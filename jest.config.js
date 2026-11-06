// Logic-level tests only: real Zustand stores and real @noble crypto run
// against in-memory stand-ins for the native modules (see __mocks__/). No
// component rendering — logic that needs testing is pulled out of components.
const preset = require('jest-expo/android/jest-preset');

// @noble/* ships ESM only, so it must be transformed like the RN/Expo packages.
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.replace('react-native-svg)', 'react-native-svg|@noble/.*)')
);

module.exports = {
  preset: 'jest-expo/android',
  transformIgnorePatterns,
  // Metro (SDK 52) resolves `@noble/ciphers/utils` by file; Jest honours the
  // package `exports` map, which only lists `./utils.js`. Bridge the two.
  moduleNameMapper: {
    '^@noble/(ciphers|hashes)/([^.]+)$': '<rootDir>/node_modules/@noble/$1/$2.js',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  clearMocks: true,
  restoreMocks: true,
};
