import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../../store/authStore';
import * as crypto from '../../utils/crypto';
import { encryptRecord, generateVaultKey } from '../../utils/crypto';
import { hasV1Data, migrateV1 } from '../migrateV1';
import { isLiveKey } from '../../store/vaultKey';
import { encodeVault, readVaultPayload, vaultExists, writeVault } from '../vaultFile';
import type { Credential, Note, PersonalInfo, VaultRecord } from '../../types/models';

const fsMock = FileSystem as unknown as {
  __files: Map<string, Uint8Array>;
  __reset: () => void;
  __failNextWrite: (name: string) => void;
};
const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

let key: Uint8Array;

const write = (records: readonly VaultRecord[], k: Uint8Array) => writeVault({ records }, k, isLiveKey);
const read = async (k: Uint8Array) => (await readVaultPayload(k))?.records ?? null;

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
  useAuthStore.setState({ encryptionKey: key, isAuthenticated: true });
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
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(4);
    expect(result.skipped).toBe(0);

    const onDisk = await read(key);
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
    await expect(migrateV1(key, isLiveKey)).rejects.toThrow('simulated write failure');
    expect(secureStoreMock.__store).toEqual(before);
    expect(vaultExists()).toBe(false);
    expect(await hasV1Data()).toBe(true);

    // The retry succeeds and yields exactly the four records.
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(4);
    expect((await read(key))?.length).toBe(4);
  });

  it('is idempotent: rerunning after the v1 cleanup was interrupted produces no duplicates', async () => {
    await seedV1(key);
    await migrateV1(key, isLiveKey);
    // Simulate the cleanup not having happened (vault written, v1 still there).
    await seedV1(key);
    expect(await hasV1Data()).toBe(true);

    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(0); // already there: nothing re-converted
    const onDisk = await read(key);
    expect(onDisk?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'n1', 'p1']);
    expect(await hasV1Data()).toBe(false);
  });

  it('skips an undecryptable entry, leaves it and its registry in place, and migrates the rest', async () => {
    await seedV1(key);
    const otherKey = await generateVaultKey();
    secureStoreMock.__store.set('c2', await encryptRecord(CREDS[1], otherKey));

    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(1);
    expect((await read(key))?.map((r) => r.id).sort()).toEqual(['c1', 'n1', 'p1']);

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
    await write([newer, older, unrelated], key);

    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(4);
    const records = byId((await read(key)) ?? []);
    expect(records.size).toBe(5);
    expect(records.get('c1')?.title).toBe('Gmail (edited in v2)');
    expect(records.get('c1')?.pinned).toBe(true);
    expect(records.get('c2')?.title).toBe('Bank'); // v1 copy (T2) beats the stale vault copy (T1)
    expect(records.get('z9')?.title).toBe('Only in vault');
    expect(await hasV1Data()).toBe(false);
  });

  it('reports hadV1 false, without reading the vault, when no registry exists', async () => {
    await write([{ ...CREDS[0]!, template: 'login', fields: [], pinned: false, tags: [] } as VaultRecord], key);
    const result = await migrateV1(key, isLiveKey);
    expect(result).toEqual({ hadV1: false, migrated: 0, skipped: 0, records: [], migratedV1Ids: [] });
  });

  it('drops dangling registry ids without writing a vault', async () => {
    secureStoreMock.__store.set('credentialKeys', JSON.stringify(['ghost']));
    const result = await migrateV1(key, isLiveKey);
    expect(result).toEqual({ hadV1: true, migrated: 0, skipped: 0, records: [], migratedV1Ids: [] });
    expect(vaultExists()).toBe(false);
    expect(await hasV1Data()).toBe(false);
  });

  it('leaves a corrupt registry and every entry it names in place, and migrates the other types', async () => {
    await seedV1(key);
    secureStoreMock.__store.set('noteKeys', 'not json');
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(3);
    expect((await read(key))?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'p1']);
    expect(secureStoreMock.__store.get('noteKeys')).toBe('not json');
    expect(secureStoreMock.__store.has('n1')).toBe(true);
    expect(secureStoreMock.__store.has('credentialKeys')).toBe(false);
    expect(await hasV1Data()).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1 registry'));
  });

  it('keeps a v1 entry that decrypts but does not map to a valid record', async () => {
    await seedV1(key);
    // A non-string title cannot be coerced into a record.
    secureStoreMock.__store.set('c1', await encryptRecord({ ...CREDS[0], title: 7 }, key));
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(1);
    expect(secureStoreMock.__store.has('c1')).toBe(true);
    expect(JSON.parse(secureStoreMock.__store.get('credentialKeys') ?? '')).toEqual(['c1']);
    expect((await read(key))?.map((r) => r.id).sort()).toEqual(['c2', 'n1', 'p1']);
    // What was written decodes cleanly on the next read.
    await expect(read(key)).resolves.toHaveLength(3);
  });

  it('anything thrown while converting an entry makes it a leftover, not an abort', async () => {
    await seedV1(key);
    // A loosely typed field is coerced (see the normalization test); a throw
    // inside the conversion is the entry's problem and never the pass's.
    secureStoreMock.__store.set('n1', await encryptRecord({ ...NOTE, category: 5 }, key));
    jest.spyOn(crypto, 'decryptRecord').mockImplementationOnce(() => {
      throw new TypeError('unexpected shape');
    });
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(1);
    expect(secureStoreMock.__store.has('c1')).toBe(true); // the TypeError'd one (first read)
    expect(JSON.parse(secureStoreMock.__store.get('credentialKeys') ?? '')).toEqual(['c1']);
    expect(secureStoreMock.__store.has('n1')).toBe(false);
    expect(byId((await read(key)) ?? []).get('n1')?.tags).toEqual(['5']);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1 record(s)'));
  });

  it('a failing SecureStore read aborts before any deletion, so the next pass retries', async () => {
    await seedV1(key);
    const before = new Map(secureStoreMock.__store);
    const realGet = SecureStore.getItemAsync;
    const getSpy = jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (k, o) => {
      if (k === 'c2') throw new Error('keystore unavailable');
      return realGet(k, o);
    });
    await expect(migrateV1(key, isLiveKey)).rejects.toThrow('keystore unavailable');
    expect(secureStoreMock.__store).toEqual(before);
    expect(vaultExists()).toBe(false);
    getSpy.mockRestore();
    expect((await migrateV1(key, isLiveKey)).migrated).toBe(4);
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
    await write([tie], key);
    await migrateV1(key, isLiveKey);
    expect(byId((await read(key)) ?? []).get('c1')?.title).toBe('Already in v2');
  });

  it('a lock during the vault write aborts before any deletion; v1 stays intact', async () => {
    await seedV1(key);
    const before = new Map(secureStoreMock.__store);
    // The nonce draw is the await inside encodeVault: lock during it.
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockImplementationOnce(async (n: number) => {
      useAuthStore.getState().logout();
      return new Uint8Array(n);
    });
    await expect(migrateV1(key, isLiveKey)).rejects.toThrow('Vault is locked');
    expect(secureStoreMock.__store).toEqual(before);
    expect(fsMock.__files.size).toBe(0);
    expect(await hasV1Data()).toBe(true);
  });

  it('a retry over an interrupted cleanup is read-only: no rewrite, just the deletions', async () => {
    await seedV1(key);
    await migrateV1(key, isLiveKey);
    const bytes = fsMock.__files.get('file:///mock/documents/vault.bin');
    await seedV1(key); // cleanup interrupted: v1 copies are back
    const spy = jest.spyOn(Crypto, 'getRandomBytesAsync');
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(0);
    expect(result.records).toHaveLength(4);
    expect(spy).not.toHaveBeenCalled(); // nothing sealed
    expect(fsMock.__files.get('file:///mock/documents/vault.bin')).toBe(bytes);
    expect(secureStoreMock.__store.size).toBe(0);
  });

  it('defaults missing v1 timestamps instead of leaving the entry behind', async () => {
    const store = secureStoreMock.__store;
    store.set('c7', await encryptRecord({ id: 'c7', title: 'No dates', username: 'u' }, key));
    store.set('c8', await encryptRecord({ id: 'c8', title: 'Only updated', updatedAt: T2, createdAt: 5 }, key));
    store.set('credentialKeys', JSON.stringify(['c7', 'c8']));
    const result = await migrateV1(key, isLiveKey);
    expect(result.skipped).toBe(0);
    const records = byId(result.records);
    const c7 = records.get('c7');
    expect(c7?.createdAt).toBe(c7?.updatedAt);
    expect(Number.isNaN(Date.parse(c7?.createdAt ?? ''))).toBe(false);
    expect(records.get('c8')?.createdAt).toBe(T2);
    expect(records.get('c8')?.updatedAt).toBe(T2);
    expect(await hasV1Data()).toBe(false);
  });

  it('does not resurrect a record deleted in v2 when a retry finds its v1 copy still there', async () => {
    await seedV1(key);
    const first = await migrateV1(key, isLiveKey);
    expect(first.migratedV1Ids.sort()).toEqual(['c1', 'c2', 'n1', 'p1']);
    // Cleanup was interrupted: the v1 copies are back...
    await seedV1(key);
    // ...and meanwhile the user deleted c1 in v2 (a normal store write keeps the ids).
    const stored = await readVaultPayload(key);
    await writeVault(
      { records: (stored?.records ?? []).filter((r) => r.id !== 'c1'), migratedV1Ids: stored?.migratedV1Ids ?? [] },
      key,
      isLiveKey
    );

    const retry = await migrateV1(key, isLiveKey);
    expect(retry.migrated).toBe(0); // the other three are present already
    expect((await read(key))?.map((r) => r.id).sort()).toEqual(['c2', 'n1', 'p1']);
    expect(secureStoreMock.__store.has('c1')).toBe(false); // the v1 copy went too
    expect(secureStoreMock.__store.size).toBe(0);
    expect((await readVaultPayload(key))?.migratedV1Ids.sort()).toEqual(['c1', 'c2', 'n1', 'p1']);
  });

  it('coerces loosely typed v1 fields instead of leaving the entry behind', async () => {
    const store = secureStoreMock.__store;
    store.set('c9', await encryptRecord({ id: 'c9', title: 'Numeric', username: 42, website: true, notes: ['x'], createdAt: T1, updatedAt: T1 }, key));
    store.set('credentialKeys', JSON.stringify(['c9']));
    store.set('n9', await encryptRecord({ id: 'n9', title: 'Cat', content: '  padded  ', category: 5, createdAt: T1, updatedAt: T1 }, key));
    store.set('noteKeys', JSON.stringify(['n9']));
    store.set('p9', await encryptRecord({ id: 'p9', title: 'Typeless', type: 7, identifier: 123456789, createdAt: T1, updatedAt: T1 }, key));
    store.set('personalInfoKeys', JSON.stringify(['p9']));

    const result = await migrateV1(key, isLiveKey);
    expect(result.skipped).toBe(0);
    const records = byId(result.records);
    expect(records.get('c9')?.fields.map((f) => [f.label, f.value])).toEqual([
      ['Username', '42'],
      ['Website', 'true'],
    ]);
    expect(records.get('n9')?.fields[0]?.value).toBe('padded');
    expect(records.get('n9')?.tags).toEqual(['5']);
    expect(records.get('p9')?.template).toBe('idDocument'); // type 'Other' → document, not number
    expect(records.get('p9')?.fields[0]?.value).toBe('123456789');
    expect(await hasV1Data()).toBe(false);
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
    fsMock.__files.set('file:///mock/documents/vault.bin.bak', await encodeVault({ records: [existing] }, key, { kind: 'vault' }));
    const result = await migrateV1(key, isLiveKey);
    expect(result.migrated).toBe(4);
    expect((await read(key))?.map((r) => r.id).sort()).toEqual(['c1', 'c2', 'n1', 'p1', 'z9']);
  });
});
