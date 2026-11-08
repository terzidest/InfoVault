import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as crypto from '../../utils/crypto';
import { encryptRecord, generateVaultKey } from '../../utils/crypto';
import { MIGRATION_DONE_KEY, hasV1Data, migrateV1 } from '../migrateV1';
import { encodeVaultFile, readVault, vaultExists, writeVault } from '../vaultFile';
import type { Credential, Note, PersonalInfo, VaultRecord } from '../../types/models';

const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
  __failNextWrite: (name: string) => void;
};
const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

let key: Uint8Array;

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-05T00:00:00.000Z';

const CREDS: Credential[] = [
  { id: 'c1', title: 'Gmail', username: 'me@example.com', password: 'hunter2', createdAt: T1, updatedAt: T1 },
  { id: 'c2', title: 'Bank', username: 'me', website: 'https://bank.example', createdAt: T1, updatedAt: T2 },
];
const PI: PersonalInfo = { id: 'p1', title: 'ΑΦΜ', type: 'Tax Number', identifier: '123456789', createdAt: T1, updatedAt: T1 };
const NOTE: Note = { id: 'n1', title: 'Standup', content: 'Every day 10:00', category: 'Work', createdAt: T1, updatedAt: T1 };

// Seeds SecureStore exactly as v1's secureStorage wrote it: each record sealed
// under the vault key at its own id, plus a JSON id registry per type.
const seedV1 = async (k: Uint8Array) => {
  const store = secureStoreMock.__store;
  for (const c of CREDS) store.set(c.id, await encryptRecord(c, k));
  store.set('credentialKeys', JSON.stringify(CREDS.map((c) => c.id)));
  store.set(PI.id, await encryptRecord(PI, k));
  store.set('personalInfoKeys', JSON.stringify([PI.id]));
  store.set(NOTE.id, await encryptRecord(NOTE, k));
  store.set('noteKeys', JSON.stringify([NOTE.id]));
};

const byId = (records: readonly VaultRecord[]): Map<string, VaultRecord> => new Map(records.map((r) => [r.id, r]));

beforeEach(async () => {
  fsMock.__reset();
  secureStoreMock.__reset();
  key = await generateVaultKey();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('hasV1Data', () => {
  it('is true when any registry exists, even an empty one, and false otherwise', async () => {
    expect(await hasV1Data()).toBe(false);
    secureStoreMock.__store.set('noteKeys', '[]');
    expect(await hasV1Data()).toBe(true);
  });
});

describe('migrateV1', () => {
  it('moves every v1 record into vault.bin with the expected templates and tags, then deletes the v1 copies', async () => {
    await seedV1(key);
    const result = await migrateV1(key);
    expect(result.migrated).toBe(4);
    expect(result.skipped).toBe(0);

    const onDisk = await readVault(key);
    expect(onDisk).toEqual(result.records);
    const records = byId(onDisk ?? []);
    expect(records.size).toBe(4);

    expect(records.get('c1')?.template).toBe('login');
    expect(records.get('c1')?.fields.map((f) => [f.label, f.kind, f.value])).toEqual([
      ['Username', 'text', 'me@example.com'],
      ['Password', 'secret', 'hunter2'],
    ]);
    expect(records.get('c2')?.updatedAt).toBe(T2);
    expect(records.get('p1')?.template).toBe('idNumber');
    expect(records.get('p1')?.title).toBe('ΑΦΜ');
    expect(records.get('n1')?.template).toBe('note');
    expect(records.get('n1')?.tags).toEqual(['work']);

    for (const id of ['c1', 'c2', 'p1', 'n1', 'credentialKeys', 'personalInfoKeys', 'noteKeys']) {
      expect(secureStoreMock.__store.has(id)).toBe(false);
    }
    expect(await hasV1Data()).toBe(false);
    expect(secureStoreMock.__store.size).toBe(0);
  });

  it('on a write failure deletes nothing and leaves no vault', async () => {
    await seedV1(key);
    const before = new Map(secureStoreMock.__store);
    fsMock.__failNextWrite('vault.bin.tmp');
    await expect(migrateV1(key)).rejects.toThrow('simulated write failure');
    expect(secureStoreMock.__store).toEqual(before);
    expect(vaultExists()).toBe(false);
    expect(await hasV1Data()).toBe(true);

    // The retry succeeds and yields exactly the four records.
    const result = await migrateV1(key);
    expect(result.migrated).toBe(4);
    expect((await readVault(key))?.length).toBe(4);
  });

  it('is idempotent: rerunning after the v1 cleanup was interrupted produces no duplicates', async () => {
    await seedV1(key);
    await migrateV1(key);
    // Simulate the cleanup not having happened (vault written, v1 still there).
    await seedV1(key);
    expect(await hasV1Data()).toBe(true);

    const result = await migrateV1(key);
    expect(result.migrated).toBe(4);
    const onDisk = await readVault(key);
    expect(onDisk?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'n1', 'p1']);
    expect(await hasV1Data()).toBe(false);
  });

  it('skips an undecryptable entry, leaves it and its registry in place, and migrates the rest', async () => {
    await seedV1(key);
    const otherKey = await generateVaultKey();
    secureStoreMock.__store.set('c2', await encryptRecord(CREDS[1], otherKey));

    const result = await migrateV1(key);
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(1);
    expect((await readVault(key))?.map((r) => r.id).sort()).toEqual(['c1', 'n1', 'p1']);

    expect(secureStoreMock.__store.has('c1')).toBe(false);
    expect(secureStoreMock.__store.has('c2')).toBe(true);
    expect(JSON.parse(secureStoreMock.__store.get('credentialKeys') ?? '')).toEqual(['c2']);
    expect(secureStoreMock.__store.has('personalInfoKeys')).toBe(false);
    expect(secureStoreMock.__store.has('noteKeys')).toBe(false);
    expect(await hasV1Data()).toBe(true); // the leftover keeps the retry alive
  });

  it('merges with an existing vault: a newer existing record wins, an older one is replaced', async () => {
    await seedV1(key);
    const newer: VaultRecord = {
      id: 'c1',
      title: 'Gmail (edited in v2)',
      template: 'login',
      fields: [],
      pinned: true,
      tags: ['keep'],
      createdAt: T1,
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const older: VaultRecord = { ...newer, id: 'c2', title: 'Stale', pinned: false, updatedAt: T1 };
    const unrelated: VaultRecord = { ...newer, id: 'z9', title: 'Only in vault', updatedAt: T1 };
    await writeVault([newer, older, unrelated], key);

    const result = await migrateV1(key);
    expect(result.migrated).toBe(4);
    const records = byId((await readVault(key)) ?? []);
    expect(records.size).toBe(5);
    expect(records.get('c1')?.title).toBe('Gmail (edited in v2)');
    expect(records.get('c1')?.pinned).toBe(true);
    expect(records.get('c2')?.title).toBe('Bank'); // v1 copy (T2) beats the stale vault copy (T1)
    expect(records.get('z9')?.title).toBe('Only in vault');
    expect(await hasV1Data()).toBe(false);
  });

  it('reports hadV1 false, without reading the vault, when no registry exists', async () => {
    await writeVault([{ ...CREDS[0]!, template: 'login', fields: [], pinned: false, tags: [] } as VaultRecord], key);
    const result = await migrateV1(key);
    expect(result).toEqual({ hadV1: false, migrated: 0, skipped: 0, records: [] });
    expect(secureStoreMock.__store.get(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('drops dangling registry ids without writing a vault', async () => {
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['ghost']));
    const result = await migrateV1(key);
    expect(result).toEqual({ hadV1: true, migrated: 0, skipped: 0, records: [] });
    expect(vaultExists()).toBe(false);
    expect(await hasV1Data()).toBe(false);
  });

  it('leaves a corrupt registry and every entry it names in place, and migrates the other types', async () => {
    await seedV1(key);
    secureStoreMock.__store.set('noteKeys', 'not json');
    const result = await migrateV1(key);
    expect(result.migrated).toBe(3);
    expect((await readVault(key))?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'p1']);
    expect(secureStoreMock.__store.get('noteKeys')).toBe('not json');
    expect(secureStoreMock.__store.has('n1')).toBe(true);
    expect(secureStoreMock.__store.has('credentialKeys')).toBe(false);
    expect(await hasV1Data()).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1 registry'));
  });

  it('keeps a v1 entry that decrypts but does not map to a valid record', async () => {
    await seedV1(key);
    const { createdAt: _dropped, ...noCreatedAt } = CREDS[0]!;
    secureStoreMock.__store.set('c1', await encryptRecord(noCreatedAt, key));
    const result = await migrateV1(key);
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(1);
    expect(secureStoreMock.__store.has('c1')).toBe(true);
    expect(JSON.parse(secureStoreMock.__store.get('credentialKeys') ?? '')).toEqual(['c1']);
    expect((await readVault(key))?.map((r) => r.id).sort()).toEqual(['c2', 'n1', 'p1']);
    // What was written decodes cleanly on the next read.
    await expect(readVault(key)).resolves.toHaveLength(3);
  });

  it('anything thrown while converting an entry makes it a leftover, not an abort', async () => {
    await seedV1(key);
    // A mapper tripping over a malformed v1 field (category must be a string).
    secureStoreMock.__store.set('n1', await encryptRecord({ ...NOTE, category: 5 }, key));
    jest.spyOn(crypto, 'decryptRecord').mockImplementationOnce(() => {
      throw new TypeError('unexpected shape');
    });
    const result = await migrateV1(key);
    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(2);
    expect(secureStoreMock.__store.has('c1')).toBe(true); // the TypeError'd one (first read)
    expect(secureStoreMock.__store.has('n1')).toBe(true);
    expect(JSON.parse(secureStoreMock.__store.get('noteKeys') ?? '')).toEqual(['n1']);
    expect((await readVault(key))?.map((r) => r.id).sort()).toEqual(['c2', 'p1']);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('2 record(s)'));
  });

  it('a failing SecureStore read aborts before any deletion, so the next pass retries', async () => {
    await seedV1(key);
    const before = new Map(secureStoreMock.__store);
    const realGet = SecureStore.getItemAsync;
    const getSpy = jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (k, o) => {
      if (k === 'c2') throw new Error('keystore unavailable');
      return realGet(k, o);
    });
    await expect(migrateV1(key)).rejects.toThrow('keystore unavailable');
    expect(secureStoreMock.__store).toEqual(before);
    expect(vaultExists()).toBe(false);
    getSpy.mockRestore();
    expect((await migrateV1(key)).migrated).toBe(4);
  });

  it('on an updatedAt tie the existing vault record wins', async () => {
    await seedV1(key);
    const tie: VaultRecord = {
      id: 'c1',
      title: 'Already in v2',
      template: 'login',
      fields: [],
      pinned: false,
      tags: [],
      createdAt: T1,
      updatedAt: T1, // same as the v1 copy
    };
    await writeVault([tie], key);
    await migrateV1(key);
    expect(byId((await readVault(key)) ?? []).get('c1')?.title).toBe('Already in v2');
  });

  it('skips the registry probe once a pass found nothing, and clears the flag if a registry turns up', async () => {
    expect(await migrateV1(key)).toEqual({ hadV1: false, migrated: 0, skipped: 0, records: [] });
    expect(secureStoreMock.__store.get(MIGRATION_DONE_KEY)).toBe('true');

    const getSpy = jest.spyOn(SecureStore, 'getItemAsync');
    await migrateV1(key);
    expect(getSpy).toHaveBeenCalledTimes(1); // the flag only
    expect(getSpy).toHaveBeenCalledWith(MIGRATION_DONE_KEY);

    // A registry appearing behind the flag (e.g. a restored keychain): the
    // flagged pass skips it, but any probe that sees it drops the flag.
    await seedV1(key);
    expect((await migrateV1(key)).hadV1).toBe(false);
    expect(await hasV1Data()).toBe(true);
    expect(secureStoreMock.__store.has(MIGRATION_DONE_KEY)).toBe(false);
    expect((await migrateV1(key)).migrated).toBe(4);
    expect(secureStoreMock.__store.has(MIGRATION_DONE_KEY)).toBe(false); // only set by an empty probe
  });

  it('merges with a vault whose last commit was interrupted (vault.bin missing, .bak present)', async () => {
    await seedV1(key);
    const existing: VaultRecord = {
      id: 'z9',
      title: 'Only in vault',
      template: 'custom',
      fields: [],
      pinned: false,
      tags: [],
      createdAt: T1,
      updatedAt: T1,
    };
    fsMock.__files.set('file:///mock/documents/vault.bin.bak', await encodeVaultFile([existing], key, { kind: 'vault' }));
    const result = await migrateV1(key);
    expect(result.migrated).toBe(4);
    expect((await readVault(key))?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'n1', 'p1', 'z9']);
  });
});
