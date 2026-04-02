import { CapabilityDefinition, DoctorTargetTier, PackageJson, SupportTier } from '../types';
import { hasDeclaredDependency } from '../core/project';

const PREVIEW_BASELINE_EVIDENCE = {
  bundle: true,
  debugBuild: true,
  device: true,
  release: false,
} as const;

const EXPLORATORY_EVIDENCE = {
  bundle: false,
  debugBuild: false,
  device: false,
  release: false,
} as const;

export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    id: 'expo-file-system',
    packageName: 'expo-file-system',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    note: 'Toolkit-managed Harmony native file-system adapters cover UTF-8 sandbox file flows, while broader Expo parity and release validation are still pending.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-fs.md',
    nativePackageNames: ['react-native-fs'],
    harmonyPermissions: [],
    sampleRoute: '/file-system',
    acceptanceChecklist: [
      'Write a UTF-8 file into the app sandbox.',
      'Read the file back and verify content.',
      'Delete the file and verify the entry disappears.',
    ],
  },
  {
    id: 'expo-image-picker',
    packageName: 'expo-image-picker',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    note: 'Toolkit-managed Harmony adapters cover permission probes, image-library selection, and initial camera-picker capture flows, while broader Expo parity and release validation are still pending.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-image-picker.md',
    nativePackageNames: ['react-native-image-picker', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.CAMERA', 'ohos.permission.READ_IMAGEVIDEO'],
    sampleRoute: '/image-picker',
    acceptanceChecklist: [
      'Request media-library permissions and surface denied/cancel states.',
      'Launch the image library flow and return one selected asset.',
      'Launch the camera flow and surface denied/cancel states.',
    ],
  },
  {
    id: 'expo-location',
    packageName: 'expo-location',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    note: 'Toolkit-managed Harmony adapters cover foreground permission, current-position, last-known, and geocoding flows. Continuous watch, background permission parity, and heading APIs stay explicitly unsupported in v1.7.x while release evidence is still pending.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/%40react-native-community-geolocation.md',
    nativePackageNames: ['@react-native-community/geolocation', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.LOCATION', 'ohos.permission.APPROXIMATELY_LOCATION'],
    sampleRoute: '/location',
    acceptanceChecklist: [
      'Request foreground location permission.',
      'Resolve one current position fix.',
      'Resolve one last-known or reverse-geocoded location result.',
    ],
  },
  {
    id: 'expo-camera',
    packageName: 'expo-camera',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: PREVIEW_BASELINE_EVIDENCE,
    note: 'Toolkit-managed Harmony adapters cover camera permission and still-photo capture through the Harmony system camera flow. Embedded live preview, preview pause/resume, microphone, and video APIs stay explicitly unsupported in v1.7.x while release evidence is still pending.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-camera-kit.md',
    nativePackageNames: ['react-native-camera-kit', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.CAMERA'],
    sampleRoute: '/camera',
    acceptanceChecklist: [
      'Request camera permission.',
      'Capture one photo and surface the asset metadata back to JS.',
      'Record denied or canceled outcomes without crashing the Harmony runtime.',
    ],
  },
  {
    id: 'expo-notifications',
    packageName: 'expo-notifications',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'shim',
    evidence: EXPLORATORY_EVIDENCE,
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
