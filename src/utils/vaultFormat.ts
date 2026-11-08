import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, concatBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import type { KdfParams } from './crypto';
import { isRecord, parseKdfParams } from './crypto';
import { TEMPLATES } from './records';
import type { Field, FieldKind, VaultRecord } from '../types/models';

// The sealed vault container: every record, as one AES-256-GCM blob under the
// vault key. Pure codec — no I/O, no randomness; the caller supplies the nonce
// (services/vaultFile.ts draws it from expo-crypto). The same container (with
// an `export` header) is the backup/export format.
//
//   offset  size        field
//   0       4           magic 'IVLT'
//   4       1           formatVersion = 1
//   5       2           headerLen, u16 big-endian
//   7       headerLen   header, UTF-8 JSON (VaultFileHeader; not secret)
//   7+h     12          GCM nonce (fresh per write)
//   19+h    n+16        AES-256-GCM ciphertext followed by the 16-byte tag
//
// GCM associated data = utf8('infovault-vault-file-v1') ++ header bytes, so
// the header is authenticated even though it is plaintext: editing it (e.g.
// swapping the KDF parameters in an export) fails the tag check. The sealed
// payload is UTF-8 JSON `{ payloadVersion: 1, records, migratedV1Ids? }`;
// `migratedV1Ids` lists every v1 record id the migration has ever converted
// (so a retried migration can tell "deleted in v2" from "not yet migrated")
// and is omitted when empty. Everything on disk is raw bytes — no hex, no
// base64.

export const MAGIC = utf8ToBytes('IVLT');
export const FORMAT_VERSION = 1;
export const PAYLOAD_VERSION = 1;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const HEADER_LEN_BYTES = 2;
export const HEADER_START = MAGIC.length + 1 + HEADER_LEN_BYTES;
const MAX_HEADER_BYTES = 0xffff;
const AAD_PREFIX = utf8ToBytes('infovault-vault-file-v1');

/** The on-disk vault carries no key material; an export carries what import needs. */
export type VaultFileHeader =
  | { kind: 'vault' }
  | { kind: 'export'; kdf: KdfParams; salt: string; wrappedKey: string };

export interface VaultPayload {
  records: readonly VaultRecord[];
  migratedV1Ids?: readonly string[];
}

export interface DecodedVaultFile {
  header: VaultFileHeader;
  records: VaultRecord[];
  migratedV1Ids: string[];
}

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

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

// Minimal structural check: enough to keep the store from crashing on a
// malformed payload, not a full schema validation of every field.
const FIELD_KINDS: ReadonlySet<string> = new Set<FieldKind>(['text', 'secret', 'number', 'date', 'url', 'multiline']);
const TEMPLATE_IDS: ReadonlySet<string> = new Set<string>(Object.keys(TEMPLATES));

export const isField = (value: unknown): value is Field =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.value === 'string' &&
  typeof value.kind === 'string' &&
  FIELD_KINDS.has(value.kind);

export const isVaultRecord = (value: unknown): value is VaultRecord =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.template === 'string' &&
  TEMPLATE_IDS.has(value.template) &&
  Array.isArray(value.fields) &&
  value.fields.every(isField) &&
  typeof value.pinned === 'boolean' &&
  isStringArray(value.tags) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const parseHeader = (raw: string): VaultFileHeader => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new VaultFileFormatError('Vault file header is not valid JSON');
  }
  if (!isRecord(value)) throw new VaultFileFormatError('Vault file header is not an object');
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

const parsePayload = (plaintext: Uint8Array): { records: VaultRecord[]; migratedV1Ids: string[] } => {
  let value: unknown;
  try {
    value = JSON.parse(bytesToUtf8(plaintext));
  } catch {
    throw new VaultFileFormatError('Vault payload is not valid JSON');
  }
  if (!isRecord(value) || value.payloadVersion !== PAYLOAD_VERSION) {
    throw new VaultFileFormatError('Unrecognized vault payload version');
  }
  if (!Array.isArray(value.records) || !value.records.every(isVaultRecord)) {
    throw new VaultFileFormatError('Vault payload records are malformed');
  }
  const ids = value.migratedV1Ids;
  if (ids !== undefined && !isStringArray(ids)) {
    throw new VaultFileFormatError('Vault payload migratedV1Ids is malformed');
  }
  return { records: value.records, migratedV1Ids: ids ?? [] };
};

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

const aadFor = (headerBytes: Uint8Array): Uint8Array => concatBytes(AAD_PREFIX, headerBytes);

/** Seals a payload into a complete vault file image under `nonce` (12 bytes, never reused). */
export const encodeVaultFile = (
  payload: VaultPayload,
  key: Uint8Array,
  header: VaultFileHeader,
  nonce: Uint8Array
): Uint8Array => {
  if (nonce.length !== NONCE_BYTES) throw new VaultFileFormatError('Vault nonce must be 12 bytes');
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  if (headerBytes.length > MAX_HEADER_BYTES) {
    throw new VaultFileFormatError('Vault file header is too large');
  }
  // Last line of defence: never seal something that will not decode later.
  if (!payload.records.every(isVaultRecord)) {
    throw new VaultFileFormatError('Refusing to write malformed records');
  }
  const ids = payload.migratedV1Ids;
  const body =
    ids !== undefined && ids.length > 0
      ? { payloadVersion: PAYLOAD_VERSION, records: payload.records, migratedV1Ids: ids }
      : { payloadVersion: PAYLOAD_VERSION, records: payload.records };
  const plaintext = utf8ToBytes(JSON.stringify(body));
  const ciphertext = gcm(key, nonce, aadFor(headerBytes)).encrypt(plaintext);

  const prefix = new Uint8Array(HEADER_START);
  prefix.set(MAGIC, 0);
  prefix[MAGIC.length] = FORMAT_VERSION;
  prefix[MAGIC.length + 1] = headerBytes.length >>> 8;
  prefix[MAGIC.length + 2] = headerBytes.length & 0xff;

  return concatBytes(prefix, headerBytes, nonce, ciphertext);
};

/** Opens a vault file image. Throws VaultFileFormatError or VaultFileAuthError. */
export const decodeVaultFile = (bytes: Uint8Array, key: Uint8Array): DecodedVaultFile => {
  if (bytes.length < HEADER_START) throw new VaultFileFormatError('Vault file is truncated');
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) throw new VaultFileFormatError('Not a vault file');
  }
  if (bytes[MAGIC.length] !== FORMAT_VERSION) {
    throw new VaultFileFormatError('Unsupported vault file version');
  }
  const headerLen = ((bytes[MAGIC.length + 1] ?? 0) << 8) | (bytes[MAGIC.length + 2] ?? 0);
  const nonceStart = HEADER_START + headerLen;
  const ciphertextStart = nonceStart + NONCE_BYTES;
  if (bytes.length < ciphertextStart + TAG_BYTES) {
    throw new VaultFileFormatError('Vault file is truncated');
  }

  const headerBytes = bytes.subarray(HEADER_START, nonceStart);
  const header = parseHeader(bytesToUtf8(headerBytes));
  const nonce = bytes.subarray(nonceStart, ciphertextStart);
  const ciphertext = bytes.subarray(ciphertextStart);

  let plaintext: Uint8Array;
  try {
    plaintext = gcm(key, nonce, aadFor(headerBytes)).decrypt(ciphertext);
  } catch {
    throw new VaultFileAuthError();
  }
  return { header, ...parsePayload(plaintext) };
};
