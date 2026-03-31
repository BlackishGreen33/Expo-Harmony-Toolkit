import { CapabilityDefinition, DoctorTargetTier, PackageJson, SupportTier } from '../types';
import { hasDeclaredDependency } from '../core/project';

export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    id: 'expo-file-system',
    packageName: 'expo-file-system',
    status: 'manual',
    supportTier: 'preview',
    note: 'Preview bridge scaffolding is available through the managed Harmony shim path, but device persistence is not verified yet.',
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
    note: 'Preview bridge scaffolding is available, but image selection and camera capture still require device-side validation before promotion.',
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
    supportTier: 'experimental',
    note: 'Location hooks are planned on top of the shared permission bridge, but no verified runtime path is shipped yet.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/%40react-native-community-geolocation.md',
    nativePackageNames: ['@react-native-community/geolocation', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.LOCATION', 'ohos.permission.APPROXIMATELY_LOCATION'],
    sampleRoute: '/location',
    acceptanceChecklist: [
      'Request foreground location permission.',
      'Resolve one current position fix.',
      'Start and stop a watchPosition subscription cleanly.',
    ],
  },
  {
    id: 'expo-camera',
    packageName: 'expo-camera',
    status: 'manual',
    supportTier: 'experimental',
    note: 'Camera preview and capture remain experimental until a stable Harmony-native implementation is wired into the managed bridge.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-camera-kit.md',
    nativePackageNames: ['react-native-camera-kit', 'react-native-permissions'],
    harmonyPermissions: ['ohos.permission.CAMERA'],
    sampleRoute: '/camera',
    acceptanceChecklist: [
      'Request camera permission.',
      'Render a live preview without crashing the Harmony runtime.',
      'Capture one photo and surface the asset metadata back to JS.',
    ],
  },
  {
    id: 'expo-notifications',
    packageName: 'expo-notifications',
    status: 'manual',
    supportTier: 'experimental',
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
