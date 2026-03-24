import { CompatibilityRecord } from '../types';

export const DEPENDENCY_CATALOG: Record<string, CompatibilityRecord> = {
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
    status: 'manual',
    note: 'Usually reachable from JavaScript, but runtime assumptions still need verification on Harmony.',
  },
  'expo-linking': {
    status: 'manual',
    note: 'Deep-link integration needs Harmony-side routing and intent validation.',
  },
  'expo-router': {
    status: 'manual',
    note: 'The router can stay at the JS layer, but native navigation dependencies still need validation.',
  },
  'react-native-gesture-handler': {
    status: 'manual',
    note: 'A Harmony adaptation exists, but this toolkit does not auto-wire it yet.',
    replacement: 'react-native-oh-library/react-native-harmony-gesture-handler',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  'react-native-reanimated': {
    status: 'manual',
    note: 'A Harmony adaptation exists, but integration must be verified app by app.',
    replacement: 'react-native-oh-library/react-native-harmony-reanimated',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-reanimated',
  },
  'react-native-svg': {
    status: 'manual',
    note: 'A Harmony adaptation exists, but this toolkit does not patch it automatically.',
    replacement: 'react-native-oh-library/react-native-harmony-svg',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-svg',
  },
  'expo-camera': {
    status: 'unknown',
    note: 'No verified Harmony migration path is shipped in v0.5.',
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
    note: 'Location permissions and runtime hooks are not validated in v0.5.',
  },
  'expo-notifications': {
    status: 'unknown',
    note: 'Notifications need platform-specific services that are out of scope for v0.5.',
  },
};
