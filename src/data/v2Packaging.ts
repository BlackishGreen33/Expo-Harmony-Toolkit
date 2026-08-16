import { CAPABILITY_DEFINITIONS } from './capabilities';
import { HARMONY_NATIVE_ADAPTERS } from './uiStack';
import {
  DEFAULT_VALIDATED_MATRIX_ID,
  VALIDATED_RELEASE_MATRICES,
} from './validatedMatrices';

interface V2PackagingEvidence {
  readonly portable: boolean;
  readonly debugHap: boolean;
  readonly releaseHap: boolean;
  readonly simulator: boolean;
}

interface V2PackagingLimitation {
  readonly id: string;
  readonly packageNames: readonly string[];
  readonly note: string;
}

interface V2PackagingLane {
  readonly id: 'covered' | 'intake-only';
  readonly packageNames: readonly string[];
  readonly evidence: V2PackagingEvidence;
  readonly limitations: readonly V2PackagingLimitation[];
}

interface V2PackagingException {
  readonly id: 'push' | 'screens' | 'skia';
  readonly packageNames: readonly string[];
  readonly evidence: V2PackagingEvidence;
  readonly fallback: string;
}

interface V2PackagingCatalog {
  readonly covered: V2PackagingLane;
  readonly exceptions: readonly V2PackagingException[];
  readonly intakeOnly: V2PackagingLane;
}

const PENDING_PACKAGING_EVIDENCE = {
  portable: false,
  debugHap: false,
  releaseHap: false,
  simulator: false,
} as const satisfies V2PackagingEvidence;

const V2_PACKAGING_EXCEPTIONS = [
  {
    id: 'push',
    packageNames: [
      'expo-notifications',
      'jcore-react-native',
      'jpush-react-native',
      'mx-jpush-expo',
    ],
    evidence: PENDING_PACKAGING_EVIDENCE,
    fallback: 'Disable push or use a manual sidecar.',
  },
  {
    id: 'screens',
    packageNames: [
      'react-native-screens',
      '@react-native-oh-tpl/react-native-screens',
    ],
    evidence: PENDING_PACKAGING_EVIDENCE,
    fallback: 'enableScreens(false)',
  },
  {
    id: 'skia',
    packageNames: [
      '@shopify/react-native-skia',
      '@react-native-oh-tpl/react-native-skia',
    ],
    evidence: PENDING_PACKAGING_EVIDENCE,
    fallback: 'Use a non-Skia renderer or disable the surface.',
  },
] as const satisfies readonly V2PackagingException[];

const EXCEPTION_PACKAGE_NAMES = new Set<string>(
  V2_PACKAGING_EXCEPTIONS.flatMap((exception) => exception.packageNames),
);

function uniqueSortedPackageNames(packageNames: readonly string[]): readonly string[] {
  return [...new Set(packageNames)].sort((left, right) => left.localeCompare(right));
}

const VERIFIED_ALLOWLIST =
  VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID].allowedDependencies;

const COVERED_PACKAGE_NAMES: readonly string[] = uniqueSortedPackageNames([
  ...VERIFIED_ALLOWLIST,
  ...CAPABILITY_DEFINITIONS.flatMap((definition) => [
    definition.packageName,
    ...definition.nativePackageNames,
  ]),
  ...HARMONY_NATIVE_ADAPTERS.flatMap((adapter) => [
    adapter.canonicalPackageName,
    adapter.adapterPackageName,
  ]),
  'expo-build-properties',
]).filter((packageName) => !EXCEPTION_PACKAGE_NAMES.has(packageName));

const FOUNDATION_SHIM_PACKAGE_NAMES: readonly string[] = CAPABILITY_DEFINITIONS.filter(
  (definition) =>
    definition.runtimeMode === 'shim' &&
    definition.packageName !== 'expo-notifications' &&
    definition.packageName !== 'react-native-safe-area-context',
).map((definition) => definition.packageName);

const COVERED_LIMITATIONS = [
  {
    id: 'foundation-shims',
    packageNames: FOUNDATION_SHIM_PACKAGE_NAMES,
    note: 'Foundation shims keep packaging paths available but do not establish native persistence, asset resolution/cache, hardware metadata, clipboard, or haptics parity.',
  },
  {
    id: 'safe-area-shim',
    packageNames: ['react-native-safe-area-context'],
    note: 'Safe-area remains covered through the toolkit shim; native inset measurement is still a documented limitation.',
  },
] as const satisfies readonly V2PackagingLimitation[];

// Packaging-owned intake surface; additions require an explicit v2 contract review.
const V2_PACKAGING_INTAKE_PACKAGE_NAMES = [
  '@ant-design/icons-react-native',
  '@ant-design/react-native',
  '@expo/vector-icons',
  '@lottiefiles/dotlottie-react',
  '@rneui/base',
  '@rneui/themed',
  'axios',
  'expo-application',
  'expo-font',
  'expo-image-manipulator',
  'expo-updates',
  'expo-web-browser',
  'react-native-draggable-grid',
  'react-native-pdf-renderer',
  'react-native-reanimated-carousel',
  'react-native-svg-transformer',
  'react-native-web',
  'zustand',
] as const;

export const V2_PACKAGING_CATALOG = {
  covered: {
    id: 'covered',
    packageNames: COVERED_PACKAGE_NAMES,
    evidence: PENDING_PACKAGING_EVIDENCE,
    limitations: COVERED_LIMITATIONS,
  },
  exceptions: V2_PACKAGING_EXCEPTIONS,
  intakeOnly: {
    id: 'intake-only',
    packageNames: V2_PACKAGING_INTAKE_PACKAGE_NAMES,
    evidence: PENDING_PACKAGING_EVIDENCE,
    limitations: [],
  },
} as const satisfies V2PackagingCatalog;
