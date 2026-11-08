import * as SecureStore from 'expo-secure-store';
import { decryptRecord, generateSecureId } from '../utils/crypto';
import { fromV1Credential, fromV1Note, fromV1PersonalInfo, timestamp } from '../utils/records';
import { isVaultRecord, readVault, writeVault } from './vaultFile';
import type { Credential, Note, PersonalInfo, VaultRecord } from '../types/models';
import type { StorageType } from '../types/storage';

// v1 → v2 storage migration: the per-record SecureStore entries (sealed under
// the vault key by v1's secureStorage) become records in vault.bin. Takes the
// key explicitly rather than going through authStore: after a v1.0.0 → v2
// update a biometric-first unlock has the key but no header yet, and the key
// is all this needs.
//
// Runs on every open (a single registry probe when there is nothing left) so
// that entries an earlier pass had to leave behind are retried. Never deletes
// a v1 entry before vault.bin holds its replacement. An entry that cannot be
// decrypted or does not map to a valid record is left in place, with its
// registry rewritten to list only the leftovers; a corrupt registry is left
// untouched along with every entry it names. Anything unexpected (a storage
// read failing, a write failing) aborts the whole pass before any deletion.

const REGISTRY_KEY: Record<StorageType, string> = {
  credential: 'credentialKeys',
  note: 'noteKeys',
  personalInfo: 'personalInfoKeys',
};

const TYPES: readonly StorageType[] = ['credential', 'note', 'personalInfo'];

export interface MigrationResult {
  // False when no v1 registry exists at all; `records` is then empty and the
  // vault file was not read.
  hadV1: boolean;
  migrated: number;
  skipped: number;
  records: VaultRecord[];
}

export const hasV1Data = async (): Promise<boolean> => {
  for (const type of TYPES) {
    if ((await SecureStore.getItemAsync(REGISTRY_KEY[type])) !== null) return true;
  }
  return false;
};

const parseRegistry = (raw: string): string[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
};

const isV1Item = (value: unknown): value is { id: string; title: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { title?: unknown }).title === 'string';

const mapV1 = (type: StorageType, item: unknown): VaultRecord | null => {
  if (!isV1Item(item)) return null;
  let record: VaultRecord;
  switch (type) {
    case 'credential':
      record = fromV1Credential(item as Credential, generateSecureId);
      break;
    case 'note':
      record = fromV1Note(item as Note, generateSecureId);
      break;
    case 'personalInfo':
      record = fromV1PersonalInfo(item as PersonalInfo, generateSecureId);
      break;
  }
  // A v1 entry missing e.g. createdAt would produce a record that vault.bin
  // rejects on every later read — after the v1 copy was deleted. Keep it.
  return isVaultRecord(record) ? record : null;
};

// What a bad sealed value throws: our own format check, @noble's GCM tag /
// length checks, hex decoding, and JSON parsing of the plaintext. Anything
// else (a failing native read, a programming error) is not a property of the
// data and must abort the pass rather than strand the entry.
const DATA_ERROR = /Unrecognized sealed-data format|invalid tag|expected length|hex|padding/i;
const isDataError = (error: unknown): boolean =>
  error instanceof SyntaxError || (error instanceof Error && DATA_ERROR.test(error.message));

const decryptV1 = (type: StorageType, sealed: string, key: Uint8Array): VaultRecord | null => {
  try {
    return mapV1(type, decryptRecord<unknown>(sealed, key));
  } catch (error) {
    if (isDataError(error)) return null;
    throw error;
  }
};

interface RegistryPlan {
  type: StorageType;
  // Entries to delete from SecureStore once the vault is written.
  done: string[];
  // Entries that stay (undecryptable / unmappable); the registry is rewritten to just these.
  leftover: string[];
}

// Existing wins only when strictly newer; otherwise the v1 copy wins. Running
// twice is therefore harmless: the second pass sees equal timestamps.
const merge = (existing: readonly VaultRecord[], incoming: readonly VaultRecord[]): VaultRecord[] => {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const record of incoming) {
    const current = byId.get(record.id);
    if (!current || timestamp(current.updatedAt) <= timestamp(record.updatedAt)) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
};

export const migrateV1 = async (vaultKey: Uint8Array): Promise<MigrationResult> => {
  const registries: { type: StorageType; raw: string }[] = [];
  for (const type of TYPES) {
    const raw = await SecureStore.getItemAsync(REGISTRY_KEY[type]);
    if (raw !== null) registries.push({ type, raw });
  }
  if (registries.length === 0) return { hadV1: false, migrated: 0, skipped: 0, records: [] };

  const incoming: VaultRecord[] = [];
  const plans: RegistryPlan[] = [];
  let skipped = 0;
  let corruptRegistries = 0;

  for (const { type, raw } of registries) {
    const ids = parseRegistry(raw);
    if (ids === null) {
      // Deleting it would orphan every entry it names; leave the whole type.
      corruptRegistries += 1;
      continue;
    }
    const plan: RegistryPlan = { type, done: [], leftover: [] };
    for (const id of ids) {
      const sealed = await SecureStore.getItemAsync(id);
      if (sealed === null) {
        // Dangling registry id: nothing to carry over, nothing to keep.
        plan.done.push(id);
        continue;
      }
      const record = decryptV1(type, sealed, vaultKey);
      if (record) {
        incoming.push(record);
        plan.done.push(id);
      } else {
        skipped += 1;
        plan.leftover.push(id);
      }
    }
    plans.push(plan);
  }

  // readVault (not a vaultExists gate) so a vault whose last commit was
  // interrupted is recovered and merged with, never overwritten.
  const existing = (await readVault(vaultKey)) ?? [];
  const records = incoming.length > 0 ? merge(existing, incoming) : existing;
  if (incoming.length > 0) {
    await writeVault(records, vaultKey);
  }

  // Only now is it safe to let go of the v1 copies. Deletion failures are
  // tolerated: a leftover entry is simply migrated again (idempotently) next
  // time.
  for (const plan of plans) {
    try {
      for (const id of plan.done) {
        await SecureStore.deleteItemAsync(id);
      }
      if (plan.leftover.length === 0) {
        await SecureStore.deleteItemAsync(REGISTRY_KEY[plan.type]);
      } else {
        await SecureStore.setItemAsync(REGISTRY_KEY[plan.type], JSON.stringify(plan.leftover));
      }
    } catch {
      console.warn(`v1 migration: could not clean up ${plan.type} entries`);
    }
  }

  if (skipped > 0) {
    console.warn(`v1 migration: ${skipped} record(s) could not be read and were left in place`);
  }
  if (corruptRegistries > 0) {
    console.warn(`v1 migration: ${corruptRegistries} registry(ies) unreadable and left in place`);
  }

  return { hadV1: true, migrated: incoming.length, skipped, records };
};
