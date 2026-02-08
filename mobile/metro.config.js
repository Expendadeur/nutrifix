// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuration pour gérer les imports conditionnels
module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['ios', 'android', 'web'],
  },
  transformer: {
    ...config.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};