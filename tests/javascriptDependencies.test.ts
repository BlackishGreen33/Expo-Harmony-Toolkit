import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { normalizeKnownJavaScriptDependencies } from '../src/core/javascriptDependencies';

it('does not discard a Harmony cold-start URL when the native bridge takes over 150 ms', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-linking-timeout-'));
  const file = path.join(root, 'node_modules/expo-router/build/fork/useLinking.native.js');
  const source = `function getInitialURLWithTimeout() {
    if (typeof window === 'undefined') return '';
    if (react_native_1.Platform.OS === 'ios') return ExpoLinking.getLinkingURL();
    return Promise.race([
      react_native_1.Linking.getInitialURL(),
      new Promise(resolve => setTimeout(() => resolve(null), 150)),
    ]);
  }
  exports.getInitialURLWithTimeout = getInitialURLWithTimeout;`;
  try {
    await fs.outputFile(file, source);
    const restore = await normalizeKnownJavaScriptDependencies(
      root, { dependencies: { react: '19.2.3' } }, { restoreOnCompletion: true },
    );
    try {
      for (const platform of ['harmony', 'android', 'ios']) {
        const exports: Record<string, any> = {};
        let timeout: (() => void) | undefined;
        let resolveNative!: (url: string) => void;
        const nativeUrl = new Promise<string>(resolve => { resolveNative = resolve; });
        runInNewContext(await fs.readFile(file, 'utf8'), {
          exports, window: {},
          react_native_1: { Platform: { OS: platform }, Linking: { getInitialURL: () => nativeUrl } },
          ExpoLinking: { getLinkingURL: () => 'ios://calendar' },
          setTimeout: (callback: () => void) => { timeout = callback; },
        });
        const result = exports.getInitialURLWithTimeout();
        timeout?.();
        resolveNative('ccnubox://calendar');
        expect(await result).toBe(platform === 'harmony' ? 'ccnubox://calendar' : platform === 'ios' ? 'ios://calendar' : null);
      }
    } finally {
      await restore();
    }
    expect(await fs.readFile(file, 'utf8')).toBe(source);
  } finally {
    await fs.remove(root);
  }
});

it('bundles Expo Router with old screens while preserving native flags and restoring package files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-router-flags-'));
  const file = path.join(root, 'node_modules/expo-router/build/screensFeatureFlags.js');
  const source = `const react_native_screens_1 = require('react-native-screens');
react_native_screens_1.featureFlags.experiment.iosPreventReattachmentOfDismissedScreens = true;
exports.initScreensFeatureFlags = function () {
  react_native_screens_1.featureFlags.experiment.synchronousScreenUpdatesEnabled = true;
};
`;
  try {
    await fs.outputFile(file, source);
    const restore = await normalizeKnownJavaScriptDependencies(
      root, { dependencies: { react: '19.2.3' } }, { restoreOnCompletion: true },
    );
    try {
      const patched = await fs.readFile(file, 'utf8');
      for (const screens of [{}, { featureFlags: { experiment: {} } }]) {
        const exports: { initScreensFeatureFlags?: () => void } = {};
        expect(() => {
          runInNewContext(patched, { exports, require: () => screens });
          exports.initScreensFeatureFlags!();
        }).not.toThrow();
        if ('featureFlags' in screens) {
          expect(screens.featureFlags?.experiment).toEqual({
            iosPreventReattachmentOfDismissedScreens: true,
            synchronousScreenUpdatesEnabled: true,
          });
        }
      }
    } finally {
      await restore();
    }
    expect(await fs.readFile(file, 'utf8')).toBe(source);
  } finally {
    await fs.remove(root);
  }
});

it('keeps legacy Fabric lookup interoperable and skips unavailable gesture diagnostics only during Harmony bundling', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-fabric-interop-'));
  const renderer = path.join(root, 'node_modules/@react-native-oh/react-native-harmony/Libraries/Renderer/shims/ReactFabric.js');
  const detector = path.join(root, 'node_modules/@harmony-js/gestures/src/handlers/gestures/GestureDetector.tsx');
  const rendererSource = 'const ReactFabric = { findHostInstance_DEPRECATED: ref => ref.host };\nexport default ReactFabric;\n';
  const detectorSource = `if (isFabric()) {
  const node = getShadowNodeFromRef(ref);
  if (global.isFormsStackingContext(node) === false) reportFlattened();
}`;
  try {
    await fs.outputFile(renderer, rendererSource);
    await fs.outputFile(detector, detectorSource);
    const restore = await normalizeKnownJavaScriptDependencies(root, {
      dependencies: { react: '19.2.3' },
      devDependencies: { '@harmony-js/gestures': 'npm:react-native-gesture-handler@2.14.1' },
    }, { restoreOnCompletion: true });
    try {
      const exports: Record<string, any> = {};
      runInNewContext(ts.transpileModule(await fs.readFile(renderer, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText, { exports });
      expect(exports.findHostInstance_DEPRECATED({ host: 42 })).toBe(42);
      expect(exports.default.findHostInstance_DEPRECATED({ host: 43 })).toBe(43);
      const reportFlattened = jest.fn();
      for (const nativeDiagnostic of [undefined, () => false, () => true]) {
        const getShadowNodeFromRef = jest.fn(() => ({}));
        runInNewContext(await fs.readFile(detector, 'utf8'), {
          global: { isFormsStackingContext: nativeDiagnostic },
          isFabric: () => true, ref: {}, getShadowNodeFromRef, reportFlattened,
        });
        expect(getShadowNodeFromRef).toHaveBeenCalledTimes(nativeDiagnostic ? 1 : 0);
      }
      expect(reportFlattened).toHaveBeenCalledTimes(1);
    } finally {
      await restore();
    }
    expect(await fs.readFile(renderer, 'utf8')).toBe(rendererSource);
    expect(await fs.readFile(detector, 'utf8')).toBe(detectorSource);
  } finally {
    await fs.remove(root);
  }
});

it('uses the renderer host-instance accessor for old Reanimated and Gesture Handler shadow-node lookups', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-host-ref-'));
  const files = [
    'node_modules/@harmony-js/gestures/src/getShadowNodeFromRef.ts',
    'node_modules/@harmony-js/animation/src/reanimated2/fabricUtils.ts',
  ].map((file) => path.join(root, file));
  const source = `exports.getNode = function(ref) {
    return findHostInstance_DEPRECATED(ref)._internalInstanceHandle.stateNode
      .node;
  };`;
  const viewFile = path.join(root, 'node_modules/@harmony-js/animation/src/createAnimatedComponent/createAnimatedComponent.tsx');
  const viewSource = `exports.viewInfo = function(hostInstance) {
    let viewTag, viewName, viewConfig;
    viewTag = hostInstance?._nativeTag;
    viewName = hostInstance?.viewConfig?.uiViewClassName;
    viewConfig = hostInstance?.viewConfig;
    return { viewTag, viewName, viewConfig };
  };`;
  try {
    for (const file of files) await fs.outputFile(file, source);
    await fs.outputFile(viewFile, viewSource);
    const restore = await normalizeKnownJavaScriptDependencies(root, {
      dependencies: { react: '19.2.3' },
      devDependencies: {
        '@harmony-js/gestures': 'npm:react-native-gesture-handler@2.14.1',
        '@harmony-js/animation': 'npm:react-native-reanimated@3.6.0',
      },
    }, { restoreOnCompletion: true });
    try {
      for (const file of files) {
        const exports: Record<string, any> = {};
        runInNewContext(await fs.readFile(file, 'utf8'), {
          exports,
          findHostInstance_DEPRECATED: (ref: unknown) => ref,
          require: (name: string) => {
            expect(name).toBe('react-native/Libraries/ReactPrivate/ReactNativePrivateInterface');
            return {
              getInternalInstanceHandleFromPublicInstance: (ref: any) =>
                ref.__internalInstanceHandle ?? ref._internalInstanceHandle,
            };
          },
        });
        for (const key of ['_internalInstanceHandle', '__internalInstanceHandle']) {
          expect(exports.getNode({ [key]: { stateNode: { node: 42 } } })).toBe(42);
        }
      }
      const exports: Record<string, any> = {};
      const viewConfig = { uiViewClassName: 'RCTView' };
      runInNewContext(await fs.readFile(viewFile, 'utf8'), { exports });
      for (const host of [{ _nativeTag: 42, viewConfig }, { __nativeTag: 42, __viewConfig: viewConfig }]) {
        expect(exports.viewInfo(host)).toEqual({ viewTag: 42, viewName: 'RCTView', viewConfig });
      }
    } finally {
      await restore();
    }
    for (const file of files) expect(await fs.readFile(file, 'utf8')).toBe(source);
    expect(await fs.readFile(viewFile, 'utf8')).toBe(viewSource);
  } finally {
    await fs.remove(root);
  }
});
