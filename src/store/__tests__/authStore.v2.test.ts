import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import useAuthStore from '../authStore';
import useRecordsStore from '../recordsStore';
import * as crypto from '../../utils/crypto';
import { encryptRecord, generateVaultKey } from '../../utils/crypto';
import type { KdfParams } from '../../utils/crypto';
import { isLiveKey } from '../vaultKey';
import { encodeVault, readVaultPayload, vaultExists, writeVault } from '../../services/vaultFile';
import type { VaultRecord } from '../../types/models';

// The cutover wiring: authStore owns the vault file's lifecycle (fresh-install
// detection, the empty file at setup, open() on every unlock, clear() on
// lock). Crypto and stores are real; SecureStore and the file system are the
// in-memory mocks from __mocks__/.

const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
};
const secureStoreMock = SecureStore as unknown as {
  __store: Map<string, string>;
  __reset: () => void;
  __setAuthGate: (mode: 'allow' | 'deny' | 'cancel') => void;
};

const VAULT = 'file:///mock/documents/vault.bin';
const HEADER_KEY = 'vaultHeader';
const LEGACY_SALT_KEY = 'vaultSalt';
const LEGACY_VERIFIER_KEY = 'vaultVerifier';
const BIOMETRIC_KEY_STORE = 'vaultBiometricKey';
const BIOMETRIC_ENABLED_KEY = 'vaultBiometricEnabled';
const SETUP_KEY = 'setupComplete';
const VAULT_KEYS = [HEADER_KEY, LEGACY_SALT_KEY, LEGACY_VERIFIER_KEY, BIOMETRIC_KEY_STORE, BIOMETRIC_ENABLED_KEY, SETUP_KEY];

const FAST_PBKDF2: KdfParams = { alg: 'pbkdf2-sha256', iterations: 500 };

const auth = () => useAuthStore.getState();
const records = () => useRecordsStore.getState();
const lock = () => auth().logout();

const record = (id: string, title: string): VaultRecord => ({
  id,
  title,
  template: 'login',
  fields: [{ id: `${id}-p`, label: 'Password', value: 'hunter2', kind: 'secret' }],
  pinned: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// A v1.0.0 device: PBKDF2 100k key, verifier, per-record SecureStore entries
// sealed under that key, biometric copy = the key itself. No header, no file.
const seedV1Device = async (password: string) => {
  const salt = await crypto.generateSalt();
  const legacyKey = pbkdf2(sha256, utf8ToBytes(password), hexToBytes(salt), { c: 100_000, dkLen: 32 });
  const store = secureStoreMock.__store;
  store.set(LEGACY_SALT_KEY, salt);
  store.set(LEGACY_VERIFIER_KEY, await encryptRecord('infovault-verifier-v1', legacyKey));
  store.set(
    'cred-1',
    await encryptRecord(
      { id: 'cred-1', title: 'Gmail', username: 'me@example.com', password: 'hunter2', createdAt: 't', updatedAt: 't' },
      legacyKey
    )
  );
  store.set('credentialKeys', JSON.stringify(['cred-1']));
  store.set('note-1', await encryptRecord({ id: 'note-1', title: 'Standup', content: '10:00', category: 'Work' }, legacyKey));
  store.set('noteKeys', JSON.stringify(['note-1']));
  store.set(BIOMETRIC_KEY_STORE, bytesToHex(legacyKey));
  store.set(BIOMETRIC_ENABLED_KEY, 'true');
  store.set(SETUP_KEY, 'true');
  return legacyKey;
};

beforeEach(() => {
  fsMock.__reset();
  secureStoreMock.__reset();
  jest.replaceProperty(crypto, 'CURRENT_KDF', FAST_PBKDF2);
  useAuthStore.setState({
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    authError: null,
    needsSetup: false,
    encryptionKey: null,
    biometricAvailable: false,
    biometricEnabled: false,
    biometricRepairNeeded: false,
    isOpeningVault: false,
    isMigrating: false,
  });
  useRecordsStore.setState({ records: [], isLoading: false, error: null, isOpen: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('init: fresh-install rule', () => {
  it('header + setup flag + biometric copy, but no vault file and no v1 data → everything cleared, setup', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    await auth().enableBiometricUnlock();
    lock();
    // Reinstall on iOS: the Keychain survived, the document directory did not.
    fsMock.__reset();
    await auth().init();
    expect(auth().needsSetup).toBe(true);
    expect(auth().biometricEnabled).toBe(false);
    for (const key of VAULT_KEYS) expect(secureStoreMock.__store.has(key)).toBe(false);
  });

  it('a header left by an interrupted setup (no setup flag) is cleared too', async () => {
    secureStoreMock.__store.set(HEADER_KEY, '{"version":2}');
    await auth().init();
    expect(auth().needsSetup).toBe(true);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(false);
  });

  it('header + no file, but v1 registries exist → not fresh (a v1 device about to migrate)', async () => {
    await seedV1Device('pw');
    await auth().init();
    expect(auth().needsSetup).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(true);
    expect(secureStoreMock.__store.has(BIOMETRIC_KEY_STORE)).toBe(true);
  });

  it('header + vault file → not fresh', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    lock();
    await auth().init();
    expect(auth().needsSetup).toBe(false);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
  });

  it('header + only a .bak left by an interrupted commit → not fresh (the backup is the vault)', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    lock();
    const bytes = fsMock.__files.get(VAULT) ?? new Uint8Array();
    fsMock.__files.delete(VAULT);
    fsMock.__files.set(`${VAULT}.bak`, bytes);
    await auth().init();
    expect(auth().needsSetup).toBe(false);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
  });

  it('a read error never routes to setup', async () => {
    secureStoreMock.__store.set(SETUP_KEY, 'true');
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('keystore busy'));
    await auth().init();
    expect(auth().needsSetup).toBe(false);
    expect(secureStoreMock.__store.has(SETUP_KEY)).toBe(true);
  });
});

describe('setup', () => {
  it('removes a stale vault file, writes an empty one under the new key, opens it and authenticates', async () => {
    // A vault.bin sealed under a key nobody holds any more.
    fsMock.__files.set(VAULT, await encodeVault({ records: [record('x', 'Old')] }, await generateVaultKey(), { kind: 'vault' }));
    fsMock.__files.set(`${VAULT}.bak`, new Uint8Array([1, 2, 3]));

    expect(await auth().setupMasterPassword('fresh-pass-123')).toBe(true);
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().isOpeningVault).toBe(false);
    expect(records().isOpen).toBe(true);
    expect(records().records).toEqual([]);
    expect(fsMock.__files.has(`${VAULT}.bak`)).toBe(false);
    const key = auth().encryptionKey ?? new Uint8Array();
    expect(await readVaultPayload(key)).toEqual({ records: [], migratedV1Ids: [] });

    // The empty file is a real vault: the first add goes through it.
    const a = await records().add({ title: 'A', template: 'note', fields: [], pinned: false, tags: [] });
    expect((await readVaultPayload(key))?.records).toEqual([a]);
  });

  it('a failure after the header is written leaves no key, no session and an error', async () => {
    jest.spyOn(FileSystem.File.prototype, 'write').mockRejectedValueOnce(new Error('disk full'));
    expect(await auth().setupMasterPassword('fresh-pass-123')).toBe(false);
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().encryptionKey).toBeNull();
    expect(auth().authError).toBe('Could not set up your vault');
    expect(records().isOpen).toBe(false);
    // The next launch sees a header with no vault: setup again.
    await auth().init();
    expect(auth().needsSetup).toBe(true);
  });
});

describe('unlock', () => {
  it('password unlock loads the records from the file', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    const key = auth().encryptionKey ?? new Uint8Array();
    await writeVault({ records: [record('a', 'A'), record('b', 'B')] }, key, isLiveKey);
    lock();
    expect(records().records).toEqual([]);

    expect(await auth().unlockWithPassword('fresh-pass-123')).toBe(true);
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().isOpeningVault).toBe(false);
    expect(auth().isMigrating).toBe(false);
    expect(records().isOpen).toBe(true);
    expect(records().records.map((r) => r.title)).toEqual(['A', 'B']);
  });

  it('isAuthenticated flips only after the records are open', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    lock();
    const seen: boolean[] = [];
    const unsubscribe = useAuthStore.subscribe((s) => {
      if (s.isAuthenticated) seen.push(useRecordsStore.getState().isOpen);
    });
    await auth().unlockWithPassword('fresh-pass-123');
    unsubscribe();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
  });

  it('a wrong password opens nothing', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    lock();
    expect(await auth().unlockWithPassword('nope')).toBe(false);
    expect(auth().authError).toBe('Incorrect master password');
    expect(records().isOpen).toBe(false);
  });

  it('v1.0.0 layout: one password unlock migrates the header AND the records, then v1 entries are gone', async () => {
    const legacyKey = await seedV1Device('correct-pw');
    await auth().init();
    expect(auth().needsSetup).toBe(false);

    expect(await auth().unlockWithPassword('correct-pw')).toBe(true);
    expect(auth().isAuthenticated).toBe(true);
    expect(bytesToHex(auth().encryptionKey ?? new Uint8Array())).toEqual(bytesToHex(legacyKey));

    // Header migration.
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_VERIFIER_KEY)).toBe(false);

    // Record migration.
    expect(vaultExists()).toBe(true);
    const titles = records().records.map((r) => [r.id, r.template, r.title]);
    expect(titles).toEqual([
      ['cred-1', 'login', 'Gmail'],
      ['note-1', 'note', 'Standup'],
    ]);
    expect(records().records.find((r) => r.id === 'note-1')?.tags).toEqual(['work']);
    expect(secureStoreMock.__store.has('cred-1')).toBe(false);
    expect(secureStoreMock.__store.has('note-1')).toBe(false);
    expect(secureStoreMock.__store.has('credentialKeys')).toBe(false);
    expect(secureStoreMock.__store.has('noteKeys')).toBe(false);
    expect(auth().isMigrating).toBe(false);

    // And the file is what the next unlock reads.
    lock();
    expect(await auth().unlockWithPassword('correct-pw')).toBe(true);
    expect(records().records.map((r) => r.id)).toEqual(['cred-1', 'note-1']);
  });

  it('v1.0.0 layout: a biometric-first unlock migrates the records too (header waits for a password)', async () => {
    await seedV1Device('correct-pw');
    await auth().init();
    expect(await auth().unlockWithBiometrics()).toBe(true);
    expect(auth().isAuthenticated).toBe(true);
    expect(records().records.map((r) => r.id)).toEqual(['cred-1', 'note-1']);
    expect(vaultExists()).toBe(true);
    expect(secureStoreMock.__store.has('cred-1')).toBe(false);
    // The header migration needs the password; the legacy entries still open the vault.
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(true);

    lock();
    expect(await auth().unlockWithPassword('correct-pw')).toBe(true);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
    expect(records().records.map((r) => r.id)).toEqual(['cred-1', 'note-1']);
  });

  it('isMigrating is on while a v1 device opens and off afterwards', async () => {
    await seedV1Device('correct-pw');
    await auth().init();
    const flags: boolean[] = [];
    const unsubscribe = useAuthStore.subscribe((s) => flags.push(s.isMigrating));
    await auth().unlockWithPassword('correct-pw');
    unsubscribe();
    expect(flags).toContain(true);
    expect(auth().isMigrating).toBe(false);
  });

  it('a vault that cannot be opened keeps the session locked, drops the key and reports a neutral error', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    await auth().enableBiometricUnlock();
    lock();
    const bytes = fsMock.__files.get(VAULT) ?? new Uint8Array();
    const corrupt = new Uint8Array(bytes);
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    fsMock.__files.set(VAULT, corrupt);

    expect(await auth().unlockWithPassword('fresh-pass-123')).toBe(false);
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().encryptionKey).toBeNull();
    expect(auth().isOpeningVault).toBe(false);
    expect(auth().isLoading).toBe(false);
    expect(auth().authError).toBe('Vault could not be opened');
    expect(records().isOpen).toBe(false);
    expect(records().records).toEqual([]);
    expect(fsMock.__files.get(VAULT)).toBe(corrupt); // nothing was written over it

    // Same through biometrics.
    expect(await auth().unlockWithBiometrics()).toBe(false);
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().encryptionKey).toBeNull();
    expect(auth().authError).toBe('Vault could not be opened');
  });

  it('a cancelled biometric prompt leaves authError alone', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    await auth().enableBiometricUnlock();
    lock();
    secureStoreMock.__setAuthGate('cancel');
    expect(await auth().unlockWithBiometrics()).toBe(false);
    expect(auth().authError).toBeNull();
  });
});

describe('lock', () => {
  it('clears the records, zeroes the key and leaves the file alone', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    const key = auth().encryptionKey ?? new Uint8Array();
    const keyCopy = new Uint8Array(key);
    await records().add({ title: 'A', template: 'note', fields: [], pinned: false, tags: [] });
    expect(records().records).toHaveLength(1);

    lock();
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().encryptionKey).toBeNull();
    expect(key.every((b) => b === 0)).toBe(true);
    expect(records().records).toEqual([]);
    expect(records().isOpen).toBe(false);
    expect((await readVaultPayload(keyCopy))?.records.map((r) => r.title)).toEqual(['A']);
  });

  it('the idle timeout locks the same way', async () => {
    await auth().setupMasterPassword('fresh-pass-123');
    await records().add({ title: 'A', template: 'note', fields: [], pinned: false, tags: [] });
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    expect(auth().checkTimeout(60_000)).toBe(true);
    expect(records().records).toEqual([]);
    expect(auth().encryptionKey).toBeNull();
  });
});
