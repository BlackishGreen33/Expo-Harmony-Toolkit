import { HarmonyIdentifiers } from '../../types';

export function renderExpoModulesCoreHarmonyShim(
  expoConfig: Record<string, any>,
  identifiers: HarmonyIdentifiers,
): string {
  const embeddedExpoConfig = buildExpoConfigForShim(expoConfig, identifiers);
  const serializedExpoConfig = JSON.stringify(embeddedExpoConfig, null, 2);
  const primaryScheme = getPrimarySchemeForShim(embeddedExpoConfig, identifiers);
  const linkingUri = primaryScheme ? `${primaryScheme}://` : null;
  const serializedLinkingUri = JSON.stringify(linkingUri);

  return `'use strict';

const { Linking, Platform } = require('react-native');

const embeddedExpoConfig = ${serializedExpoConfig};
const nativeModules = Object.create(null);

class EventSubscription {
  constructor(remove) {
    this._remove = remove;
  }

  remove() {
    if (!this._remove) {
      return;
    }

    const remove = this._remove;
    this._remove = null;
    remove();
  }
}

class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  addListener(eventName, listener) {
    const listeners = this._listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this._listeners.set(eventName, listeners);

    return new EventSubscription(() => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this._listeners.delete(eventName);
      }
    });
  }

  removeAllListeners(eventName) {
    if (typeof eventName === 'string') {
      this._listeners.delete(eventName);
      return;
    }

    this._listeners.clear();
  }

  emit(eventName, payload) {
    const listeners = this._listeners.get(eventName);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(payload);
    }
  }
}

class LegacyEventEmitter extends EventEmitter {}

class NativeModule extends EventEmitter {}

class SharedObject {}

class SharedRef extends SharedObject {}

class CodedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'CodedError';
  }
}

class UnavailabilityError extends CodedError {
  constructor(moduleName, propertyName) {
    super(
      'ERR_UNAVAILABLE',
      propertyName
        ? moduleName + '.' + propertyName + ' is not available on Harmony.'
        : moduleName + ' is not available on Harmony.',
    );
    this.name = 'UnavailabilityError';
  }
}

class ExpoLinkingModule extends NativeModule {
  constructor(initialUrl) {
    super();
    this._currentUrl = initialUrl;
  }

  getLinkingURL() {
    return this._currentUrl;
  }

  _setCurrentUrl(url) {
    this._currentUrl = url;
    this.emit('onURLReceived', {
      url,
    });
  }
}

const expoLinkingModule = new ExpoLinkingModule(${serializedLinkingUri});

if (Linking?.addEventListener) {
  Linking.addEventListener('url', (event) => {
    expoLinkingModule._setCurrentUrl(event?.url ?? null);
  });
}

nativeModules.ExpoLinking = expoLinkingModule;
nativeModules.ExponentConstants = {
  manifest: embeddedExpoConfig,
  appOwnership: null,
  executionEnvironment: 'standalone',
  experienceUrl: ${serializedLinkingUri},
  linkingUri: ${serializedLinkingUri},
  statusBarHeight: 0,
  systemVersion: 'HarmonyOS',
  platform: {
    android: embeddedExpoConfig.android ?? null,
    ios: embeddedExpoConfig.ios ?? null,
    web: null,
  },
};
nativeModules.ExpoAsset = {
  async downloadAsync(url) {
    return url;
  },
};
nativeModules.ExpoFetchModule = {
  NativeRequest: class NativeRequest {
    constructor(_response) {
      this._response = _response;
    }

    async start() {
      throw new UnavailabilityError('ExpoFetchModule', 'NativeRequest.start');
    }

    cancel() {}
  },
};

function requireOptionalNativeModule(name) {
  return nativeModules[name] ?? null;
}

function requireNativeModule(name) {
  const nativeModule = requireOptionalNativeModule(name);

  if (nativeModule) {
    return nativeModule;
  }

  throw new UnavailabilityError(name);
}

function requireNativeViewManager(name) {
  throw new UnavailabilityError(name, 'viewManager');
}

function registerWebModule() {}

async function reloadAppAsync() {}

function installOnUIRuntime() {}

globalThis.expo = {
  ...(globalThis.expo ?? {}),
  EventEmitter,
  LegacyEventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  modules: {
    ...(globalThis.expo?.modules ?? {}),
    ...nativeModules,
  },
};

module.exports = {
  Platform,
  CodedError,
  UnavailabilityError,
  EventEmitter,
  LegacyEventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  requireNativeModule,
  requireOptionalNativeModule,
  requireNativeViewManager,
  registerWebModule,
  reloadAppAsync,
  installOnUIRuntime,
};
`;
}

function buildExpoConfigForShim(
  expoConfig: Record<string, any>,
  identifiers: HarmonyIdentifiers,
): Record<string, unknown> {
  const normalized = toSerializableValue(expoConfig);
  const config =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? { ...normalized }
      : {};

  config.name = config.name ?? identifiers.appName;
  config.slug = config.slug ?? identifiers.slug;
  config.version = config.version ?? '1.0.0';

  if (!config.scheme) {
    config.scheme = getPrimarySchemeForShim(config, identifiers);
  }

  const android =
    config.android && typeof config.android === 'object' && !Array.isArray(config.android)
      ? { ...config.android }
      : {};
  const ios =
    config.ios && typeof config.ios === 'object' && !Array.isArray(config.ios)
      ? { ...config.ios }
      : {};

  android.package = android.package ?? identifiers.androidPackage ?? identifiers.bundleName;
  ios.bundleIdentifier =
    ios.bundleIdentifier ?? identifiers.iosBundleIdentifier ?? identifiers.bundleName;

  config.android = android;
  config.ios = ios;

  return config;
}

function getPrimarySchemeForShim(
  expoConfig: Record<string, unknown>,
  identifiers: HarmonyIdentifiers,
): string {
  const scheme = expoConfig.scheme;

  if (typeof scheme === 'string' && scheme.trim().length > 0) {
    return scheme.trim();
  }

  if (Array.isArray(scheme)) {
    const firstScheme = scheme.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    if (firstScheme) {
      return firstScheme.trim();
    }
  }

  return (
    identifiers.androidPackage ??
    identifiers.iosBundleIdentifier ??
    identifiers.bundleName
  );
}

function toSerializableValue(value: unknown): any {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => toSerializableValue(entry))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const serializedEntry = toSerializableValue(entry);

      if (serializedEntry !== undefined) {
        result[key] = serializedEntry;
      }
    }

    return result;
  }

  return undefined;
}
