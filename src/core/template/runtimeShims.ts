export function renderReactNativeSafeAreaContextHarmonyShim(): string {
  return `'use strict';

const React = require('react');
const { Dimensions, View, StyleSheet, I18nManager, TurboModuleRegistry, DeviceEventEmitter } = require('react-native');
const native = TurboModuleRegistry.get('SafeAreaTurboModule');
if (!native) throw new Error('RNOH SafeAreaTurboModule is unavailable. Rebuild the Harmony application.');
let currentInsets = native.getInitialInsets();

function getWindowMetrics() {
  const metrics = Dimensions.get('window') ?? { width: 0, height: 0 };

  return {
    frame: {
      x: 0,
      y: 0,
      width: typeof metrics.width === 'number' ? metrics.width : 0,
      height: typeof metrics.height === 'number' ? metrics.height : 0,
    },
    insets: currentInsets,
  };
}

const initialWindowMetrics = getWindowMetrics();
const initialWindowSafeAreaInsets = initialWindowMetrics.insets;
const SafeAreaInsetsContext = React.createContext(null);
const SafeAreaFrameContext = React.createContext(null);
let currentMetrics = initialWindowMetrics;
const listeners = new Set();
function publish() {
  currentMetrics = getWindowMetrics();
  listeners.forEach((listener) => listener());
}
DeviceEventEmitter.addListener('SAFE_AREA_INSETS_CHANGE', (insets) => {
  currentInsets = insets;
  publish();
});
Dimensions.addEventListener('change', publish);
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function SafeAreaProvider({ children, initialMetrics, initialSafeAreaInsets, style, onLayout, ...rest }) {
  const windowMetrics = React.useSyncExternalStore(subscribe, () => currentMetrics);
  const [measuredFrame, setFrame] = React.useState(null);
  const view = React.useRef(null);
  const frame = measuredFrame ?? initialMetrics?.frame ?? windowMetrics.frame;
  const baseInsets = windowMetrics.insets;
  const insets = !measuredFrame && (initialMetrics?.insets ?? initialSafeAreaInsets) || {
    top: Math.min(frame.height, Math.max(0, baseInsets.top - frame.y)),
    left: Math.min(frame.width, Math.max(0, baseInsets.left - frame.x)),
    bottom: Math.min(frame.height, Math.max(0, frame.y + frame.height - windowMetrics.frame.height + baseInsets.bottom)),
    right: Math.min(frame.width, Math.max(0, frame.x + frame.width - windowMetrics.frame.width + baseInsets.right)),
  };
  const measure = (event) => {
    view.current?.measureInWindow((x, y, width, height) => {
      setFrame((previous) => previous && previous.x === x && previous.y === y && previous.width === width && previous.height === height
        ? previous : { x, y, width, height });
    });
    onLayout?.(event);
  };

  return React.createElement(
    SafeAreaFrameContext.Provider,
    { value: frame },
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: insets },
      React.createElement(View, { ...rest, ref: view, onLayout: measure, style: [{ flex: 1 }, style] }, children),
    ),
  );
}

function NativeSafeAreaProvider(props) {
  return React.createElement(SafeAreaProvider, props);
}

const SafeAreaView = React.forwardRef(({ children, style, edges, mode = 'padding', ...rest }, ref) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const flattened = { ...StyleSheet.flatten(style) };
  const prefix = mode === 'margin' ? 'margin' : 'padding';
  const edgeModes = edges == null ? { top: 'additive', bottom: 'additive', left: 'additive', right: 'additive' }
    : Array.isArray(edges) ? Object.fromEntries(edges.map((edge) => [edge, 'additive'])) : edges;
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const suffix = edge[0].toUpperCase() + edge.slice(1);
    const horizontal = edge === 'left' || edge === 'right';
    const logical = horizontal ? prefix + ((edge === 'left') !== I18nManager.isRTL ? 'Start' : 'End') : '';
    const raw = flattened[logical] ?? flattened[prefix + suffix] ?? flattened[prefix + (horizontal ? 'Horizontal' : 'Vertical')] ?? flattened[prefix] ?? 0;
    const value = typeof raw === 'string' && raw.endsWith('%') ? Number.parseFloat(raw) * frame.width / 100 : raw;
    const edgeMode = edgeModes[edge] ?? 'off';
    flattened[prefix + suffix] = edgeMode === 'off' ? raw : edgeMode === 'maximum' ? Math.max(value, insets[edge]) : value + insets[edge];
  }
  delete flattened[prefix + 'Start'];
  delete flattened[prefix + 'End'];
  return React.createElement(View, { ...rest, ref, style: flattened }, children);
});

function SafeAreaListenerContent({ children, onChange }) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  React.useEffect(() => { onChange({ insets, frame }); }, [onChange, insets, frame]);
  return children;
}

function SafeAreaListener({ children, onChange, ...rest }) {
  return React.createElement(SafeAreaProvider, rest, React.createElement(SafeAreaListenerContent, { onChange }, children));
}

function useSafeAreaInsets() {
  const value = React.useContext(SafeAreaInsetsContext);
  if (!value) throw new Error('No safe area value available. Render SafeAreaProvider at the app root.');
  return value;
}

function useSafeAreaFrame() {
  const value = React.useContext(SafeAreaFrameContext);
  if (!value) throw new Error('No safe area frame available. Render SafeAreaProvider at the app root.');
  return value;
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
