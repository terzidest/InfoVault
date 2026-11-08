let contents = '';

module.exports = {
  // Lets `import * as X` hand every importer this same object (no interop copy),
  // so spies set in a test reach the code under test.
  __esModule: true,
  setStringAsync: async (value) => {
    contents = String(value);
    return true;
  },
  getStringAsync: async () => contents,

  __reset() {
    contents = '';
  },
};
