import * as SecureStore from 'expo-secure-store';
import { decryptRecord, generateSecureId } from '../utils/crypto';
import { fromV1Credential, fromV1Note, fromV1PersonalInfo } from '../utils/records';
import { readVault, vaultExists, writeVault } from './vaultFile';
import type { Credential, Note, PersonalInfo, VaultRecord } from '../types/models';
import type { StorageType } from '../types/storage';

// One-shot v1 → v2 storage migration: the per-record SecureStore entries
// (sealed under the vault key by v1's secureStorage) become records in
// vault.bin. Takes the key explicitly rather than going through authStore:
// after a v1.0.0 → v2 update a biometric-first unlock has the key but no
// header yet, and the key is all this needs.
//
// Never deletes a v1 entry before vault.bin holds its replacement. An entry
// that cannot be decrypted is left in place (and its registry kept, listing
// only the leftovers) so nothing is lost silently; the next unlock retries.

const REGISTRY_KEY: Record<StorageType, string> = {
  credential: 'credentialKeys',
  note: 'noteKeys',
  personalInfo: 'personalInfoKeys',
};

const TYPES: readonly StorageType[] = ['credential', 'note', 'personalInfo'];

export interface MigrationResult {
  migrated: number;
  skipped: number;
  records: VaultRecord[];
}

const readRegistry = async (type: StorageType): Promise<string[] | null> => {
  const raw = await SecureStore.getItemAsync(REGISTRY_KEY[type]);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const hasV1Data = async (): Promise<boolean> => {
  for (const type of TYPES) {
    if ((await SecureStore.getItemAsync(REGISTRY_KEY[type])) !== null) return true;
  }
  return false;
};

const isV1Item = (value: unknown): value is { id: string; title: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { title?: unknown }).title === 'string';

const mapV1 = (type: StorageType, item: unknown): VaultRecord | null => {
  if (!isV1Item(item)) return null;
  switch (type) {
    case 'credential':
      return fromV1Credential(item as Credential, generateSecureId);
    case 'note':
      return fromV1Note(item as Note, generateSecureId);
    case 'personalInfo':
      return fromV1PersonalInfo(item as PersonalInfo, generateSecureId);
  }
};

interface RegistryPlan {
  type: StorageType;
  // Entries to delete from SecureStore once the vault is written.
  done: string[];
  // Entries that stay (undecryptable); the registry is rewritten to just these.
  leftover: string[];
}

const timestamp = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

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
  const incoming: VaultRecord[] = [];
  const plans: RegistryPlan[] = [];
  let skipped = 0;

  for (const type of TYPES) {
    const ids = await readRegistry(type);
    if (ids === null) continue;
    const plan: RegistryPlan = { type, done: [], leftover: [] };
    for (const id of ids) {
      const sealed = await SecureStore.getItemAsync(id);
      if (sealed === null) {
        // Dangling registry id: nothing to carry over, nothing to keep.
        plan.done.push(id);
        continue;
      }
      let record: VaultRecord | null = null;
      try {
        record = mapV1(type, decryptRecord<unknown>(sealed, vaultKey));
      } catch {
        record = null;
      }
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

  const existing = vaultExists() ? ((await readVault(vaultKey)) ?? []) : [];
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

  return { migrated: incoming.length, skipped, records };
};
