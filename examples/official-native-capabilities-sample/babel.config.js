const path = require('path');
const fs = require('fs');

function resolveExpoScopedModule(moduleName) {
  const expoPackagePath = require.resolve('expo/package.json');
  const expoPackageRoot = path.dirname(expoPackagePath);

  return require.resolve(moduleName, { paths: [expoPackageRoot] });
}

module.exports = function babelConfig(api) {
  const isHarmony = api.caller((caller) => caller?.platform === 'harmony');
  if (isHarmony && fs.existsSync(path.join(__dirname, 'node_modules/@harmony-js/react-native-reanimated/package.json'))) {
    return {
      presets: [[resolveExpoScopedModule('babel-preset-expo'), { reanimated: false, worklets: false }]],
      plugins: [require.resolve('@harmony-js/react-native-reanimated/plugin')],
    };
  }

  return {
    presets: [resolveExpoScopedModule('babel-preset-expo')],
    plugins: [resolveExpoScopedModule('expo-router/babel')],
  };
};
