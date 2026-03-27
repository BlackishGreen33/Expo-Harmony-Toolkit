export const UI_STACK_VALIDATED_ADAPTERS = [
  {
    canonicalPackageName: 'react-native-reanimated',
    canonicalVersion: '3.6.0',
    adapterPackageName: '@react-native-oh-tpl/react-native-reanimated',
    adapterVersion: '3.6.4-rc.5',
    adapterRepository: 'react-native-oh-library/react-native-harmony-reanimated',
    adapterPath: 'react-native-harmony-reanimated',
    adapterCommit: '9fdbe676209937383907be0592291223c6ca7ad7',
    harmonyHarFileName: 'reanimated.har',
    supportsAutolinking: false,
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-reanimated',
  },
  {
    canonicalPackageName: 'react-native-svg',
    canonicalVersion: '15.0.0',
    adapterPackageName: '@react-native-oh-tpl/react-native-svg',
    adapterVersion: '15.0.1-rc.12',
    adapterRepository: 'react-native-oh-library/react-native-harmony-svg',
    adapterPath: 'react-native-harmony-svg',
    adapterCommit: '97c31d2f72559931d62fa84a9c86e86d343753d3',
    harmonyHarFileName: 'svg.har',
    supportsAutolinking: false,
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-svg',
  },
  {
    canonicalPackageName: 'react-native-gesture-handler',
    canonicalVersion: '2.14.1',
    adapterPackageName: '@react-native-oh-tpl/react-native-gesture-handler',
    adapterVersion: '2.14.17-rc.2',
    adapterRepository: 'react-native-oh-library/react-native-harmony-gesture-handler',
    adapterPath: 'react-native-harmony-gesture-handler',
    adapterCommit: 'ed5bcf2ada6e83f9ec0d50cf239c8d84db3c6462',
    harmonyHarFileName: 'gesture_handler.har',
    supportsAutolinking: true,
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
] as const;

export type UiStackValidatedAdapter = (typeof UI_STACK_VALIDATED_ADAPTERS)[number];

export const UI_STACK_CANONICAL_TO_ADAPTER = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.map((entry) => [entry.canonicalPackageName, entry.adapterPackageName]),
) as Record<string, string>;

export const UI_STACK_ADAPTER_TO_CANONICAL = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.map((entry) => [entry.adapterPackageName, entry.canonicalPackageName]),
) as Record<string, string>;

export const UI_STACK_ADAPTER_PACKAGE_NAMES = UI_STACK_VALIDATED_ADAPTERS.map(
  (entry) => entry.adapterPackageName,
);

export function getUiStackAdapterSpecifier(adapter: UiStackValidatedAdapter): string {
  return `github:${adapter.adapterRepository}#${adapter.adapterCommit}&path:${adapter.adapterPath}`;
}
