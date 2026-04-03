import { ValidatedReleaseMatrix } from '../types';
import { TOOLKIT_PACKAGE_NAME } from '../core/constants';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from './uiStack';

export const DEFAULT_VALIDATED_MATRIX_ID = 'expo55-rnoh082-ui-stack';

const BASE_ALLOWED_DEPENDENCIES = [
  'expo',
  '@expo/metro-runtime',
  'expo-constants',
  'expo-linking',
  'expo-router',
  'react',
  'react-dom',
  'react-native',
  'expo-status-bar',
  '@babel/runtime',
  '@react-native-community/cli',
  'metro',
  '@react-native-oh/react-native-harmony',
  '@react-native-oh/react-native-harmony-cli',
  TOOLKIT_PACKAGE_NAME,
] as const;

export const VALIDATED_RELEASE_MATRICES: Record<string, ValidatedReleaseMatrix> = {
  [DEFAULT_VALIDATED_MATRIX_ID]: {
    id: DEFAULT_VALIDATED_MATRIX_ID,
    expoSdkVersion: 55,
    nativeIdentifierRequirement: 'android_or_ios',
    allowedDependencies: [
      ...BASE_ALLOWED_DEPENDENCIES,
      ...UI_STACK_VALIDATED_ADAPTERS.flatMap((entry) => [
        entry.canonicalPackageName,
        entry.adapterPackageName,
      ]),
    ],
    dependencyRules: {
      expo: {
        required: true,
        version: '>=55.0.0 <56.0.0',
      },
      '@expo/metro-runtime': {
        version: '>=55.0.0 <56.0.0',
      },
      'expo-constants': {
        version: '>=55.0.0 <56.0.0',
      },
      'expo-linking': {
        version: '>=55.0.0 <56.0.0',
      },
      'expo-router': {
        version: '>=55.0.0 <56.0.0',
      },
      react: {
        required: true,
        version: '19.1.1',
      },
      'react-dom': {
        version: '19.1.1',
      },
      'react-native': {
        required: true,
        version: '0.82.1',
      },
      '@react-native-oh/react-native-harmony': {
        required: true,
        version: '0.82.18',
      },
      '@react-native-oh/react-native-harmony-cli': {
        required: true,
        version: '0.82.18',
      },
      '@react-native-community/cli': {
        required: true,
        version: '>=20.0.0 <21.0.0',
      },
      metro: {
        required: true,
        version: '>=0.83.0 <0.84.0',
      },
      '@babel/runtime': {
        version: '>=7.0.0 <8.0.0',
      },
      'expo-status-bar': {
        version: '>=3.0.0 <4.0.0',
      },
      ...Object.fromEntries(
        UI_STACK_VALIDATED_ADAPTERS.flatMap((entry) => [
          [
            entry.canonicalPackageName,
            {
              version: entry.canonicalVersion,
            },
          ],
          [
            entry.adapterPackageName,
            {
              specifier: getUiStackAdapterSpecifier(entry),
            },
          ],
        ]),
      ),
    },
  },
};
