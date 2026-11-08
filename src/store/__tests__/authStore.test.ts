import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import useAuthStore from '../authStore';
import useCredentialsStore from '../credentialsStore';
import * as crypto from '../../utils/crypto';
import { decryptRecord, encryptRecord, parseVaultHeader } from '../../utils/crypto';
import type { KdfParams } from '../../utils/crypto';

// The manual mock (see __mocks__/) exposes test-only helpers beyond the real
// module's surface. It must be reached through the same import the code under
// test uses, so the in-memory store is one instance.
const secureStoreMock = SecureStore as unknown as {
  __store: Map<string, string>;
  __reset: () => void;
  __setAuthGate: (mode: 'allow' | 'deny' | 'cancel') => void;
  __failNextSet: (key: string) => void;
  __authGatedWrites: () => number;
};

const HEADER_KEY = 'vaultHeader';
const LEGACY_SALT_KEY = 'vaultSalt';
const LEGACY_VERIFIER_KEY = 'vaultVerifier';
const BIOMETRIC_KEY_STORE = 'vaultBiometricKey';
const BIOMETRIC_ENABLED_KEY = 'vaultBiometricEnabled';
const SETUP_KEY = 'setupComplete';

const FAST_PBKDF2: KdfParams = { alg: 'pbkdf2-sha256', iterations: 500 };
const FAST_ARGON2: KdfParams = { alg: 'argon2id', memoryKiB: 256, passes: 1, parallelism: 1 };

const silenceConsole = () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
};

const lock = () => useAuthStore.getState().logout();

// Builds a vault exactly as the pre-header (v1.0.0) setup code wrote it:
// PBKDF2 100k → key, verifier = sentinel sealed under that key, records
// sealed under the same key, biometric copy = the key itself.
const seedLegacyVault = async (password: string) => {
  const salt = await crypto.generateSalt();
  const legacyKey = pbkdf2(sha256, utf8ToBytes(password), hexToBytes(salt), {
    c: 100_000,
    dkLen: 32,
  });
  const store = secureStoreMock.__store;
  store.set(LEGACY_SALT_KEY, salt);
  store.set(LEGACY_VERIFIER_KEY, await encryptRecord('infovault-verifier-v1', legacyKey));
  store.set('cred-1', await encryptRecord({ id: 'cred-1', title: 'Gmail', password: 'hunter2' }, legacyKey));
  store.set('credentialKeys', JSON.stringify(['cred-1']));
  store.set(BIOMETRIC_KEY_STORE, bytesToHex(legacyKey));
  store.set(BIOMETRIC_ENABLED_KEY, 'true');
  store.set(SETUP_KEY, 'true');
  return { salt, legacyKey };
};

beforeEach(() => {
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
  });
  silenceConsole();
});

describe('legacy (salt + verifier) vault migration', () => {
  it('rejects a wrong password and does not migrate', async () => {
    await seedLegacyVault('correct-pw');
    await useAuthStore.getState().init();
    expect(await useAuthStore.getState().unlockWithPassword('wrong')).toBe(false);
    expect(useAuthStore.getState().authError).toBe('Incorrect master password');
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(true);
  });

  it('unlocks, keeps the legacy key as the vault key, writes a header under a fresh salt, deletes legacy entries', async () => {
    const { salt, legacyKey } = await seedLegacyVault('correct-pw');
    await useAuthStore.getState().init();
    expect(await useAuthStore.getState().unlockWithPassword('correct-pw')).toBe(true);

    const key = useAuthStore.getState().encryptionKey;
    expect(key && bytesToHex(key)).toEqual(bytesToHex(legacyKey));

    const header = parseVaultHeader(secureStoreMock.__store.get(HEADER_KEY) ?? '');
    expect(header.kdf).toEqual(FAST_PBKDF2);
    expect(header.salt).not.toEqual(salt);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_VERIFIER_KEY)).toBe(false);

    // Existing records still decrypt under the vault key.
    const rec = decryptRecord<{ title: string }>(secureStoreMock.__store.get('cred-1') ?? '', key ?? new Uint8Array());
    expect(rec.title).toBe('Gmail');
  });

  it('the stored biometric copy still opens the vault after migration', async () => {
    await seedLegacyVault('correct-pw');
    await useAuthStore.getState().init();
    await useAuthStore.getState().unlockWithPassword('correct-pw');
    lock();
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(true);
    const key = useAuthStore.getState().encryptionKey ?? new Uint8Array();
    expect(decryptRecord<{ title: string }>(secureStoreMock.__store.get('cred-1') ?? '', key).title).toBe('Gmail');
  });

  it('retries the migration on the next unlock if the header write failed', async () => {
    await seedLegacyVault('correct-pw');
    await useAuthStore.getState().init();
    secureStoreMock.__failNextSet(HEADER_KEY);
    expect(await useAuthStore.getState().unlockWithPassword('correct-pw')).toBe(true);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(false);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(true); // legacy intact
    lock();
    expect(await useAuthStore.getState().unlockWithPassword('correct-pw')).toBe(true);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(false);
  });
});

describe('header vault', () => {
  it('setup writes a header and no legacy entries, and wipes pre-existing records', async () => {
    secureStoreMock.__store.set('cred-stale', 'plaintext-junk');
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['cred-stale']));
    secureStoreMock.__store.set(LEGACY_SALT_KEY, 'aa');
    expect(await useAuthStore.getState().setupMasterPassword('fresh-pass-123')).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(secureStoreMock.__store.has(HEADER_KEY)).toBe(true);
    expect(secureStoreMock.__store.has(LEGACY_SALT_KEY)).toBe(false);
    expect(secureStoreMock.__store.has('cred-stale')).toBe(false);
    expect(secureStoreMock.__store.get(SETUP_KEY)).toBe('true');
  });

  it('unlocks with the right password only, and the vault key is stable across unlocks', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    const first = bytesToHex(useAuthStore.getState().encryptionKey ?? new Uint8Array());
    lock();
    expect(await useAuthStore.getState().unlockWithPassword('nope')).toBe(false);
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(true);
    expect(bytesToHex(useAuthStore.getState().encryptionKey ?? new Uint8Array())).toEqual(first);
  });

  it('re-wraps the vault key when the header KDF is older than CURRENT_KDF, without touching records', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    const key = useAuthStore.getState().encryptionKey ?? new Uint8Array();
    const keyHex = bytesToHex(key); // lock() zeroes `key` in place below
    secureStoreMock.__store.set('cred-1', await encryptRecord({ title: 'x' }, key));
    const before = secureStoreMock.__store.get(HEADER_KEY);
    lock();

    jest.replaceProperty(crypto, 'CURRENT_KDF', FAST_ARGON2);
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(true);
    const after = secureStoreMock.__store.get(HEADER_KEY) ?? '';
    expect(after).not.toEqual(before);
    expect(parseVaultHeader(after).kdf).toEqual(FAST_ARGON2);
    const key2 = useAuthStore.getState().encryptionKey ?? new Uint8Array();
    expect(bytesToHex(key2)).toEqual(keyHex);
    expect(decryptRecord<{ title: string }>(secureStoreMock.__store.get('cred-1') ?? '', key2).title).toBe('x');

    // Already current: no rewrite.
    lock();
    await useAuthStore.getState().unlockWithPassword('fresh-pass-123');
    expect(secureStoreMock.__store.get(HEADER_KEY)).toEqual(after);
    lock();
    expect(await useAuthStore.getState().unlockWithPassword('wrong')).toBe(false);
  });

  it('fails closed on a tampered or malformed header', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    lock();
    const raw = JSON.parse(secureStoreMock.__store.get(HEADER_KEY) ?? '{}') as { wrappedKey: string };
    const wk = raw.wrappedKey;
    raw.wrappedKey = wk.slice(0, -1) + (wk.endsWith('0') ? '1' : '0');
    secureStoreMock.__store.set(HEADER_KEY, JSON.stringify(raw));
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    secureStoreMock.__store.set(HEADER_KEY, '{"version":2,"kdf":{"alg":"md5"}}');
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('reports "not set up" when neither header nor legacy entries exist', async () => {
    expect(await useAuthStore.getState().unlockWithPassword('anything')).toBe(false);
    expect(useAuthStore.getState().authError).toBe('Vault is not set up');
  });
});

describe('lock', () => {
  it('zeroes the key bytes, drops the key, and evicts decrypted records', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    const key = useAuthStore.getState().encryptionKey ?? new Uint8Array();
    useCredentialsStore.setState({ credentials: [{ id: '1', title: 't', createdAt: '', updatedAt: '' }] });
    lock();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().encryptionKey).toBeNull();
    expect(key.every((b) => b === 0)).toBe(true);
    expect(useCredentialsStore.getState().credentials).toEqual([]);
  });

  it('checkTimeout locks after the idle window and not before', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    expect(useAuthStore.getState().checkTimeout(60_000)).toBe(false);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    expect(useAuthStore.getState().checkTimeout(60_000)).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('biometrics', () => {
  it('enable stores the key copy behind the auth gate; a cancelled prompt leaves the vault locked', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    expect(await useAuthStore.getState().enableBiometricUnlock()).toBe(true);
    expect(secureStoreMock.__store.get(BIOMETRIC_ENABLED_KEY)).toBe('true');
    lock();
    secureStoreMock.__setAuthGate('cancel');
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    secureStoreMock.__setAuthGate('allow');
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(true);
  });

  it('self-heals an invalidated keystore entry on the next password unlock', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    await useAuthStore.getState().enableBiometricUnlock();
    expect(secureStoreMock.__authGatedWrites()).toBe(1);
    lock();
    // OS invalidated the entry (enrollment change): gated read returns nothing.
    secureStoreMock.__store.delete(BIOMETRIC_KEY_STORE);
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(false);
    expect(useAuthStore.getState().biometricRepairNeeded).toBe(true);
    await useAuthStore.getState().init();
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(true);
    await Promise.resolve(); // the re-store is fire-and-forget
    await Promise.resolve();
    expect(secureStoreMock.__store.has(BIOMETRIC_KEY_STORE)).toBe(true);
    expect(secureStoreMock.__authGatedWrites()).toBe(2); // exactly one repair write
    expect(useAuthStore.getState().biometricRepairNeeded).toBe(false);
    lock();
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(true);
  });

  it('a normal password unlock never writes the biometric copy (no prompt on Home)', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    await useAuthStore.getState().enableBiometricUnlock();
    expect(secureStoreMock.__authGatedWrites()).toBe(1);
    for (let i = 0; i < 3; i += 1) {
      lock();
      await useAuthStore.getState().init();
      expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(true);
      await Promise.resolve();
    }
    expect(secureStoreMock.__authGatedWrites()).toBe(1);
  });

  it('a dismissed biometric prompt is not treated as a broken entry', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    await useAuthStore.getState().enableBiometricUnlock();
    lock();
    secureStoreMock.__setAuthGate('cancel');
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(false);
    expect(useAuthStore.getState().biometricRepairNeeded).toBe(false);
    secureStoreMock.__setAuthGate('allow');
    await useAuthStore.getState().init();
    expect(await useAuthStore.getState().unlockWithPassword('fresh-pass-123')).toBe(true);
    await Promise.resolve();
    expect(secureStoreMock.__authGatedWrites()).toBe(1);
  });

  it('an unreadable entry (non-cancel error) queues a repair; disabling biometrics clears it', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    await useAuthStore.getState().enableBiometricUnlock();
    lock();
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('Could not decrypt the item'));
    expect(await useAuthStore.getState().unlockWithBiometrics()).toBe(false);
    expect(useAuthStore.getState().biometricRepairNeeded).toBe(true);
    await useAuthStore.getState().init();
    await useAuthStore.getState().unlockWithPassword('fresh-pass-123');
    await useAuthStore.getState().disableBiometricUnlock();
    expect(useAuthStore.getState().biometricRepairNeeded).toBe(false);
  });

  it('disable removes the copy and the flag', async () => {
    await useAuthStore.getState().setupMasterPassword('fresh-pass-123');
    await useAuthStore.getState().enableBiometricUnlock();
    await useAuthStore.getState().disableBiometricUnlock();
    expect(secureStoreMock.__store.has(BIOMETRIC_KEY_STORE)).toBe(false);
    expect(secureStoreMock.__store.has(BIOMETRIC_ENABLED_KEY)).toBe(false);
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('enable requires an unlocked vault', async () => {
    expect(await useAuthStore.getState().enableBiometricUnlock()).toBe(false);
    expect(useAuthStore.getState().authError).toMatch(/unlocked/);
  });
});

describe('init', () => {
  it('needsSetup reflects the setup flag and biometricEnabled requires enrolment', async () => {
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().needsSetup).toBe(true);
    secureStoreMock.__store.set(SETUP_KEY, 'true');
    secureStoreMock.__store.set(BIOMETRIC_ENABLED_KEY, 'true');
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().needsSetup).toBe(false);
    expect(useAuthStore.getState().biometricEnabled).toBe(true);
  });

  it('a read error never routes to setup (which would wipe records)', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('keystore busy'));
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().needsSetup).toBe(false);
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });
});
