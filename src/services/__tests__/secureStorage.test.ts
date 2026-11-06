import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../../store/authStore';
import { generateVaultKey } from '../../utils/crypto';
import {
  deleteFromSecureStore,
  getAllItemsByType,
  getFromSecureStore,
  getKeysByType,
  saveToSecureStore,
  wipeAllRecords,
} from '../secureStorage';

const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

const unlockWith = async () => {
  const key = await generateVaultKey();
  useAuthStore.setState({ encryptionKey: key, isAuthenticated: true });
  return key;
};

beforeEach(() => {
  secureStoreMock.__reset();
  useAuthStore.setState({ encryptionKey: null, isAuthenticated: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('encrypted record storage', () => {
  it('saves ciphertext, registers the key once, and reads the record back', async () => {
    await unlockWith();
    const record = { id: 'n1', title: 'Bike lock', content: '4421' };
    expect(await saveToSecureStore('n1', record, 'note')).toBe(true);
    expect(await saveToSecureStore('n1', record, 'note')).toBe(true);

    const raw = secureStoreMock.__store.get('n1') ?? '';
    expect(raw.startsWith('v1:')).toBe(true);
    expect(raw).not.toContain('4421');
    expect(await getKeysByType('note')).toEqual(['n1']);
    expect(await getFromSecureStore('n1')).toEqual(record);
  });

  it('delete removes the entry and its registry slot', async () => {
    await unlockWith();
    await saveToSecureStore('a', { id: 'a' }, 'credential');
    await saveToSecureStore('b', { id: 'b' }, 'credential');
    await deleteFromSecureStore('a', 'credential');
    expect(secureStoreMock.__store.has('a')).toBe(false);
    expect(await getKeysByType('credential')).toEqual(['b']);
  });

  it('getAllItemsByType skips a record it cannot read instead of failing the load', async () => {
    await unlockWith();
    await saveToSecureStore('ok', { id: 'ok' }, 'personalInfo');
    secureStoreMock.__store.set('bad', 'v1:00:00');
    secureStoreMock.__store.set('personalInfoKeys', JSON.stringify(['ok', 'bad']));
    expect(await getAllItemsByType('personalInfo')).toEqual([{ id: 'ok' }]);
  });

  it('refuses to read or write while the vault is locked', async () => {
    await expect(getFromSecureStore('x')).resolves.toBeNull(); // nothing stored → null before key check
    secureStoreMock.__store.set('x', 'v1:00:00');
    await expect(getFromSecureStore('x')).rejects.toThrow('Vault is locked');
    await expect(saveToSecureStore('y', { id: 'y' }, 'note')).rejects.toThrow('Vault is locked');
    expect(secureStoreMock.__store.has('y')).toBe(false);
  });

  it('abandons a write if the vault locked while the record was being sealed', async () => {
    await unlockWith();
    // The nonce draw is the await inside encryptRecord: lock during it.
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useAuthStore.getState().logout();
      return new Uint8Array(n);
    });
    await expect(saveToSecureStore('late', { id: 'late' }, 'note')).rejects.toThrow('Vault is locked');
    expect(secureStoreMock.__store.has('late')).toBe(false);
    expect(await getKeysByType('note')).toEqual([]);
  });

  it('wipeAllRecords clears every type and registry and needs no key', async () => {
    await unlockWith();
    await saveToSecureStore('c', { id: 'c' }, 'credential');
    await saveToSecureStore('n', { id: 'n' }, 'note');
    useAuthStore.setState({ encryptionKey: null, isAuthenticated: false });
    await wipeAllRecords();
    expect([...secureStoreMock.__store.keys()]).toEqual([]);
  });
});
