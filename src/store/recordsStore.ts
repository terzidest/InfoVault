import { create } from 'zustand';
import { createOpTracker } from './opTracker';
import { isLiveKey, requireKey } from './vaultKey';
import { migrateV1 } from '../services/migrateV1';
import { readVaultPayload, vaultExists, writeVault } from '../services/vaultFile';
import { generateSecureId } from '../utils/crypto';
import { errorMessage } from '../utils/errors';
import { MAX_RECORD_BYTES, serializedSize, touchRecord } from '../utils/records';
import { isVaultRecord } from '../utils/vaultFormat';
import type { VaultRecord, VaultRecordInput } from '../types/models';

// The v2 record store: every record of every template, held decrypted in
// memory while the vault is unlocked and persisted as one sealed file
// (services/vaultFile.ts). authStore drives it: unlock/setup call open(),
// logout() calls clear(). This module must not touch authStore at load time
// (authStore imports it; a module-level use would run against a half-loaded
// module) — the key is read at call time through vaultKey.ts.

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
  // True when the last open() left v1 entries behind: the migration threw, or
  // it could not convert some entries (skipped). Cleared by the next open()
  // whose pass completes with nothing left over. Home shows a notice while set.
  migrationPending: boolean;
  // Loads the vault under the key authStore currently holds. `hasLegacyData`
  // is init()'s registry probe: when false the v1 migration is skipped
  // entirely (no second probe). Resolves true when the records were
  // published, false when the open was abandoned because the vault locked or
  // was cleared meanwhile (not an error).
  open: (hasLegacyData?: boolean) => Promise<boolean>;
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

// v1 ids the migration has converted; carried through every write so a
// retried migration does not resurrect a record deleted in v2. Not secret,
// nothing renders it, so it stays out of the reactive state.
let migratedV1Ids: string[] = [];

// logout() zeroes the key bytes in place and drops the reference, so a
// reference comparison detects a lock that happened during an await.
const isCurrent = (key: Uint8Array, gen: number): boolean => isLiveKey(key) && generation === gen;

const assertSize = (record: VaultRecord): void => {
  const bytes = serializedSize(record);
  if (bytes > MAX_RECORD_BYTES) throw new RecordTooLargeError(bytes);
};

// Only the user-editable part of a record may come in through a patch:
// `{ title: undefined }` must not punch a hole, and identity/creation fields
// are the store's to set.
const sanitizePatch = (patch: Partial<VaultRecordInput>): Partial<VaultRecordInput> => {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = patch as Partial<VaultRecord>;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<VaultRecordInput>;
};

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
  // task (not as they were when it was called), validates every record (shape
  // and size cap), persists, then publishes — unless the vault was locked or
  // cleared in the meantime.
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
        records.forEach(assertValid);
        await writeVault({ records, migratedV1Ids }, key, isLiveKey); // lock-checked after sealing
        // The write stands on disk, but the lock already evicted memory: the
        // caller must not treat this as a published change (and navigate on).
        if (!isCurrent(key, gen)) throw new Error('Vault is locked');
        set({ records });
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

  const findOrThrow = (records: VaultRecord[], id: string): VaultRecord => {
    const existing = records.find((r) => r.id === id);
    if (!existing) throw new Error('Record not found');
    return existing;
  };

  return {
    records: [],
    isLoading: false,
    error: null,
    isOpen: false,
    migrationPending: false,

    open: (hasLegacyData = true) =>
      enqueue(async () => {
        // Start from nothing: whatever an earlier open left behind is stale,
        // and a task from before this point must not publish into this one.
        generation += 1;
        const gen = generation;
        migratedV1Ids = [];
        set({ records: [], isOpen: false, error: null });
        let key: Uint8Array | null = null;
        ops.begin(set);
        try {
          key = requireKey();
          // Runs whenever init() saw v1 registries, so entries an earlier pass
          // had to leave behind are retried. It writes vault.bin itself when
          // it migrates anything. `null` = it threw; v1 stays for next time.
          const migration = hasLegacyData
            ? await migrateV1(key, isLiveKey).catch((error: unknown) => {
                // v1 stays put for the next unlock; the existing vault still loads.
                console.warn('v1 migration failed; will retry on the next unlock', error instanceof Error ? error.name : '');
                return null;
              })
            : undefined;
          const migrationPending = migration === null || (migration !== undefined && migration.skipped > 0);
          // readVaultPayload also recovers a vault whose last commit was
          // interrupted — never gate on vaultExists for the read.
          const stored = migration?.hadV1 ? migration : await readVaultPayload(key);
          if (!isCurrent(key, gen)) return false;
          const records = stored?.records ?? [];
          migratedV1Ids = stored?.migratedV1Ids ?? [];
          // A vault file must exist whenever a header does: authStore.init()
          // reads "header but no file" as a reinstall and wipes the header. A
          // v1 install with nothing to migrate (empty or absent registries)
          // reaches here with no file, so seal the (possibly empty) set now.
          if (!vaultExists()) {
            await writeVault({ records, migratedV1Ids }, key, isLiveKey);
            if (!isCurrent(key, gen)) return false;
          }
          set({ records, isOpen: true, migrationPending });
          return true;
        } catch (error) {
          // Locked or cleared mid-open: the lock zeroed the key, so the read
          // failing is the expected consequence, not an error to surface.
          if (key !== null && !isCurrent(key, gen)) return false;
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
        return { records: [...records, record], result: record };
      }),

    update: (id, patch) =>
      mutate('updating', (records) => {
        const existing = findOrThrow(records, id);
        const updated = touchRecord({ ...existing, ...sanitizePatch(patch) }, nowIso());
        return { records: records.map((r) => (r.id === id ? updated : r)), result: updated };
      }),

    remove: (id) =>
      mutate('removing', (records) => {
        findOrThrow(records, id);
        return { records: records.filter((r) => r.id !== id), result: true };
      }),

    togglePin: (id) =>
      mutate('pinning', (records) => {
        const existing = findOrThrow(records, id);
        const updated = touchRecord({ ...existing, pinned: !existing.pinned }, nowIso());
        return { records: records.map((r) => (r.id === id ? updated : r)), result: updated };
      }),

    getById: (id) => get().records.find((r) => r.id === id),

    // Evicts the decrypted records from memory (lock). The file is untouched.
    // Any task still in flight sees the generation change and publishes nothing.
    clear: () => {
      generation += 1;
      migratedV1Ids = [];
      set({ records: [], isOpen: false, error: null });
    },
  };
});

export default useRecordsStore;
