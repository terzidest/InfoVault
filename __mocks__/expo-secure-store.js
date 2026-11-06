// In-memory SecureStore. Auth-gated reads (requireAuthentication) honour a
// test switch so biometric cancel / keystore-invalidated paths can be driven.
const store = new Map();
let authGate = 'allow'; // 'allow' | 'deny' (entry invalidated → null) | 'cancel' (prompt dismissed → throws)
let failSetKeys = new Set();

module.exports = {
  // Lets `import * as X` hand every importer this same object (no interop copy),
  // so spies set in a test reach the code under test.
  __esModule: true,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',

  async getItemAsync(key, options) {
    if (options && options.requireAuthentication) {
      if (authGate === 'cancel') throw new Error('User canceled the authentication');
      if (authGate === 'deny') return null;
    }
    return store.has(key) ? store.get(key) : null;
  },

  async setItemAsync(key, value) {
    if (failSetKeys.has(key)) {
      failSetKeys.delete(key);
      throw new Error(`simulated write failure for ${key}`);
    }
    store.set(key, String(value));
  },

  async deleteItemAsync(key) {
    store.delete(key);
  },

  // Test helpers
  __store: store,
  __reset() {
    store.clear();
    authGate = 'allow';
    failSetKeys = new Set();
  },
  __setAuthGate(mode) {
    authGate = mode;
  },
  __failNextSet(key) {
    failSetKeys.add(key);
  },
};
