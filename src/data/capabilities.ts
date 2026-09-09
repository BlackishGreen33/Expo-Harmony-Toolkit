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

const THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE = {
  bundle: true,
  debugBuild: true,
  device: false,
  release: false,
} as const;

const THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE_SOURCE = {
  bundle: 'automated',
  debugBuild: 'automated',
  device: 'none',
  release: 'none',
} as const;

const THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE = {
  bundle: true,
  debugBuild: true,
  device: false,
  release: false,
} as const;

const THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE = {
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
    evidence: { ...PREVIEW_BASELINE_EVIDENCE, device: false },
    evidenceSource: { ...PREVIEW_BASELINE_EVIDENCE_SOURCE, device: 'none' },
    note: 'CameraView connects a native XComponent surface to Camera Kit input/output sessions, with PhotoOutput capture and AVRecorder controls. A ready event requires the first preview frame. Camera input, saved capture, device and release acceptance remain separate gates; this is not full Expo Camera API parity.',
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
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'Harmony Asset Store backs async and sync storage with service isolation and device-local encrypted persistence. Biometric authentication and shared access groups remain explicitly unsupported; physical-device acceptance is pending.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/securestore/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/secure-store',
    acceptanceChecklist: [
      'Write a sample key and read it back after restarting the app; verify service isolation.',
      'Delete the sample key and verify getItemAsync returns null.',
      'Reject unsupported authentication options instead of storing without the requested protection.',
    ],
  },
  {
    id: 'expo-asset',
    packageName: 'expo-asset',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'Harmony resolves Metro asset metadata, extracts packaged resources and downloads HTTP or base64 assets into the native cache. Failures reject without marking assets downloaded; device and release acceptance remain pending.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/asset/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/asset',
    acceptanceChecklist: [
      'Create an Asset from a URI and expose deterministic metadata.',
      'Resolve loadAsync for bundled module identifiers and verify readable cached bytes.',
      'Verify HTTP errors, cache reuse, concurrent downloads and useAssets completion.',
    ],
  },
  {
    id: 'expo-device',
    packageName: 'expo-device',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'Device constants come from Harmony deviceInfo and system memory APIs; emulator models are identified as virtual devices. Physical hardware metadata acceptance remains pending.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/device/',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/device',
    acceptanceChecklist: [
      'Read OS-provided device metadata and memory without native module crashes.',
      'Resolve getDeviceTypeAsync and distinguish the simulator from a physical device.',
      'Record real hardware metadata behavior separately before promotion.',
    ],
  },
  {
    id: 'expo-clipboard',
    packageName: 'expo-clipboard',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'Harmony system pasteboard supports awaited text, HTML, URL and image writes, permission-aware reads and change events. READ_PASTEBOARD requires profile ACL approval plus user consent; native failures propagate and device acceptance remains pending.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/clipboard/',
    nativePackageNames: [],
    harmonyPermissions: ['ohos.permission.READ_PASTEBOARD'],
    sampleRoute: '/clipboard',
    acceptanceChecklist: [
      'Write a string through setStringAsync and read it back with getStringAsync.',
      'Read clipboard content across JS restarts; check content types, images, URL helpers and change events.',
      'Validate real system pasteboard behavior on device before verified promotion.',
    ],
  },
  {
    id: 'expo-haptics',
    packageName: 'expo-haptics',
    status: 'manual',
    supportTier: 'preview',
    runtimeMode: 'adapter',
    evidence: APP_FOUNDATION_BASELINE_EVIDENCE,
    evidenceSource: APP_FOUNDATION_BASELINE_EVIDENCE_SOURCE,
    note: 'Haptic calls invoke the Harmony vibrator with distinct touch durations and propagate native errors. Physical feedback quality and hardware support require device validation.',
    docsUrl: 'https://docs.expo.dev/versions/latest/sdk/haptics/',
    nativePackageNames: [],
    harmonyPermissions: ['ohos.permission.VIBRATE'],
    sampleRoute: '/haptics',
    acceptanceChecklist: [
      'Invoke the vibrator for selectionAsync, impactAsync, and notificationAsync; propagate permission and hardware errors.',
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
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B keeps Expo Notifications on a safe experimental shim for ccnubox push flows while JPush delivery and signed-runtime behavior remain separate evidence gates.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: [],
    harmonyPermissions: ['ohos.permission.NOTIFICATION_CONTROLLER'],
    sampleRoute: '/third-party-wave-b/notifications',
    acceptanceChecklist: [
      'Bundle notification permission and channel setup paths without crashing.',
      'Keep foreground receipt, click, and cold-start delivery pending signed simulator and device evidence.',
      'Do not treat simulator app-shell launch as notification delivery acceptance.',
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
  {
    id: 'async-storage',
    packageName: '@react-native-async-storage/async-storage',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.2 Wave A tracks Async Storage through its Harmony adapter, but persistence behavior remains experimental until device and release evidence are closed.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs',
    nativePackageNames: ['@react-native-oh-tpl/async-storage'],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-a/async-storage',
    acceptanceChecklist: [
      'Install the canonical package with the matching Harmony adapter.',
      'Bundle a minimal Async Storage read/write/remove surface.',
      'Keep real persistence, migration, and release HAP runtime behavior pending device evidence.',
    ],
  },
  {
    id: 'react-native-screens',
    packageName: 'react-native-screens',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.2 Wave A tracks Screens through its Harmony adapter metadata, while managed autolinking and navigation-stack runtime behavior remain promotion gaps.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: ['@react-native-oh-tpl/react-native-screens'],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-a/screens',
    acceptanceChecklist: [
      'Install the canonical package with the matching Harmony adapter.',
      'Bundle a minimal navigation stack that imports react-native-screens.',
      'Do not claim verified support until adapter autolinking, device, and release evidence are recorded.',
    ],
  },
  {
    id: 'react-native-safe-area-context',
    packageName: 'react-native-safe-area-context',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_A_BASELINE_EVIDENCE_SOURCE,
    note: 'The toolkit bridge consumes RNOH SafeAreaTurboModule measurements and inset-change events, measures provider frames and applies edge padding or margins. Device and release layout acceptance remain pending.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: [],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-a/safe-area',
    acceptanceChecklist: [
      'Render SafeAreaProvider, SafeAreaView, and safe-area hooks with measured RNOH insets.',
      'Keep the Metro alias on .expo-harmony/shims/react-native-safe-area-context.',
      'Verify inset updates on rotation, nested provider frames, selected edges, padding and margins.',
    ],
  },
  {
    id: 'react-native-webview',
    packageName: 'react-native-webview',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B tracks ccnubox WebView surfaces through the Harmony adapter, but navigation, injected scripts, and release runtime stability remain promotion evidence.',
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-webview.md',
    nativePackageNames: ['@react-native-oh-tpl/react-native-webview'],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-b/webview',
    acceptanceChecklist: [
      'Install react-native-webview with the matching Harmony adapter.',
      'Bundle a minimal WebView surface with message passing and navigation callbacks.',
      'Validate signed simulator startup and real WebView runtime behavior before any promotion.',
    ],
  },
  {
    id: 'jpush-react-native',
    packageName: 'jpush-react-native',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B keeps ccnubox JPush runtime dependencies in formal telemetry; registrationId, arrival, click, and cold-start payloads still require signed runtime evidence.',
    docsUrl: 'https://docs.jiguang.cn/jpush/client/HarmonyOS/hmos_guide',
    nativePackageNames: ['jcore-react-native'],
    harmonyPermissions: ['ohos.permission.NOTIFICATION_CONTROLLER'],
    sampleRoute: '/third-party-wave-b/jpush',
    acceptanceChecklist: [
      'Keep jpush-react-native, jcore-react-native, and mx-jpush-expo visible in doctor reports.',
      'Bundle guarded JPush init and registrationId lookup paths without native-module crashes.',
      'Record signed simulator and device push delivery evidence before any promotion.',
    ],
  },
  {
    id: 'expo-media-library',
    packageName: 'expo-media-library',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B tracks ccnubox media-library save flows through the camera-roll Harmony adapter while gallery write/read behavior remains runtime evidence.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: ['@react-native-oh-tpl/camera-roll'],
    harmonyPermissions: ['ohos.permission.READ_IMAGEVIDEO', 'ohos.permission.WRITE_IMAGEVIDEO'],
    sampleRoute: '/third-party-wave-b/media-library',
    acceptanceChecklist: [
      'Install expo-media-library with the camera-roll Harmony adapter available.',
      'Bundle permission and create-asset code paths used by ccnubox screenshots.',
      'Validate gallery write/read behavior on signed simulator and device before promotion.',
    ],
  },
  {
    id: 'lottie-react-native',
    packageName: 'lottie-react-native',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B tracks ccnubox Lottie animation surfaces through the Harmony adapter, but animation playback remains simulator and device smoke evidence.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: ['@react-native-oh-tpl/lottie-react-native'],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-b/lottie',
    acceptanceChecklist: [
      'Install lottie-react-native with the matching Harmony adapter.',
      'Bundle a minimal LottieView surface and local animation asset path.',
      'Validate playback on signed simulator and device before promotion.',
    ],
  },
  {
    id: 'react-native-skia',
    packageName: '@shopify/react-native-skia',
    status: 'manual',
    supportTier: 'experimental',
    runtimeMode: 'adapter',
    evidence: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE,
    evidenceSource: THIRD_PARTY_WAVE_B_BASELINE_EVIDENCE_SOURCE,
    note: 'v1.9.3 Wave B tracks ccnubox Skia timetable rendering through the Harmony adapter direction while canvas rendering remains runtime evidence.',
    docsUrl: 'https://github.com/react-native-oh-library',
    nativePackageNames: ['@react-native-oh-tpl/react-native-skia'],
    harmonyPermissions: [],
    sampleRoute: '/third-party-wave-b/skia',
    acceptanceChecklist: [
      'Install @shopify/react-native-skia with the Harmony Skia adapter available.',
      'Bundle a minimal Canvas/Skia import surface used by timetable rendering.',
      'Validate actual canvas rendering on signed simulator and device before promotion.',
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
