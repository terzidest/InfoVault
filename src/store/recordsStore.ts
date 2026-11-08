import { create } from 'zustand';
import useAuthStore from './authStore';
import { createOpTracker } from './opTracker';
import { migrateV1 } from '../services/migrateV1';
import { errorMessage, requireKey } from '../services/secureStorage';
import { isVaultRecord, readVault, writeVault } from '../services/vaultFile';
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
  // Loads the vault under the key authStore currently holds.
  open: () => Promise<void>;
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

// Bumped by clear() and at the start of open(). A task that started before
// must not publish afterwards, so every set() re-checks it and the key.
let generation = 0;

// logout() zeroes the key bytes in place and drops the reference, so a
// reference comparison detects a lock that happened during an await.
const isCurrent = (key: Uint8Array, gen: number): boolean =>
  useAuthStore.getState().encryptionKey === key && generation === gen;

const assertSize = (record: VaultRecord): void => {
  const bytes = serializedSize(record);
  if (bytes > MAX_RECORD_BYTES) throw new RecordTooLargeError(bytes);
};

// `{ title: undefined }` must not punch a hole in the record.
const withoutUndefined = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;

const assertValid = (record: VaultRecord): void => {
  if (!isVaultRecord(record)) throw new Error('Record is invalid');
  assertSize(record);
};

const nowIso = (): string => new Date().toISOString();

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
        await writeVault(records, key); // lock-checked after sealing
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

    open: () =>
      enqueue(async () => {
        // Start from nothing: whatever an earlier open left behind is stale,
        // and a task from before this point must not publish into this one.
        generation += 1;
        const gen = generation;
        set({ records: [], isOpen: false, error: null });
        let key: Uint8Array | null = null;
        ops.begin(set);
        try {
          key = requireKey();
          // Always runs: it is one registry probe when there is nothing to
          // migrate, and it retries entries an earlier pass had to leave
          // behind. It writes vault.bin itself when it migrates anything.
          const migration = await migrateV1(key).catch((error: unknown) => {
            // v1 stays put for the next unlock; the existing vault still loads.
            console.warn('v1 migration failed; will retry on the next unlock', error instanceof Error ? error.name : '');
            return null;
          });
          // readVault also recovers a vault whose last commit was interrupted
          // (vault.bin missing, .bak present) — never gate on vaultExists.
          // No file is written here when there is none: setup/unlock (cutover
          // PR) decides that.
          const records = migration?.hadV1 ? migration.records : ((await readVault(key)) ?? []);
          if (isCurrent(key, gen)) set({ records, isOpen: true });
        } catch (error) {
          // Locked or cleared mid-open: the lock zeroed the key, so the read
          // failing is the expected consequence, not an error to surface.
          if (key !== null && !isCurrent(key, gen)) return;
          console.error('Error opening the vault:', error);
          set({ error: errorMessage(error) });
          throw error;
        } finally {
          ops.end(set);
        }
      }),

    add: (input) =>
      mutate('adding', (records) => {
        const now = nowIso();
        // Spread first so a stray id/timestamp on the input can never win.
        const record: VaultRecord = { ...input, id: generateSecureId(), createdAt: now, updatedAt: now };
        assertValid(record);
        return { records: [...records, record], result: record };
      }),

    update: (id, patch) =>
      mutate('updating', (records) => {
        const existing = records.find((r) => r.id === id);
        if (!existing) throw new Error('Record not found');
        const updated: VaultRecord = { ...existing, ...withoutUndefined(patch), id, updatedAt: nowIso() };
        assertValid(updated);
        return { records: records.map((r) => (r.id === id ? updated : r)), result: updated };
      }),

    remove: (id) =>
      mutate('removing', (records) => ({ records: records.filter((r) => r.id !== id), result: true })),

    togglePin: (id) =>
      mutate('pinning', (records) => {
        const existing = records.find((r) => r.id === id);
        if (!existing) throw new Error('Record not found');
        const updated: VaultRecord = { ...existing, pinned: !existing.pinned, updatedAt: nowIso() };
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

// Locking must evict the decrypted records even before the cutover wires
// clear() into logout(): follow authStore and clear whenever the session ends.
useAuthStore.subscribe((state, previous) => {
  const lockedNow = (previous.isAuthenticated && !state.isAuthenticated) || (previous.encryptionKey && !state.encryptionKey);
  if (lockedNow) useRecordsStore.getState().clear();
});

export default useRecordsStore;
