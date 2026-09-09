import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  renderExpoSecureStorePreviewShim,
  renderExpoDevicePreviewShim,
  renderExpoHapticsPreviewShim,
  renderExpoHarmonySecureStoreTurboModule,
  renderExpoHarmonyAppFoundationTurboModule,
  renderExpoAssetPreviewShim,
  renderExpoClipboardPreviewShim,
} from '../src/core/template/renderers/appFoundation';

function load(source: string, native: Record<string, unknown> | null, modules: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  runInNewContext(source, {
    module,
    require: (name: string) => {
      if (name in modules) return modules[name];
      if (name === 'react-native') return { TurboModuleRegistry: { get: () => native } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return module.exports;
}

it('uses secure native storage across JS reloads, separates services and rejects unsafe inputs', async () => {
  const native = {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue('persisted'),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    setItemSync: jest.fn(), getItemSync: jest.fn().mockReturnValue('persisted'),
  };
  const store = load(renderExpoSecureStorePreviewShim(), native);
  await store.setItemAsync('session', 'persisted', { keychainService: 'school' });
  expect(native.setItem).toHaveBeenCalledWith('session', 'persisted', { keychainService: 'school' });
  const reloaded = load(renderExpoSecureStorePreviewShim(), native);
  expect(await reloaded.getItemAsync('session', { keychainService: 'school' })).toBe('persisted');
  expect(native.getItem).toHaveBeenCalledWith('session', { keychainService: 'school' });
  await reloaded.deleteItemAsync('session');
  expect(native.deleteItem).toHaveBeenCalledWith('session', {});
  store.setItem('session', 'persisted');
  expect(store.getItem('session')).toBe('persisted');
  expect(native.setItemSync).toHaveBeenCalledWith('session', 'persisted', {});
  await expect(store.setItemAsync('bad/key', 'x')).rejects.toThrow('key');
  await expect(store.setItemAsync('valid', { value: 'x' })).rejects.toThrow('string');
  await expect(store.setItemAsync('valid', 'x', { requireAuthentication: true })).rejects.toThrow('authentication');
  expect(store.canUseBiometricAuthentication()).toBe(false);
  native.getItem.mockRejectedValueOnce(new Error('locked'));
  await expect(store.getItemAsync('session')).rejects.toThrow('locked');
  const unavailable = load(renderExpoSecureStorePreviewShim(), null);
  expect(await unavailable.isAvailableAsync()).toBe(false);
  await expect(unavailable.getItemAsync('session')).rejects.toThrow('native');
});

it('awaits system clipboard writes and preserves text, image, URL, event and failure contracts', async () => {
  const native = {
    setString: jest.fn().mockResolvedValue(undefined), getString: jest.fn().mockResolvedValue('system text'),
    setUrl: jest.fn().mockResolvedValue(undefined), getUrl: jest.fn().mockResolvedValue('https://example.test'),
    setImage: jest.fn().mockResolvedValue(undefined), getImage: jest.fn().mockResolvedValue({ data: 'data:image/png;base64,AQ==', size: { width: 1, height: 1 } }),
    getContentTypes: jest.fn().mockResolvedValue(['image']),
  };
  const subscription = { remove: jest.fn() };
  const emitter = { addListener: jest.fn().mockReturnValue(subscription) };
  const api = load(renderExpoClipboardPreviewShim(), native, {
    'react-native': { TurboModuleRegistry: { get: () => native }, DeviceEventEmitter: emitter },
  });
  expect(await api.setStringAsync('text')).toBe(true);
  expect(native.setString).toHaveBeenCalledWith('text', 'plainText');
  await api.setStringAsync('<b>text</b>', { inputFormat: 'html' });
  expect(native.setString).toHaveBeenLastCalledWith('<b>text</b>', 'html');
  expect(await api.getStringAsync()).toBe('system text');
  expect(await api.hasStringAsync()).toBe(false);
  expect(await api.hasImageAsync()).toBe(true);
  await api.setUrlAsync('https://example.test');
  expect(native.setUrl).toHaveBeenCalledWith('https://example.test');
  expect(await api.getUrlAsync()).toBe('https://example.test');
  await api.setImageAsync('AQ==');
  expect(native.setImage).toHaveBeenCalledWith('AQ==');
  expect(await api.getImageAsync({ format: 'png' })).toMatchObject({ size: { width: 1, height: 1 } });
  expect(native.getImage).toHaveBeenCalledWith('png', 1);
  const listener = jest.fn();
  api.removeClipboardListener(api.addClipboardListener(listener));
  expect(emitter.addListener).toHaveBeenCalledWith('ExpoHarmonyClipboardChanged', listener);
  expect(subscription.remove).toHaveBeenCalledTimes(1);
  native.setString.mockRejectedValueOnce(new Error('write failed'));
  await expect(api.setStringAsync('text')).rejects.toThrow('write failed');
  await expect(api.getImageAsync({ format: 'jpeg', jpegQuality: 2 })).rejects.toThrow('quality');
});

it('resolves registered assets, waits for a real local file, deduplicates downloads and allows retry', async () => {
  const loadAsset = jest.fn().mockResolvedValue('file:///cache/real.png');
  const native = { loadAsset };
  const registry = { getAssetByID: (id: number) => id === 7 ? {
    name: 'icon', type: 'png', hash: 'content-hash', width: 10, height: 20,
    httpServerLocation: '/assets/assets', scales: [1, 2],
  } : undefined };
  const api = load(renderExpoAssetPreviewShim(), native, {
    'react-native/Libraries/Image/AssetRegistry': registry,
    'react-native': {
      TurboModuleRegistry: { get: () => native },
      Image: { resolveAssetSource: () => ({ uri: 'asset:///assets/icon@2x.png', scale: 2 }) },
    },
  });
  const remote = api.Asset.fromURI('https://example.test/image.png?version=2');
  expect(remote.downloaded).toBe(false);
  expect(remote.localUri).toBeNull();
  expect(api.Asset.fromURI(remote.uri)).toBe(remote);
  const [one, two] = await Promise.all([remote.downloadAsync(), remote.downloadAsync()]);
  expect(one).toBe(two);
  expect(loadAsset).toHaveBeenCalledTimes(1);
  expect(loadAsset).toHaveBeenCalledWith(remote.uri, 'png', null);
  expect(remote).toMatchObject({ downloaded: true, localUri: 'file:///cache/real.png' });
  const registered = api.Asset.fromModule(7);
  expect(registered).toMatchObject({ name: 'icon', type: 'png', width: 10, height: 20, hash: 'content-hash' });
  await registered.downloadAsync();
  expect(loadAsset).toHaveBeenLastCalledWith('asset:///assets/icon@2x.png', 'png', 'assets/assets/icon@2x.png');
  expect(() => api.Asset.fromModule(404)).toThrow('registry');
  const failed = api.Asset.fromURI('https://example.test/failure.png');
  loadAsset.mockRejectedValueOnce(new Error('404'));
  await expect(failed.downloadAsync()).rejects.toThrow('404');
  expect(failed.downloaded).toBe(false);
  expect(failed.localUri).toBeNull();
  await failed.downloadAsync();
  expect(failed.downloaded).toBe(true);
});

it('stores secrets in Asset Store with access protection, stable aliases and no plaintext fallback', async () => {
  const persisted = new Map<string, Map<number, unknown>>();
  const alias = (entry: Map<number, Uint8Array>) => new TextDecoder().decode(entry.get(1));
  const querySync = jest.fn((entry) => {
    const value = persisted.get(alias(entry));
    if (!value) throw { code: 24000002 };
    return [value];
  });
  const addSync = jest.fn((entry) => { persisted.set(alias(entry), entry); });
  const remove = jest.fn(async (entry) => {
    if (!persisted.delete(alias(entry))) throw { code: 24000002 };
  });
  const asset = {
    Tag: { ALIAS: 1, SECRET: 2, RETURN_TYPE: 3, ACCESSIBILITY: 4, SYNC_TYPE: 5, CONFLICT_RESOLUTION: 6 },
    ReturnType: { ALL: 0 }, Accessibility: { DEVICE_UNLOCKED: 2, DEVICE_FIRST_UNLOCKED: 1, DEVICE_POWERED_ON: 0 },
    SyncType: { NEVER: 0 }, ConflictResolution: { OVERWRITE: 1 },
    querySync, query: async (entry: unknown) => querySync(entry),
    addSync, add: async (entry: unknown) => addSync(entry), remove,
  };
  const exports: Record<string, any> = {};
  const modules: Record<string, unknown> = {
    '@kit.ArkTS': { util: { TextEncoder, TextDecoder: { create: () => new TextDecoder() } } },
    '@kit.AssetStoreKit': { asset },
    '@rnoh/react-native-openharmony/ts': { AnyThreadTurboModule: class {} },
  };
  runInNewContext(ts.transpileModule(renderExpoHarmonySecureStoreTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Uint8Array, require: (name: string) => modules[name] });
  const Store = exports.ExpoHarmonySecureStoreTurboModule;
  await new Store().setItem('token', '秘密', { keychainService: 'a' });
  expect(addSync.mock.calls[0][0].get(4)).toBe(2);
  expect(addSync.mock.calls[0][0].get(5)).toBe(0);
  const reloaded = new Store();
  expect(await reloaded.getItem('token', { keychainService: 'a' })).toBe('秘密');
  expect(await reloaded.getItem('token', { keychainService: 'b' })).toBeNull();
  reloaded.setItemSync('token', 'replacement', { keychainService: 'a', keychainAccessible: 1 });
  expect(reloaded.getItemSync('token', { keychainService: 'a' })).toBe('replacement');
  expect(addSync.mock.calls[1][0].get(4)).toBe(1);
  await reloaded.deleteItem('token', { keychainService: 'a' });
  await reloaded.deleteItem('token', { keychainService: 'a' });
  expect(reloaded.getItemSync('token', { keychainService: 'a' })).toBeNull();
  querySync.mockImplementationOnce(() => { throw { code: 24000003 }; });
  await expect(reloaded.getItem('token', {})).rejects.toMatchObject({ code: 24000003 });
  await expect(reloaded.setItem('token', 'x', { requireAuthentication: true })).rejects.toThrow('authentication');
  await expect(reloaded.setItem('token', 'x', { keychainService: '界'.repeat(100) })).rejects.toThrow('256');
  expect(persisted.size).toBe(0);
});

it('reads real device fields and calls the native vibrator with the requested touch duration', async () => {
  const startVibration = jest.fn().mockResolvedValue(undefined);
  const exports: Record<string, any> = {};
  const deviceInfo = {
    productModel: 'emulator', brand: 'test', manufacture: 'test', hardwareModel: 'arm', productSeries: 'phone',
    marketName: 'test', deviceType: 'phone', osFullName: 'OpenHarmony-6.0.0.1',
    majorVersion: 6, seniorVersion: 0, featureVersion: 0, buildVersion: 1,
    displayVersion: '6.0.0.1', sdkApiVersion: 20, abiList: 'arm64-v8a, armeabi-v7a',
  };
  const modules: Record<string, unknown> = {
    '@ohos.deviceInfo': deviceInfo,
    '@ohos.hidebug': { getSystemMemInfo: () => ({ totalMem: 1024n }) },
    '@ohos.vibrator': { startVibration },
    '@rnoh/react-native-openharmony/ts': { AnyThreadTurboModule: class {} },
  };
  runInNewContext(ts.transpileModule(renderExpoHarmonyAppFoundationTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] });
  const native = new exports.ExpoHarmonyAppFoundationTurboModule();
  expect(native.getConstants()).toMatchObject({ modelName: 'emulator', isDevice: false, deviceType: 1, totalMemory: 1024 * 1024, osVersion: '6.0.0', supportedCpuArchitectures: ['arm64-v8a', 'armeabi-v7a'] });
  deviceInfo.productModel = 'physical-test-model';
  expect(native.getConstants().isDevice).toBe(true);
  await native.triggerHaptic('selection');
  await native.triggerHaptic('heavy');
  expect(startVibration.mock.calls).toEqual([
    [{ type: 'time', duration: 8 }, { usage: 'touch' }],
    [{ type: 'time', duration: 35 }, { usage: 'touch' }],
  ]);
  startVibration.mockRejectedValueOnce(new Error('hardware unavailable'));
  await expect(native.triggerHaptic('light')).rejects.toThrow('hardware unavailable');
});

it('exposes OS device constants and forwards distinct haptic styles without swallowing failures', async () => {
  const constants = { modelName: 'emulator', isDevice: false, deviceType: 1, osVersion: '6.0.0', totalMemory: 4096 };
  const native = { getConstants: () => constants, triggerHaptic: jest.fn().mockResolvedValue(undefined) };
  const device = load(renderExpoDevicePreviewShim(), native);
  expect(device).toMatchObject(constants);
  expect(await device.getDeviceTypeAsync()).toBe(1);
  const haptics = load(renderExpoHapticsPreviewShim(), native);
  await haptics.selectionAsync();
  await haptics.impactAsync(haptics.ImpactFeedbackStyle.Heavy);
  await haptics.notificationAsync(haptics.NotificationFeedbackType.Error);
  expect(native.triggerHaptic.mock.calls).toEqual([['selection'], ['heavy'], ['error']]);
  native.triggerHaptic.mockRejectedValueOnce(new Error('permission denied'));
  await expect(haptics.selectionAsync()).rejects.toThrow('permission denied');
  native.triggerHaptic.mockRejectedValueOnce({ code: 14600101, message: 'Device not supported.' });
  await expect(haptics.selectionAsync()).rejects.toThrow('Device not supported.');
  await expect(haptics.impactAsync('invalid')).rejects.toThrow('style');
});
