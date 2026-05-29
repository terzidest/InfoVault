import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes } from '@noble/ciphers/utils';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

// AES-256-GCM whole-record encryption with a PBKDF2-SHA256 derived key.
// Randomness comes exclusively from expo-crypto (a CSPRNG) — never @noble's
// randomBytes, which relies on WebCrypto that is absent in RN/Hermes.
const KEY_BYTES = 32; // AES-256
const SALT_BYTES = 16;
const NONCE_BYTES = 12; // 96-bit GCM nonce (NIST-recommended)
const PBKDF2_ITERATIONS = 100_000; // PBKDF2-SHA256; Argon2id is the documented upgrade path
const SEAL_VERSION = 'v1';
const VERIFIER_SENTINEL = 'infovault-verifier-v1';

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

export const deriveKey = async (masterPassword: string, saltHex: string): Promise<Uint8Array> =>
  pbkdf2Async(sha256, utf8ToBytes(masterPassword), hexToBytes(saltHex), {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_BYTES,
  });

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

// A sentinel encrypted under the derived key. On unlock we decrypt it to confirm
// the master password was correct, without storing the password or key hash.
export const makeVerifier = (key: Uint8Array): Promise<string> =>
  encryptRecord(VERIFIER_SENTINEL, key);

export const verifyKey = (sealedVerifier: string, key: Uint8Array): boolean => {
  try {
    return decryptRecord<string>(sealedVerifier, key) === VERIFIER_SENTINEL;
  } catch {
    return false;
  }
};
