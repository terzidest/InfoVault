import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { gcm } from '@noble/ciphers/aes.js';
import { hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import useAuthStore from '../../store/authStore';
import { generateVaultKey } from '../../utils/crypto';
import {
  VaultFileAuthError,
  VaultFileFormatError,
  commitVaultBytes,
  decodeVaultFile,
  encodeVaultFile,
  isVaultRecord,
  readVault,
  removeVault,
  vaultExists,
  writeVault,
} from '../vaultFile';
import type { VaultFileHeader } from '../vaultFile';
import { FIXTURE_BYTES_BASE64, FIXTURE_KEY_HEX, FIXTURE_RECORDS } from '../__fixtures__/vaultFile.v1';
import type { VaultRecord } from '../../types/models';

// The manual mock (see __mocks__/) exposes test-only helpers beyond the real
// module's surface.
const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
  __failNextWrite: (name: string) => void;
  __failNextMove: (name: string) => void;
};

const DOC = 'file:///mock/documents';
const VAULT = `${DOC}/vault.bin`;
const TMP = `${DOC}/vault.bin.tmp`;
const BAK = `${DOC}/vault.bin.bak`;

const VAULT_HEADER: VaultFileHeader = { kind: 'vault' };

const makeRecord = (i: number, overrides: Partial<VaultRecord> = {}): VaultRecord => ({
  id: `r-${i}`,
  title: `Record ${i}`,
  template: 'login',
  fields: [
    { id: `f-${i}-a`, label: 'Username', value: `user${i}`, kind: 'text' },
    { id: `f-${i}-b`, label: 'Password', value: `pw-${i}-Ωμέγα`, kind: 'secret' },
  ],
  pinned: i % 2 === 0,
  tags: i % 3 === 0 ? ['tag'] : [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const makeRecords = (n: number): VaultRecord[] => Array.from({ length: n }, (_, i) => makeRecord(i));

const base64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// Byte offsets (see the format comment in vaultFile.ts).
const HEADER_START = 7;
const headerLen = (bytes: Uint8Array): number => ((bytes[5] ?? 0) << 8) | (bytes[6] ?? 0);
const nonceStart = (bytes: Uint8Array): number => HEADER_START + headerLen(bytes);
const ciphertextStart = (bytes: Uint8Array): number => nonceStart(bytes) + 12;

let key: Uint8Array;

beforeEach(async () => {
  fsMock.__reset();
  key = await generateVaultKey();
  // writeVault refuses any key authStore does not currently hold.
  useAuthStore.setState({ encryptionKey: key, isAuthenticated: true });
});

describe('encodeVaultFile / decodeVaultFile', () => {
  it.each([0, 3, 500])('round-trips %i records', async (n) => {
    const records = makeRecords(n);
    const bytes = await encodeVaultFile(records, key, VAULT_HEADER);
    const decoded = decodeVaultFile(bytes, key);
    expect(decoded.header).toEqual(VAULT_HEADER);
    expect(decoded.records).toEqual(records);
  });

  it('lays the container out as magic | version | headerLen | header | nonce | ciphertext+tag', async () => {
    const bytes = await encodeVaultFile([], key, VAULT_HEADER);
    expect(Array.from(bytes.subarray(0, 4))).toEqual(Array.from(utf8ToBytes('IVLT')));
    expect(bytes[4]).toBe(1);
    const header = JSON.stringify(VAULT_HEADER);
    expect(headerLen(bytes)).toBe(header.length);
    expect(new TextDecoder().decode(bytes.subarray(HEADER_START, nonceStart(bytes)))).toBe(header);
    const plaintextLen = JSON.stringify({ payloadVersion: 1, records: [] }).length;
    expect(bytes.length).toBe(ciphertextStart(bytes) + plaintextLen + 16);
    // No hex/base64 of the payload: the plaintext never appears in the file.
    expect(new TextDecoder().decode(bytes.subarray(ciphertextStart(bytes)))).not.toContain('payloadVersion');
  });

  it('draws a fresh nonce per write, so identical content never produces identical bytes', async () => {
    const a = await encodeVaultFile(makeRecords(2), key, VAULT_HEADER);
    const b = await encodeVaultFile(makeRecords(2), key, VAULT_HEADER);
    expect(Array.from(a.subarray(nonceStart(a), ciphertextStart(a)))).not.toEqual(
      Array.from(b.subarray(nonceStart(b), ciphertextStart(b)))
    );
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('rejects a bad magic and an unknown format version with VaultFileFormatError', async () => {
    const bytes = await encodeVaultFile(makeRecords(1), key, VAULT_HEADER);
    const badMagic = new Uint8Array(bytes);
    badMagic[0] = 0x58;
    expect(() => decodeVaultFile(badMagic, key)).toThrow(VaultFileFormatError);
    const badVersion = new Uint8Array(bytes);
    badVersion[4] = 2;
    expect(() => decodeVaultFile(badVersion, key)).toThrow(VaultFileFormatError);
    expect(() => decodeVaultFile(new Uint8Array(0), key)).toThrow(VaultFileFormatError);
  });

  it('rejects truncated input at every cut point', async () => {
    const bytes = await encodeVaultFile(makeRecords(2), key, VAULT_HEADER);
    for (let cut = 1; cut < bytes.length; cut += 7) {
      const truncated = bytes.subarray(0, cut);
      let caught: unknown;
      try {
        decodeVaultFile(truncated, key);
      } catch (error) {
        caught = error;
      }
      expect(caught instanceof VaultFileFormatError || caught instanceof VaultFileAuthError).toBe(true);
    }
    expect(() => decodeVaultFile(bytes.subarray(0, bytes.length - 1), key)).toThrow(VaultFileAuthError);
  });

  it('detects a flipped ciphertext byte, a flipped tag byte and a wrong key as VaultFileAuthError', async () => {
    const bytes = await encodeVaultFile(makeRecords(3), key, VAULT_HEADER);
    const flipped = new Uint8Array(bytes);
    const at = ciphertextStart(bytes) + 5;
    flipped[at] = (flipped[at] ?? 0) ^ 0x01;
    expect(() => decodeVaultFile(flipped, key)).toThrow(VaultFileAuthError);

    const tagFlipped = new Uint8Array(bytes);
    tagFlipped[bytes.length - 1] = (tagFlipped[bytes.length - 1] ?? 0) ^ 0x80;
    expect(() => decodeVaultFile(tagFlipped, key)).toThrow(VaultFileAuthError);

    const otherKey = await generateVaultKey();
    expect(() => decodeVaultFile(bytes, otherKey)).toThrow(VaultFileAuthError);
  });

  it('binds the header into the AAD: editing it fails authentication', async () => {
    const header: VaultFileHeader = {
      kind: 'export',
      kdf: { alg: 'pbkdf2-sha256', iterations: 100_000 },
      salt: 'aa'.repeat(16),
      wrappedKey: 'v1:00:00',
    };
    const bytes = await encodeVaultFile(makeRecords(1), key, header);
    // Same length edit so the layout stays valid and only the AAD changes.
    const edited = new Uint8Array(bytes);
    const headerText = new TextDecoder().decode(edited.subarray(HEADER_START, nonceStart(edited)));
    const weakened = headerText.replace('100000', '100001');
    expect(weakened).not.toBe(headerText);
    edited.set(utf8ToBytes(weakened), HEADER_START);
    expect(() => decodeVaultFile(edited, key)).toThrow(VaultFileAuthError);
  });

  it('rejects a malformed header before touching the ciphertext', async () => {
    const bytes = await encodeVaultFile(makeRecords(1), key, VAULT_HEADER);
    const edited = new Uint8Array(bytes);
    edited.set(utf8ToBytes('{"kind":"nope!"}'), HEADER_START); // same length as {"kind":"vault"}
    expect(() => decodeVaultFile(edited, key)).toThrow(VaultFileFormatError);
  });

  it('round-trips an export-shaped header, for both KDF families', async () => {
    const headers: VaultFileHeader[] = [
      {
        kind: 'export',
        kdf: { alg: 'pbkdf2-sha256', iterations: 100_000 },
        salt: '0f'.repeat(16),
        wrappedKey: 'v1:aabb:ccdd',
      },
      {
        kind: 'export',
        kdf: { alg: 'argon2id', memoryKiB: 19_456, passes: 2, parallelism: 1 },
        salt: '0f'.repeat(16),
        wrappedKey: 'v1:aabb:ccdd',
      },
    ];
    for (const header of headers) {
      const bytes = await encodeVaultFile(makeRecords(2), key, header);
      const decoded = decodeVaultFile(bytes, key);
      expect(decoded.header).toEqual(header);
      expect(decoded.records).toEqual(makeRecords(2));
    }
  });

  it('refuses to encode malformed records, and rejects a sealed payload whose records are not records', async () => {
    const bad = [{ id: 1, title: 'x' }] as unknown as VaultRecord[];
    await expect(encodeVaultFile(bad, key, VAULT_HEADER)).rejects.toThrow(VaultFileFormatError);
    const missingTimestamps = [{ ...makeRecord(1), createdAt: undefined }] as unknown as VaultRecord[];
    await expect(encodeVaultFile(missingTimestamps, key, VAULT_HEADER)).rejects.toThrow(VaultFileFormatError);

    // Seal a bad payload by hand (same layout and AAD) to exercise the decode-side guard.
    const headerBytes = utf8ToBytes(JSON.stringify(VAULT_HEADER));
    const nonce = await Crypto.getRandomBytesAsync(12);
    const aad = new Uint8Array([...utf8ToBytes('infovault-vault-file-v1'), ...headerBytes]);
    const sealed = gcm(key, nonce, aad).encrypt(utf8ToBytes(JSON.stringify({ payloadVersion: 1, records: bad })));
    const bytes = new Uint8Array([
      ...utf8ToBytes('IVLT'),
      1,
      headerBytes.length >>> 8,
      headerBytes.length & 0xff,
      ...headerBytes,
      ...nonce,
      ...sealed,
    ]);
    expect(() => decodeVaultFile(bytes, key)).toThrow(VaultFileFormatError);
    expect(isVaultRecord(makeRecord(1))).toBe(true);
    expect(isVaultRecord({ ...makeRecord(1), tags: [1] })).toBe(false);
  });

  it('rejects an unknown template or field kind', async () => {
    const badTemplate = [{ ...makeRecord(1), template: 'passport' }] as unknown as VaultRecord[];
    const badKind = [
      { ...makeRecord(1), fields: [{ id: 'f', label: 'x', value: 'y', kind: 'password' }] },
    ] as unknown as VaultRecord[];
    expect(isVaultRecord(badTemplate[0])).toBe(false);
    expect(isVaultRecord(badKind[0])).toBe(false);
    await expect(encodeVaultFile(badTemplate, key, VAULT_HEADER)).rejects.toThrow(VaultFileFormatError);
    await expect(encodeVaultFile(badKind, key, VAULT_HEADER)).rejects.toThrow(VaultFileFormatError);
  });
});

describe('readVault / writeVault', () => {
  it('reports no vault, writes one atomically and reads it back', async () => {
    expect(vaultExists()).toBe(false);
    expect(await readVault(key)).toBeNull();

    const records = makeRecords(4);
    await writeVault(records, key);
    expect(vaultExists()).toBe(true);
    expect([...fsMock.__files.keys()]).toEqual([VAULT]);
    expect(await readVault(key)).toEqual(records);

    await writeVault(makeRecords(1), key);
    expect([...fsMock.__files.keys()]).toEqual([VAULT]);
    expect(await readVault(key)).toEqual(makeRecords(1));
  });

  it('fails closed on the wrong key', async () => {
    await writeVault(makeRecords(1), key);
    await expect(readVault(await generateVaultKey())).rejects.toThrow(VaultFileAuthError);
  });

  it('a failed tmp write leaves the previous vault untouched', async () => {
    const before = makeRecords(2);
    await writeVault(before, key);
    const bytesBefore = fsMock.__files.get(VAULT);

    fsMock.__failNextWrite('vault.bin.tmp');
    await expect(writeVault(makeRecords(9), key)).rejects.toThrow('simulated write failure');
    expect(fsMock.__files.get(VAULT)).toBe(bytesBefore);
    expect(await readVault(key)).toEqual(before);
  });

  it('a failed move of the previous file to .bak leaves it untouched', async () => {
    const before = makeRecords(2);
    await writeVault(before, key);
    const bytesBefore = fsMock.__files.get(VAULT);

    fsMock.__failNextMove('vault.bin');
    await expect(writeVault(makeRecords(9), key)).rejects.toThrow('simulated move failure');
    expect(fsMock.__files.get(VAULT)).toBe(bytesBefore);
    expect(await readVault(key)).toEqual(before);
  });

  it('a failed move of .tmp into place: .bak (last acknowledged) is restored and the .tmp discarded', async () => {
    const before = makeRecords(2);
    await writeVault(before, key);

    fsMock.__failNextMove('vault.bin.tmp');
    await expect(writeVault(makeRecords(9), key)).rejects.toThrow('simulated move failure');
    expect(fsMock.__files.has(VAULT)).toBe(false);
    expect(fsMock.__files.has(BAK)).toBe(true);
    expect(fsMock.__files.has(TMP)).toBe(true);

    // The caller saw that write fail, so memory == disk means `before`.
    expect(await readVault(key)).toEqual(before);
    expect(fsMock.__files.has(VAULT)).toBe(true);
    expect(fsMock.__files.has(BAK)).toBe(false);
    expect(fsMock.__files.has(TMP)).toBe(false);
  });

  it('a later write on an interrupted-commit state builds on the last acknowledged file', async () => {
    const before = makeRecords(2);
    await writeVault(before, key);
    fsMock.__failNextMove('vault.bin.tmp');
    await expect(writeVault(makeRecords(9), key)).rejects.toThrow();
    expect(fsMock.__files.has(VAULT)).toBe(false);

    // A tmp write failing in that state still leaves the previous file readable.
    fsMock.__failNextWrite('vault.bin.tmp');
    await expect(writeVault(makeRecords(5), key)).rejects.toThrow('simulated write failure');
    expect(fsMock.__files.has(VAULT)).toBe(true);
    expect(fsMock.__files.has(BAK)).toBe(false);
    expect(fsMock.__files.has(TMP)).toBe(false);
    expect(await readVault(key)).toEqual(before);

    // And a successful one replaces it cleanly.
    fsMock.__files.delete(VAULT);
    fsMock.__files.set(BAK, await encodeVaultFile(before, key, VAULT_HEADER));
    fsMock.__files.set(TMP, new Uint8Array([1, 2, 3]));
    await writeVault(makeRecords(5), key);
    expect([...fsMock.__files.keys()]).toEqual([VAULT]);
    expect(await readVault(key)).toEqual(makeRecords(5));
  });

  it('a partial .tmp next to a .bak: .bak is restored and the partial .tmp dropped', async () => {
    const before = makeRecords(2);
    await writeVault(before, key);
    const good = fsMock.__files.get(VAULT) ?? new Uint8Array();
    fsMock.__files.delete(VAULT);
    fsMock.__files.set(BAK, good);
    const newer = await encodeVaultFile(makeRecords(9), key, VAULT_HEADER);
    fsMock.__files.set(TMP, newer.subarray(0, newer.length - 20)); // truncated: fails the tag

    expect(await readVault(key)).toEqual(before);
    expect(fsMock.__files.has(VAULT)).toBe(true);
    expect(fsMock.__files.has(BAK)).toBe(false);
    expect(fsMock.__files.has(TMP)).toBe(false);
  });

  it('a .tmp alone is never a vault: it is discarded and the vault reported absent', async () => {
    const bytes = await encodeVaultFile(makeRecords(3), key, VAULT_HEADER);
    fsMock.__files.set(TMP, bytes);
    expect(await readVault(key)).toBeNull();
    expect(fsMock.__files.size).toBe(0);
  });

  it('cleans up stale .bak/.tmp leftovers once the primary reads fine', async () => {
    await writeVault(makeRecords(1), key);
    fsMock.__files.set(BAK, new Uint8Array([1, 2, 3]));
    fsMock.__files.set(TMP, new Uint8Array([4]));
    expect(await readVault(key)).toEqual(makeRecords(1));
    expect([...fsMock.__files.keys()]).toEqual([VAULT]);
  });

  it('commitVaultBytes stores exactly the given bytes; removeVault deletes every copy', async () => {
    const bytes = await encodeVaultFile(makeRecords(1), key, VAULT_HEADER);
    await commitVaultBytes(bytes);
    expect(Array.from(fsMock.__files.get(VAULT) ?? [])).toEqual(Array.from(bytes));
    fsMock.__files.set(BAK, bytes);
    fsMock.__files.set(TMP, bytes);
    await removeVault();
    expect(fsMock.__files.size).toBe(0);
    expect(vaultExists()).toBe(false);
    await expect(removeVault()).resolves.toBeUndefined(); // idempotent
  });

  it('refuses an on-disk file carrying an export header', async () => {
    const header: VaultFileHeader = {
      kind: 'export',
      kdf: { alg: 'pbkdf2-sha256', iterations: 1 },
      salt: '00',
      wrappedKey: 'v1:00:00',
    };
    fsMock.__files.set(VAULT, await encodeVaultFile(makeRecords(1), key, header));
    await expect(readVault(key)).rejects.toThrow(VaultFileFormatError);
  });

  it('writeVault refuses a key the vault no longer holds and touches nothing on disk', async () => {
    await writeVault(makeRecords(1), key);
    const before = fsMock.__files.get(VAULT);
    // Lock during the nonce draw: the key bytes are zeroed in place.
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useAuthStore.getState().logout();
      return new Uint8Array(n);
    });
    await expect(writeVault(makeRecords(5), key)).rejects.toThrow('Vault is locked');
    expect(fsMock.__files.get(VAULT)).toBe(before);
    expect([...fsMock.__files.keys()]).toEqual([VAULT]);
    // And a key that was simply never the live one.
    useAuthStore.setState({ encryptionKey: await generateVaultKey(), isAuthenticated: true });
    await expect(writeVault(makeRecords(5), key)).rejects.toThrow('Vault is locked');
    expect(fsMock.__files.get(VAULT)).toBe(before);
  });

  it('uses expo-crypto for the nonce', async () => {
    const spy = jest.spyOn(Crypto, 'getRandomBytesAsync');
    await writeVault([], key);
    expect(spy).toHaveBeenCalledWith(12);
  });
});

describe('committed fixture', () => {
  it('decodes the committed v1-format bytes to the fixture records (format regression guard)', () => {
    const decoded = decodeVaultFile(base64ToBytes(FIXTURE_BYTES_BASE64), hexToBytes(FIXTURE_KEY_HEX));
    expect(decoded.header).toEqual({ kind: 'vault' });
    expect(decoded.records).toEqual(FIXTURE_RECORDS);
  });

  it('re-encoding the fixture under its fixed nonce reproduces the committed bytes exactly', async () => {
    jest
      .spyOn(Crypto, 'getRandomBytesAsync')
      .mockImplementationOnce(async (n: number) => Uint8Array.from({ length: n }, (_, i) => i));
    const bytes = await encodeVaultFile(FIXTURE_RECORDS, hexToBytes(FIXTURE_KEY_HEX), { kind: 'vault' });
    expect(Array.from(bytes)).toEqual(Array.from(base64ToBytes(FIXTURE_BYTES_BASE64)));
  });
});
