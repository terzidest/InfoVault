import * as SecureStore from 'expo-secure-store';

export type StorageType = 'credential' | 'note' | 'personalInfo';

// The v1 (pre-2.0) record layout in SecureStore: one sealed entry per record
// at its own id, plus a JSON id registry per type (`credentialKeys`, ...).
// Nothing writes this layout any more. The v2 migration (migrateV1.ts) reads
// it and setup wipes it; this module is the only place that spells its names
// and the only parser of its registries.

export const STORAGE_TYPES: readonly StorageType[] = ['credential', 'note', 'personalInfo'];

export const registryKey = (type: StorageType): string => `${type}Keys`;

export interface Registry {
  type: StorageType;
  raw: string;
}

/** One parallel read of the three registries; the only probe there is. */
export const readRegistries = async (): Promise<Registry[]> => {
  const raws = await Promise.all(STORAGE_TYPES.map((type) => SecureStore.getItemAsync(registryKey(type))));
  const found: Registry[] = [];
  STORAGE_TYPES.forEach((type, i) => {
    const raw = raws[i];
    if (raw !== null && raw !== undefined) found.push({ type, raw });
  });
  return found;
};

/**
 * The ids a registry names, or null when it is corrupt (not JSON, not an
 * array, or any non-string id). A corrupt registry is always left in place
 * along with everything it names: deleting it would orphan those entries.
 */
export const parseRegistry = (raw: string): string[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
};

// Deletes every v1 record entry across all types and the registries
// themselves (corrupt registries excepted, see parseRegistry). Needs no key:
// it only removes. Used by setup so a fresh vault never inherits entries
// sealed under a key nobody holds any more.
export const wipeAllRecords = async (): Promise<void> => {
  for (const { type, raw } of await readRegistries()) {
    const ids = parseRegistry(raw);
    if (ids === null) continue;
    for (const id of ids) {
      await SecureStore.deleteItemAsync(id);
    }
    await SecureStore.deleteItemAsync(registryKey(type));
  }
};
