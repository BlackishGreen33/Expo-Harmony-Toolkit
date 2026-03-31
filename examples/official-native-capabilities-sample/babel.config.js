const path = require('path');

function resolveExpoScopedModule(moduleName) {
  const expoPackagePath = require.resolve('expo/package.json');
  const expoPackageRoot = path.dirname(expoPackagePath);

  return require.resolve(moduleName, { paths: [expoPackageRoot] });
}

module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: [resolveExpoScopedModule('babel-preset-expo')],
    plugins: [resolveExpoScopedModule('expo-router/babel')],
  };
};
