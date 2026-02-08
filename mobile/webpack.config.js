// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons'],
      },
    },
    argv
  );

  // Ajouter des alias pour résoudre les imports conditionnels
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native-maps': require.resolve('components/MapViewWrapper.js'),
  };

  // Ignorer les modules natifs sur le web
  config.resolve.fallback = {
    ...config.resolve.fallback,
    'react-native/Libraries/Utilities/codegenNativeCommands': false,
  };

  return config;
};