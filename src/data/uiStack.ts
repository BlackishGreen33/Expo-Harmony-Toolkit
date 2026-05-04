export const UI_STACK_VALIDATED_ADAPTERS = [
  {
    canonicalPackageName: 'react-native-reanimated',
    canonicalVersion: '3.6.0',
    adapterPackageName: '@react-native-oh-tpl/react-native-reanimated',
    adapterVersion: '3.6.4-rc.5',
    adapterRepository: 'react-native-oh-library/react-native-harmony-reanimated',
    adapterPath: 'react-native-harmony-reanimated',
    adapterCommit: '9fdbe676209937383907be0592291223c6ca7ad7',
    harmonyHarFileName: 'reanimated.har',
    supportsAutolinking: false,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-reanimated/ts',
      etsPackageName: 'ReanimatedPackage',
      cppHeaderName: 'ReanimatedPackage.h',
      cppPackageName: 'ReanimatedPackage',
      cmakeTargetName: 'rnoh_reanimated',
    },
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-reanimated',
  },
  {
    canonicalPackageName: 'react-native-svg',
    canonicalVersion: '15.0.0',
    adapterPackageName: '@react-native-oh-tpl/react-native-svg',
    adapterVersion: '15.0.1-rc.12',
    adapterRepository: 'react-native-oh-library/react-native-harmony-svg',
    adapterPath: 'react-native-harmony-svg',
    adapterCommit: '97c31d2f72559931d62fa84a9c86e86d343753d3',
    npmSpecifier: '15.0.1-rc.11',
    harmonyHarFileName: 'svg.har',
    supportsAutolinking: false,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-svg/ts',
      etsPackageName: 'SvgPackage',
      cppHeaderName: 'SVGPackage.h',
      cppPackageName: 'SVGPackage',
      cmakeTargetName: 'rnoh_svg',
    },
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-svg',
  },
] as const;

export type UiStackValidatedAdapter = (typeof UI_STACK_VALIDATED_ADAPTERS)[number];

export const HARMONY_NATIVE_ADAPTERS = [
  ...UI_STACK_VALIDATED_ADAPTERS,
  {
    canonicalPackageName: '@react-native-async-storage/async-storage',
    adapterPackageName: '@react-native-oh-tpl/async-storage',
    adapterVersion: '1.21.0-0.2.2',
    harmonyHarFileName: 'async_storage.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/async-storage/ts',
      etsPackageName: 'AsyncStoragePackage',
      cppHeaderName: 'AsyncStoragePackage.h',
      cppPackageName: 'AsyncStoragePackage',
      cmakeTargetName: 'rnoh_async_storage',
    },
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs',
  },
  {
    canonicalPackageName: 'react-native-webview',
    adapterPackageName: '@react-native-oh-tpl/react-native-webview',
    adapterVersion: '13.10.3',
    harmonyHarFileName: 'rn_webview.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-webview/ts',
      etsPackageName: 'WebViewPackage',
      cppHeaderName: 'WebViewPackage.h',
      cppPackageName: 'WebViewPackage',
      cmakeTargetName: 'rnoh_webview',
    },
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-webview.md',
  },
  {
    canonicalPackageName: 'react-native-screens',
    adapterPackageName: '@react-native-oh-tpl/react-native-screens',
    adapterVersion: '4.8.1-rc.3',
    harmonyHarFileName: 'screens.har',
    supportsAutolinking: true,
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  {
    canonicalPackageName: 'react-native-gesture-handler',
    adapterPackageName: '@react-native-oh-tpl/react-native-gesture-handler',
    adapterVersion: '2.14.17-rc.0',
    harmonyHarFileName: 'gesture_handler.har',
    supportsAutolinking: true,
    docsUrl: 'https://github.com/react-native-oh-library/react-native-harmony-gesture-handler',
  },
  {
    canonicalPackageName: 'lottie-react-native',
    adapterPackageName: '@react-native-oh-tpl/lottie-react-native',
    adapterVersion: '6.4.1-0.1.9-1',
    harmonyHarFileName: 'lottie.har',
    supportsAutolinking: true,
    managedAutolinking: {
      cppHeaderName: 'LottieAnimationViewPackage.h',
      cppPackageName: 'LottieAnimationViewPackage',
      cmakeTargetName: 'rnoh_lottie',
    },
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  {
    canonicalPackageName: 'react-native-safe-area-context',
    adapterPackageName: '@react-native-oh-tpl/react-native-safe-area-context',
    adapterVersion: '4.7.4-0.2.1',
    harmonyHarFileName: 'safe_area.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-safe-area-context/ts',
      etsPackageName: 'SafeAreaViewPackage',
      cppHeaderName: 'SafeAreaViewPackage.h',
      cppPackageName: 'SafeAreaViewPackage',
      cmakeTargetName: 'rnoh_safe_area',
    },
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  {
    canonicalPackageName: '@react-native-camera-roll/camera-roll',
    adapterPackageName: '@react-native-oh-tpl/camera-roll',
    adapterVersion: '7.8.4-rc.2',
    harmonyHarFileName: 'camera_roll.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/camera-roll/ts',
      etsPackageName: 'CameraRollPackage',
    },
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  {
    canonicalPackageName: '@react-native-clipboard/clipboard',
    adapterPackageName: '@react-native-oh-tpl/clipboard',
    adapterVersion: '1.13.2-0.0.9',
    harmonyHarFileName: 'clipboard.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/clipboard/ts',
      etsPackageName: 'ClipboardPackage',
      cppHeaderName: 'ClipboardPackage.h',
      cppPackageName: 'ClipboardPackage',
      cmakeTargetName: 'rnoh_clipboard',
    },
    docsUrl: 'https://github.com/react-native-oh-library',
  },
  {
    canonicalPackageName: 'react-native-image-picker',
    adapterPackageName: '@react-native-oh-tpl/react-native-image-picker',
    adapterVersion: '7.0.3-0.1.7',
    harmonyHarFileName: 'image_picker.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-image-picker/ts',
      etsPackageName: 'ImagePickerViewPackage',
      cppHeaderName: 'RNImagePickerPackage.h',
      cppPackageName: 'RNImagePickerPackage',
      cmakeTargetName: 'rnoh_image_picker',
    },
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-image-picker.md',
  },
  {
    canonicalPackageName: 'react-native-fs',
    adapterPackageName: '@react-native-oh-tpl/react-native-fs',
    adapterVersion: '2.20.0-0.1.14',
    harmonyHarFileName: 'fs.har',
    supportsAutolinking: true,
    managedAutolinking: {
      etsImportPath: '@react-native-oh-tpl/react-native-fs/ts',
      etsPackageName: 'FsPackage',
    },
    docsUrl: 'https://github.com/react-native-oh-library/usage-docs/blob/master/en/react-native-fs.md',
  },
  {
    canonicalPackageName: '@shopify/react-native-skia',
    adapterPackageName: '@react-native-oh-tpl/react-native-skia',
    adapterVersion: '1.3.8-rc.1',
    harmonyHarFileName: 'skia.har',
    supportsAutolinking: false,
    docsUrl: 'https://github.com/react-native-oh-library',
  },
] as const;

export type HarmonyNativeAdapter = (typeof HARMONY_NATIVE_ADAPTERS)[number];

export const UI_STACK_CANONICAL_TO_ADAPTER = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.map((entry) => [entry.canonicalPackageName, entry.adapterPackageName]),
) as Record<string, string>;

export const UI_STACK_ADAPTER_TO_CANONICAL = Object.fromEntries(
  UI_STACK_VALIDATED_ADAPTERS.map((entry) => [entry.adapterPackageName, entry.canonicalPackageName]),
) as Record<string, string>;

export const UI_STACK_ADAPTER_PACKAGE_NAMES = UI_STACK_VALIDATED_ADAPTERS.map(
  (entry) => entry.adapterPackageName,
);

export const HARMONY_NATIVE_ADAPTER_PACKAGE_NAMES = HARMONY_NATIVE_ADAPTERS.map(
  (entry) => entry.adapterPackageName,
);

export function getUiStackAdapterSpecifier(adapter: UiStackValidatedAdapter): string {
  return `github:${adapter.adapterRepository}#${adapter.adapterCommit}&path:${adapter.adapterPath}`;
}
