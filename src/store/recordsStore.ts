import { create } from 'zustand';
import useAuthStore from './authStore';
import { createOpTracker } from './opTracker';
import { migrateV1 } from '../services/migrateV1';
import { commitVaultBytes, encodeVaultFile, readVault } from '../services/vaultFile';
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

// Every operation that touches the file runs through one queue: each write
// seals the full record set and goes through the same .tmp/.bak files, so two
// in flight at once would lose one's change and collide on .tmp.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

// Bumped by clear(). A task that started before a clear()/lock must not
// repopulate plaintext afterwards, so every set() re-checks it and the key.
let generation = 0;

// The in-memory key lives in authStore; read it at call-time (never at module
// load) so the import cycle stays safe and a lock is seen immediately.
const requireKey = (): Uint8Array => {
  const key = useAuthStore.getState().encryptionKey;
  if (!key) throw new Error('Vault is locked');
  return key;
};

// logout() zeroes the key bytes in place and drops the reference, so a
// reference comparison detects a lock that happened during an await.
const isCurrent = (key: Uint8Array, gen: number): boolean =>
  useAuthStore.getState().encryptionKey === key && generation === gen;

const assertSize = (record: VaultRecord): void => {
  const bytes = serializedSize(record);
  if (bytes > MAX_RECORD_BYTES) throw new RecordTooLargeError(bytes);
};

// Seals and commits the full record set. If the vault locked while we were
// sealing, the bytes were encrypted with a dead key — abort rather than
// persist an unreadable vault.
const persist = async (records: VaultRecord[], key: Uint8Array): Promise<void> => {
  const bytes = await encodeVaultFile(records, key, { kind: 'vault' });
  if (useAuthStore.getState().encryptionKey !== key) {
    throw new Error('Vault is locked');
  }
  await commitVaultBytes(bytes);
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface Mutation<T> {
  records: VaultRecord[];
  result: T;
}

const useRecordsStore = create<RecordsState>((set, get) => {
  // Runs `compute` against the records as they are once the queue reaches this
  // task (not as they were when it was called), persists, then publishes —
  // unless the vault was locked or cleared in the meantime.
  const mutate = <T>(label: string, compute: (records: VaultRecord[]) => Mutation<T>): Promise<T> =>
    enqueue(async () => {
      const gen = generation;
      let key: Uint8Array | null = null;
      ops.begin(set);
      try {
        key = requireKey();
        // Without open()'s records in memory a write would seal a near-empty
        // set over the real vault.
        if (!get().isOpen) throw new Error('Vault is not open');
        const { records, result } = compute(get().records);
        await persist(records, key);
        if (isCurrent(key, gen)) set({ records });
        return result;
      } catch (error) {
        // A lock or clear() during the write is why it failed; the caller
        // still learns the write did not happen, but it is not an error state.
        if (key !== null && !isCurrent(key, gen)) throw error;
        console.error(`Error ${label} record:`, error);
        set({ error: errorMessage(error) });
        throw error;
      } finally {
        ops.end(set);
      }
    });

  return {
    records: [],
    isLoading: false,
    error: null,
    isOpen: false,

    open: (vaultKey) =>
      enqueue(async () => {
        const gen = generation;
        ops.begin(set);
        try {
          // Always runs: it is a single registry probe when there is nothing
          // to migrate, and it retries entries an earlier pass had to leave
          // behind. It writes vault.bin itself when it migrates anything.
          const migration = await migrateV1(vaultKey).catch((error: unknown) => {
            // v1 stays put for the next unlock; the existing vault still loads.
            console.warn('v1 migration failed; will retry on the next unlock', error instanceof Error ? error.name : '');
            return null;
          });
          // readVault also recovers a vault whose last commit was interrupted
          // (vault.bin missing, .tmp/.bak present) — never gate on vaultExists.
          // No file is written here when there is none: setup/unlock (cutover
          // PR) decides that.
          const records = migration?.hadV1 ? migration.records : ((await readVault(vaultKey)) ?? []);
          if (isCurrent(vaultKey, gen)) set({ records, isOpen: true });
        } catch (error) {
          // Locked or cleared mid-open: the lock zeroed the key, so the read
          // failing is the expected consequence, not an error to surface.
          if (!isCurrent(vaultKey, gen)) return;
          console.error('Error opening the vault:', error);
          set({ error: errorMessage(error) });
          throw error;
        } finally {
          ops.end(set);
        }
      }),

    add: (input) =>
      mutate('adding', (records) => {
        const now = new Date().toISOString();
        // Spread first so a stray id/timestamp on the input can never win.
        const record: VaultRecord = { ...input, id: generateSecureId(), createdAt: now, updatedAt: now };
        assertSize(record);
        return { records: [...records, record], result: record };
      }),

    update: (id, patch) =>
      mutate('updating', (records) => {
        const existing = records.find((r) => r.id === id);
        if (!existing) throw new Error('Record not found');
        const updated: VaultRecord = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
        assertSize(updated);
        return { records: records.map((r) => (r.id === id ? updated : r)), result: updated };
      }),

    remove: (id) =>
      mutate('removing', (records) => ({ records: records.filter((r) => r.id !== id), result: true })),

    togglePin: (id) =>
      mutate('pinning', (records) => {
        const existing = records.find((r) => r.id === id);
        if (!existing) throw new Error('Record not found');
        const updated: VaultRecord = { ...existing, pinned: !existing.pinned, updatedAt: new Date().toISOString() };
        return { records: records.map((r) => (r.id === id ? updated : r)), result: updated };
      }),

    getById: (id) => get().records.find((r) => r.id === id),

    // Evicts the decrypted records from memory (lock). The file is untouched.
    // Any task still in flight sees the generation change and publishes nothing.
    clear: () => {
      generation += 1;
      set({ records: [], isOpen: false, error: null });
    },
  };
});

export default useRecordsStore;
