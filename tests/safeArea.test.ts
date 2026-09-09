import { runInNewContext } from 'node:vm';
import { renderReactNativeSafeAreaContextHarmonyShim } from '../src/core/template/runtimeShims';

it('uses RNOH measured insets, follows native changes and applies selected edges to padding or margin', () => {
  const insets = { top: 30, right: 0, bottom: 20, left: 0 };
  const nativeEvents = { addListener: jest.fn() };
  let window = { width: 400, height: 800 };
  const dimensions = { get: () => window, addEventListener: jest.fn() };
  const React = {
    createContext: (value: unknown) => ({ value }),
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
    forwardRef: (fn: unknown) => fn,
    useContext: (context: { value: unknown }) => context.value,
    useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
    useState: (value: unknown) => [typeof value === 'function' ? value() : value, jest.fn()],
    useRef: () => ({ current: null }), useEffect: jest.fn(),
  };
  const module = { exports: {} as any };
  runInNewContext(renderReactNativeSafeAreaContextHarmonyShim(), {
    module, require: (name: string) => name === 'react' ? React : {
      Dimensions: dimensions,
      TurboModuleRegistry: { get: () => ({ getInitialInsets: () => insets }) },
      DeviceEventEmitter: nativeEvents, View: 'View', I18nManager: { isRTL: false },
      StyleSheet: { flatten: (value: unknown) => value ?? {} },
    },
  });
  const api = module.exports;
  expect(api.initialWindowMetrics.insets).toEqual(insets);
  api.SafeAreaInsetsContext.value = insets;
  api.SafeAreaFrameContext.value = api.initialWindowMetrics.frame;
  const padded = api.SafeAreaView({ edges: ['top', 'bottom'], style: { padding: 4 }, testID: 'safe' });
  expect(padded.props.style).toMatchObject({ paddingTop: 34, paddingBottom: 24, paddingLeft: 4 });
  expect(padded.props.testID).toBe('safe');
  const margin = api.SafeAreaView({ mode: 'margin', edges: { top: 'maximum', bottom: 'off' }, style: { marginTop: 40, marginBottom: 3 } });
  expect(margin.props.style).toMatchObject({ marginTop: 40, marginBottom: 3 });
  const [eventName, onInsets] = nativeEvents.addListener.mock.calls[0];
  expect(eventName).toBe('SAFE_AREA_INSETS_CHANGE');
  onInsets({ ...insets, top: 0 });
  const provider = api.SafeAreaProvider({ children: 'child' });
  // The provider publishes measured native changes, not a fixed zero-inset baseline.
  expect(JSON.stringify(provider)).toContain('"bottom":20');
  expect(JSON.stringify(provider)).toContain('"top":0');
  const initial = api.SafeAreaProvider({ initialMetrics: { frame: { x: 0, y: 30, width: 400, height: 600 }, insets } });
  expect(initial.children[0].props.value).toEqual(insets);
  window = { width: 800, height: 400 };
  expect(dimensions.addEventListener.mock.calls[0][0]).toBe('change');
  dimensions.addEventListener.mock.calls[0][1]();
  expect(api.SafeAreaProvider({}).props.value).toEqual({ x: 0, y: 0, width: 800, height: 400 });
});
