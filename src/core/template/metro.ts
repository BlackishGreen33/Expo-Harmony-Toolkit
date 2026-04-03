import { CapabilityDefinition } from '../../types';

export function renderMetroConfig(
  enabledCapabilities: readonly CapabilityDefinition[],
): string {
  const previewCapabilityAliases = enabledCapabilities
    .filter(
      (capability) =>
        capability.supportTier === 'preview' ||
        capability.supportTier === 'experimental',
    )
    .map(
      (capability) =>
        `  '${capability.packageName}': path.resolve(__dirname, '.expo-harmony/shims/${capability.packageName}'),`,
    )
    .join('\n');

  return `const fs = require('fs');
const path = require('path');

process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT ?? 'app';

const { getDefaultConfig } = require('expo/metro-config');
const { createHarmonyMetroConfig } = require('@react-native-oh/react-native-harmony/metro.config');

const defaultConfig = getDefaultConfig(__dirname);
const harmonyConfig = createHarmonyMetroConfig({
  reactNativeHarmonyPackageName: '@react-native-oh/react-native-harmony',
});
const expoHarmonyShims = {
  'expo-modules-core': path.resolve(__dirname, '.expo-harmony/shims/expo-modules-core'),
  'react-native-safe-area-context': path.resolve(
    __dirname,
    '.expo-harmony/shims/react-native-safe-area-context',
  ),
${previewCapabilityAliases ? `${previewCapabilityAliases}\n` : ''}};
const uiStackRootModuleAliases = {
  'react-native-gesture-handler': path.resolve(__dirname, 'node_modules/react-native-gesture-handler'),
  'react-native-reanimated': path.resolve(__dirname, 'node_modules/react-native-reanimated'),
  'react-native-svg': path.resolve(__dirname, 'node_modules/react-native-svg'),
};
const resolvePackageAlias = (context, moduleName, platform, aliases) => {
  for (const [aliasedModuleName, aliasedModulePath] of Object.entries(aliases)) {
    if (moduleName === aliasedModuleName) {
      return context.resolveRequest(context, aliasedModulePath, platform);
    }

    if (moduleName.startsWith(\`\${aliasedModuleName}/\`)) {
      return context.resolveRequest(
        context,
        path.join(aliasedModulePath, moduleName.slice(aliasedModuleName.length + 1)),
        platform,
      );
    }
  }

  return null;
};
const resolveUiStackModuleAlias = (context, moduleName, platform) =>
  resolvePackageAlias(context, moduleName, platform, uiStackRootModuleAliases);
const resolveExpoHarmonyModuleAlias = (context, moduleName, platform) =>
  resolvePackageAlias(context, moduleName, platform, expoHarmonyShims);
const reactNativeCompatibilitySourceExts = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json'];
const reactNativeCompatibilityPackageMarkers = [
  path.sep + '@react-native-oh' + path.sep + 'react-native-harmony' + path.sep,
  path.sep + 'react-native' + path.sep,
];
const findFirstExistingCompatibilityModule = (candidateBasePath, platforms) => {
  for (const candidatePlatform of platforms) {
    for (const candidateExtension of reactNativeCompatibilitySourceExts) {
      const candidatePath = candidatePlatform
        ? \`\${candidateBasePath}.\${candidatePlatform}.\${candidateExtension}\`
        : \`\${candidateBasePath}.\${candidateExtension}\`;

      if (fs.existsSync(candidatePath)) {
        return { candidatePath, candidatePlatform };
      }
    }
  }

  return null;
};
const resolveReactNativeCompatibilityWrapper = (context, moduleName, platform) => {
  if (platform !== 'harmony' || !context.originModulePath || !moduleName.startsWith('.')) {
    return null;
  }

  const originModulePath = context.originModulePath;
  const isReactNativeCompatibilityWrapper = reactNativeCompatibilityPackageMarkers.some((marker) =>
    originModulePath.includes(marker),
  );

  if (!isReactNativeCompatibilityWrapper) {
    return null;
  }

  const originExtension = path.extname(originModulePath);
  const originBasename = path.basename(originModulePath, originExtension);
  const candidateModulePath = path.resolve(path.dirname(originModulePath), moduleName);
  const candidateModuleExtension = path.extname(candidateModulePath);
  const candidateBasename = path.basename(candidateModulePath, candidateModuleExtension);

  const candidateBasePath = candidateModuleExtension
    ? candidateModulePath.slice(0, -candidateModuleExtension.length)
    : candidateModulePath;

  if (candidateBasename === originBasename) {
    const compatibilityWrapperCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
      'harmony',
      'native',
      'android',
      'ios',
    ]);

    if (compatibilityWrapperCandidate) {
      return context.resolveRequest(
        context,
        compatibilityWrapperCandidate.candidatePath,
        compatibilityWrapperCandidate.candidatePlatform || platform,
      );
    }

    return null;
  }

  const standardResolutionCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
    'harmony',
    'native',
    '',
  ]);

  if (standardResolutionCandidate) {
    return null;
  }

  const compatibilityFallbackCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
    'android',
    'ios',
  ]);

  if (compatibilityFallbackCandidate) {
    return context.resolveRequest(
      context,
      compatibilityFallbackCandidate.candidatePath,
      compatibilityFallbackCandidate.candidatePlatform || platform,
    );
  }

  return null;
};
const resolveExpoHarmonyShim = (context, moduleName, platform) => {
  const uiStackModuleAliasResolution = resolveUiStackModuleAlias(context, moduleName, platform);

  if (uiStackModuleAliasResolution) {
    return uiStackModuleAliasResolution;
  }

  const expoHarmonyModuleAliasResolution = resolveExpoHarmonyModuleAlias(context, moduleName, platform);

  if (expoHarmonyModuleAliasResolution) {
    return expoHarmonyModuleAliasResolution;
  }

  const compatibilityWrapperResolution = resolveReactNativeCompatibilityWrapper(
    context,
    moduleName,
    platform,
  );

  if (compatibilityWrapperResolution) {
    return compatibilityWrapperResolution;
  }

  const harmonyResolveRequest = harmonyConfig.resolver?.resolveRequest;

  if (typeof harmonyResolveRequest === 'function') {
    return harmonyResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = {
  ...defaultConfig,
  ...harmonyConfig,
  projectRoot: __dirname,
  server: {
    ...(defaultConfig.server ?? {}),
    ...(harmonyConfig.server ?? {}),
    unstable_serverRoot: __dirname,
  },
  transformer: {
    ...(defaultConfig.transformer ?? {}),
    ...(harmonyConfig.transformer ?? {}),
  },
  serializer: {
    ...(defaultConfig.serializer ?? {}),
    ...(harmonyConfig.serializer ?? {}),
  },
  resolver: {
    ...(defaultConfig.resolver ?? {}),
    ...(harmonyConfig.resolver ?? {}),
    extraNodeModules: {
      ...((defaultConfig.resolver?.extraNodeModules ?? {})),
      ...((harmonyConfig.resolver?.extraNodeModules ?? {})),
      ...uiStackRootModuleAliases,
      ...expoHarmonyShims,
    },
    resolveRequest: resolveExpoHarmonyShim,
    sourceExts: [
      'harmony.ts',
      'harmony.tsx',
      'harmony.js',
      'harmony.jsx',
      ...((harmonyConfig.resolver?.sourceExts ??
        defaultConfig.resolver?.sourceExts ?? ['ts', 'tsx', 'js', 'jsx', 'json'])),
    ],
  },
};
`;
}
