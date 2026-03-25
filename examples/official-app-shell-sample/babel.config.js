const path = require('path');

function resolveExpoScopedModule(moduleName) {
  const expoPackagePath = require.resolve('expo/package.json');
  const expoPackageRoot = path.dirname(expoPackagePath);

  return require.resolve(moduleName, { paths: [expoPackageRoot] });
}

module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    // Expo keeps babel-preset-expo as a nested dependency. Resolve through Expo so
    // pnpm workspace installs still bundle the App Shell sample correctly.
    presets: [resolveExpoScopedModule('babel-preset-expo')],
    plugins: [resolveExpoScopedModule('expo-router/babel')],
  };
};
