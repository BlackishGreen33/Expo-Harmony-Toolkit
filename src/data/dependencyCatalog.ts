import { CompatibilityRecord } from '../types';
import { TOOLKIT_PACKAGE_NAME } from '../core/constants';
import { CAPABILITY_DEFINITIONS } from './capabilities';
import {
  HARMONY_NATIVE_ADAPTERS,
  UI_STACK_VALIDATED_ADAPTERS,
  getUiStackAdapterSpecifier,
} from './uiStack';

const UI_STACK_COMPATIBILITY_RECORDS = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.flatMap((entry) => [
    [
      entry.canonicalPackageName,
      {
        status: 'supported',
        supportTier: 'verified',
        note: `Supported in the validated UI-stack matrix when paired with ${entry.adapterPackageName} and the managed Harmony autolinking output.`,
        replacement: entry.adapterPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
    [
      entry.adapterPackageName,
      {
        status: 'supported',
        supportTier: 'verified',
        note: `Harmony adapter pinned to ${entry.adapterVersion}. The validated matrix requires the exact Git spec ${getUiStackAdapterSpecifier(entry)}.`,
        replacement: entry.canonicalPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
  ]),
) as Record<string, CompatibilityRecord>;

const UI_STACK_ADAPTER_PACKAGE_NAME_SET = new Set<string>(
  UI_STACK_VALIDATED_ADAPTERS.map((entry) => entry.adapterPackageName),
);

const HARMONY_NATIVE_ADAPTER_COMPATIBILITY_RECORDS = Object.fromEntries(
  HARMONY_NATIVE_ADAPTERS.filter(
    (entry) => !UI_STACK_ADAPTER_PACKAGE_NAME_SET.has(entry.adapterPackageName),
  ).flatMap((entry) => [
    [
      entry.canonicalPackageName,
      {
        status: 'manual',
        supportTier: 'experimental',
        note: `Harmony runtime support is tracked through ${entry.adapterPackageName}. Keep it on the experimental lane until bundle, debug HAP, and device evidence are recorded for the consuming app.`,
        replacement: entry.adapterPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
    [
      entry.adapterPackageName,
      {
        status: 'manual',
        supportTier: 'experimental',
        note: `Harmony adapter package pinned by the ccnubox intake catalog. The toolkit can link its HAR when ${entry.harmonyHarFileName} is installed, but runtime behavior still needs app-level evidence.`,
        replacement: entry.canonicalPackageName,
        docsUrl: entry.docsUrl,
      } satisfies CompatibilityRecord,
    ],
  ]),
) as Record<string, CompatibilityRecord>;

export const DEPENDENCY_CATALOG: Record<string, CompatibilityRecord> = {
  [TOOLKIT_PACKAGE_NAME]: {
    status: 'supported',
    supportTier: 'verified',
    note: 'The published toolkit package may be installed locally to provide the CLI and config plugin inside a validated project.',
  },
  expo: {
    status: 'supported',
    supportTier: 'verified',
    note: 'Toolkit can parse Expo config and scaffold Harmony sidecar files for managed/CNG projects.',
  },
  '@expo/metro-runtime': {
    status: 'supported',
    supportTier: 'verified',
    note: 'Metro runtime is part of the validated managed Expo routing/bundling chain and keeps Expo workspace peers aligned.',
  },
  '@babel/runtime': {
    status: 'supported',
    supportTier: 'verified',
    note: 'Runtime helpers are used by the official minimal sample bundling chain.',
  },
  '@react-native-community/cli': {
    status: 'supported',
    supportTier: 'verified',
    note: 'The React Native CLI exposes the bundle-harmony command used by the official sample.',
  },
  '@react-native-oh/react-native-harmony': {
    status: 'supported',
    supportTier: 'verified',
    note: 'This is the RNOH runtime package used by the vendored Harmony sidecar template.',
  },
  '@react-native-oh/react-native-harmony-cli': {
    status: 'supported',
    supportTier: 'verified',
    note: 'This package provides the bundle-harmony command used by the official minimal sample.',
  },
  react: {
    status: 'supported',
    supportTier: 'verified',
    note: 'React is treated as a baseline JavaScript dependency.',
  },
  'react-dom': {
    status: 'supported',
    supportTier: 'verified',
    note: 'React DOM is treated as a workspace peer for Expo Router and web-capable managed Expo projects inside the validated matrix.',
  },
  'react-native': {
    status: 'supported',
    supportTier: 'verified',
    note: 'React Native is supported as managed Expo input, but runtime portability is only promised inside the validated matrix.',
  },
  metro: {
    status: 'supported',
    supportTier: 'verified',
    note: 'Metro is part of the official sample bundling chain.',
  },
  'expo-status-bar': {
    status: 'supported',
    supportTier: 'verified',
    note: 'Status bar rendering stays in the JavaScript/UI layer for the official minimal sample.',
  },
  'expo-asset': {
    status: 'manual',
    supportTier: 'preview',
    note: 'v1.9.0 app-foundation baseline keeps Asset API imports and load paths bundle-safe through the toolkit shim; native asset cache parity still needs device and release evidence.',
  },
  'expo-build-properties': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Native property overrides should be reviewed manually because Harmony uses a separate sidecar project.',
  },
  'expo-constants': {
    status: 'supported',
    supportTier: 'verified',
    note: 'Constants reads are treated as part of the validated App Shell matrix when they stay in the JavaScript layer.',
  },
  'expo-linking': {
    status: 'supported',
    supportTier: 'verified',
    note: 'URL generation and JS-layer linking are treated as part of the validated App Shell matrix.',
  },
  'expo-router': {
    status: 'supported',
    supportTier: 'verified',
    note: 'File-based routing is treated as part of the validated App Shell matrix when router peers, scheme, and plugin config are present.',
  },
  '@react-native-async-storage/async-storage': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Async storage is a high-frequency startup dependency. Treat it as an experimental Harmony intake dependency until the managed adapter path has stable doctor, sample, and build coverage.',
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  'react-native-safe-area-context': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Safe-area handling is shimmed by the toolkit for Harmony so App Shell layouts can keep rendering while the native path remains outside the verified matrix.',
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  'react-native-screens': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Navigation stacks frequently depend on react-native-screens. Keep it on the experimental lane until the Harmony adapter path has repeatable sample and device coverage.',
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  'react-native-webview': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'WebView is a common app-shell blocker. Treat it as an experimental intake dependency until the Harmony runtime path is validated on device.',
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  ...UI_STACK_COMPATIBILITY_RECORDS,
  ...HARMONY_NATIVE_ADAPTER_COMPATIBILITY_RECORDS,
  'react-native-gesture-handler': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Gesture Handler is not part of the current public matrix. Device-side runtime validation is still blocked by the current Harmony adapter and RNOH combination.',
    replacement: '@react-native-oh-tpl/react-native-gesture-handler',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  '@react-native-oh-tpl/react-native-gesture-handler': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'The current Gesture Handler adapter remains experimental and is outside the validated matrix until its ArkTS turbo module path runs cleanly on device.',
    replacement: 'react-native-gesture-handler',
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  '@ant-design/icons-react-native': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Icon font rendering is accepted for the ccnubox intake path; font asset registration still needs bundle/debug validation on Harmony.',
  },
  '@ant-design/react-native': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'React Native UI components are JS-heavy, but the app must still validate modal, picker, and gesture surfaces on Harmony.',
  },
  '@bacons/apple-targets': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'iOS widget build tooling may be excluded from Harmony doctor because it does not participate in the Harmony runtime.',
  },
  '@expo/vector-icons': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Vector icon rendering is accepted when paired with bundled icon fonts and a working Expo font path.',
  },
  '@lottiefiles/dotlottie-react': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'dotLottie usage remains an experimental animation surface until the app records Harmony runtime evidence.',
  },
  '@react-navigation/bottom-tabs': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'React Navigation tabs are accepted for the ccnubox app-shell path when paired with screens, safe-area, gesture, and reanimated validation.',
  },
  '@react-navigation/elements': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'React Navigation elements stay in the JS/UI layer but inherit the navigation-stack runtime evidence requirements.',
  },
  '@react-navigation/native': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'React Navigation native is accepted for managed Harmony intake when linking, safe-area, screens, and gesture dependencies are present.',
  },
  '@rneui/base': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'RNE base components are accepted as JS/UI dependencies and should be covered by app-level visual smoke tests.',
  },
  '@rneui/themed': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'RNE themed components are accepted as JS/UI dependencies and should be covered by app-level visual smoke tests.',
  },
  axios: {
    status: 'supported',
    supportTier: 'verified',
    note: 'HTTP client dependency with no native surface.',
  },
  'expo-application': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Application metadata reads require Harmony verification because Expo native modules are outside the verified UI-stack matrix.',
  },
  'expo-blur': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Blur effects need visual verification on Harmony and are not part of the verified UI-stack matrix.',
  },
  'expo-clipboard': {
    status: 'manual',
    supportTier: 'preview',
    note: 'v1.9.0 app-foundation baseline provides a session clipboard shim and keeps the Harmony clipboard adapter as the native promotion path.',
    replacement: '@react-native-oh-tpl/clipboard',
  },
  'expo-device': {
    status: 'manual',
    supportTier: 'preview',
    note: 'v1.9.0 app-foundation baseline exposes stable Harmony placeholder device metadata while real hardware metadata remains promotion evidence.',
  },
  'expo-dev-client': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Dev-client native behavior is outside release eligibility; it may exist in the project without blocking experimental intake.',
  },
  'expo-font': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Font loading is accepted for ccnubox intake but must be validated with bundled icon/font assets in the Harmony HAP.',
  },
  'expo-haptics': {
    status: 'manual',
    supportTier: 'preview',
    note: 'v1.9.0 app-foundation baseline turns haptics calls into safe no-ops until a real Harmony device feedback path is validated.',
  },
  'expo-image': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Image rendering and cache behavior require Harmony bundle and device validation.',
  },
  'expo-image-manipulator': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Image manipulation remains an experimental ccnubox requirement for timetable screenshot/export flows.',
  },
  'expo-insights': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Telemetry should not block bundle intake, but Harmony runtime behavior remains outside the verified matrix.',
  },
  'expo-linear-gradient': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Gradient rendering requires visual smoke validation on Harmony.',
  },
  'expo-media-library': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Media-library write/read flows should be backed by the Harmony camera-roll adapter for screenshot save acceptance.',
    replacement: '@react-native-oh-tpl/camera-roll',
  },
  'expo-secure-store': {
    status: 'manual',
    supportTier: 'preview',
    note: 'v1.9.0 app-foundation baseline provides a session secure-store shim; encrypted persistence still needs native device and release evidence.',
  },
  'expo-splash-screen': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Splash behavior is accepted for ccnubox intake but remains native-side runtime evidence.',
  },
  'expo-symbols': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Symbols are platform-specific visual assets and require Harmony fallback/runtime verification.',
  },
  'expo-system-ui': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'System UI updates touch native chrome and need Harmony runtime validation.',
  },
  'expo-updates': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'OTA update checks remain experimental on Harmony until update metadata and launch behavior are validated.',
  },
  'expo-web-browser': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'In-app browser flows need Harmony runtime validation; they must not replace WebView parity for pages that require injected scripts.',
  },
  'jcore-react-native': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'JCore is accepted as part of the JPush Harmony intake path, but device-side SDK evidence is required.',
    docsUrl: 'https://docs.jiguang.cn/jpush/client/HarmonyOS/hmos_guide',
  },
  'jpush-react-native': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'JPush is a real runtime requirement for ccnubox. Keep it in the catalog and require a Harmony SDK bridge plus device evidence for registrationId, arrival, click, and cold-start payloads.',
    docsUrl: 'https://docs.jiguang.cn/jpush/client/HarmonyOS/hmos_guide',
  },
  'mx-jpush-expo': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'The Expo config plugin may be excluded from Harmony config processing, but the JPush runtime dependency must stay visible in doctor reports.',
    docsUrl: 'https://docs.jiguang.cn/jpush/client/HarmonyOS/hmos_guide',
  },
  'react-native-draggable-grid': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Drag-grid behavior is accepted for the ccnubox homepage intake and requires gesture/runtime smoke validation.',
  },
  'react-native-edge-to-edge': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'Android edge-to-edge native configuration can be excluded as a config plugin; runtime chrome behavior remains Harmony-specific.',
  },
  'react-native-keyboard-aware-scroll-view': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Keyboard-aware scrolling is accepted as JS/UI behavior but requires form-flow validation on Harmony.',
  },
  'react-native-pdf-renderer': {
    status: 'manual',
    supportTier: 'experimental',
    note: 'PDF rendering is a native-looking app requirement and remains experimental until a Harmony renderer or adapter is validated.',
  },
  'react-native-reanimated-carousel': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Carousel behavior is accepted when paired with the validated reanimated Harmony adapter and homepage smoke tests.',
  },
  'react-native-svg-transformer': {
    status: 'supported',
    supportTier: 'experimental',
    note: 'Metro SVG transformation is accepted for bundling when paired with the validated react-native-svg Harmony adapter.',
  },
  'react-native-web': {
    status: 'supported',
    supportTier: 'verified',
    note: 'Web support dependency has no Harmony native runtime surface.',
  },
  zustand: {
    status: 'supported',
    supportTier: 'verified',
    note: 'State management dependency with no native surface.',
  },
  ...Object.fromEntries(
    CAPABILITY_DEFINITIONS.map((definition) => [
      definition.packageName,
      {
        status: definition.status,
        supportTier: definition.supportTier,
        note: definition.note,
        docsUrl: definition.docsUrl,
      } satisfies CompatibilityRecord,
    ]),
  ),
};
