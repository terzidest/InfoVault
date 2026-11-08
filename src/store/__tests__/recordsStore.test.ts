import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../authStore';
import useRecordsStore, { RecordTooLargeError } from '../recordsStore';
import { encryptRecord, generateVaultKey } from '../../utils/crypto';
import { MAX_RECORD_BYTES } from '../../utils/records';
import { readVault, vaultExists, writeVault } from '../../services/vaultFile';
import type { VaultRecordInput } from '../../types/models';

const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
  __failNextWrite: (name: string) => void;
};
const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

const VAULT = 'file:///mock/documents/vault.bin';

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
  useRecordsStore.setState({ records: [], isLoading: false, error: null, isOpen: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('open', () => {
  it('yields an empty set, and writes no file, when there is neither a vault nor v1 data', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(true);
    expect(useRecordsStore.getState().isLoading).toBe(false);
    expect(vaultExists()).toBe(false);
  });

  it('loads an existing vault file', async () => {
    const key = await unlockWith();
    const stored = [{ ...loginInput('A'), id: 'a', createdAt: 't', updatedAt: 't' }];
    await writeVault(stored, key);
    await useRecordsStore.getState().open(key);
    expect(useRecordsStore.getState().records).toEqual(stored);
  });

  it('migrates v1 entries when there is no vault file yet', async () => {
    const key = await unlockWith();
    secureStoreMock.__store.set(
      'c1',
      await encryptRecord({ id: 'c1', title: 'Bank', username: 'me', createdAt: 't', updatedAt: 't' }, key)
    );
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['c1']));
    await useRecordsStore.getState().open(key);
    const records = useRecordsStore.getState().records;
    expect(records.map((r) => [r.id, r.template])).toEqual([['c1', 'login']]);
    expect(await readVault(key)).toEqual(records);
    expect(secureStoreMock.__store.has('c1')).toBe(false);
  });

  it('surfaces a wrong key as an error and rethrows', async () => {
    const key = await unlockWith();
    await writeVault([], key);
    const other = await generateVaultKey();
    await expect(useRecordsStore.getState().open(other)).rejects.toThrow();
    expect(useRecordsStore.getState().error).not.toBeNull();
    expect(useRecordsStore.getState().isOpen).toBe(false);
  });
});

describe('mutations persist through the vault file', () => {
  it('add / update / remove / togglePin round-trip through readVault', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    const { add, update, remove, togglePin, getById } = useRecordsStore.getState();

    const a = await add(loginInput('A'));
    const b = await add(loginInput('B'));
    expect(a.id).not.toEqual(b.id);
    expect(a.createdAt).toEqual(a.updatedAt);
    expect(await readVault(key)).toEqual([a, b]);

    const a2 = await update(a.id, { title: 'A2', tags: ['x'] });
    expect(a2.title).toBe('A2');
    expect(a2.createdAt).toBe(a.createdAt);
    expect(getById(a.id)).toEqual(a2);
    expect(await readVault(key)).toEqual([a2, b]);

    const bPinned = await togglePin(b.id);
    expect(bPinned.pinned).toBe(true);
    expect((await togglePin(b.id)).pinned).toBe(false);

    expect(await remove(a.id)).toBe(true);
    expect(useRecordsStore.getState().records.map((r) => r.id)).toEqual([b.id]);
    expect((await readVault(key))?.map((r) => r.id)).toEqual([b.id]);
    expect(useRecordsStore.getState().isLoading).toBe(false);
  });

  it('update and togglePin of a missing id throw and write nothing', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    await expect(useRecordsStore.getState().update('nope', { title: 'x' })).rejects.toThrow('Record not found');
    await expect(useRecordsStore.getState().togglePin('nope')).rejects.toThrow('Record not found');
    expect(useRecordsStore.getState().error).toBe('Record not found');
    expect(vaultExists()).toBe(false);
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
    await useRecordsStore.getState().open(key);
    const first = await useRecordsStore.getState().add(loginInput('A'));
    const bytesBefore = fsMock.__files.get(VAULT);

    // The nonce draw is the await inside encodeVaultFile: lock during it.
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useAuthStore.getState().logout();
      return new Uint8Array(n);
    });
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('Vault is locked');
    expect(fsMock.__files.get(VAULT)).toBe(bytesBefore);
    expect(useRecordsStore.getState().records).toEqual([first]); // memory matches disk
  });

  it('a failed file write leaves memory and disk consistent and sets error', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    const first = await useRecordsStore.getState().add(loginInput('A'));
    fsMock.__failNextWrite('vault.bin.tmp');
    await expect(useRecordsStore.getState().add(loginInput('B'))).rejects.toThrow('simulated write failure');
    expect(useRecordsStore.getState().records).toEqual([first]);
    expect(await readVault(key)).toEqual([first]);
    expect(useRecordsStore.getState().error).toContain('simulated write failure');
  });

  it('rejects a record over MAX_RECORD_BYTES on add and on update', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    const huge = loginInput('Huge');
    huge.fields[0] = { ...huge.fields[0]!, value: 'x'.repeat(MAX_RECORD_BYTES) };
    await expect(useRecordsStore.getState().add(huge)).rejects.toThrow(RecordTooLargeError);
    expect(vaultExists()).toBe(false);

    const ok = await useRecordsStore.getState().add(loginInput('Ok'));
    await expect(useRecordsStore.getState().update(ok.id, { fields: huge.fields })).rejects.toThrow(
      RecordTooLargeError
    );
    expect(await readVault(key)).toEqual([ok]);
  });

  it('clear() empties memory but leaves the file alone', async () => {
    const key = await unlockWith();
    await useRecordsStore.getState().open(key);
    const a = await useRecordsStore.getState().add(loginInput('A'));
    useRecordsStore.getState().clear();
    expect(useRecordsStore.getState().records).toEqual([]);
    expect(useRecordsStore.getState().isOpen).toBe(false);
    expect(await readVault(key)).toEqual([a]);
  });
});
