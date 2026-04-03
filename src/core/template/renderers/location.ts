import { CapabilityDefinition } from '../../../types';


export function renderExpoHarmonyLocationTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import geoLocationManager from '@ohos.geoLocationManager';
import { sensor } from '@kit.SensorServiceKit';
import { AnyThreadTurboModuleContext, AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
  android: {
    accuracy: 'fine' | 'coarse' | 'none';
  };
};

type ExpoLocationObject = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
  mocked: false;
};

type ProviderStatus = {
  locationServicesEnabled: boolean;
  backgroundModeEnabled: boolean;
  gpsAvailable: boolean;
  networkAvailable: boolean;
  passiveAvailable: boolean;
};

type ReverseGeocodeResult = {
  city: string | null;
  district: string | null;
  streetNumber: string | null;
  street: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  postalCode: string | null;
  name: string | null;
  isoCountryCode: string | null;
  timezone: null;
  formattedAddress: string | null;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
};

type HeadingObject = {
  magHeading: number;
  trueHeading: number | null;
  accuracy: number;
};

export class ExpoHarmonyLocationTurboModule extends AnyThreadTurboModule {
  public static readonly NAME = 'ExpoHarmonyLocation';

  private readonly atManager = abilityAccessCtrl.createAtManager();
  private nextWatchId = 1;

  getConstants(): Record<string, never> {
    return {};
  }

  async getForegroundPermissionStatus(): Promise<PermissionResponse> {
    return this.getLocationPermissionResponse();
  }

  async requestForegroundPermission(): Promise<PermissionResponse> {
    return this.requestLocationPermissionResponse();
  }

  async getBackgroundPermissionStatus(): Promise<PermissionResponse> {
    const backgroundStatus = this.resolvePermissionStatus('ohos.permission.LOCATION_IN_BACKGROUND');
    return this.buildBackgroundPermissionResponse(backgroundStatus);
  }

  async requestBackgroundPermission(): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [
      'ohos.permission.LOCATION_IN_BACKGROUND',
    ]);
    return this.getBackgroundPermissionStatus();
  }

  async hasServicesEnabled(): Promise<boolean> {
    return geoLocationManager.isLocationEnabled();
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    const locationServicesEnabled = geoLocationManager.isLocationEnabled();

    return {
      locationServicesEnabled,
      backgroundModeEnabled:
        this.resolvePermissionStatus('ohos.permission.LOCATION_IN_BACKGROUND') ===
        abilityAccessCtrl.PermissionStatus.GRANTED,
      gpsAvailable: locationServicesEnabled,
      networkAvailable: locationServicesEnabled,
      passiveAvailable: locationServicesEnabled,
    };
  }

  async getCurrentPosition(options?: { accuracy?: number }): Promise<ExpoLocationObject> {
    const location = await geoLocationManager.getCurrentLocation(
      this.createCurrentLocationRequest(options?.accuracy),
    );
    return this.normalizeLocation(location);
  }

  async getLastKnownPosition(_options?: Record<string, unknown>): Promise<ExpoLocationObject | null> {
    try {
      const location = geoLocationManager.getLastLocation();
      return this.hasCoordinates(location) ? this.normalizeLocation(location) : null;
    } catch (_error) {
      return null;
    }
  }

  async geocode(address: string): Promise<GeocodeResult[]> {
    const addresses = await geoLocationManager.getAddressesFromLocationName({
      description: address,
      locale: 'en-US',
      maxItems: 5,
    });

    return addresses.map((addressEntry) => ({
      latitude: Number(addressEntry.latitude ?? 0),
      longitude: Number(addressEntry.longitude ?? 0),
    }));
  }

  async reverseGeocode(location: { latitude: number; longitude: number }): Promise<ReverseGeocodeResult[]> {
    const addresses = await geoLocationManager.getAddressesFromLocation({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      locale: 'en-US',
      maxItems: 5,
    });

    return addresses.map((addressEntry) => ({
      city: this.readAddressString(addressEntry, ['locality']),
      district: this.readAddressString(addressEntry, ['subLocality']),
      streetNumber: this.readAddressString(addressEntry, ['subThoroughfare', 'streetNumber']),
      street: this.readAddressString(addressEntry, ['thoroughfare', 'street']),
      region: this.readAddressString(addressEntry, ['administrativeArea', 'region']),
      subregion: this.readAddressString(addressEntry, ['subAdministrativeArea', 'subregion']),
      country: this.readAddressString(addressEntry, ['countryName', 'country']),
      postalCode: this.readAddressString(addressEntry, ['postalCode']),
      name: this.readAddressString(addressEntry, ['placeName', 'name']),
      isoCountryCode: this.readAddressString(addressEntry, ['countryCode', 'isoCountryCode']),
      timezone: null,
      formattedAddress: this.readAddressString(addressEntry, ['addressUrl']) ?? this.joinAddressDescriptions(addressEntry),
    }));
  }

  async startWatchPosition(
    options?: { accuracy?: number },
    _listenerConfig?: Record<string, unknown>,
  ): Promise<{ watchId: number; initialLocation: ExpoLocationObject | null }> {
    const watchId = this.nextWatchId++;
    return {
      watchId,
      initialLocation: await this.getLastKnownPosition(options ?? {}),
    };
  }

  async stopWatchPosition(_watchId: number): Promise<void> {
    return;
  }

  async getHeading(): Promise<HeadingObject> {
    return this.readHeadingSnapshot();
  }

  async startWatchHeading(
    _listenerConfig?: Record<string, unknown>,
  ): Promise<{ watchId: number; initialHeading: HeadingObject }> {
    const watchId = this.nextWatchId++;
    return {
      watchId,
      initialHeading: await this.getHeading(),
    };
  }

  async stopWatchHeading(_watchId: number): Promise<void> {
    return;
  }

  private async getLocationPermissionResponse(): Promise<PermissionResponse> {
    const approximateStatus = this.resolvePermissionStatus('ohos.permission.APPROXIMATELY_LOCATION');
    const preciseStatus = this.resolvePermissionStatus('ohos.permission.LOCATION');

    return this.buildPermissionResponse(approximateStatus, preciseStatus);
  }

  private async buildBackgroundPermissionResponse(
    backgroundStatus: abilityAccessCtrl.PermissionStatus,
  ): Promise<PermissionResponse> {
    const foregroundPermission = await this.getLocationPermissionResponse();
    const granted = backgroundStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const denied =
      backgroundStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
      backgroundStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
      backgroundStatus === abilityAccessCtrl.PermissionStatus.INVALID;

    return {
      ...foregroundPermission,
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
    };
  }

  private async requestLocationPermissionResponse(): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [
      'ohos.permission.APPROXIMATELY_LOCATION',
      'ohos.permission.LOCATION',
    ]);

    return this.getLocationPermissionResponse();
  }

  private resolvePermissionStatus(permissionName: Permissions): abilityAccessCtrl.PermissionStatus {
    const atManagerWithSelfStatus = this.atManager as abilityAccessCtrl.AtManager & {
      getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus;
    };

    if (typeof atManagerWithSelfStatus.getSelfPermissionStatus === 'function') {
      return atManagerWithSelfStatus.getSelfPermissionStatus(permissionName);
    }

    const accessTokenId = this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId;
    const grantStatus = this.atManager.checkAccessTokenSync(accessTokenId, permissionName);

    return grantStatus === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
      ? abilityAccessCtrl.PermissionStatus.GRANTED
      : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;
  }

  private buildPermissionResponse(
    approximateStatus: abilityAccessCtrl.PermissionStatus,
    preciseStatus: abilityAccessCtrl.PermissionStatus,
  ): PermissionResponse {
    const coarseGranted = approximateStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const fineGranted = preciseStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const granted = coarseGranted || fineGranted;
    const denied =
      (approximateStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
        approximateStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
        approximateStatus === abilityAccessCtrl.PermissionStatus.INVALID) &&
      (preciseStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
        preciseStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
        preciseStatus === abilityAccessCtrl.PermissionStatus.INVALID);

    return {
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
      expires: 'never',
      android: {
        accuracy: fineGranted ? 'fine' : coarseGranted ? 'coarse' : 'none',
      },
    };
  }

  private createCurrentLocationRequest(accuracy?: number): geoLocationManager.CurrentLocationRequest {
    if (typeof accuracy === 'number' && accuracy >= 4) {
      return {
        priority: geoLocationManager.LocationRequestPriority.ACCURACY,
      };
    }

    if (typeof accuracy === 'number' && accuracy <= 2) {
      return {
        priority: geoLocationManager.LocationRequestPriority.LOW_POWER,
      };
    }

    return {
      priority: geoLocationManager.LocationRequestPriority.FIRST_FIX,
    };
  }

  private hasCoordinates(location: geoLocationManager.Location | null | undefined): location is geoLocationManager.Location {
    return (
      !!location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number'
    );
  }

  private normalizeLocation(location: geoLocationManager.Location): ExpoLocationObject {
    return {
      coords: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        altitude: typeof location.altitude === 'number' ? location.altitude : null,
        accuracy: typeof location.accuracy === 'number' ? location.accuracy : null,
        altitudeAccuracy: null,
        heading: typeof location.direction === 'number' ? location.direction : null,
        speed: typeof location.speed === 'number' ? location.speed : null,
      },
      timestamp: Number(location.timeStamp ?? Date.now()),
      mocked: false,
    };
  }

  private async readHeadingSnapshot(): Promise<HeadingObject> {
    return new Promise((resolve) => {
      try {
        const sensorApi = sensor as unknown as {
          once?: (sensorId: number, callback: (data: Record<string, number>) => void) => void;
          SensorId?: {
            ROTATION_VECTOR?: number;
          };
        };
        const onceFn = sensorApi.once;
        const rotationVectorId = sensorApi.SensorId?.ROTATION_VECTOR;

        if (typeof onceFn !== 'function' || typeof rotationVectorId !== 'number') {
          resolve({
            magHeading: 0,
            trueHeading: null,
            accuracy: 0,
          });
          return;
        }

        onceFn(rotationVectorId, (data: Record<string, number>) => {
          const x = Number(data?.x ?? 0);
          const y = Number(data?.y ?? 0);
          const z = Number(data?.z ?? 0);
          const w = Number(data?.w ?? 1);
          const sinyCosp = 2 * (w * z + x * y);
          const cosyCosp = 1 - 2 * (y * y + z * z);
          const magHeading = (Math.atan2(sinyCosp, cosyCosp) * 180 / Math.PI + 360) % 360;
          resolve({
            magHeading,
            trueHeading: magHeading,
            accuracy: 3,
          });
        });
      } catch (_error) {
        resolve({
          magHeading: 0,
          trueHeading: null,
          accuracy: 0,
        });
      }
    });
  }

  private readAddressString(
    addressEntry: geoLocationManager.GeoAddress,
    candidateKeys: string[],
  ): string | null {
    const addressRecord = addressEntry as Record<string, unknown>;

    for (const key of candidateKeys) {
      const value = addressRecord[key];

      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private joinAddressDescriptions(addressEntry: geoLocationManager.GeoAddress): string | null {
    const descriptions = (addressEntry as Record<string, unknown>).descriptions;

    if (!Array.isArray(descriptions) || descriptions.length === 0) {
      return null;
    }

    const normalized = descriptions.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    return normalized.length > 0 ? normalized.join(', ') : null;
  }
}
`;
}


export function renderExpoLocationHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyLocation';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);

function createError(code, message) {
  return new CodedError(code, message);
}

function createUnsupportedError(operationName) {
  return createError(
    'ERR_EXPO_HARMONY_UNSUPPORTED',
    '${capability.packageName} does not implement ' + operationName + ' on HarmonyOS yet.',
  );
}

function requireNativeModule(operationName) {
  if (NATIVE_MODULE) {
    return NATIVE_MODULE;
  }

  throw createError(
    'ERR_EXPO_HARMONY_NATIVE_MODULE_MISSING',
    '${capability.packageName} expected the ' +
      NATIVE_MODULE_NAME +
      ' TurboModule to be registered, but it was missing while running ' +
      operationName +
      '.',
  );
}

function normalizeNativeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code)
        : null;
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : typeof error.name === 'string' && error.name.length > 0
          ? error.name
          : JSON.stringify(error);

    return new Error(code ? '[native:' + code + '] ' + message : message);
  }

  return new Error(String(error));
}

async function invokeNative(methodName, operationName, ...args) {
  try {
    return await requireNativeModule(operationName)[methodName](...args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

function normalizePermissionResponse(permissionResponse) {
  return {
    status: permissionResponse?.status ?? 'undetermined',
    granted: permissionResponse?.granted === true,
    canAskAgain: permissionResponse?.canAskAgain !== false,
    expires: permissionResponse?.expires ?? 'never',
    android: permissionResponse?.android ?? { accuracy: 'none' },
    ios: permissionResponse?.ios ?? null,
  };
}

function normalizeLocationObject(location) {
  return {
    coords: {
      latitude: Number(location?.coords?.latitude ?? 0),
      longitude: Number(location?.coords?.longitude ?? 0),
      altitude:
        typeof location?.coords?.altitude === 'number' ? location.coords.altitude : null,
      accuracy:
        typeof location?.coords?.accuracy === 'number' ? location.coords.accuracy : null,
      altitudeAccuracy:
        typeof location?.coords?.altitudeAccuracy === 'number'
          ? location.coords.altitudeAccuracy
          : null,
      heading: typeof location?.coords?.heading === 'number' ? location.coords.heading : null,
      speed: typeof location?.coords?.speed === 'number' ? location.coords.speed : null,
    },
    timestamp: Number(location?.timestamp ?? Date.now()),
    mocked: location?.mocked === true,
  };
}

function normalizeProviderStatus(providerStatus) {
  return {
    locationServicesEnabled: providerStatus?.locationServicesEnabled === true,
    backgroundModeEnabled: providerStatus?.backgroundModeEnabled === true,
    gpsAvailable: providerStatus?.gpsAvailable === true,
    networkAvailable: providerStatus?.networkAvailable === true,
    passiveAvailable: providerStatus?.passiveAvailable === true,
  };
}

function normalizeReverseGeocodeResult(address) {
  return {
    city: address?.city ?? null,
    district: address?.district ?? null,
    streetNumber: address?.streetNumber ?? null,
    street: address?.street ?? null,
    region: address?.region ?? null,
    subregion: address?.subregion ?? null,
    country: address?.country ?? null,
    postalCode: address?.postalCode ?? null,
    name: address?.name ?? null,
    isoCountryCode: address?.isoCountryCode ?? null,
    timezone: address?.timezone ?? null,
    formattedAddress: address?.formattedAddress ?? null,
  };
}

function normalizeGeocodeInput(address) {
  if (typeof address === 'string') {
    return address.trim();
  }

  if (!address || typeof address !== 'object') {
    return '';
  }

  const parts = [
    address.name,
    address.streetNumber,
    address.street,
    address.district,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.join(', ');
}

function normalizeGeocodeResults(results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((result) => ({
    latitude: Number(result?.latitude ?? 0),
    longitude: Number(result?.longitude ?? 0),
    altitude: typeof result?.altitude === 'number' ? result.altitude : null,
    accuracy: typeof result?.accuracy === 'number' ? result.accuracy : null,
  }));
}

function normalizeHeadingObject(heading) {
  return {
    magHeading: Number(heading?.magHeading ?? 0),
    trueHeading:
      typeof heading?.trueHeading === 'number' && Number.isFinite(heading.trueHeading)
        ? heading.trueHeading
        : null,
    accuracy:
      typeof heading?.accuracy === 'number' && Number.isFinite(heading.accuracy)
        ? heading.accuracy
        : 0,
  };
}

function createSubscription(remove) {
  let active = true;

  return {
    remove() {
      if (!active) {
        return;
      }

      active = false;
      remove();
    },
  };
}

module.exports = {
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  async getForegroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'getForegroundPermissionStatus',
        'getForegroundPermissionsAsync',
      ),
    );
  },
  async requestForegroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'requestForegroundPermission',
        'requestForegroundPermissionsAsync',
      ),
    );
  },
  async getBackgroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'getBackgroundPermissionStatus',
        'getBackgroundPermissionsAsync',
      ),
    );
  },
  async requestBackgroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'requestBackgroundPermission',
        'requestBackgroundPermissionsAsync',
      ),
    );
  },
  async hasServicesEnabledAsync() {
    return await invokeNative('hasServicesEnabled', 'hasServicesEnabledAsync');
  },
  async getProviderStatusAsync() {
    return normalizeProviderStatus(
      await invokeNative('getProviderStatus', 'getProviderStatusAsync'),
    );
  },
  async getCurrentPositionAsync(options) {
    return normalizeLocationObject(
      await invokeNative('getCurrentPosition', 'getCurrentPositionAsync', options ?? {}),
    );
  },
  async getLastKnownPositionAsync(options) {
    const location = await invokeNative(
      'getLastKnownPosition',
      'getLastKnownPositionAsync',
      options ?? {},
    );
    return location ? normalizeLocationObject(location) : null;
  },
  async geocodeAsync(address) {
    return normalizeGeocodeResults(
      await invokeNative(
        'geocode',
        'geocodeAsync',
        normalizeGeocodeInput(address),
      ),
    );
  },
  async reverseGeocodeAsync(location) {
    const results = await invokeNative(
      'reverseGeocode',
      'reverseGeocodeAsync',
      {
        latitude: Number(location?.latitude ?? 0),
        longitude: Number(location?.longitude ?? 0),
      },
    );

    if (!Array.isArray(results)) {
      return [];
    }

    return results.map(normalizeReverseGeocodeResult);
  },
  async watchPositionAsync(options, callback, errorHandler) {
    if (typeof callback !== 'function') {
      throw createError(
        'ERR_EXPO_HARMONY_INVALID_LISTENER',
        '${capability.packageName} expected watchPositionAsync to receive a callback.',
      );
    }

    try {
      const watchResult = await invokeNative(
        'startWatchPosition',
        'watchPositionAsync',
        options ?? {},
        null,
      );
      const watchId =
        typeof watchResult?.watchId === 'number' ? watchResult.watchId : Number(Date.now());

      if (watchResult?.initialLocation) {
        callback(normalizeLocationObject(watchResult.initialLocation));
      }

      return createSubscription(() => {
        void invokeNative(
          'stopWatchPosition',
          'Location.watchPositionAsync.remove',
          watchId,
        ).catch(() => {});
      });
    } catch (error) {
      if (typeof errorHandler === 'function') {
        errorHandler(error);
      }

      throw error;
    }
  },
  async watchHeadingAsync(callback) {
    if (typeof callback !== 'function') {
      throw createError(
        'ERR_EXPO_HARMONY_INVALID_LISTENER',
        '${capability.packageName} expected watchHeadingAsync to receive a callback.',
      );
    }

    const watchResult = await invokeNative(
      'startWatchHeading',
      'watchHeadingAsync',
      null,
    );
    const watchId =
      typeof watchResult?.watchId === 'number' ? watchResult.watchId : Number(Date.now());

    if (watchResult?.initialHeading) {
      callback(normalizeHeadingObject(watchResult.initialHeading));
    }

    return createSubscription(() => {
      void invokeNative(
        'stopWatchHeading',
        'Location.watchHeadingAsync.remove',
        watchId,
      ).catch(() => {});
    });
  },
  async getHeadingAsync() {
    return normalizeHeadingObject(
      await invokeNative('getHeading', 'getHeadingAsync'),
    );
  },
};
`;
}


export function renderExpoLocationPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, but foreground permission, current-position, and watch flows still need device-side validation.';
const DEFAULT_PERMISSION_RESPONSE = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

function getPermissionResponse() {
  return { ...DEFAULT_PERMISSION_RESPONSE };
}

module.exports = {
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync() {
    return unavailable('requestForegroundPermissionsAsync');
  },
  getForegroundPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  requestBackgroundPermissionsAsync() {
    return unavailable('requestBackgroundPermissionsAsync');
  },
  getBackgroundPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  hasServicesEnabledAsync() {
    return Promise.resolve(false);
  },
  getCurrentPositionAsync(options) {
    return unavailable('getCurrentPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  getLastKnownPositionAsync(options) {
    return unavailable('getLastKnownPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  watchPositionAsync(options) {
    return unavailable('watchPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  geocodeAsync(address) {
    return unavailable('geocodeAsync(' + JSON.stringify(address ?? null) + ')');
  },
  reverseGeocodeAsync(location) {
    return unavailable('reverseGeocodeAsync(' + JSON.stringify(location ?? null) + ')');
  },
};
`;
}

