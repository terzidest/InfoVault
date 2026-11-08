import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes } from '@noble/ciphers/utils';
import { argon2idAsync } from '@noble/hashes/argon2';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

// AES-256-GCM whole-record encryption under a random vault key, which is
// itself wrapped (AES-256-GCM) under a key derived from the master password.
// Randomness comes exclusively from expo-crypto (a CSPRNG) — never @noble's
// randomBytes, which relies on WebCrypto that is absent in RN/Hermes.
const KEY_BYTES = 32; // AES-256
const SALT_BYTES = 16;
const NONCE_BYTES = 12; // 96-bit GCM nonce (NIST-recommended)
const SEAL_VERSION = 'v1';
const VERIFIER_SENTINEL = 'infovault-verifier-v1';
// Domain-separates the vault-key wrap from record encryption.
const WRAP_AAD = utf8ToBytes('infovault-vault-key-v2');

export type KdfParams =
  | { alg: 'pbkdf2-sha256'; iterations: number }
  | { alg: 'argon2id'; memoryKiB: number; passes: number; parallelism: number };

// Applied to new vaults, and to existing ones on their next password unlock.
// Argon2id is the planned default once its unlock latency on Hermes is
// measured on a low-end device (OWASP minimum: 19 MiB, 2 passes, p=1).
export const CURRENT_KDF: KdfParams = { alg: 'pbkdf2-sha256', iterations: 100_000 };

// What pre-header (legacy) vaults were derived with. Fixed forever.
export const LEGACY_KDF: KdfParams = { alg: 'pbkdf2-sha256', iterations: 100_000 };

// Stored as one SecureStore entry so it is written atomically. Not secret:
// it must be readable before unlock.
export interface VaultHeader {
  version: 2;
  kdf: KdfParams;
  salt: string; // hex
  wrappedKey: string; // the vault key, sealed under the password-derived key
}

export const generateSecureId = (): string => Crypto.randomUUID();

export const checkPasswordStrength = (password: string | undefined | null): number => {
  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;

  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  const uniqueChars = new Set(password).size;
  score += Math.min(10, uniqueChars / 2);

  return Math.min(100, score);
};

export const generateSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  return bytesToHex(bytes);
};

export const deriveKey = async (
  masterPassword: string,
  saltHex: string,
  kdf: KdfParams
): Promise<Uint8Array> => {
  const password = utf8ToBytes(masterPassword);
  const salt = hexToBytes(saltHex);
  switch (kdf.alg) {
    case 'pbkdf2-sha256':
      return pbkdf2Async(sha256, password, salt, { c: kdf.iterations, dkLen: KEY_BYTES });
    case 'argon2id':
      return argon2idAsync(password, salt, {
        m: kdf.memoryKiB,
        t: kdf.passes,
        p: kdf.parallelism,
        dkLen: KEY_BYTES,
      });
  }
};

export const isSameKdf = (a: KdfParams, b: KdfParams): boolean => {
  switch (a.alg) {
    case 'pbkdf2-sha256':
      return b.alg === a.alg && b.iterations === a.iterations;
    case 'argon2id':
      return (
        b.alg === a.alg &&
        b.memoryKiB === a.memoryKiB &&
        b.passes === a.passes &&
        b.parallelism === a.parallelism
      );
  }
};

export const generateVaultKey = (): Promise<Uint8Array> => Crypto.getRandomBytesAsync(KEY_BYTES);

export const wrapVaultKey = async (vaultKey: Uint8Array, wrappingKey: Uint8Array): Promise<string> => {
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const ciphertext = gcm(wrappingKey, nonce, WRAP_AAD).encrypt(vaultKey);
  return `${SEAL_VERSION}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
};

// Returns null when the wrapping key is wrong (i.e. wrong master password) or
// the wrapped key was tampered with — the GCM tag check covers both.
export const unwrapVaultKey = (wrapped: string, wrappingKey: Uint8Array): Uint8Array | null => {
  const [version, nonceHex, ciphertextHex] = wrapped.split(':');
  if (version !== SEAL_VERSION || !nonceHex || !ciphertextHex) {
    throw new Error('Unrecognized wrapped-key format');
  }
  try {
    const vaultKey = gcm(wrappingKey, hexToBytes(nonceHex), WRAP_AAD).decrypt(
      hexToBytes(ciphertextHex)
    );
    return vaultKey.length === KEY_BYTES ? vaultKey : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const parseKdfParams = (value: unknown): KdfParams => {
  if (isRecord(value)) {
    if (value.alg === 'pbkdf2-sha256' && isPositiveInt(value.iterations)) {
      return { alg: value.alg, iterations: value.iterations };
    }
    if (
      value.alg === 'argon2id' &&
      isPositiveInt(value.memoryKiB) &&
      isPositiveInt(value.passes) &&
      isPositiveInt(value.parallelism)
    ) {
      return {
        alg: value.alg,
        memoryKiB: value.memoryKiB,
        passes: value.passes,
        parallelism: value.parallelism,
      };
    }
  }
  throw new Error('Unrecognized KDF parameters');
};

export const serializeVaultHeader = (header: VaultHeader): string => JSON.stringify(header);

export const parseVaultHeader = (raw: string): VaultHeader => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    typeof value.salt !== 'string' ||
    typeof value.wrappedKey !== 'string'
  ) {
    throw new Error('Unrecognized vault header');
  }
  return {
    version: 2,
    kdf: parseKdfParams(value.kdf),
    salt: value.salt,
    wrappedKey: value.wrappedKey,
  };
};

export const encryptRecord = async (value: unknown, key: Uint8Array): Promise<string> => {
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const ciphertext = gcm(key, nonce).encrypt(plaintext);
  return `${SEAL_VERSION}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
};

export const decryptRecord = <T>(sealed: string, key: Uint8Array): T => {
  const [version, nonceHex, ciphertextHex] = sealed.split(':');
  if (version !== SEAL_VERSION || !nonceHex || !ciphertextHex) {
    throw new Error('Unrecognized sealed-data format');
  }
  const plaintext = gcm(key, hexToBytes(nonceHex)).decrypt(hexToBytes(ciphertextHex));
  return JSON.parse(bytesToUtf8(plaintext)) as T;
};

// Legacy vaults only: a sentinel encrypted under the password-derived key,
// decrypted on unlock to confirm the password. Header vaults don't need one —
// unwrapping the vault key authenticates the password.
export const verifyKey = (sealedVerifier: string, key: Uint8Array): boolean => {
  try {
    return decryptRecord<string>(sealedVerifier, key) === VERIFIER_SENTINEL;
  } catch {
    return false;
  }
};
