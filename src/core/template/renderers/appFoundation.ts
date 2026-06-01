export function renderExpoSecureStorePreviewShim(): string {
  return `'use strict';

const secureStore = new Map();

async function isAvailableAsync() {
  return true;
}

async function setItemAsync(key, value) {
  secureStore.set(String(key), String(value));
}

async function getItemAsync(key) {
  const normalizedKey = String(key);
  return secureStore.has(normalizedKey) ? secureStore.get(normalizedKey) : null;
}

async function deleteItemAsync(key) {
  secureStore.delete(String(key));
}

module.exports = {
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync,
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
};
`;
}

export function renderExpoAssetPreviewShim(): string {
  return `'use strict';

class Asset {
  constructor(input) {
    this.name = input.name ?? null;
    this.type = input.type ?? null;
    this.hash = input.hash ?? null;
    this.uri = input.uri;
    this.localUri = input.localUri ?? input.uri;
    this.width = input.width ?? null;
    this.height = input.height ?? null;
    this.downloaded = Boolean(input.downloaded);
  }

  static fromURI(uri) {
    return new Asset({
      name: String(uri).split('/').pop() || 'remote-asset',
      uri: String(uri),
      downloaded: true,
    });
  }

  static fromModule(moduleId) {
    if (typeof moduleId === 'string') {
      return Asset.fromURI(moduleId);
    }

    return new Asset({
      name: 'expo-harmony-module-asset',
      uri: 'asset://' + String(moduleId),
      localUri: 'asset://' + String(moduleId),
    });
  }

  static async loadAsync(moduleIds) {
    return loadAsync(moduleIds);
  }

  async downloadAsync() {
    this.downloaded = true;
    this.localUri = this.localUri ?? this.uri;
    return this;
  }
}

async function loadAsync(moduleIds) {
  const input = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  return Promise.all(input.map((moduleId) => Asset.fromModule(moduleId).downloadAsync()));
}

function useAssets() {
  return [null, null];
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

const DeviceType = {
  UNKNOWN: 0,
  PHONE: 1,
  TABLET: 2,
  DESKTOP: 3,
  TV: 4,
};

async function getDeviceTypeAsync() {
  return DeviceType.UNKNOWN;
}

module.exports = {
  DeviceType,
  brand: 'OpenHarmony',
  manufacturer: 'OpenHarmony',
  modelName: 'Harmony preview device',
  modelId: null,
  designName: null,
  productName: 'expo-harmony-preview',
  deviceYearClass: null,
  totalMemory: null,
  supportedCpuArchitectures: [],
  osName: 'HarmonyOS',
  osVersion: 'preview',
  osBuildId: null,
  osInternalBuildId: null,
  osBuildFingerprint: null,
  platformApiLevel: null,
  deviceName: 'Harmony preview device',
  isDevice: true,
  getDeviceTypeAsync,
};
`;
}

export function renderExpoClipboardPreviewShim(): string {
  return `'use strict';

let clipboardString = '';
let clipboardUrl = null;
let clipboardImage = null;

async function setStringAsync(value) {
  clipboardString = String(value);
  clipboardUrl = null;
  return true;
}

async function getStringAsync() {
  return clipboardString;
}

async function hasStringAsync() {
  return clipboardString.length > 0;
}

async function setUrlAsync(value) {
  clipboardUrl = String(value);
  clipboardString = clipboardUrl;
}

async function getUrlAsync() {
  return clipboardUrl;
}

async function setImageAsync(value) {
  clipboardImage = String(value);
}

async function getImageAsync() {
  return clipboardImage;
}

module.exports = {
  setStringAsync,
  getStringAsync,
  hasStringAsync,
  setUrlAsync,
  getUrlAsync,
  setImageAsync,
  getImageAsync,
};
`;
}

export function renderExpoHapticsPreviewShim(): string {
  return `'use strict';

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

async function selectionAsync() {}

async function impactAsync() {}

async function notificationAsync() {}

module.exports = {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  selectionAsync,
  impactAsync,
  notificationAsync,
};
`;
}
