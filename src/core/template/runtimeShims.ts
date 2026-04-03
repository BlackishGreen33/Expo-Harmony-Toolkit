export function renderReactNativeSafeAreaContextHarmonyShim(): string {
  return `'use strict';

const React = require('react');
const { Dimensions, View } = require('react-native');

function getWindowMetrics() {
  const metrics = Dimensions.get('window') ?? { width: 0, height: 0 };

  return {
    frame: {
      x: 0,
      y: 0,
      width: typeof metrics.width === 'number' ? metrics.width : 0,
      height: typeof metrics.height === 'number' ? metrics.height : 0,
    },
    insets: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };
}

const initialWindowMetrics = getWindowMetrics();
const initialWindowSafeAreaInsets = initialWindowMetrics.insets;
const SafeAreaInsetsContext = React.createContext(initialWindowMetrics.insets);
const SafeAreaFrameContext = React.createContext(initialWindowMetrics.frame);

function SafeAreaProvider({ children, initialMetrics = initialWindowMetrics, style }) {
  const metrics = initialMetrics ?? initialWindowMetrics;

  return React.createElement(
    SafeAreaFrameContext.Provider,
    { value: metrics.frame },
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: metrics.insets },
      React.createElement(View, { style: [{ flex: 1 }, style] }, children),
    ),
  );
}

function NativeSafeAreaProvider(props) {
  return React.createElement(SafeAreaProvider, props);
}

function SafeAreaView({ children, style, ...rest }) {
  return React.createElement(View, { ...rest, style }, children);
}

function SafeAreaListener({ children }) {
  return typeof children === 'function' ? children(initialWindowMetrics) : null;
}

function useSafeAreaInsets() {
  return React.useContext(SafeAreaInsetsContext);
}

function useSafeAreaFrame() {
  return React.useContext(SafeAreaFrameContext);
}

function useSafeArea() {
  return useSafeAreaInsets();
}

function withSafeAreaInsets(Component) {
  return React.forwardRef((props, ref) =>
    React.createElement(Component, {
      ...props,
      ref,
      insets: useSafeAreaInsets(),
    }),
  );
}

module.exports = {
  EdgeInsets: undefined,
  initialWindowMetrics,
  initialWindowSafeAreaInsets,
  NativeSafeAreaProvider,
  SafeAreaConsumer: SafeAreaInsetsContext.Consumer,
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaListener,
  SafeAreaProvider,
  SafeAreaView,
  useSafeArea,
  useSafeAreaFrame,
  useSafeAreaInsets,
  withSafeAreaInsets,
};
`;
}

export function renderHarmonyRuntimePrelude(): string {
  return `'use strict';

require('react-native/Libraries/Core/InitializeCore');

function requireReactNativeBaseViewConfigHarmony() {
  try {
    return require('react-native/Libraries/NativeComponent/BaseViewConfig.harmony');
  } catch (_error) {
    return null;
  }
}

function requireRnohBaseViewConfigHarmony() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/BaseViewConfig.harmony');
  } catch (_error) {
    return null;
  }
}

function requireReactNativeBaseViewConfig() {
  try {
    return require('react-native/Libraries/NativeComponent/BaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireReactNativePlatformBaseViewConfig() {
  try {
    return require('react-native/Libraries/NativeComponent/PlatformBaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireRnohBaseViewConfig() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/BaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireRnohPlatformBaseViewConfig() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/PlatformBaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function patchNativeComponentViewConfigDefaults() {
  const harmonyBaseViewConfigModule =
    requireReactNativeBaseViewConfigHarmony() ?? requireRnohBaseViewConfigHarmony();
  const harmonyBaseViewConfig = harmonyBaseViewConfigModule?.default ?? harmonyBaseViewConfigModule;

  if (!harmonyBaseViewConfig) {
    return;
  }

  for (const moduleExports of [
    requireReactNativeBaseViewConfig(),
    requireReactNativePlatformBaseViewConfig(),
    requireRnohBaseViewConfig(),
    requireRnohPlatformBaseViewConfig(),
  ]) {
    if (moduleExports && typeof moduleExports === 'object') {
      moduleExports.default = harmonyBaseViewConfig;
    }
  }
}

function installGlobalIfMissing(name, factory) {
  if (typeof globalThis[name] !== 'undefined') {
    return;
  }

  const value = factory();

  if (typeof value !== 'undefined') {
    globalThis[name] = value;
  }
}

patchNativeComponentViewConfigDefaults();
installGlobalIfMissing('FormData', () => require('react-native/Libraries/Network/FormData').default);
installGlobalIfMissing('Blob', () => require('react-native/Libraries/Blob/Blob').default);
installGlobalIfMissing('FileReader', () => require('react-native/Libraries/Blob/FileReader').default);
`;
}
