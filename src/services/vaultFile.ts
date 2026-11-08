import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import useAuthStore from '../store/authStore';
import {
  NONCE_BYTES,
  VaultFileFormatError,
  decodeVaultFile,
  encodeVaultFile,
} from '../utils/vaultFormat';
import type { VaultFileHeader, VaultPayload } from '../utils/vaultFormat';
import type { VaultRecord } from '../types/models';

// File I/O for the sealed vault (format: utils/vaultFormat.ts). Lives in the
// app's document directory as `vault.bin`; `.tmp` and `.bak` siblings exist
// only during a commit. This module draws the nonce (expo-crypto) and owns
// the atomic-replace protocol and the lock check on every write.

const VAULT_FILE = 'vault.bin';
// Written first, then moved over VAULT_FILE; see commitVaultBytes.
const TMP_FILE = 'vault.bin.tmp';
// The previous VAULT_FILE while the new one is being moved into place.
const BAK_FILE = 'vault.bin.bak';

export interface StoredVault {
  records: VaultRecord[];
  migratedV1Ids: string[];
}

const vaultFile = (): File => new File(Paths.document, VAULT_FILE);
const tmpFile = (): File => new File(Paths.document, TMP_FILE);
const bakFile = (): File => new File(Paths.document, BAK_FILE);

const deleteIfExists = (file: File): void => {
  if (file.exists) file.delete();
};

export const vaultExists = (): boolean => vaultFile().exists;

/** Seals a payload with a fresh expo-crypto nonce. Pure apart from the nonce draw. */
export const encodeVault = async (
  payload: VaultPayload,
  key: Uint8Array,
  header: VaultFileHeader
): Promise<Uint8Array> => encodeVaultFile(payload, key, header, await Crypto.getRandomBytesAsync(NONCE_BYTES));

/**
 * Replaces `vault.bin` with `bytes` without ever leaving the vault without a
 * decodable copy on disk.
 *
 * `File.move(dest, { overwrite: true })` is not atomic on iOS: the native
 * side removes the destination and then moves, so a crash in between would
 * lose the vault. So instead: write `.tmp` → move the current file to `.bak`
 * → move `.tmp` into place (destination now absent, no overwrite needed) →
 * delete `.bak`. At every step either `vault.bin` or `vault.bin.bak` holds
 * the last acknowledged file. `.tmp` is never authoritative: a previous
 * commit that failed before its final move belongs to a mutation the caller
 * saw fail, so a stray `.tmp` is discarded and a stranded `.bak` is put back
 * first, and the new write builds on that.
 */
export const commitVaultBytes = async (bytes: Uint8Array): Promise<void> => {
  deleteIfExists(tmpFile());
  if (!vaultFile().exists && bakFile().exists) {
    await bakFile().move(vaultFile());
  }

  const tmp = tmpFile();
  await tmp.write(bytes);

  const vault = vaultFile();
  if (vault.exists) {
    // `.bak` is disposable, so overwriting a stale one is fine. Note that
    // move() repoints the moved instance at its new location, so every
    // destination below is a fresh reference.
    await vault.move(bakFile(), { overwrite: true });
  }
  await tmp.move(vaultFile());
  deleteIfExists(bakFile());
};

/**
 * The only way the vault gets written. `key` must be the live key held by
 * authStore: logout() zeroes the key bytes in place, so a lock during the
 * nonce draw would otherwise seal the records under zeros. The reference
 * check after encoding catches that and aborts before anything touches disk.
 * A bare record array is accepted as `{ records }` (no migration ids).
 */
export const writeVault = async (
  payload: VaultPayload | readonly VaultRecord[],
  key: Uint8Array
): Promise<void> => {
  const normalized: VaultPayload = Array.isArray(payload) ? { records: payload } : (payload as VaultPayload);
  const bytes = await encodeVault(normalized, key, { kind: 'vault' });
  if (useAuthStore.getState().encryptionKey !== key) {
    throw new Error('Vault is locked');
  }
  await commitVaultBytes(bytes);
};

const readAndDecode = async (file: File, key: Uint8Array): Promise<StoredVault> => {
  const bytes = await file.bytes();
  const { header, records, migratedV1Ids } = decodeVaultFile(bytes, key);
  if (header.kind !== 'vault') {
    throw new VaultFileFormatError('The on-disk vault must carry a vault header');
  }
  return { records, migratedV1Ids };
};

/**
 * Returns the stored payload, or null when there is no vault on disk at all.
 *
 * Recovery (see commitVaultBytes): `.tmp` is never authoritative — it is the
 * unfinished write of a mutation whose caller saw it fail — and is deleted
 * whenever it is seen. With `vault.bin` missing, `.bak` is the last
 * acknowledged file and is restored. With `vault.bin` present but
 * undecodable (format or tag failure) and a `.bak` that decodes, `.bak` is
 * restored over it; if `.bak` is absent or fails too, the primary's error is
 * what the caller sees (a wrong key is not a reason to touch the files).
 */
export const readVaultPayload = async (key: Uint8Array): Promise<StoredVault | null> => {
  deleteIfExists(tmpFile());

  const vault = vaultFile();
  const bak = bakFile();
  if (vault.exists) {
    try {
      const stored = await readAndDecode(vault, key);
      // Leftover from an interrupted commit; the primary is intact.
      deleteIfExists(bakFile());
      return stored;
    } catch (primaryError) {
      if (!bak.exists) throw primaryError;
      let stored: StoredVault;
      try {
        stored = await readAndDecode(bak, key);
      } catch {
        throw primaryError;
      }
      await bak.move(vaultFile(), { overwrite: true });
      return stored;
    }
  }

  if (bak.exists) {
    const stored = await readAndDecode(bak, key);
    await bak.move(vaultFile());
    return stored;
  }

  return null;
};

/** The records only; see readVaultPayload. */
export const readVault = async (key: Uint8Array): Promise<VaultRecord[] | null> =>
  (await readVaultPayload(key))?.records ?? null;

export const removeVault = async (): Promise<void> => {
  deleteIfExists(vaultFile());
  deleteIfExists(bakFile());
  deleteIfExists(tmpFile());
};
