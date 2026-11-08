import * as Crypto from 'expo-crypto';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import {
  CURRENT_KDF,
  LEGACY_KDF,
  decryptRecord,
  deriveKey,
  encryptRecord,
  generateSalt,
  generateVaultKey,
  isSameKdf,
  parseVaultHeader,
  serializeVaultHeader,
  unwrapVaultKey,
  verifyKey,
  wrapVaultKey,
} from '../crypto';
import type { KdfParams, VaultHeader } from '../crypto';

// Small iteration counts keep the suite fast; the KDF itself is cross-checked
// against Node's implementation below, so correctness doesn't depend on 100k.
const FAST_PBKDF2: KdfParams = { alg: 'pbkdf2-sha256', iterations: 1000 };
const SMALL_ARGON2: KdfParams = { alg: 'argon2id', memoryKiB: 256, passes: 1, parallelism: 1 };

const nodeCrypto = jest.requireActual<{
  pbkdf2Sync: (p: string, s: Uint8Array, c: number, len: number, digest: string) => Uint8Array;
}>('crypto');

describe('record encryption (AES-256-GCM)', () => {
  it('round-trips an arbitrary JSON value under a random key', async () => {
    const key = await generateVaultKey();
    const value = { title: 'ΑΦΜ', fields: [{ label: 'number', value: '123456789' }], n: 3 };
    const sealed = await encryptRecord(value, key);
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(decryptRecord<typeof value>(sealed, key)).toEqual(value);
  });

  it('uses a fresh nonce per seal, so identical plaintexts differ on disk', async () => {
    const key = await generateVaultKey();
    const a = await encryptRecord('same', key);
    const b = await encryptRecord('same', key);
    expect(a).not.toEqual(b);
  });

  it('refuses a tampered ciphertext and a wrong key', async () => {
    const key = await generateVaultKey();
    const other = await generateVaultKey();
    const sealed = await encryptRecord({ secret: 'x' }, key);
    const [v, nonce, ct] = sealed.split(':') as [string, string, string];
    const flipped = ct.slice(0, -1) + (ct.endsWith('0') ? '1' : '0');
    expect(() => decryptRecord(`${v}:${nonce}:${flipped}`, key)).toThrow();
    expect(() => decryptRecord(sealed, other)).toThrow();
  });

  it('rejects an unrecognised seal format', async () => {
    const key = await generateVaultKey();
    expect(() => decryptRecord('v2:aa:bb', key)).toThrow('Unrecognized sealed-data format');
    expect(() => decryptRecord('garbage', key)).toThrow('Unrecognized sealed-data format');
  });
});

describe('key derivation', () => {
  it('generates 16-byte hex salts and 32-byte vault keys from the CSPRNG', async () => {
    const spy = jest.spyOn(Crypto, 'getRandomBytesAsync');
    const salt = await generateSalt();
    const key = await generateVaultKey();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toHaveLength(32);
    expect(spy).toHaveBeenCalledWith(16);
    expect(spy).toHaveBeenCalledWith(32);
  });

  it('PBKDF2-SHA256 matches Node for the same inputs', async () => {
    const saltHex = '73616c74'; // "salt"
    const ours = await deriveKey('passwd', saltHex, FAST_PBKDF2);
    const theirs = nodeCrypto.pbkdf2Sync('passwd', utf8ToBytes('salt'), 1000, 32, 'sha256');
    expect(bytesToHex(ours)).toEqual(bytesToHex(new Uint8Array(theirs)));
  });

  it('Argon2id derives a 32-byte key deterministically and differs from PBKDF2', async () => {
    const saltHex = await generateSalt();
    const a = await deriveKey('pw', saltHex, SMALL_ARGON2);
    const b = await deriveKey('pw', saltHex, SMALL_ARGON2);
    const p = await deriveKey('pw', saltHex, FAST_PBKDF2);
    expect(a).toHaveLength(32);
    expect(bytesToHex(a)).toEqual(bytesToHex(b));
    expect(bytesToHex(a)).not.toEqual(bytesToHex(p));
  });

  it('a different salt or password changes the key', async () => {
    const s1 = await generateSalt();
    const s2 = await generateSalt();
    const k1 = await deriveKey('pw', s1, FAST_PBKDF2);
    const k2 = await deriveKey('pw', s2, FAST_PBKDF2);
    const k3 = await deriveKey('pw2', s1, FAST_PBKDF2);
    expect(bytesToHex(k1)).not.toEqual(bytesToHex(k2));
    expect(bytesToHex(k1)).not.toEqual(bytesToHex(k3));
  });

  it('LEGACY_KDF is pinned to what pre-header vaults were derived with', () => {
    expect(LEGACY_KDF).toEqual({ alg: 'pbkdf2-sha256', iterations: 100_000 });
    expect(['pbkdf2-sha256', 'argon2id']).toContain(CURRENT_KDF.alg);
  });

  it('isSameKdf compares algorithm and every parameter', () => {
    expect(isSameKdf(FAST_PBKDF2, { alg: 'pbkdf2-sha256', iterations: 1000 })).toBe(true);
    expect(isSameKdf(FAST_PBKDF2, { alg: 'pbkdf2-sha256', iterations: 1001 })).toBe(false);
    expect(isSameKdf(FAST_PBKDF2, SMALL_ARGON2)).toBe(false);
    expect(isSameKdf(SMALL_ARGON2, { ...SMALL_ARGON2 })).toBe(true);
    expect(isSameKdf(SMALL_ARGON2, { ...SMALL_ARGON2, passes: 2 })).toBe(false);
  });
});

describe('vault key wrapping', () => {
  it('unwraps with the right wrapping key and returns null otherwise', async () => {
    const vaultKey = await generateVaultKey();
    const wrapping = await deriveKey('pw', await generateSalt(), FAST_PBKDF2);
    const wrong = await deriveKey('pw!', await generateSalt(), FAST_PBKDF2);
    const wrapped = await wrapVaultKey(vaultKey, wrapping);
    expect(bytesToHex(unwrapVaultKey(wrapped, wrapping) ?? new Uint8Array())).toEqual(bytesToHex(vaultKey));
    expect(unwrapVaultKey(wrapped, wrong)).toBeNull();
  });

  it('returns null for a tampered wrapped key and throws on a malformed one', async () => {
    const vaultKey = await generateVaultKey();
    const wrapping = await deriveKey('pw', await generateSalt(), FAST_PBKDF2);
    const wrapped = await wrapVaultKey(vaultKey, wrapping);
    const tampered = wrapped.slice(0, -1) + (wrapped.endsWith('0') ? '1' : '0');
    expect(unwrapVaultKey(tampered, wrapping)).toBeNull();
    expect(() => unwrapVaultKey('nope', wrapping)).toThrow('Unrecognized wrapped-key format');
  });

  it('a record sealed with the vault key cannot be opened with the wrapping key (domain separation)', async () => {
    const vaultKey = await generateVaultKey();
    const wrapping = await deriveKey('pw', await generateSalt(), FAST_PBKDF2);
    const wrapped = await wrapVaultKey(vaultKey, wrapping);
    // The wrapped blob is not a record: record decryption must not accept it.
    expect(() => decryptRecord(wrapped, wrapping)).toThrow();
  });
});

describe('vault header', () => {
  const header: VaultHeader = { version: 2, kdf: FAST_PBKDF2, salt: 'ab'.repeat(16), wrappedKey: 'v1:aa:bb' };

  it('serialises and parses back identically', () => {
    expect(parseVaultHeader(serializeVaultHeader(header))).toEqual(header);
    const argon: VaultHeader = { ...header, kdf: SMALL_ARGON2 };
    expect(parseVaultHeader(serializeVaultHeader(argon))).toEqual(argon);
  });

  it.each([
    ['wrong version', { ...header, version: 1 }],
    ['missing salt', { version: 2, kdf: FAST_PBKDF2, wrappedKey: 'x' }],
    ['unknown algorithm', { ...header, kdf: { alg: 'md5', iterations: 1 } }],
    ['non-positive iterations', { ...header, kdf: { alg: 'pbkdf2-sha256', iterations: 0 } }],
    ['argon2 missing parallelism', { ...header, kdf: { alg: 'argon2id', memoryKiB: 1, passes: 1 } }],
  ])('rejects a header with %s', (_name, bad) => {
    expect(() => parseVaultHeader(JSON.stringify(bad))).toThrow();
  });

  it('rejects non-JSON and non-object input', () => {
    expect(() => parseVaultHeader('{')).toThrow();
    expect(() => parseVaultHeader('"str"')).toThrow('Unrecognized vault header');
  });
});

describe('legacy verifier', () => {
  it('verifyKey accepts the sentinel under the right key only', async () => {
    const key = await generateVaultKey();
    const other = await generateVaultKey();
    const verifier = await encryptRecord('infovault-verifier-v1', key);
    expect(verifyKey(verifier, key)).toBe(true);
    expect(verifyKey(verifier, other)).toBe(false);
    expect(verifyKey('broken', key)).toBe(false);
  });
});
