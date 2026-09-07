import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { ensureNormalizedLocalHarCompatibilityShims } from '../src/core/build/compatibilityShims';
import { HARMONY_NATIVE_ADAPTERS } from '../src/data/uiStack';

it.each(['\n', '\r\n'])('passes the cold-start URI into the RNOH worker registry (%j)', async (newline) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-launch-uri-'));
  const file = path.join(root, 'src/main/ets/RNOH/RNInstancesCoordinator.ets');
  const original = `this.rnInstanceRegistry = new RNInstanceRegistry(
      'existing arguments',
      (rnInstance) => {
        rnInstance.postMessageToCpp('WINDOW_ID', 1);
      }
    )`.replace(/\n/g, newline);
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@rnoh/react-native-openharmony');
    const patched = await fs.readFile(file, 'utf8');
    const registry = jest.fn();
    const create = new Function('RNInstanceRegistry', 'options', patched);
    create.call({}, registry, { launchURI: 'ccnubox://checkUpdate' });
    expect(registry.mock.calls[0][0]).toBe('existing arguments');
    const callback = registry.mock.calls[0][1];
    const postMessageToCpp = jest.fn();
    callback({ postMessageToCpp });
    expect(postMessageToCpp).toHaveBeenCalledWith('WINDOW_ID', 1);
    expect(registry.mock.calls[0][2]).toBe('ccnubox://checkUpdate');
    create.call({}, registry, undefined);
    expect(registry.mock.calls[1][2]).toBeUndefined();
    await ensureNormalizedLocalHarCompatibilityShims(root, '@rnoh/react-native-openharmony');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});

it.each(['\n', '\r\n'])('connects the WebView descriptor to its native view (%j)', async (newline) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-webview-'));
  const file = path.join(root, 'src/main/ets/RNCWebViewPackage.ets');
  const original = [
    "import { RNOHPackage } from '@rnoh/react-native-openharmony';",
    'export class RNCWebViewPackage extends RNOHPackage  {',
    '  createAnyThreadTurboModuleFactory() { return "existing factory"; }',
    '}',
  ].join(newline);
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-webview');
    const patched = await fs.readFile(file, 'utf8');
    const nativeView = jest.fn();
    const exports: Record<string, any> = {};
    const script = ts.transpile(patched.replace(/^@Builder\r?\n/gm, ''), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
    new Function('require', 'exports', 'wrapBuilder', script)(
      (name: string) => name === './RNCWebView' ? { RNCWebView: nativeView } : { RNOHPackage: class {} },
      exports,
      (builder: unknown) => builder,
    );
    const pkg = new exports.RNCWebViewPackage();
    const builders = pkg.createWrappedCustomRNComponentBuilderByComponentNameMap?.();
    expect(builders?.has('RNCWebView')).toBe(true);
    const context = { rnComponentContext: { instanceId: 1 }, tag: 42 };
    builders.get('RNCWebView')(context);
    expect(nativeView).toHaveBeenCalledWith({ ctx: context.rnComponentContext, tag: 42 });
    expect(pkg.createAnyThreadTurboModuleFactory()).toBe('existing factory');
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-webview');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});

it.each(['\n', '\r\n'])('registers the existing Screens content builder once (%j)', async (newline) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-screens-'));
  const file = path.join(root, 'src/main/ets/RNOHScreensPackage.ets');
  const original = [
    'import { RNSScreenContentWrapper } from "./components/RNSScreenContentWrapper";',
    'return new Map()',
    '  .set(RNSSearchBar.NAME, wrapBuilder(componentBuilder))',
  ].join(newline);
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-screens');
    const patched = await fs.readFile(file, 'utf8');
    expect(patched).toContain(`${newline}  .set(RNSScreenContentWrapper.NAME, wrapBuilder(componentBuilder))`);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-screens');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});

it('does not push the first screen twice after descriptor initialization', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-screens-stack-'));
  const file = path.join(root, 'src/main/ets/components/RNSScreenStack.ets');
  const original = `onDescriptorChange() {
    const newChildren = this.descriptor.childrenTags;
    this.updateStack(newChildren)
    this.stack = [...newChildren]
  }
  async aboutToAppear() {
    this.descriptor = this.ctx.descriptorRegistry.getDescriptor(this.tag)
    const insets = await this.safeAreaInsets.getSafeAreaInsets()
    this.topInset = insets.top
    this.stackController.pushPathByName(this.stack[0].toString(), null)
  }`;
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-screens');
    const patched = await fs.readFile(file, 'utf8');
    // ArkUI invokes the descriptor watcher before the awaited inset read finishes.
    const paths: string[] = [];
    const screen = {
      ctx: { descriptorRegistry: { getDescriptor: () => ({ childrenTags: [11] }) } },
      tag: 1,
      stack: [] as number[],
      topInset: 0,
      safeAreaInsets: { getSafeAreaInsets: async () => ({ top: 24 }) },
      stackController: { pushPathByName: (name: string) => paths.push(name) },
      updateStack: (children: number[]) => paths.push(...children.map(String)),
      set descriptor(value: { childrenTags: number[] }) {
        this.updateStack(value.childrenTags);
        this.stack = [...value.childrenTags];
      },
    };
    const body = patched.match(/async aboutToAppear\(\) \{([\s\S]*)\}/)![1];
    const initialize = new Function(`return async function() {${body}}`)();
    await initialize.call(screen);
    expect(paths).toEqual(['11']);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-screens');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});

it('preserves Lottie color filter arrays across the native prop boundary', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-lottie-props-'));
  const cpp = path.join(root, 'src/main/cpp');
  try {
    await fs.outputFile(path.join(root, 'index.ets'), "export * from './src/main/ets/LottieAnimationView';\n");
    await fs.outputFile(path.join(cpp, 'Props.h'), '#include <jsi/jsi.h>\nstd::string colorFilters{};\n');
    await fs.outputFile(path.join(cpp, 'Props.cpp'), 'colorFilters(convertRawProp(context, rawProps, "colorFilters", sourceProps.colorFilters, {}))');
    await fs.outputFile(path.join(cpp, 'LottieAnimationViewJSIBinder.h'), 'object.setProperty(rt, "colorFilters", "string");');
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/lottie-react-native');
    const first = await Promise.all(['Props.h', 'Props.cpp', 'LottieAnimationViewJSIBinder.h'].map((name) => fs.readFile(path.join(cpp, name), 'utf8')));
    expect(first[0]).toContain('folly::dynamic colorFilters = folly::dynamic::array();');
    expect(first[1]).toContain('sourceProps.colorFilters, folly::dynamic::array()');
    expect(first[2]).toContain('"colorFilters", "Object"');
    const nativePackage = await fs.readFile(path.join(root, 'src/main/ets/RNOHLottiePackage.ets'), 'utf8');
    const exports: Record<string, any> = {};
    const nativeView = jest.fn();
    new Function('require', 'exports', 'wrapBuilder', ts.transpile(nativePackage.replace(/^@Builder\r?\n/gm, ''), {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    }))((name: string) => name === './LottieAnimationView'
      ? { LottieAnimationView: nativeView, LOTTIE_TYPE: 'LottieAnimationView' }
      : { RNOHPackage: class {} }, exports, (builder: unknown) => builder);
    const context = { rnComponentContext: { instanceId: 1 }, tag: 7 };
    new exports.RNOHLottiePackage().createWrappedCustomRNComponentBuilderByComponentNameMap().get('LottieAnimationView')(context);
    expect(nativeView).toHaveBeenCalledWith({ ctx: context.rnComponentContext, tag: 7 });
    expect(await fs.readFile(path.join(root, 'index.ets'), 'utf8')).toContain("export * from './src/main/ets/RNOHLottiePackage'");
    expect(HARMONY_NATIVE_ADAPTERS.find(adapter => adapter.canonicalPackageName === 'lottie-react-native')?.managedAutolinking).toMatchObject({
      etsImportPath: '@react-native-oh-tpl/lottie-react-native', etsPackageName: 'RNOHLottiePackage',
    });
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/lottie-react-native');
    expect(await Promise.all(['Props.h', 'Props.cpp', 'LottieAnimationViewJSIBinder.h'].map((name) => fs.readFile(path.join(cpp, name), 'utf8')))).toEqual(first);
    expect(await fs.readFile(path.join(root, 'src/main/ets/RNOHLottiePackage.ets'), 'utf8')).toBe(nativePackage);
  } finally {
    await fs.remove(root);
  }
});

it('registers both Skia native views while preserving its existing TurboModule factory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-skia-views-'));
  const original = "class ExistingFactory {}\nexport class RNSkiaPackage extends RNPackage { createTurboModulesFactory() { return 'existing'; } }";
  try {
    await fs.outputFile(path.join(root, 'src/main/ets/RNSkiaPackage.ts'), original);
    await fs.outputFile(path.join(root, 'ts.ts'), "export * from './src/main/ets/RNSkiaPackage';\n");
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-skia');
    const nativePackage = await fs.readFile(path.join(root, 'src/main/ets/RNOHSkiaPackage.ets'), 'utf8');
    expect(nativePackage.indexOf('import { RNOHPackage')).toBeLessThan(nativePackage.indexOf('class ExistingFactory'));
    const exports: Record<string, any> = {};
    const domView = jest.fn();
    const pictureView = jest.fn();
    class RNOHPackage {}
    new Function('require', 'exports', 'wrapBuilder', ts.transpile(nativePackage.replace(/^@Builder\r?\n/gm, ''), {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    }))((name: string) => name === './RNCSkiaDomView' ? { RNCSkiaDomView: domView }
      : name === './RNCSkiaPictureView' ? { RNCSkiaPictureView: pictureView }
      : { RNOHPackage }, exports, (builder: unknown) => builder);
    const pkg = new exports.RNSkiaPackage();
    expect(pkg).toBeInstanceOf(RNOHPackage);
    expect(pkg.createTurboModulesFactory()).toBe('existing');
    const builders = pkg.createWrappedCustomRNComponentBuilderByComponentNameMap();
    const context = { rnComponentContext: { instanceId: 1 }, tag: 8 };
    builders.get('SkiaDomView')(context);
    builders.get('SkiaPictureView')(context);
    expect(domView).toHaveBeenCalledWith({ ctx: context.rnComponentContext, tag: 8 });
    expect(pictureView).toHaveBeenCalledWith({ ctx: context.rnComponentContext, tag: 8 });
    expect(await fs.pathExists(path.join(root, 'ts.ts'))).toBe(false);
    expect(await fs.readFile(path.join(root, 'ts.ets'), 'utf8')).toContain("'./src/main/ets/RNOHSkiaPackage'");
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-skia');
    expect(await fs.readFile(path.join(root, 'src/main/ets/RNOHSkiaPackage.ets'), 'utf8')).toBe(nativePackage);
    expect(await fs.readFile(path.join(root, 'src/main/ets/RNSkiaPackage.ts'), 'utf8')).toBe(original);
  } finally {
    await fs.remove(root);
  }
});

it('passes the unwrapped RNOH node id to Skia snapshots', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-skia-snapshot-'));
  const file = path.join(root, 'src/main/ets/RNSkiaModule.ts');
  const original = `let obj = JSON.parse(JSON.stringify(this.ctx.rnInstance.getNativeNodeIdByTag(tag)));
      let id = obj.ok;
      return componentSnapshot.getSync(id);`;
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-skia');
    const patched = await fs.readFile(file, 'utf8');
    const snapshot = jest.fn((id) => id);
    const takeSnapshot = new Function('tag', 'componentSnapshot', patched);
    const ctx = { ctx: { rnInstance: { getNativeNodeIdByTag: () => 'View(12)@native' } } };
    expect(takeSnapshot.call(ctx, 12, { getSync: snapshot })).toBe('View(12)@native');
    expect(snapshot).toHaveBeenCalledWith('View(12)@native');
    expect(() => takeSnapshot.call({ ctx: { rnInstance: { getNativeNodeIdByTag: () => undefined } } }, 12, { getSync: snapshot })).toThrow('not mounted');
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/react-native-skia');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});

it('preserves absolute Camera Roll paths and settles failed save dialogs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-camera-roll-'));
  const file = path.join(root, 'src/main/ets/CameraRollTurboModule.ts');
  const original = `class CameraRoll {
  private dialogQueue = [];
  private isDialogOpen = false;
  async showDialog() {
    if(this.isDialogOpen) return;
    this.isDialogOpen = true
    const [saveUris, photoCreationConfigs, res] = this.dialogQueue.pop()
    let result = await this.phAccessHelper.showAssetsCreationDialog(saveUris, photoCreationConfigs);
    res(result)
    this.isDialogOpen = false
    if(this.dialogQueue.length) this.showDialog()
  }
  requestToCreateDialog(saveUris, photoCreationConfigs): Promise<string[]> {
    return new Promise(res => {
      this.dialogQueue.push([saveUris, photoCreationConfigs, res])
      this.showDialog()
    })
  }
  getAssetsPermissionResult(saveUris, photoCreationConfigs): Promise<string[]> {
    return new Promise(async(res) => {
      let result = await this.requestToCreateDialog(saveUris, photoCreationConfigs);
      res(result)
    })
  }
  private getUriOnSandboxPath(uriStr: string) {
    const uriObj = { path: new URL(uriStr).pathname };
    uriStr = uriStr.replace(/^file:\\/+/i, '');
    return uriStr;
  }
  saveToDevice(error) {
    try { throw error; } catch(e) {
      Logger.error(\`saveToDevice error: \${e}\`);
    }
  }
  canceledSave(resourceType, saveUri) {
    if (false) {} else {
      if (resourceType) {
        fs.unlinkSync(saveUri);
      }
    }
  }
}`;
  try {
    await fs.outputFile(file, original);
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/camera-roll');
    const patched = await fs.readFile(file, 'utf8');
    const CameraRoll = new Function('Logger', `${ts.transpile(patched, { target: ts.ScriptTarget.ES2020 })}; return CameraRoll;`)({ error: jest.fn() });
    const cameraRoll = new CameraRoll();
    expect(cameraRoll.getUriOnSandboxPath('file:///data/storage/el2/base/cache/a%20b.png')).toBe('/data/storage/el2/base/cache/a b.png');
    cameraRoll.phAccessHelper = {
      showAssetsCreationDialog: jest.fn().mockRejectedValueOnce(new Error('save dialog failed')).mockResolvedValueOnce(['file://media/Photo/2']),
    };
    const failed = cameraRoll.getAssetsPermissionResult(['file://source/1'], []);
    const next = cameraRoll.getAssetsPermissionResult(['file://source/2'], []);
    await expect(failed).rejects.toThrow('save dialog failed');
    await expect(next).resolves.toEqual(['file://media/Photo/2']);
    expect(() => cameraRoll.saveToDevice(new Error('write failed'))).toThrow('write failed');
    expect(() => cameraRoll.canceledSave(false, '')).toThrow('Photo save was canceled');
    await ensureNormalizedLocalHarCompatibilityShims(root, '@react-native-oh-tpl/camera-roll');
    expect(await fs.readFile(file, 'utf8')).toBe(patched);
  } finally {
    await fs.remove(root);
  }
});
