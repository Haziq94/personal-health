// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite runs on web through a WASM build of SQLite. Metro treats .wasm
// as unknown unless it is registered as an asset.
config.resolver.assetExts.push('wasm');

// That WASM worker needs SharedArrayBuffer, which browsers only expose to
// cross-origin-isolated pages. Native builds ignore both of these.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
