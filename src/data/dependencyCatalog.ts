import { CompatibilityRecord } from '../types';
import { TOOLKIT_PACKAGE_NAME } from '../core/constants';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from './uiStack';

const UI_STACK_COMPATIBILITY_RECORDS = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.flatMap((entry) => [
    [
      entry.canonicalPackageName,
      {
        status: 'supported',
        note: `Supported in the validated UI-stack matrix when paired with ${entry.adapterPackageName} and the managed Harmony autolinking output.`,
        replacement: entry.adapterPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
    [
      entry.adapterPackageName,
      {
        status: 'supported',
        note: `Harmony adapter pinned to ${entry.adapterVersion}. The validated matrix requires the exact Git spec ${getUiStackAdapterSpecifier(entry)}.`,
        replacement: entry.canonicalPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
  ]),
) as Record<string, CompatibilityRecord>;

export const DEPENDENCY_CATALOG: Record<string, CompatibilityRecord> = {
  [TOOLKIT_PACKAGE_NAME]: {
    status: 'supported',
    note: 'The published toolkit package may be installed locally to provide the CLI and config plugin inside a validated project.',
  },
  expo: {
    status: 'supported',
    note: 'Toolkit can parse Expo config and scaffold Harmony sidecar files for managed/CNG projects.',
  },
  '@babel/runtime': {
    status: 'supported',
    note: 'Runtime helpers are used by the official minimal sample bundling chain.',
  },
  '@react-native-community/cli': {
    status: 'supported',
    note: 'The React Native CLI exposes the bundle-harmony command used by the official sample.',
  },
  '@react-native-oh/react-native-harmony': {
    status: 'supported',
    note: 'This is the RNOH runtime package used by the vendored Harmony sidecar template.',
  },
  '@react-native-oh/react-native-harmony-cli': {
    status: 'supported',
    note: 'This package provides the bundle-harmony command used by the official minimal sample.',
  },
  react: {
    status: 'supported',
    note: 'React is treated as a baseline JavaScript dependency.',
  },
  'react-native': {
    status: 'supported',
    note: 'React Native is supported as managed Expo input, but runtime portability is only promised inside the validated matrix.',
  },
  metro: {
    status: 'supported',
    note: 'Metro is part of the official sample bundling chain.',
  },
  'expo-status-bar': {
    status: 'supported',
    note: 'Status bar rendering stays in the JavaScript/UI layer for the official minimal sample.',
  },
  'expo-asset': {
    status: 'manual',
    note: 'Asset handling often needs Harmony-specific verification after bundling.',
  },
  'expo-build-properties': {
    status: 'manual',
    note: 'Native property overrides should be reviewed manually because Harmony uses a separate sidecar project.',
  },
  'expo-constants': {
    status: 'supported',
    note: 'Constants reads are treated as part of the validated App Shell matrix when they stay in the JavaScript layer.',
  },
  'expo-linking': {
    status: 'supported',
    note: 'URL generation and JS-layer linking are treated as part of the validated App Shell matrix.',
  },
  'expo-router': {
    status: 'supported',
    note: 'File-based routing is treated as part of the validated App Shell matrix when router peers, scheme, and plugin config are present.',
  },
  ...UI_STACK_COMPATIBILITY_RECORDS,
  'react-native-gesture-handler': {
    status: 'manual',
    note: 'Gesture Handler is not part of the current public matrix. Device-side runtime validation is still blocked by the current Harmony adapter and RNOH combination.',
    replacement: '@react-native-oh-tpl/react-native-gesture-handler',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  '@react-native-oh-tpl/react-native-gesture-handler': {
    status: 'manual',
    note: 'The current Gesture Handler adapter remains experimental and is outside the validated matrix until its ArkTS turbo module path runs cleanly on device.',
    replacement: 'react-native-gesture-handler',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  'expo-camera': {
    status: 'unknown',
    note: 'No verified Harmony migration path is shipped in v1.0.',
  },
  'expo-file-system': {
    status: 'unknown',
    note: 'File-system APIs need a verified Harmony implementation before they can be treated as supported.',
  },
  'expo-image-picker': {
    status: 'unknown',
    note: 'Media-picker flows need dedicated Harmony integration and testing.',
  },
  'expo-location': {
    status: 'unknown',
    note: 'Location permissions and runtime hooks are not validated in v1.0.',
  },
  'expo-notifications': {
    status: 'unknown',
    note: 'Notifications need platform-specific services that are out of scope for v1.0.',
  },
};
