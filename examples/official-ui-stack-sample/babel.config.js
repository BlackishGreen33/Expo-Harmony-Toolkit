const path = require('path');

function resolveExpoScopedModule(moduleName) {
  const expoPackagePath = require.resolve('expo/package.json');
  const expoPackageRoot = path.dirname(expoPackagePath);

  return require.resolve(moduleName, { paths: [expoPackageRoot] });
}

module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    // Expo keeps babel-preset-expo nested. Resolve through Expo so pnpm workspace
    // installs keep the UI-stack sample bundleable without relying on hoisting.
    presets: [resolveExpoScopedModule('babel-preset-expo')],
    plugins: [
      resolveExpoScopedModule('expo-router/babel'),
      'react-native-reanimated/plugin',
    ],
  };
};
