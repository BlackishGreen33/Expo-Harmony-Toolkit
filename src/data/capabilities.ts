import { CapabilityDefinition, DoctorTargetTier, PackageJson, SupportTier } from '../types';
import { hasDeclaredDependency } from '../core/project';

const PREVIEW_BASELINE_EVIDENCE = {
  bundle: true,
  debugBuild: true,
  device: true,
  release: false,
} as const;

const PREVIEW_BASELINE_EVIDENCE_SOURCE = {
  bundle: 'automated',
  debugBuild: 'automated',
  device: 'manual-doc',
  release: 'none',
} as const;

const EXPLORATORY_EVIDENCE = {
  bundle: false,
  debugBuild: false,
  device: false,
  release: false,
} as const;

const EXPLORATORY_EVIDENCE_SOURCE = {
  bundle: 'none',
  debugBuild: 'none',
  device: 'none',
  release: 'none',
} as const;

const APP_FOUNDATION_BASELINE_EVIDENCE = {
  bundle: true,
  debugBuild: true,
  device: false,
  release: false,
} as const;

const APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE = {
  bundle: 'automated',
  debugBuild: 'automated',
  device: 'none',
  release: 'none',
} as const;

export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    id: 'expo-file-system',
    packageName: 'expo-file-system',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    evidenceSource: PREVIEW_BASELINE_EVIDENCE_SOURCE,
    note: 'Toolkit-managed Harmony native file-system adapters cover the v1.8.0 preview subset: UTF-8/base64 sandbox I/O, append and partial reads, md5 metadata, and direct downloads into the app sandbox.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-fs.md',
    nativePackageNames: ['react-native-fs'],
    harmonyPermissions: [],
    sampleRoute: '/file-system',
    acceptanceChecklist: [
      'Write UTF-8 and base64 content into the app sandbox.',
      'Read back full and partial content and verify md5 metadata.',
      'Download a remote file into the sandbox and clean up generated entries.',
    ],
  },
  {
    id: 'expo-image-picker',
    packageName: 'expo-image-picker',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    evidenceSource: PREVIEW_BASELINE_EVIDENCE_SOURCE,
    note: 'Toolkit-managed Harmony adapters cover the v1.8.0 preview subset: media and camera permissions, single/multi-select library flows, system photo/video capture, pending-result restore, and richer video asset metadata.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-image-picker.md',
    nativePackageNames: ['react-native-image-picker', 'react-native-permissions'],
    harmonyPermissions: [
      'ohos.permission.CAMERA',
      'ohos.permission.MICROPHONE',
      'ohos.permission.READ_IMAGEVIDEO',
    ],
    sampleRoute: '/image-picker',
    acceptanceChecklist: [
      'Request media-library and camera permissions and surface denied/cancel states.',
      'Launch single, multi-select, and mixed library flows and return asset metadata.',
      'Launch photo/video camera capture and restore one pending result when the JS side resumes.',
    ],
  },
  {
    id: 'expo-location',
    packageName: 'expo-location',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    evidenceSource: PREVIEW_BASELINE_EVIDENCE_SOURCE,
    note: 'Toolkit-managed Harmony adapters cover the v1.8.0 preview subset: foreground/background permission flows, current and last-known fixes, geocoding, continuous watch subscriptions, and sensor-backed heading updates.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/%40react-native-community-geolocation.md',
    nativePackageNames: ['@react-native-community/geolocation', 'react-native-permissions'],
    harmonyPermissions: [
      'ohos.permission.LOCATION',
      'ohos.permission.APPROXIMATELY_LOCATION',
      'ohos.permission.LOCATION_IN_BACKGROUND',
      'ohos.permission.ACCELEROMETER',
    ],
    sampleRoute: '/location',
    acceptanceChecklist: [
      'Request foreground and background location permissions.',
      'Resolve current and last-known fixes plus one active watch update.',
      'Resolve heading snapshot/watch updates and reverse-geocoded results.',
    ],
  },
  {
    id: 'expo-camera',
    packageName: 'expo-camera',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    evidenceSource: PREVIEW_BASELINE_EVIDENCE_SOURCE,
    note: 'Toolkit-managed Harmony adapters cover the v1.8.0 preview subset: embedded camera preview, still capture, preview pause/resume, microphone permission, and in-session video recording controls.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-camera-kit.md',
    nativePackageNames: ['react-native-camera-kit', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.CAMERA', 'ohos.permission.MICROPHONE'],
    sampleRoute: '/camera',
    acceptanceChecklist: [
      'Request camera and microphone permissions.',
      'Capture one photo and one embedded video result and surface metadata back to JS.',
      'Exercise preview pause/resume plus denied or canceled outcomes without crashing the Harmony runtime.',
    ],
  },
  {
    id: 'expo-secure-store',
    packageName: 'expo-secure-store',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'shim',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 app-foundation baseline provides a toolkit-managed session shim for secure-store API shape, keeping real encrypted Harmony storage on the promotion path before verified release parity.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/securestore/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/secure-store',
    acceptanceChecklist: [
      'Write a sample key with setItemAsync and read it back in the same JS session.',
      'Delete the sample key and verify getItemAsync returns null.',
      'Keep device persistence and encrypted backend behavior out of verified until native evidence is recorded.',
    ],
  },
  {
    id: 'expo-asset',
    packageName: 'expo-asset',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'shim',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 app-foundation baseline keeps the Asset API bundle-safe on Harmony while native asset resolution and cache semantics remain promotion evidence.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/asset/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/asset',
    acceptanceChecklist: [
      'Create an Asset from a URI and expose deterministic metadata.',
      'Resolve loadAsync for one or more module identifiers without crashing the Harmony bundle.',
      'Keep native resource resolution and cache parity pending device and release evidence.',
    ],
  },
  {
    id: 'expo-device',
    packageName: 'expo-device',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'shim',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 app-foundation baseline exposes stable Harmony placeholder device metadata for JS startup paths; real hardware metadata remains outside verified.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/device/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/device',
    acceptanceChecklist: [
      'Read stable device metadata constants without native module crashes.',
      'Resolve getDeviceTypeAsync with an explicit preview value.',
      'Record real hardware metadata behavior separately before promotion.',
    ],
  },
  {
    id: 'expo-clipboard',
    packageName: 'expo-clipboard',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'shim',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 app-foundation baseline keeps clipboard reads and writes bundle-safe through a session shim while the Harmony clipboard adapter remains the native promotion path.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/clipboard/',
    nativePackageNames: ['@react-native-oh-tpl/clipboard'],
    harmonyPermissions: [],
    sampleRoute: '/clipboard',
    acceptanceChecklist: [
      'Write a string through setStringAsync and read it back with getStringAsync.',
      'Expose hasStringAsync and URL helpers without crashing app-shell startup.',
      'Validate real system pasteboard behavior on device before verified promotion.',
    ],
  },
  {
    id: 'expo-haptics',
    packageName: 'expo-haptics',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'shim',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 app-foundation baseline makes haptics calls no-op safely on Harmony until a real device vibration path is validated.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/haptics/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/haptics',
    acceptanceChecklist: [
      'Resolve selectionAsync, impactAsync, and notificationAsync without throwing.',
      'Expose Expo haptics enum values used by common app startup paths.',
      'Keep physical haptic feedback pending device evidence.',
    ],
  },
  {
    id: 'expo-notifications',
    packageName: 'expo-notifications',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'shim',
    evidence: EXPLORATORY_EVIDENCE,
    evidenceSource: EXPLORATORY_EVIDENCE_SOURCE,
    note: 'Notifications stay below the public promise until a complete Harmony delivery story is validated end to end.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: [],
    harmonyPermissions: ['ohos.permission.NOTIFICATION_CONTROLLER'],
    sampleRoute: '/notifications',
    acceptanceChecklist: [
      'Register for notifications on a signed build.',
      'Receive a foreground notification.',
      'Validate open-from-notification lifecycle.',
    ],
  },
  {
    id: 'react-native-gesture-handler',
    packageName: 'react-native-gesture-handler',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.0 formal acceptance slice tracks Gesture Handler through its Harmony adapter, but it remains experimental until device and release runtime evidence are closed.',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
    nativePackageNames: ['@react-native-oh-tpl/react-native-gesture-handler'],
    harmonyPermissions: [],
    sampleRoute: '/gesture-handler',
    acceptanceChecklist: [
      'Install the canonical package with the matching Harmony adapter.',
      'Bundle a minimal GestureHandlerRootView and tap handler surface.',
      'Record debug HAP evidence before any promotion decision; device and release remain separate gates.',
    ],
  },
] as const;

export const CAPABILITY_BY_PACKAGE = Object.fromEntries(
  CAPABILITY_DEFINITIONS.map((definition) => [definition.packageName, definition]),
) as Record<string, CapabilityDefinition>;

const SUPPORT_TIER_ORDER: Record<SupportTier, number> = {
  verified: 0,
  preview: 1,
  experimental: 2,
  unsupported: 3,
};

export function compareSupportTiers(left: SupportTier, right: SupportTier): number {
  return SUPPORT_TIER_ORDER[left] - SUPPORT_TIER_ORDER[right];
}

export function isSupportTierAllowed(
  dependencyTier: SupportTier,
  targetTier: DoctorTargetTier,
): boolean {
  return compareSupportTiers(dependencyTier, targetTier) <= 0;
}

export function getCapabilityDefinitionsForProject(
  packageJson: PackageJson,
  options: {
    excludedDependencies?: ReadonlySet<string>;
  } = {},
): CapabilityDefinition[] {
  const excludedDependencies = options.excludedDependencies ?? new Set<string>();

  return CAPABILITY_DEFINITIONS.filter((definition) =>
    !excludedDependencies.has(definition.packageName) &&
    hasDeclaredDependency(packageJson, definition.packageName),
  ).sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function collectCapabilityHarmonyPermissions(
  packageJson: PackageJson,
  options: {
    excludedDependencies?: ReadonlySet<string>;
  } = {},
): string[] {
  return Array.from(
    new Set(
      getCapabilityDefinitionsForProject(packageJson, options)
        .filter((definition) => definition.runtimeMode !== 'shim')
        .flatMap((definition) => definition.harmonyPermissions),
    ),
  ).sort((left, right) => left.localeCompare(right));
}
