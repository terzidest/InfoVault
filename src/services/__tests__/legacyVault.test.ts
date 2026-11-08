import * as SecureStore from 'expo-secure-store';
import { STORAGE_TYPES, parseRegistry, readRegistries, registryKey, wipeAllRecords } from '../legacyVault';

const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

beforeEach(() => {
  secureStoreMock.__reset();
});

describe('v1 layout names', () => {
  it('spells the three registries exactly as v1 wrote them', () => {
    expect(STORAGE_TYPES.map(registryKey)).toEqual(['credentialKeys', 'noteKeys', 'personalInfoKeys']);
  });
});

describe('readRegistries / parseRegistry', () => {
  it('returns only the registries that exist, in type order, raw', async () => {
    expect(await readRegistries()).toEqual([]);
    secureStoreMock.__store.set('personalInfoKeys', '["p1"]');
    secureStoreMock.__store.set('credentialKeys', '[]');
    expect(await readRegistries()).toEqual([
      { type: 'credential', raw: '[]' },
      { type: 'personalInfo', raw: '["p1"]' },
    ]);
  });

  it('parses a string array and calls everything else corrupt', () => {
    expect(parseRegistry('[]')).toEqual([]);
    expect(parseRegistry('["a","b"]')).toEqual(['a', 'b']);
    expect(parseRegistry('not json')).toBeNull();
    expect(parseRegistry('{"a":1}')).toBeNull();
    expect(parseRegistry('[1,"a"]')).toBeNull();
  });
});

describe('wipeAllRecords', () => {
  it('deletes every registered entry and every registry, and nothing else', async () => {
    const store = secureStoreMock.__store;
    store.set('c1', 'sealed');
    store.set('c2', 'sealed');
    store.set('credentialKeys', JSON.stringify(['c1', 'c2']));
    store.set('n1', 'sealed');
    store.set('noteKeys', JSON.stringify(['n1']));
    store.set('vaultHeader', 'keep');
    store.set('appSettings', 'keep');
    await wipeAllRecords();
    expect([...store.keys()].sort()).toEqual(['appSettings', 'vaultHeader']);
  });

  it('leaves a corrupt registry and what it names in place (same rule as the migration)', async () => {
    const store = secureStoreMock.__store;
    store.set('personalInfoKeys', 'not json');
    store.set('noteKeys', JSON.stringify([1, 'n1']));
    store.set('n1', 'sealed');
    store.set('credentialKeys', JSON.stringify(['c1']));
    store.set('c1', 'sealed');
    await wipeAllRecords();
    expect([...store.keys()].sort()).toEqual(['n1', 'noteKeys', 'personalInfoKeys']);
  });
});
