// Node's CSPRNG stands in for the platform one. Same contract as expo-crypto.
const nodeCrypto = require('crypto');

module.exports = {
  // Lets `import * as X` hand every importer this same object (no interop copy),
  // so spies set in a test reach the code under test.
  __esModule: true,
  randomUUID: () => nodeCrypto.randomUUID(),
  getRandomBytes: (byteCount) => new Uint8Array(nodeCrypto.randomBytes(byteCount)),
  getRandomBytesAsync: async (byteCount) => new Uint8Array(nodeCrypto.randomBytes(byteCount)),
};
