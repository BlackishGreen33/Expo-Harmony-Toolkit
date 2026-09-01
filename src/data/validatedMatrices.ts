import semver from 'semver';
import { PackageJson, ValidatedDependencyRule, ValidatedReleaseMatrix } from '../types';
import { TOOLKIT_PACKAGE_NAME } from '../core/constants';
import {
  UI_STACK_VALIDATED_ADAPTERS,
  getUiStackAdapterRepositorySpecifier,
  getUiStackAdapterSpecifier,
} from './uiStack';

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

const ALLOWED_DEPENDENCIES = [
  ...BASE_ALLOWED_DEPENDENCIES,
  ...UI_STACK_VALIDATED_ADAPTERS.flatMap((entry) => [
    entry.canonicalPackageName,
    entry.adapterPackageName,
  ]),
];

function createDependencyRules(input: {
  expoSdkVersion: number;
  reactVersion: string;
  reactNativeVersion: string;
  reanimatedVersion: string;
  svgVersion: string;
}): Record<string, ValidatedDependencyRule> {
  const expoRange = `>=${input.expoSdkVersion}.0.0 <${input.expoSdkVersion + 1}.0.0`;

  return {
    expo: {
      required: true,
      version: expoRange,
    },
    '@expo/metro-runtime': {
      version: expoRange,
    },
    'expo-constants': {
      version: expoRange,
    },
    'expo-linking': {
      version: expoRange,
    },
    'expo-router': {
      version: expoRange,
    },
    react: {
      required: true,
      version: input.reactVersion,
    },
    'react-dom': {
      version: input.reactVersion,
    },
    'react-native': {
      required: true,
      version: input.reactNativeVersion,
    },
    '@react-native-oh/react-native-harmony': {
      required: true,
      version: '0.82.29',
    },
    '@react-native-oh/react-native-harmony-cli': {
      required: true,
      version: '0.82.29',
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
            version:
              entry.canonicalPackageName === 'react-native-reanimated'
                ? input.reanimatedVersion
                : input.svgVersion,
          },
        ],
        [
          entry.adapterPackageName,
          {
            specifiers: [
              getUiStackAdapterSpecifier(entry),
              getUiStackAdapterRepositorySpecifier(entry),
            ],
          },
        ],
      ]),
    ),
  };
}

export const VALIDATED_RELEASE_MATRICES: Record<string, ValidatedReleaseMatrix> = {
  [DEFAULT_VALIDATED_MATRIX_ID]: {
    id: DEFAULT_VALIDATED_MATRIX_ID,
    supportTier: 'verified',
    expoSdkVersion: 55,
    nativeIdentifierRequirement: 'android_or_ios',
    allowedDependencies: ALLOWED_DEPENDENCIES,
    dependencyRules: createDependencyRules({
      expoSdkVersion: 55,
      reactVersion: '19.1.1',
      reactNativeVersion: '0.82.1',
      reanimatedVersion: '3.6.0',
      svgVersion: '15.0.0',
    }),
  },
  'expo55-rn083-rnoh082-preview': {
    id: 'expo55-rn083-rnoh082-preview',
    supportTier: 'preview',
    expoSdkVersion: 55,
    nativeIdentifierRequirement: 'android_or_ios',
    allowedDependencies: ALLOWED_DEPENDENCIES,
    dependencyRules: createDependencyRules({
      expoSdkVersion: 55,
      reactVersion: '>=19.2.0 <20.0.0',
      reactNativeVersion: '>=0.83.0 <0.84.0',
      reanimatedVersion: '>=4.0.0 <5.0.0',
      svgVersion: '>=15.0.0 <16.0.0',
    }),
  },
  'expo56-rn085-rnoh082-preview': {
    id: 'expo56-rn085-rnoh082-preview',
    supportTier: 'preview',
    expoSdkVersion: 56,
    nativeIdentifierRequirement: 'android_or_ios',
    allowedDependencies: ALLOWED_DEPENDENCIES,
    dependencyRules: createDependencyRules({
      expoSdkVersion: 56,
      reactVersion: '>=19.2.0 <20.0.0',
      reactNativeVersion: '>=0.85.0 <0.86.0',
      reanimatedVersion: '>=4.0.0 <5.0.0',
      svgVersion: '>=15.0.0 <16.0.0',
    }),
  },
  'expo57-rn086-rnoh082-preview': {
    id: 'expo57-rn086-rnoh082-preview',
    supportTier: 'preview',
    expoSdkVersion: 57,
    nativeIdentifierRequirement: 'android_or_ios',
    allowedDependencies: ALLOWED_DEPENDENCIES,
    dependencyRules: createDependencyRules({
      expoSdkVersion: 57,
      reactVersion: '>=19.2.0 <20.0.0',
      reactNativeVersion: '>=0.86.0 <0.87.0',
      reanimatedVersion: '>=4.0.0 <5.0.0',
      svgVersion: '>=15.0.0 <16.0.0',
    }),
  },
};

export function resolveValidatedReleaseMatrix(
  packageJson: PackageJson,
  expoSdkVersion: number | null,
): ValidatedReleaseMatrix {
  const candidates = Object.values(VALIDATED_RELEASE_MATRICES).filter(
    (matrix) => matrix.expoSdkVersion === expoSdkVersion,
  );
  const reactNativeSpecifier =
    packageJson.dependencies?.['react-native'] ??
    packageJson.devDependencies?.['react-native'] ??
    packageJson.peerDependencies?.['react-native'];
  const reactNativeVersion = reactNativeSpecifier ? semver.coerce(reactNativeSpecifier) : null;

  return (
    candidates.find((matrix) => {
      const range = matrix.dependencyRules['react-native']?.version;
      return Boolean(
        range &&
          reactNativeVersion &&
          semver.satisfies(reactNativeVersion, range, { includePrerelease: true }),
      );
    }) ??
    candidates[0] ??
    VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID]
  );
}
