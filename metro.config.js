const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WalletConnect's noble/scure dependencies still publish browser mappings that
// point at file-extension subpaths omitted from their package export maps.
// Metro already falls back to file resolution for them; opting out of package
// exports makes that compatible resolution deterministic and removes warnings.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
