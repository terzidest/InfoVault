import * as SecureStore from 'expo-secure-store';
import { STORAGE_TYPES, registryKey, wipeAllRecords } from '../legacyVault';

const secureStoreMock = SecureStore as unknown as { __store: Map<string, string>; __reset: () => void };

beforeEach(() => {
  secureStoreMock.__reset();
});

describe('v1 layout names', () => {
  it('spells the three registries exactly as v1 wrote them', () => {
    expect(STORAGE_TYPES.map(registryKey)).toEqual(['credentialKeys', 'noteKeys', 'personalInfoKeys']);
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

  it('still removes a registry it cannot parse (nothing it names can be found anyway)', async () => {
    const store = secureStoreMock.__store;
    store.set('personalInfoKeys', 'not json');
    store.set('noteKeys', JSON.stringify([1, 'n1']));
    store.set('n1', 'sealed');
    await wipeAllRecords();
    expect(store.size).toBe(0);
  });
});
