// Logic-level tests only: real Zustand stores and real @noble crypto run
// against in-memory stand-ins for the native modules (see __mocks__/). No
// component rendering — logic that needs testing is pulled out of components.
const preset = require('jest-expo/android/jest-preset');

// @noble/* ships ESM only, so it must be transformed like the RN/Expo packages.
// The preset's allow-list is a single negative lookahead; add @noble to it.
const ALLOW_LIST_PREFIX = '/node_modules/(?!(';
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.startsWith(ALLOW_LIST_PREFIX)
    ? pattern.replace(ALLOW_LIST_PREFIX, `${ALLOW_LIST_PREFIX}@noble/.*|`)
    : pattern
);

module.exports = {
  preset: 'jest-expo/android',
  transformIgnorePatterns,
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  clearMocks: true,
  restoreMocks: true,
};
