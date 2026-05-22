const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * Uses dynamic import for `react-native-monorepo-config` because the package
 * publishes as ESM-only and `require()` of ESM is gated by a Node flag until
 * Node 23. Metro accepts a Promise-resolved config.
 *
 * @type {Promise<import('metro-config').MetroConfig>}
 */
module.exports = (async () => {
  const { withMetroConfig } = await import('react-native-monorepo-config');
  return withMetroConfig(getDefaultConfig(__dirname), {
    root,
    dirname: __dirname,
  });
})();
