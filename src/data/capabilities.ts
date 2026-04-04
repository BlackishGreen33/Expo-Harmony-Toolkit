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
): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS.filter((definition) =>
    hasDeclaredDependency(packageJson, definition.packageName),
  ).sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function collectCapabilityHarmonyPermissions(
  packageJson: PackageJson,
): string[] {
  return Array.from(
    new Set(
      getCapabilityDefinitionsForProject(packageJson).flatMap((definition) => definition.harmonyPermissions),
    ),
  ).sort((left, right) => left.localeCompare(right));
}
