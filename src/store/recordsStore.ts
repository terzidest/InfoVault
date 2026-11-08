import { create } from 'zustand';
import useAuthStore from './authStore';
import { createOpTracker } from './opTracker';
import { hasV1Data, migrateV1 } from '../services/migrateV1';
import { commitVaultBytes, encodeVaultFile, readVault, vaultExists } from '../services/vaultFile';
import { generateSecureId } from '../utils/crypto';
import { MAX_RECORD_BYTES, serializedSize } from '../utils/records';
import type { VaultRecord, VaultRecordInput } from '../types/models';

// The v2 record store: every record of every template, held decrypted in
// memory while the vault is unlocked and persisted as one sealed file
// (services/vaultFile.ts). Not yet wired into unlock — the cutover PR does
// that; until then the three v1 domain stores remain what the screens use.

export class RecordTooLargeError extends Error {
  constructor(bytes: number) {
    super(`Record is ${bytes} bytes; the limit is ${MAX_RECORD_BYTES}`);
    this.name = 'RecordTooLargeError';
  }
}

export interface RecordsState {
  records: VaultRecord[];
  isLoading: boolean;
  error: string | null;
  // True once open() has populated `records` for the current unlock.
  isOpen: boolean;
  open: (vaultKey: Uint8Array) => Promise<void>;
  add: (input: VaultRecordInput) => Promise<VaultRecord>;
  update: (id: string, patch: Partial<VaultRecordInput>) => Promise<VaultRecord>;
  remove: (id: string) => Promise<boolean>;
  togglePin: (id: string) => Promise<VaultRecord>;
  getById: (id: string) => VaultRecord | undefined;
  clear: () => void;
}

const ops = createOpTracker();

// The in-memory key lives in authStore; read it at call-time (never at module
// load) so the import cycle stays safe and a lock is seen immediately.
const requireKey = (): Uint8Array => {
  const key = useAuthStore.getState().encryptionKey;
  if (!key) throw new Error('Vault is locked');
  return key;
};

const assertSize = (record: VaultRecord): void => {
  const bytes = serializedSize(record);
  if (bytes > MAX_RECORD_BYTES) throw new RecordTooLargeError(bytes);
};

// Seals and commits the full record set. logout() zeroes the key bytes in
// place; if the vault locked while we were sealing, the bytes were encrypted
// with a dead key — abort rather than persist an unreadable vault.
const persist = async (records: VaultRecord[]): Promise<void> => {
  const key = requireKey();
  const bytes = await encodeVaultFile(records, key, { kind: 'vault' });
  if (useAuthStore.getState().encryptionKey !== key) {
    throw new Error('Vault is locked');
  }
  await commitVaultBytes(bytes);
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const useRecordsStore = create<RecordsState>((set, get) => ({
  records: [],
  isLoading: false,
  error: null,
  isOpen: false,

  open: async (vaultKey) => {
    ops.begin(set);
    try {
      let records: VaultRecord[];
      if (vaultExists()) {
        records = (await readVault(vaultKey)) ?? [];
      } else if (await hasV1Data()) {
        // Writes vault.bin itself and leaves un-migratable v1 entries in place.
        records = (await migrateV1(vaultKey)).records;
      } else {
        // No file is written here: setup/unlock (cutover PR) decides that.
        records = [];
      }
      set({ records, isOpen: true });
    } catch (error) {
      console.error('Error opening the vault:', error);
      set({ error: errorMessage(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  add: async (input) => {
    ops.begin(set);
    try {
      const now = new Date().toISOString();
      const record: VaultRecord = { id: generateSecureId(), ...input, createdAt: now, updatedAt: now };
      assertSize(record);

      const records = [...get().records, record];
      await persist(records);
      set({ records });
      return record;
    } catch (error) {
      console.error('Error adding record:', error);
      set({ error: errorMessage(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  update: async (id, patch) => {
    ops.begin(set);
    try {
      const existing = get().records.find((r) => r.id === id);
      if (!existing) throw new Error('Record not found');

      const updated: VaultRecord = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
      assertSize(updated);

      const records = get().records.map((r) => (r.id === id ? updated : r));
      await persist(records);
      set({ records });
      return updated;
    } catch (error) {
      console.error('Error updating record:', error);
      set({ error: errorMessage(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  remove: async (id) => {
    ops.begin(set);
    try {
      const records = get().records.filter((r) => r.id !== id);
      await persist(records);
      set({ records });
      return true;
    } catch (error) {
      console.error('Error removing record:', error);
      set({ error: errorMessage(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  togglePin: async (id) => {
    const existing = get().records.find((r) => r.id === id);
    if (!existing) {
      set({ error: 'Record not found' });
      throw new Error('Record not found');
    }
    return get().update(id, { pinned: !existing.pinned });
  },

  getById: (id) => get().records.find((r) => r.id === id),

  // Evicts the decrypted records from memory (lock). The file is untouched.
  clear: () => {
    set({ records: [], isOpen: false, error: null });
  },
}));

export default useRecordsStore;
