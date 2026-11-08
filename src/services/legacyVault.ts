import * as SecureStore from 'expo-secure-store';
import type { StorageType } from '../types/storage';

// The v1 (pre-2.0) record layout in SecureStore: one sealed entry per record
// at its own id, plus a JSON id registry per type (`credentialKeys`, ...).
// Nothing writes this layout any more. The v2 migration (migrateV1.ts) reads
// it and setup wipes it; this module is the only place that spells its names.

export const STORAGE_TYPES: readonly StorageType[] = ['credential', 'note', 'personalInfo'];

export const registryKey = (type: StorageType): string => `${type}Keys`;

const readRegistryIds = async (type: StorageType): Promise<string[]> => {
  try {
    const raw = (await SecureStore.getItemAsync(registryKey(type))) ?? '[]';
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

// Deletes every v1 record entry across all types and the registries
// themselves. Needs no key: it only removes. Used by setup so a fresh vault
// never inherits entries sealed under a key nobody holds any more.
export const wipeAllRecords = async (): Promise<void> => {
  for (const type of STORAGE_TYPES) {
    const ids = await readRegistryIds(type);
    for (const id of ids) {
      await SecureStore.deleteItemAsync(id);
    }
    await SecureStore.deleteItemAsync(registryKey(type));
  }
};
