// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['ios/**', 'android/**', 'node_modules/**', '.expo/**', 'babel.config.js', 'metro.config.js'],
  },
]);
