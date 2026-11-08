import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../authStore';
import useRecordsStore, { RecordTooLargeError } from '../recordsStore';
import { encryptRecord, generateVaultKey } from '../../utils/crypto';
import { MAX_RECORD_BYTES } from '../../utils/records';
import { isLiveKey } from '../vaultKey';
import { commitVaultBytes, encodeVault, readVaultPayload, vaultExists, writeVault } from '../../services/vaultFile';
import type { VaultRecord, VaultRecordInput } from '../../types/models';

const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
  __failNextWrite: (name: string) => void;
};
const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

const VAULT = 'file:///mock/documents/vault.bin';

const write = (records: readonly VaultRecord[], k: Uint8Array) => writeVault({ records }, k, isLiveKey);
const read = async (k: Uint8Array) => (await readVaultPayload(k))?.records ?? null;

const loginInput = (title: string): VaultRecordInput => ({
  title,
  template: 'login',
  fields: [
    { id: `${title}-u`, label: 'Username', value: 'me', kind: 'text' },
    { id: `${title}-p`, label: 'Password', value: 'hunter2', kind: 'secret' },
  ],
  pinned: false,
  tags: [],
});

const unlockWith = async () => {
  const key = await generateVaultKey();
  useAuthStore.setState({ encryptionKey: key, isAuthenticated: true });
  return key;
};

beforeEach(() => {
  fsMock.__reset();
  secureStoreMock.__reset();
  useAuthStore.setState({ encryptionKey: null, isAuthenticated: false });
  useRecordsStore.setState({ records: [], isLoading: false, error: null, isOpen: false, migrationPending: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('open', () => {
  it('yields an empty set, and seals an empty vault file, when there is neither a vault nor v1 data', async () => {
    const key = await unlockWith();
    expect(await useRecordsStore.getState().open()).toBe(true);
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(true);
    expect(useRecordsStore.getState().isLoading).toBe(false);
    expect(useRecordsStore.getState().migrationPending).toBe(false);
    // A header must never exist without a file (authStore's fresh-install rule).
    expect(vaultExists()).toBe(true);
    expect(await read(key)).toEqual([]);
  });

  it('writes the file when v1 registries exist but hold nothing to migrate', async () => {
    const key = await unlockWith();
    secureStoreMock.__store.set('credentialKeys', '[]');
    expect(await useRecordsStore.getState().open()).toBe(true);
    expect(vaultExists()).toBe(true);
    expect(await read(key)).toEqual([]);
    expect(secureStoreMock.__store.has('credentialKeys')).toBe(false);
  });

  it('does not rewrite a file that already exists on open', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    await write(stored, key);
    const bytes = fsMock.__files.get(VAULT);
    await useRecordsStore.getState().open();
    expect(fsMock.__files.get(VAULT)).toBe(bytes);
  });

  it('open(false) skips the migration entirely: no registry probe, v1 entries untouched', async () => {
    const key = await unlockWith();
    secureStoreMock.__store.set('c1', await encryptRecord({ id: 'c1', title: 'Bank', createdAt: 't', updatedAt: 't' }, key));
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['c1']));
    const probe = jest.spyOn(SecureStore, 'getItemAsync');
    expect(await useRecordsStore.getState().open(false)).toBe(true);
    expect(probe).not.toHaveBeenCalled();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().migrationPending).toBe(false);
    expect(secureStoreMock.__store.has('c1')).toBe(true);
  });

  it('loads an existing vault file', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    await write(stored, key);
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().records).toEqual(stored);
  });

  it('migrates v1 entries when there is no vault file yet', async () => {
    const key = await unlockWith();
    secureStoreMock.__store.set(
      'c1',
      await encryptRecord({ id: 'c1', title: 'Bank', username: 'me', createdAt: 't', updatedAt: 't' }, key)
    );
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['c1']));
    await useRecordsStore.getState().open();
    const records = useRecordsStore.getState().records;
    expect(records.map((r) => [r.id, r.template])).toEqual([['c1', 'login']]);
    expect(await read(key)).toEqual(records);
    expect(secureStoreMock.__store.has('c1')).toBe(false);
  });

  it('recovers a vault whose last commit was interrupted instead of starting empty', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    // Crash between moving vault.bin → .bak and .tmp → vault.bin, with a partial .tmp.
    fsMock.__files.set(`${VAULT}.bak`, await encodeVault({ records: stored }, key, { kind: 'vault' }));
    fsMock.__files.set(`${VAULT}.tmp`, new Uint8Array([0x49, 0x56]));
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().records).toEqual(stored);
    const b = await useRecordsStore.getState().add(loginInput('B'));
    expect((await read(key))?.map((r) => r.id)).toEqual(['a', b.id]);
  });

  it('retries v1 leftovers on a later open even though a vault already exists', async () => {
    const key = await unlockWith();
    const other = await generateVaultKey();
    const v1 = { id: 'c1', title: 'Bank', createdAt: 't', updatedAt: 't' };
    secureStoreMock.__store.set('c1', await encryptRecord(v1, other)); // not readable yet
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['c1']));
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().migrationPending).toBe(true); // skipped, not thrown
    expect(secureStoreMock.__store.has('c1')).toBe(true);
    const a = await useRecordsStore.getState().add(loginInput('A'));
    useRecordsStore.getState().clear();

    secureStoreMock.__store.set('c1', await encryptRecord(v1, key)); // now it decrypts
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().records.map((r) => r.id).sort()).toEqual([a.id, 'c1'].sort());
    expect(useRecordsStore.getState().migrationPending).toBe(false);
    expect(secureStoreMock.__store.size).toBe(0);
  });

  it('publishes nothing if the vault is locked or cleared while opening', async () => {
    const key = await unlockWith();
    await write([{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }], key);
    // The registry probe is the first await inside open(): lock during it.
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementationOnce(async () => {
      useAuthStore.getState().logout();
      return null;
    });
    expect(await useRecordsStore.getState().open()).toBe(false);
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    expect(useRecordsStore.getState().error).toBeNull();

    await unlockWith();
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementationOnce(async () => {
      useRecordsStore.getState().clear();
      return null;
    });
    expect(await useRecordsStore.getState().open()).toBe(false);
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    expect(useRecordsStore.getState().isLoading).toBe(false);
  });

  it('a migration failure is not fatal: the existing vault loads, v1 stays for the next unlock', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    await write(stored, key);
    secureStoreMock.__store.set('c1', await encryptRecord({ id: 'c1', title: 'Bank', createdAt: 't', updatedAt: 't' }, key));
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['c1']));
    const realGet = SecureStore.getItemAsync;
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (k, o) => {
      if (k === 'c1') throw new Error('keystore unavailable');
      return realGet(k, o);
    });
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().records).toEqual(stored);
    expect(useRecordsStore.getState().isOpen).toBe(true);
    expect(useRecordsStore.getState().error).toBeNull();
    expect(useRecordsStore.getState().migrationPending).toBe(true);
    expect(secureStoreMock.__store.has('c1')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('migration failed'), 'Error');

    // The next pass completes (the entry decrypts again): the flag clears and c1 is in.
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useRecordsStore.getState().clear();
    await useRecordsStore.getState().open();
    expect(useRecordsStore.getState().migrationPending).toBe(false);
    expect(useRecordsStore.getState().records.map((r) => r.id).sort()).toEqual(['a', 'c1']);
    expect(secureStoreMock.__store.has('c1')).toBe(false);
  });

  it('throws while locked and opens nothing', async () => {
    await expect(useRecordsStore.getState().open()).rejects.toThrow('Vault is locked');
    expect(useRecordsStore.getState().isOpen).toBe(false);
    expect(useRecordsStore.getState().error).toBe('Vault is locked');
  });

  it('starts from nothing: a failed re-open leaves no stale records and refuses mutations', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const a = await useRecordsStore.getState().add(loginInput('A'));
    expect(useRecordsStore.getState().records).toEqual([a]);

    const bytes = fsMock.__files.get(VAULT) ?? new Uint8Array();
    const corrupt = new Uint8Array(bytes);
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    fsMock.__files.set(VAULT, corrupt);
    await expect(useRecordsStore.getState().open()).rejects.toThrow();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is not open');
    expect(fsMock.__files.get(VAULT)).toBe(corrupt); // nothing was written over it
    expect(key.length).toBe(32);
  });

  it('a lock (logout) evicts the records and refuses the mutation in flight', async () => {
    await unlockWith();
    await useRecordsStore.getState().open();
    await useRecordsStore.getState().add(loginInput('A'));
    expect(useRecordsStore.getState().records).toHaveLength(1);
    useAuthStore.getState().logout();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    // The generation moved on: a mutation is refused rather than resumed.
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is locked');
    await unlockWith();
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is not open');
  });

  it('surfaces a wrong key as an error and rethrows', async () => {
    await commitVaultBytes(await encodeVault({ records: [] }, await generateVaultKey(), { kind: 'vault' }));
    await unlockWith(); // the live key is not the one the file was sealed under
    await expect(useRecordsStore.getState().open()).rejects.toThrow();
    expect(useRecordsStore.getState().error).not.toBeNull();
    expect(useRecordsStore.getState().isOpen).toBe(false);
  });
});

describe('mutations persist through the vault file', () => {
  it('add / update / remove / togglePin round-trip through readVault', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const { add, update, remove, togglePin, getById } = useRecordsStore.getState();

    const a = await add(loginInput('A'));
    const b = await add(loginInput('B'));
    expect(a.id).not.toEqual(b.id);
    expect(a.createdAt).toEqual(a.updatedAt);
    expect(await read(key)).toEqual([a, b]);

    const a2 = await update(a.id, { title: 'A2', tags: ['x'] });
    expect(a2.title).toBe('A2');
    expect(a2.createdAt).toBe(a.createdAt);
    expect(getById(a.id)).toEqual(a2);
    expect(await read(key)).toEqual([a2, b]);

    const bPinned = await togglePin(b.id);
    expect(bPinned.pinned).toBe(true);
    expect((await togglePin(b.id)).pinned).toBe(false);

    expect(await remove(a.id)).toBe(true);
    expect(useRecordsStore.getState().records.map((r) => r.id)).toEqual([b.id]);
    expect((await read(key))?.map((r) => r.id)).toEqual([b.id]);
    expect(useRecordsStore.getState().isLoading).toBe(false);
  });

  it('serializes concurrent mutations so none is lost', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const { add, update, remove } = useRecordsStore.getState();
    const [a, b, c] = await Promise.all([add(loginInput('A')), add(loginInput('B')), add(loginInput('C'))]);
    expect(useRecordsStore.getState().records.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect((await read(key))?.map((r) => r.id)).toEqual([a.id, b.id, c.id]);

    // The queued update sees the record the queued add created before it.
    const results = await Promise.all([remove(a.id), update(b.id, { title: 'B2' }), add(loginInput('D'))]);
    expect(results[1].title).toBe('B2');
    expect((await read(key))?.map((r) => r.title)).toEqual(['B2', 'C', 'D']);
    expect(useRecordsStore.getState().isLoading).toBe(false);
  });

  it('a mutation whose write lands after clear() is not published and does not resolve', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useRecordsStore.getState().clear();
      return new Uint8Array(n);
    });
    await expect(useRecordsStore.getState().add(loginInput('A'))).rejects.toThrow('Vault is locked');
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().error).toBeNull();
    expect((await read(key))?.map((r) => r.title)).toEqual(['A']); // the key was live, so the write stands
  });

  it('togglePin runs the same validation as every mutation (size cap at the boundary)', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const a = await useRecordsStore.getState().add({ ...loginInput('A'), pinned: true });
    // ASCII only, so chars == bytes. `"pinned":false` is one byte longer than
    // `"pinned":true`: a pinned record sitting exactly at the cap cannot be unpinned.
    const size = (r: VaultRecord) => JSON.stringify(r).length;
    const base = await useRecordsStore.getState().update(a.id, { tags: [''] });
    const slack = MAX_RECORD_BYTES - size(base);
    const atCap = await useRecordsStore.getState().update(a.id, { tags: ['x'.repeat(slack)] });
    expect(size(atCap)).toBe(MAX_RECORD_BYTES);
    await expect(useRecordsStore.getState().togglePin(a.id)).rejects.toThrow(RecordTooLargeError);
    expect((await read(key))?.[0]?.pinned).toBe(true);
    // One byte of room and it goes through.
    const fits = await useRecordsStore.getState().update(a.id, { tags: ['x'.repeat(slack - 1)] });
    expect(size(fits)).toBe(MAX_RECORD_BYTES - 1);
    const unpinned = await useRecordsStore.getState().togglePin(a.id);
    expect(unpinned.pinned).toBe(false);
    expect(size(unpinned)).toBe(MAX_RECORD_BYTES);
  });

  it('update strips id and createdAt from the patch', async () => {
    await unlockWith();
    await useRecordsStore.getState().open();
    const a = await useRecordsStore.getState().add(loginInput('A'));
    const forged = { id: 'forged', createdAt: 'x', title: 'A2' } as unknown as Partial<VaultRecordInput>;
    const updated = await useRecordsStore.getState().update(a.id, forged);
    expect(updated.id).toBe(a.id);
    expect(updated.createdAt).toBe(a.createdAt);
    expect(updated.title).toBe('A2');
    expect(useRecordsStore.getState().records.map((r) => r.id)).toEqual([a.id]);
  });

  it('update, remove and togglePin of a missing id throw and write nothing', async () => {
    await unlockWith();
    await useRecordsStore.getState().open();
    const bytes = fsMock.__files.get(VAULT);
    await expect(useRecordsStore.getState().update('nope', { title: 'x' })).rejects.toThrow('Record not found');
    await expect(useRecordsStore.getState().remove('nope')).rejects.toThrow('Record not found');
    await expect(useRecordsStore.getState().togglePin('nope')).rejects.toThrow('Record not found');
    expect(useRecordsStore.getState().error).toBe('Record not found');
    expect(fsMock.__files.get(VAULT)).toBe(bytes); // the empty vault open() sealed, untouched
  });

  it('refuses to mutate before open() succeeded, so a stale vault is never overwritten', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    fsMock.__files.set(`${VAULT}.bak`, await encodeVault({ records: stored }, key, { kind: 'vault' }));
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is not open');
    await expect(useRecordsStore.getState().remove('a')).rejects.toThrow('Vault is not open');
    expect(fsMock.__files.has(VAULT)).toBe(false);
    expect(await read(key)).toEqual(stored);
    useRecordsStore.getState().clear();
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is not open');
  });

  it('ignores a stray id or timestamps on the add() input', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const stray = { ...loginInput('A'), id: 'forged', createdAt: 'x', updatedAt: 'y' } as VaultRecordInput;
    const a = await useRecordsStore.getState().add(stray);
    expect(a.id).not.toBe('forged');
    expect(a.createdAt).not.toBe('x');
    expect((await read(key))?.[0]?.id).toBe(a.id);
  });

  it('refuses to mutate while locked and writes nothing', async () => {
    useRecordsStore.setState({ records: [], isOpen: true });
    await expect(useRecordsStore.getState().add(loginInput('A'))).rejects.toThrow('Vault is locked');
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().error).toBe('Vault is locked');
    expect(fsMock.__files.size).toBe(0);
  });

  it('abandons a write when the vault locks while the file is being sealed', async () => {
    const key = await unlockWith();
    const keyCopy = new Uint8Array(key); // logout() zeroes `key` in place
    await useRecordsStore.getState().open();
    const first = await useRecordsStore.getState().add(loginInput('A'));
    const bytesBefore = fsMock.__files.get(VAULT);

    // The nonce draw is the await inside encodeVault: lock during it.
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useAuthStore.getState().logout();
      return new Uint8Array(n);
    });
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is locked');
    expect(fsMock.__files.get(VAULT)).toBe(bytesBefore);
    // The lock evicted memory; disk still holds exactly the acknowledged set.
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(await read(keyCopy)).toEqual([first]);
    expect(useRecordsStore.getState().error).toBeNull(); // the lock is not an error state
  });

  it('a failed file write leaves memory and disk consistent and sets error', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const first = await useRecordsStore.getState().add(loginInput('A'));
    fsMock.__failNextWrite('vault.bin.tmp');
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('simulated write failure');
    expect(useRecordsStore.getState().records).toEqual([first]);
    expect(await read(key)).toEqual([first]);
    expect(useRecordsStore.getState().error).toContain('simulated write failure');
  });

  it('rejects a record over MAX_RECORD_BYTES on add and on update', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const huge = loginInput('Huge');
    huge.fields[0] = { ...huge.fields[0]!, value: 'x'.repeat(MAX_RECORD_BYTES) };
    await expect(useRecordsStore.getState().add(huge)).rejects.toThrow(RecordTooLargeError);
    expect(await read(key)).toEqual([]);

    const ok = await useRecordsStore.getState().add(loginInput('Ok'));
    await expect(useRecordsStore.getState().update(ok.id, { fields: huge.fields })).rejects.toThrow(
      RecordTooLargeError
    );
    expect(await read(key)).toEqual([ok]);
  });

  it('clear() empties memory but leaves the file alone', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open();
    const a = await useRecordsStore.getState().add(loginInput('A'));
    useRecordsStore.getState().clear();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    expect(await read(key)).toEqual([a]);
  });
});
