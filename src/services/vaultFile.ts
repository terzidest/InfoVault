import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, concatBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import type { KdfParams } from '../utils/crypto';
import { parseKdfParams } from '../utils/crypto';
import type { Field, VaultRecord } from '../types/models';

// The sealed vault file: every record, as one AES-256-GCM blob under the
// vault key. Lives in the app's document directory as `vault.bin`. The same
// container (with an `export` header) is the backup/export format.
//
//   offset  size        field
//   0       4           magic 'IVLT'
//   4       1           formatVersion = 1
//   5       2           headerLen, u16 big-endian
//   7       headerLen   header, UTF-8 JSON (VaultFileHeader; not secret)
//   7+h     12          GCM nonce (fresh per write, from expo-crypto)
//   19+h    n+16        AES-256-GCM ciphertext followed by the 16-byte tag
//
// GCM associated data = utf8('infovault-vault-file-v1') ++ header bytes, so
// the header is authenticated even though it is plaintext: editing it (e.g.
// swapping the KDF parameters in an export) fails the tag check. The sealed
// payload is UTF-8 JSON `{ payloadVersion: 1, records: VaultRecord[] }`.
// Everything on disk is raw bytes — no hex, no base64.

const MAGIC = utf8ToBytes('IVLT');
const FORMAT_VERSION = 1;
const PAYLOAD_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_LEN_BYTES = 2;
const MAX_HEADER_BYTES = 0xffff;
const AAD_PREFIX = utf8ToBytes('infovault-vault-file-v1');

const VAULT_FILE = 'vault.bin';
// Written first, then moved over VAULT_FILE; see commitVaultBytes.
const TMP_FILE = 'vault.bin.tmp';
// The previous VAULT_FILE while the new one is being moved into place.
const BAK_FILE = 'vault.bin.bak';

/** The on-disk vault carries no key material; an export carries what import needs. */
export type VaultFileHeader =
  | { kind: 'vault' }
  | { kind: 'export'; kdf: KdfParams; salt: string; wrappedKey: string };

/** Bad magic, unknown version, truncated container, or malformed header/payload. */
export class VaultFileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultFileFormatError';
  }
}

/** GCM tag failure: wrong key, or the header/ciphertext was tampered with. */
export class VaultFileAuthError extends Error {
  constructor(message = 'Vault file could not be authenticated') {
    super(message);
    this.name = 'VaultFileAuthError';
  }
}

export interface DecodedVaultFile {
  header: VaultFileHeader;
  records: VaultRecord[];
}

// ---------------------------------------------------------------------------
// Pure container helpers (no I/O; the only side effect is the nonce draw)
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

const parseHeader = (raw: string): VaultFileHeader => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new VaultFileFormatError('Vault file header is not valid JSON');
  }
  if (!isObject(value)) throw new VaultFileFormatError('Vault file header is not an object');
  if (value.kind === 'vault') return { kind: 'vault' };
  if (value.kind === 'export') {
    if (typeof value.salt !== 'string' || typeof value.wrappedKey !== 'string') {
      throw new VaultFileFormatError('Export header is missing salt or wrapped key');
    }
    let kdf: KdfParams;
    try {
      kdf = parseKdfParams(value.kdf);
    } catch {
      throw new VaultFileFormatError('Export header has unrecognized KDF parameters');
    }
    return { kind: 'export', kdf, salt: value.salt, wrappedKey: value.wrappedKey };
  }
  throw new VaultFileFormatError('Unrecognized vault file header kind');
};

// Minimal structural check: enough to keep the store from crashing on a
// malformed payload, not a full schema validation of every field kind.
const isField = (value: unknown): value is Field =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.value === 'string' &&
  typeof value.kind === 'string';

const isVaultRecord = (value: unknown): value is VaultRecord =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.template === 'string' &&
  Array.isArray(value.fields) &&
  value.fields.every(isField) &&
  typeof value.pinned === 'boolean' &&
  isStringArray(value.tags) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const parsePayload = (plaintext: Uint8Array): VaultRecord[] => {
  let value: unknown;
  try {
    value = JSON.parse(bytesToUtf8(plaintext));
  } catch {
    throw new VaultFileFormatError('Vault payload is not valid JSON');
  }
  if (!isObject(value) || value.payloadVersion !== PAYLOAD_VERSION) {
    throw new VaultFileFormatError('Unrecognized vault payload version');
  }
  if (!Array.isArray(value.records) || !value.records.every(isVaultRecord)) {
    throw new VaultFileFormatError('Vault payload records are malformed');
  }
  return value.records;
};

const aadFor = (headerBytes: Uint8Array): Uint8Array => concatBytes(AAD_PREFIX, headerBytes);

/** Seals `records` into a complete vault file image with a fresh nonce. */
export const encodeVaultFile = async (
  records: readonly VaultRecord[],
  key: Uint8Array,
  header: VaultFileHeader
): Promise<Uint8Array> => {
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  if (headerBytes.length > MAX_HEADER_BYTES) {
    throw new VaultFileFormatError('Vault file header is too large');
  }
  const plaintext = utf8ToBytes(JSON.stringify({ payloadVersion: PAYLOAD_VERSION, records }));
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const ciphertext = gcm(key, nonce, aadFor(headerBytes)).encrypt(plaintext);

  const prefix = new Uint8Array(MAGIC.length + 1 + HEADER_LEN_BYTES);
  prefix.set(MAGIC, 0);
  prefix[MAGIC.length] = FORMAT_VERSION;
  prefix[MAGIC.length + 1] = headerBytes.length >>> 8;
  prefix[MAGIC.length + 2] = headerBytes.length & 0xff;

  return concatBytes(prefix, headerBytes, nonce, ciphertext);
};

/** Opens a vault file image. Throws VaultFileFormatError or VaultFileAuthError. */
export const decodeVaultFile = (bytes: Uint8Array, key: Uint8Array): DecodedVaultFile => {
  const fixedLen = MAGIC.length + 1 + HEADER_LEN_BYTES;
  if (bytes.length < fixedLen) throw new VaultFileFormatError('Vault file is truncated');
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) throw new VaultFileFormatError('Not a vault file');
  }
  if (bytes[MAGIC.length] !== FORMAT_VERSION) {
    throw new VaultFileFormatError('Unsupported vault file version');
  }
  const headerLen = ((bytes[MAGIC.length + 1] ?? 0) << 8) | (bytes[MAGIC.length + 2] ?? 0);
  const nonceStart = fixedLen + headerLen;
  const ciphertextStart = nonceStart + NONCE_BYTES;
  if (bytes.length < ciphertextStart + TAG_BYTES) {
    throw new VaultFileFormatError('Vault file is truncated');
  }

  const headerBytes = bytes.subarray(fixedLen, nonceStart);
  const header = parseHeader(bytesToUtf8(headerBytes));
  const nonce = bytes.subarray(nonceStart, ciphertextStart);
  const ciphertext = bytes.subarray(ciphertextStart);

  let plaintext: Uint8Array;
  try {
    plaintext = gcm(key, nonce, aadFor(headerBytes)).decrypt(ciphertext);
  } catch {
    throw new VaultFileAuthError();
  }
  return { header, records: parsePayload(plaintext) };
};

// ---------------------------------------------------------------------------
// File I/O (expo-file-system, SDK 58 object API)
// ---------------------------------------------------------------------------

const vaultFile = (): File => new File(Paths.document, VAULT_FILE);
const tmpFile = (): File => new File(Paths.document, TMP_FILE);
const bakFile = (): File => new File(Paths.document, BAK_FILE);

const deleteIfExists = (file: File): void => {
  if (file.exists) file.delete();
};

export const vaultExists = (): boolean => vaultFile().exists;

/**
 * Replaces `vault.bin` with `bytes` without ever leaving the vault without a
 * decodable copy on disk.
 *
 * `File.move(dest, { overwrite: true })` is not atomic on iOS: the native
 * side removes the destination and then moves, so a crash in between would
 * lose the vault. So instead: write `.tmp` → move the current file to `.bak`
 * → move `.tmp` into place (destination now absent, no overwrite needed) →
 * delete `.bak`. At every step either `vault.bin` or `vault.bin.bak` holds
 * the previous complete file, and readVault recovers from `.bak` (or a fully
 * written `.tmp`) when `vault.bin` is missing.
 */
export const commitVaultBytes = async (bytes: Uint8Array): Promise<void> => {
  const tmp = tmpFile();
  const vault = vaultFile();
  const bak = bakFile();

  deleteIfExists(tmp);
  await tmp.write(bytes);

  if (vault.exists) {
    // `.bak` is disposable, so overwriting a stale one is fine. Note that
    // move() repoints the moved instance at its new location, so every
    // destination below is a fresh reference.
    await vault.move(bak, { overwrite: true });
  }
  await tmp.move(vaultFile());
  deleteIfExists(bakFile());
};

export const writeVault = async (records: readonly VaultRecord[], key: Uint8Array): Promise<void> => {
  const bytes = await encodeVaultFile(records, key, { kind: 'vault' });
  await commitVaultBytes(bytes);
};

const readAndDecode = async (file: File, key: Uint8Array): Promise<VaultRecord[]> => {
  const bytes = await file.bytes();
  const { header, records } = decodeVaultFile(bytes, key);
  if (header.kind !== 'vault') {
    throw new VaultFileFormatError('The on-disk vault must carry a vault header');
  }
  return records;
};

/**
 * Returns the records, or null when there is no vault on disk at all.
 *
 * Recovery (see commitVaultBytes): with `vault.bin` missing, `.bak` is the
 * previous complete file and is restored. Failing that, a `.tmp` that decodes
 * is a completely written new file whose move never happened; it is restored
 * too. Anything else is left for the caller: a `.tmp` that does not decode is
 * a partial write and is not the vault.
 */
export const readVault = async (key: Uint8Array): Promise<VaultRecord[] | null> => {
  const vault = vaultFile();
  if (vault.exists) {
    const records = await readAndDecode(vault, key);
    // Leftovers from an interrupted commit; the primary is intact.
    deleteIfExists(bakFile());
    deleteIfExists(tmpFile());
    return records;
  }

  const bak = bakFile();
  if (bak.exists) {
    const records = await readAndDecode(bak, key);
    await bak.move(vault);
    deleteIfExists(tmpFile());
    return records;
  }

  const tmp = tmpFile();
  if (tmp.exists) {
    let records: VaultRecord[];
    try {
      records = await readAndDecode(tmp, key);
    } catch (error) {
      if (error instanceof VaultFileAuthError) {
        // Partial write under the right key, or the wrong key; either way
        // there is nothing to recover.
        throw error;
      }
      return null;
    }
    await tmp.move(vault);
    return records;
  }

  return null;
};

export const removeVault = async (): Promise<void> => {
  deleteIfExists(vaultFile());
  deleteIfExists(bakFile());
  deleteIfExists(tmpFile());
};
