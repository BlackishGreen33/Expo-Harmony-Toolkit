export function renderExpoSecureStorePreviewShim(): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const native = TurboModuleRegistry.get('ExpoHarmonySecureStore');

function requireNative() {
  if (!native) throw new Error('SecureStore native module is unavailable. Rebuild the Harmony application.');
  return native;
}

function validate(key, options) {
  if (typeof key !== 'string' || !/^[\\w.-]+$/.test(key)) {
    throw new Error('SecureStore key must contain only letters, numbers, dots, hyphens and underscores.');
  }
  if (options.requireAuthentication || options.keychainAccessible === 6) {
    throw new Error('SecureStore biometric/passcode authentication is not supported on Harmony.');
  }
  if (options.accessGroup != null) throw new Error('SecureStore access groups are not supported on Harmony.');
  if (options.keychainService != null && typeof options.keychainService !== 'string') {
    throw new Error('SecureStore keychainService must be a string.');
  }
  if (options.keychainAccessible != null && ![0, 1, 2, 3, 4, 5].includes(options.keychainAccessible)) {
    throw new Error('Invalid SecureStore keychain accessibility.');
  }
}

function validateValue(value) {
  if (typeof value !== 'string') throw new Error('SecureStore value must be a string.');
}

async function isAvailableAsync() {
  return native != null;
}

async function setItemAsync(key, value, options = {}) {
  validate(key, options);
  validateValue(value);
  return requireNative().setItem(key, value, options);
}

async function getItemAsync(key, options = {}) {
  validate(key, options);
  return requireNative().getItem(key, options);
}

async function deleteItemAsync(key, options = {}) {
  validate(key, options);
  return requireNative().deleteItem(key, options);
}

function setItem(key, value, options = {}) {
  validate(key, options);
  validateValue(value);
  return requireNative().setItemSync(key, value, options);
}

function getItem(key, options = {}) {
  validate(key, options);
  return requireNative().getItemSync(key, options);
}

module.exports = {
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
  ALWAYS_THIS_DEVICE_ONLY: 5,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 6,
  canUseBiometricAuthentication: () => false,
  isAvailableAsync,
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
  setItem,
  getItem,
};
`;
}

export function renderExpoAssetPreviewShim(): string {
  return String.raw`'use strict';

const { Image, TurboModuleRegistry } = require('react-native');
const { getAssetByID } = require('react-native/Libraries/Image/AssetRegistry');
const native = TurboModuleRegistry.get('ExpoHarmonyFileSystem');
const byUri = new Map();
const byModule = new Map();

class Asset {
  constructor(input) {
    this.name = input.name ?? null;
    this.type = input.type ?? null;
    this.hash = input.hash ?? null;
    this.uri = input.uri;
    this.localUri = null;
    this.width = input.width ?? null;
    this.height = input.height ?? null;
    this.downloaded = false;
    this.rawPath = input.rawPath ?? null;
    this.downloading = null;
  }

  static fromURI(uri) {
    if (typeof uri !== 'string' || !uri.length) throw new Error('Asset URI must be a non-empty string.');
    if (byUri.has(uri)) return byUri.get(uri);
    const filename = uri.split(/[?#]/)[0].split('/').pop() || '';
    const dataType = uri.match(/^data:[^/]+\/([^;,]+)/);
    const type = dataType ? dataType[1] : filename.includes('.') ? filename.split('.').pop() : '';
    const asset = new Asset({
      name: type ? filename.slice(0, -(type.length + 1)) : filename,
      type,
      uri,
    });
    byUri.set(uri, asset);
    return asset;
  }

  static fromModule(moduleId) {
    if (typeof moduleId === 'string') {
      return Asset.fromURI(moduleId);
    }

    if (moduleId && typeof moduleId === 'object' && typeof moduleId.uri === 'string') {
      return new Asset({ ...Asset.fromURI(moduleId.uri), ...moduleId });
    }
    if (byModule.has(moduleId)) return byModule.get(moduleId);
    const meta = getAssetByID(moduleId);
    if (!meta) throw new Error('Module ' + moduleId + ' is missing from the asset registry.');
    const resolved = Image.resolveAssetSource(moduleId);
    if (!resolved?.uri) throw new Error('Unable to resolve asset module ' + moduleId);
    const scale = resolved.scale ?? 1;
    const folder = meta.httpServerLocation.replace(/^\//, '').replace(/^assets\//, '');
    const filename = meta.name + (scale === 1 ? '' : '@' + scale + 'x') + '.' + meta.type;
    const rawPath = ('assets/' + (folder ? folder + '/' : '') + filename).replace(/\.\.\//g, '_');
    const asset = new Asset({
      ...meta,
      uri: resolved.uri,
      rawPath,
    });
    byModule.set(moduleId, asset);
    return asset;
  }

  static async loadAsync(moduleIds) {
    return loadAsync(moduleIds);
  }

  async downloadAsync() {
    if (!native) throw new Error('Asset native file module is unavailable. Rebuild the Harmony application.');
    if (!this.downloading) {
      this.downloading = native.loadAsset(this.uri, this.type || '', this.rawPath).then((uri) => {
        if (typeof uri !== 'string' || !uri.startsWith('file://')) throw new Error('Native asset download returned no local file.');
        this.localUri = uri;
        this.downloaded = true;
      }).catch((error) => {
        this.localUri = null;
        this.downloaded = false;
        throw error;
      }).finally(() => { this.downloading = null; });
    }
    await this.downloading;
    return this;
  }
}

async function loadAsync(moduleIds) {
  const input = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  return Promise.all(input.map((moduleId) => Asset.fromModule(moduleId).downloadAsync()));
}

function useAssets(moduleIds) {
  const { useEffect, useState } = require('react');
  const [assets, setAssets] = useState();
  const [error, setError] = useState();
  useEffect(() => {
    let active = true;
    loadAsync(moduleIds).then(
      (value) => { if (active) setAssets(value); },
      (reason) => { if (active) setError(reason); },
    );
    return () => { active = false; };
  }, []);
  return [assets, error];
}

module.exports = {
  Asset,
  loadAsync,
  useAssets,
};
`;
}

export function renderExpoDevicePreviewShim(): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const native = TurboModuleRegistry.get('ExpoHarmonyAppFoundation');
if (!native) throw new Error('Device native module is unavailable. Rebuild the Harmony application.');
const constants = native.getConstants();

const DeviceType = {
  UNKNOWN: 0,
  PHONE: 1,
  TABLET: 2,
  DESKTOP: 3,
  TV: 4,
};

async function getDeviceTypeAsync() {
  return constants.deviceType;
}

module.exports = {
  DeviceType,
  ...constants,
  designName: null,
  deviceYearClass: null,
  osBuildFingerprint: null,
  getDeviceTypeAsync,
};
`;
}

export function renderExpoClipboardPreviewShim(): string {
  return `'use strict';

const { TurboModuleRegistry, DeviceEventEmitter } = require('react-native');
const native = TurboModuleRegistry.get('ExpoHarmonyClipboard');
const ContentType = { PLAIN_TEXT: 'plain-text', HTML: 'html', IMAGE: 'image', URL: 'url' };
const StringFormat = { PLAIN_TEXT: 'plainText', HTML: 'html' };

function requireNative() {
  if (!native) throw new Error('Clipboard native module is unavailable. Rebuild the Harmony application.');
  return native;
}

function format(value = 'plainText') {
  if (!Object.values(StringFormat).includes(value)) throw new Error('Invalid clipboard string format.');
  return value;
}

async function setStringAsync(value, options = {}) {
  if (typeof value !== 'string') throw new Error('Clipboard text must be a string.');
  await requireNative().setString(value, format(options.inputFormat));
  return true;
}

async function getStringAsync(options = {}) {
  return requireNative().getString(format(options.preferredFormat));
}

async function hasStringAsync() {
  const types = await requireNative().getContentTypes();
  return types.includes(ContentType.PLAIN_TEXT) || types.includes(ContentType.HTML);
}

async function setUrlAsync(value) {
  if (typeof value !== 'string') throw new Error('Clipboard URL must be a string.');
  await requireNative().setUrl(value);
}

async function getUrlAsync() { return requireNative().getUrl(); }

async function setImageAsync(value) {
  if (typeof value !== 'string' || !value) throw new Error('Clipboard image must be a base64 string.');
  await requireNative().setImage(value);
}

async function getImageAsync(options = { format: 'png' }) {
  if (!['png', 'jpeg'].includes(options.format)) throw new Error('Invalid clipboard image format.');
  const quality = options.jpegQuality ?? 1;
  if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) throw new Error('Invalid clipboard image quality.');
  return requireNative().getImage(options.format, quality);
}

async function hasImageAsync() { return (await requireNative().getContentTypes()).includes(ContentType.IMAGE); }
async function hasUrlAsync() { return (await requireNative().getContentTypes()).includes(ContentType.URL); }

function addClipboardListener(listener) {
  requireNative();
  return DeviceEventEmitter.addListener('ExpoHarmonyClipboardChanged', listener);
}

function removeClipboardListener(subscription) { subscription.remove(); }

module.exports = {
  ContentType,
  StringFormat,
  setStringAsync,
  getStringAsync,
  hasStringAsync,
  setUrlAsync,
  getUrlAsync,
  setImageAsync,
  getImageAsync,
  hasImageAsync,
  hasUrlAsync,
  addClipboardListener,
  removeClipboardListener,
};
`;
}

export function renderExpoHapticsPreviewShim(): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const native = TurboModuleRegistry.get('ExpoHarmonyAppFoundation');

const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Rigid: 'rigid',
  Soft: 'soft',
};

const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

async function trigger(style) {
  if (!native) throw new Error('Haptics native module is unavailable. Rebuild the Harmony application.');
  try { await native.triggerHaptic(style); }
  catch (error) {
    if (error instanceof Error) throw error;
    throw Object.assign(new Error(error?.message ?? JSON.stringify(error) ?? String(error)), { code: error?.code });
  }
}

async function selectionAsync() { await trigger('selection'); }

async function impactAsync(style = ImpactFeedbackStyle.Medium) {
  if (!Object.values(ImpactFeedbackStyle).includes(style)) throw new Error('Invalid haptic impact style.');
  await trigger(style);
}

async function notificationAsync(type = NotificationFeedbackType.Success) {
  if (!Object.values(NotificationFeedbackType).includes(type)) throw new Error('Invalid haptic notification style.');
  await trigger(type);
}

module.exports = {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  selectionAsync,
  impactAsync,
  notificationAsync,
};
`;
}

export function renderExpoHarmonySecureStoreTurboModule(): string {
  return `import { util } from '@kit.ArkTS';
import { asset } from '@kit.AssetStoreKit';
import { AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';

type StoreOptions = {
  keychainService?: string;
  keychainAccessible?: number;
  requireAuthentication?: boolean;
  accessGroup?: string;
};

export class ExpoHarmonySecureStoreTurboModule extends AnyThreadTurboModule {
  public static readonly NAME = 'ExpoHarmonySecureStore';
  private readonly encoder = new util.TextEncoder();
  private readonly decoder = util.TextDecoder.create('utf-8');

  async getItem(key: string, options: StoreOptions): Promise<string | null> {
    const query = this.alias(key, options);
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      return this.secret(await asset.query(query));
    } catch (error) {
      if (this.isNotFound(error)) return null;
      throw error;
    }
  }

  getItemSync(key: string, options: StoreOptions): string | null {
    const query = this.alias(key, options);
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      return this.secret(asset.querySync(query));
    } catch (error) {
      if (this.isNotFound(error)) return null;
      throw error;
    }
  }

  async setItem(key: string, value: string, options: StoreOptions): Promise<void> {
    await asset.add(this.attributes(key, value, options));
  }

  setItemSync(key: string, value: string, options: StoreOptions): void {
    asset.addSync(this.attributes(key, value, options));
  }

  async deleteItem(key: string, options: StoreOptions): Promise<void> {
    try {
      await asset.remove(this.alias(key, options));
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }
  }

  private alias(key: string, options: StoreOptions): asset.AssetMap {
    if (!/^[\\w.-]+$/.test(key)) throw new Error('Invalid SecureStore key.');
    if (options.requireAuthentication || options.keychainAccessible === 6 || options.accessGroup != null) {
      throw new Error('SecureStore authentication and access groups are not supported on Harmony.');
    }
    const bytes = this.encoder.encode('expo-harmony:' + JSON.stringify([options.keychainService ?? '', key]));
    if (bytes.length > 256) throw new Error('SecureStore key and service alias exceeds 256 UTF-8 bytes.');
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, bytes);
    return query;
  }

  private attributes(key: string, value: string, options: StoreOptions): asset.AssetMap {
    const attributes = this.alias(key, options);
    const accessible = options.keychainAccessible ?? 0;
    if (![0, 1, 2, 3, 4, 5].includes(accessible)) throw new Error('Invalid SecureStore accessibility.');
    attributes.set(asset.Tag.SECRET, this.encoder.encode(value));
    attributes.set(asset.Tag.ACCESSIBILITY, accessible === 1 || accessible === 4
      ? asset.Accessibility.DEVICE_FIRST_UNLOCKED
      : accessible === 2 || accessible === 5 ? asset.Accessibility.DEVICE_POWERED_ON : asset.Accessibility.DEVICE_UNLOCKED);
    attributes.set(asset.Tag.SYNC_TYPE, asset.SyncType.NEVER);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    return attributes;
  }

  private secret(matches: asset.AssetMap[]): string | null {
    const value = matches[0]?.get(asset.Tag.SECRET);
    return value instanceof Uint8Array ? this.decoder.decode(value) : null;
  }

  private isNotFound(error: object): boolean {
    return Number((error as { code?: number }).code) === 24000002;
  }
}
`;
}

export function renderExpoHarmonyAppFoundationTurboModule(): string {
  return `import deviceInfo from '@ohos.deviceInfo';
import hidebug from '@ohos.hidebug';
import vibrator from '@ohos.vibrator';
import { AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';

type DeviceConstants = {
  brand: string;
  manufacturer: string;
  modelName: string;
  modelId: string;
  productName: string;
  deviceName: string;
  deviceType: number;
  isDevice: boolean;
  osName: string;
  osVersion: string;
  osBuildId: string;
  osInternalBuildId: string;
  platformApiLevel: number;
  totalMemory: number | null;
  supportedCpuArchitectures: string[];
};

export class ExpoHarmonyAppFoundationTurboModule extends AnyThreadTurboModule {
  public static readonly NAME = 'ExpoHarmonyAppFoundation';

  getConstants(): DeviceConstants {
    const types: Record<string, number> = { phone: 1, default: 1, tablet: 2, '2in1': 3, pc: 3, tv: 4 };
    let memory: number | null = null;
    try { memory = Number(hidebug.getSystemMemInfo().totalMem) * 1024; } catch (_) {}
    return {
      brand: deviceInfo.brand,
      manufacturer: deviceInfo.manufacture,
      modelName: deviceInfo.productModel,
      modelId: deviceInfo.hardwareModel,
      productName: deviceInfo.productSeries,
      deviceName: deviceInfo.marketName,
      deviceType: types[deviceInfo.deviceType] ?? 0,
      isDevice: !/emulator|simulator/i.test(deviceInfo.productModel),
      osName: deviceInfo.osFullName.split('-')[0],
      osVersion: deviceInfo.majorVersion + '.' + deviceInfo.seniorVersion + '.' + deviceInfo.featureVersion,
      osBuildId: deviceInfo.displayVersion,
      osInternalBuildId: String(deviceInfo.buildVersion),
      platformApiLevel: deviceInfo.sdkApiVersion,
      totalMemory: memory,
      supportedCpuArchitectures: deviceInfo.abiList.split(',').map((abi: string) => abi.trim()).filter((abi: string) => abi.length > 0),
    };
  }

  async triggerHaptic(style: string): Promise<void> {
    const durations: Record<string, number> = { selection: 8, light: 10, medium: 20, heavy: 35, rigid: 15, soft: 25, success: 30, warning: 50, error: 75 };
    const duration = durations[style];
    if (duration === undefined) throw new Error('Invalid haptic style.');
    await vibrator.startVibration({ type: 'time', duration }, { usage: 'touch' });
  }
}
`;
}
