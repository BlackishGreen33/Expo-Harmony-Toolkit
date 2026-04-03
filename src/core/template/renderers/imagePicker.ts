import { CapabilityDefinition } from '../../../types';


export function renderExpoHarmonyImagePickerTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import photoAccessHelper from '@ohos.file.photoAccessHelper';
import picker from '@ohos.file.picker';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
import { UITurboModuleContext, UITurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
  accessPrivileges?: 'all' | 'limited' | 'none';
};

type LaunchImageLibraryOptions = {
  mediaTypes?: string | string[];
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
};

type LaunchCameraOptions = {
  mediaTypes?: string | string[];
  cameraType?: string;
};

type ImagePickerAsset = {
  uri: string;
  assetId: string | null;
  width: number;
  height: number;
  type: 'image' | 'video' | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  exif: null;
  base64: null;
};

type ImagePickerResult = {
  canceled: boolean;
  assets: ImagePickerAsset[] | null;
};

export class ExpoHarmonyImagePickerTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyImagePicker';

  private readonly atManager = abilityAccessCtrl.createAtManager();
  private pendingResult: ImagePickerResult | null = null;

  getConstants(): Record<string, never> {
    return {};
  }

  async getMediaLibraryPermissionStatus(_writeOnly?: boolean): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.READ_IMAGEVIDEO', true);
  }

  async requestMediaLibraryPermission(_writeOnly?: boolean): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.READ_IMAGEVIDEO', true);
  }

  async getCameraPermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.CAMERA', false);
  }

  async requestCameraPermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.CAMERA', false);
  }

  async launchImageLibrary(options?: LaunchImageLibraryOptions): Promise<ImagePickerResult> {
    await this.ensurePermissionGranted('ohos.permission.READ_IMAGEVIDEO', true);

    const photoPicker = new photoAccessHelper.PhotoViewPicker();
    const selection = await photoPicker.select(this.createPhotoSelectOptions(options));
    let selectedUris = this.normalizeSelectedUris(selection?.photoUris);

    if (selectedUris.length === 0) {
      selectedUris = await this.launchLegacyPhotoPicker(options);
    }

    if (selectedUris.length === 0) {
      return this.createCanceledResult();
    }

    const authorizedUris = await this.requestAuthorizedUris(selectedUris);
    const assets = await Promise.all(
      authorizedUris.map((uri, index) =>
        this.createImagePickerAsset(uri, selectedUris[index] ?? uri, this.inferAssetTypeFromMediaTypes(options?.mediaTypes)),
      ),
    );

    const result = {
      canceled: false,
      assets,
    };
    this.pendingResult = result;
    return result;
  }

  async launchCamera(options?: LaunchCameraOptions): Promise<ImagePickerResult> {
    const requestedAssetType = this.inferAssetTypeFromMediaTypes(options?.mediaTypes);

    await this.ensurePermissionGranted('ohos.permission.CAMERA', false);
    await this.ensurePermissionGranted('ohos.permission.READ_IMAGEVIDEO', true);
    if (requestedAssetType === 'video') {
      await this.ensurePermissionGranted('ohos.permission.MICROPHONE', false);
    }

    const cameraEntryPicker = new photoAccessHelper.PhotoViewPicker();
    const selection = await cameraEntryPicker.select(
      this.createPhotoSelectOptions(
        {
          mediaTypes: requestedAssetType === 'video' ? 'videos' : 'images',
          allowsMultipleSelection: false,
        },
        true,
      ),
    );
    const selectedUris = this.normalizeSelectedUris(selection?.photoUris);

    if (selectedUris.length === 0) {
      return this.createCanceledResult();
    }

    const authorizedUris = await this.requestAuthorizedUris(selectedUris);
    const assetUri = authorizedUris[0] ?? selectedUris[0];

    const result = {
      canceled: false,
      assets: [await this.createImagePickerAsset(assetUri, selectedUris[0], requestedAssetType ?? 'image')],
    };
    this.pendingResult = result;
    return result;
  }

  async getPendingResult(): Promise<ImagePickerResult | null> {
    const result = this.pendingResult;
    this.pendingResult = null;
    return result;
  }

  private async ensurePermissionGranted(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<void> {
    const permissionResponse = await this.getPermissionResponse(permissionName, isMediaLibraryPermission);

    if (permissionResponse.granted) {
      return;
    }

    const requestedResponse = await this.requestPermissionResponse(permissionName, isMediaLibraryPermission);

    if (!requestedResponse.granted) {
      throw new Error(\`Permission denied for \${permissionName}.\`);
    }
  }

  private async getPermissionResponse(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<PermissionResponse> {
    return this.permissionResponseFromStatus(
      this.resolvePermissionStatus(permissionName),
      isMediaLibraryPermission,
    );
  }

  private async requestPermissionResponse(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<PermissionResponse> {
    const requestResult = await this.atManager.requestPermissionsFromUser(
      this.ctx.uiAbilityContext,
      [permissionName],
    );
    const authResult = Array.isArray(requestResult.authResults)
      ? Number(requestResult.authResults[0] ?? abilityAccessCtrl.GrantStatus.PERMISSION_DENIED)
      : abilityAccessCtrl.GrantStatus.PERMISSION_DENIED;

    if (authResult === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
      return this.permissionResponseFromStatus(
        abilityAccessCtrl.PermissionStatus.GRANTED,
        isMediaLibraryPermission,
      );
    }

    return this.permissionResponseFromStatus(
      abilityAccessCtrl.PermissionStatus.DENIED,
      isMediaLibraryPermission,
    );
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

  private permissionResponseFromStatus(
    permissionStatus: abilityAccessCtrl.PermissionStatus,
    isMediaLibraryPermission: boolean,
  ): PermissionResponse {
    const granted = permissionStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const denied =
      permissionStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.INVALID;

    return {
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
      expires: 'never',
      ...(isMediaLibraryPermission
        ? {
            accessPrivileges: granted ? 'all' : 'none',
          }
        : {}),
    };
  }

  private createPhotoSelectOptions(
    options?: LaunchImageLibraryOptions,
    isPhotoTakingSupported: boolean = false,
  ): photoAccessHelper.PhotoSelectOptions {
    const selectOptions = new photoAccessHelper.PhotoSelectOptions();
    selectOptions.MIMEType = this.resolvePhotoViewMimeType(options?.mediaTypes);
    selectOptions.maxSelectNumber =
      options?.allowsMultipleSelection === true
        ? this.resolveSelectionLimit(options?.selectionLimit)
        : 1;
    selectOptions.isSearchSupported = true;
    selectOptions.isPhotoTakingSupported = isPhotoTakingSupported;
    return selectOptions;
  }

  private async launchLegacyPhotoPicker(options?: LaunchImageLibraryOptions): Promise<string[]> {
    const legacyPicker = new picker.PhotoViewPicker(this.ctx.uiAbilityContext);
    const legacyOptions = new picker.PhotoSelectOptions();
    legacyOptions.MIMEType = this.resolveLegacyPhotoViewMimeType(options?.mediaTypes);
    legacyOptions.maxSelectNumber =
      options?.allowsMultipleSelection === true
        ? this.resolveSelectionLimit(options?.selectionLimit)
        : 1;

    const selection = await legacyPicker.select(legacyOptions);
    return this.normalizeSelectedUris(selection?.photoUris);
  }

  private resolveSelectionLimit(selectionLimit?: number): number {
    if (typeof selectionLimit === 'number' && Number.isFinite(selectionLimit) && selectionLimit > 0) {
      return Math.floor(selectionLimit);
    }

    return 20;
  }

  private resolvePhotoViewMimeType(
    rawMediaTypes?: string | string[],
  ): photoAccessHelper.PhotoViewMIMETypes {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return photoAccessHelper.PhotoViewMIMETypes.VIDEO_TYPE;
    }

    if (normalized.includes('video') && normalized.includes('image')) {
      return photoAccessHelper.PhotoViewMIMETypes.IMAGE_VIDEO_TYPE;
    }

    return photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
  }

  private resolveLegacyPhotoViewMimeType(
    rawMediaTypes?: string | string[],
  ): picker.PhotoViewMIMETypes {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return picker.PhotoViewMIMETypes.VIDEO_TYPE;
    }

    if (normalized.includes('video') && normalized.includes('image')) {
      return picker.PhotoViewMIMETypes.IMAGE_VIDEO_TYPE;
    }

    return picker.PhotoViewMIMETypes.IMAGE_TYPE;
  }

  private inferAssetTypeFromMediaTypes(
    rawMediaTypes?: string | string[],
  ): 'image' | 'video' | null {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return 'video';
    }

    if (normalized.includes('image')) {
      return 'image';
    }

    return null;
  }

  private normalizeMediaTypes(rawMediaTypes?: string | string[]): string[] {
    if (Array.isArray(rawMediaTypes)) {
      return Array.from(
        new Set(
          rawMediaTypes
            .map((value) => this.normalizeMediaTypeValue(value))
            .filter((value): value is string => value !== null),
        ),
      );
    }

    const singleValue = this.normalizeMediaTypeValue(rawMediaTypes);
    return singleValue ? [singleValue] : ['image'];
  }

  private normalizeMediaTypeValue(rawValue?: string): string | null {
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
      return 'image';
    }

    switch (rawValue) {
      case 'All':
      case 'all':
      case 'images':
      case 'image':
      case 'livePhotos':
        return 'image';
      case 'Videos':
      case 'videos':
      case 'video':
        return 'video';
      default:
        return rawValue.includes('video') ? 'video' : rawValue.includes('image') ? 'image' : null;
    }
  }

  private normalizeSelectedUris(photoUris: Array<string> | undefined | null): string[] {
    if (!Array.isArray(photoUris)) {
      return [];
    }

    return photoUris.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  private async requestAuthorizedUris(photoUris: string[]): Promise<string[]> {
    const helper = photoAccessHelper.getPhotoAccessHelper(this.ctx.uiAbilityContext);

    try {
      const authorizedUris = await helper.requestPhotoUrisReadPermission(photoUris);
      const normalizedAuthorizedUris = this.normalizeSelectedUris(authorizedUris);
      return normalizedAuthorizedUris.length > 0 ? normalizedAuthorizedUris : photoUris;
    } catch (_error) {
      return photoUris;
    }
  }

  private async createImagePickerAsset(
    assetUri: string,
    originalUri: string,
    fallbackType: 'image' | 'video' | null,
  ): Promise<ImagePickerAsset> {
    const inferredType = this.inferAssetTypeFromUri(assetUri, fallbackType);
    const imageSize =
      inferredType === 'image' ? await this.getImageSize(assetUri) : { width: 0, height: 0 };
    const fileSize = await this.getFileSize(assetUri);
    const fileName = this.extractFileName(assetUri) ?? this.extractFileName(originalUri);

    return {
      uri: assetUri,
      assetId: originalUri,
      width: imageSize.width,
      height: imageSize.height,
      type: inferredType,
      fileName,
      fileSize,
      mimeType: this.inferMimeType(assetUri, inferredType),
      duration: inferredType === 'video' ? await this.getVideoDuration(assetUri) : null,
      exif: null,
      base64: null,
    };
  }

  private inferAssetTypeFromUri(
    assetUri: string,
    fallbackType: 'image' | 'video' | null,
  ): 'image' | 'video' | null {
    const normalizedUri = assetUri.toLowerCase();

    if (normalizedUri.match(/\\.(mp4|m4v|mov|3gp|webm)(\\?|#|$)/)) {
      return 'video';
    }

    if (normalizedUri.match(/\\.(png|jpe?g|gif|bmp|webp|heic|heif)(\\?|#|$)/)) {
      return 'image';
    }

    return fallbackType;
  }

  private inferMimeType(
    assetUri: string,
    assetType: 'image' | 'video' | null,
  ): string | null {
    const normalizedUri = assetUri.toLowerCase();

    if (normalizedUri.endsWith('.png')) {
      return 'image/png';
    }
    if (normalizedUri.endsWith('.gif')) {
      return 'image/gif';
    }
    if (normalizedUri.endsWith('.webp')) {
      return 'image/webp';
    }
    if (normalizedUri.endsWith('.bmp')) {
      return 'image/bmp';
    }
    if (normalizedUri.endsWith('.heic')) {
      return 'image/heic';
    }
    if (normalizedUri.endsWith('.heif')) {
      return 'image/heif';
    }
    if (normalizedUri.match(/\\.jpe?g(\\?|#|$)/)) {
      return 'image/jpeg';
    }
    if (normalizedUri.match(/\\.(mp4|m4v)(\\?|#|$)/)) {
      return 'video/mp4';
    }
    if (normalizedUri.match(/\\.mov(\\?|#|$)/)) {
      return 'video/quicktime';
    }
    if (normalizedUri.match(/\\.webm(\\?|#|$)/)) {
      return 'video/webm';
    }

    return assetType === 'video' ? 'video/*' : assetType === 'image' ? 'image/*' : null;
  }

  private extractFileName(assetUri: string): string | null {
    if (typeof assetUri !== 'string' || assetUri.length === 0) {
      return null;
    }

    const sanitizedUri = assetUri.split('?')[0]?.split('#')[0] ?? assetUri;
    const lastSlashIndex = sanitizedUri.lastIndexOf('/');
    const rawFileName =
      lastSlashIndex >= 0 ? sanitizedUri.slice(lastSlashIndex + 1) : sanitizedUri;

    if (rawFileName.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawFileName);
    } catch (_error) {
      return rawFileName;
    }
  }

  private async getImageSize(assetUri: string): Promise<{ width: number; height: number }> {
    let imageSource: image.ImageSource | null = null;

    try {
      imageSource = image.createImageSource(assetUri);
      const imageInfo = await imageSource.getImageInfo();
      return {
        width: Number(imageInfo.size?.width ?? 0),
        height: Number(imageInfo.size?.height ?? 0),
      };
    } catch (_error) {
      return {
        width: 0,
        height: 0,
      };
    } finally {
      if (imageSource) {
        try {
          await imageSource.release();
        } catch (_error) {
          // Ignore cleanup errors from ImageSource release.
        }
      }
    }
  }

  private async getFileSize(assetUri: string): Promise<number | null> {
    const fsTarget = this.resolveFsTarget(assetUri);

    if (!fsTarget) {
      return null;
    }

    try {
      const stat = await fs.stat(fsTarget);
      return Number(stat.size ?? 0);
    } catch (_error) {
      return null;
    }
  }

  private async getVideoDuration(_assetUri: string): Promise<number | null> {
    return 0;
  }

  private resolveFsTarget(assetUri: string): string | null {
    if (assetUri.startsWith('file://')) {
      return assetUri.slice('file://'.length);
    }

    return assetUri.startsWith('/') ? assetUri : null;
  }

  private createCanceledResult(): ImagePickerResult {
    return {
      canceled: true,
      assets: null,
    };
  }
}
`;
}


export function renderExpoImagePickerHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyImagePicker';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);

function createError(code, message) {
  return new CodedError(code, message);
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

function normalizePickerResult(result) {
  if (!result || result.canceled === true || !Array.isArray(result.assets) || result.assets.length === 0) {
    return {
      canceled: true,
      assets: null,
    };
  }

  return {
    canceled: false,
    assets: result.assets.map((asset) => ({
      uri: String(asset.uri),
      assetId: asset.assetId ?? null,
      width: Number(asset.width ?? 0),
      height: Number(asset.height ?? 0),
      type: asset.type ?? null,
      fileName: asset.fileName ?? null,
      fileSize:
        typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize)
          ? asset.fileSize
          : null,
      mimeType: asset.mimeType ?? null,
      duration:
        typeof asset.duration === 'number' && Number.isFinite(asset.duration)
          ? asset.duration
          : null,
      exif: asset.exif ?? null,
      base64: asset.base64 ?? null,
    })),
  };
}

async function invokeNative(methodName, operationName, ...args) {
  try {
    return await requireNativeModule(operationName)[methodName](...args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

module.exports = {
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
  CameraType: {
    front: 'front',
    back: 'back',
  },
  UIImagePickerPresentationStyle: {
    AUTOMATIC: 'automatic',
    FULL_SCREEN: 'fullScreen',
    PAGE_SHEET: 'pageSheet',
    FORM_SHEET: 'formSheet',
    CURRENT_CONTEXT: 'currentContext',
    OVER_FULL_SCREEN: 'overFullScreen',
  },
  async requestCameraPermissionsAsync() {
    return invokeNative(
      'requestCameraPermission',
      'requestCameraPermissionsAsync',
    );
  },
  async requestMediaLibraryPermissionsAsync(writeOnly) {
    return invokeNative(
      'requestMediaLibraryPermission',
      'requestMediaLibraryPermissionsAsync',
      writeOnly === true,
    );
  },
  async getCameraPermissionsAsync() {
    return invokeNative('getCameraPermissionStatus', 'getCameraPermissionsAsync');
  },
  async getMediaLibraryPermissionsAsync(writeOnly) {
    return invokeNative(
      'getMediaLibraryPermissionStatus',
      'getMediaLibraryPermissionsAsync',
      writeOnly === true,
    );
  },
  async launchCameraAsync(options) {
    return normalizePickerResult(
      await invokeNative('launchCamera', 'launchCameraAsync', options ?? {}),
    );
  },
  async launchImageLibraryAsync(options) {
    return normalizePickerResult(
      await invokeNative('launchImageLibrary', 'launchImageLibraryAsync', options ?? {}),
    );
  },
  async getPendingResultAsync() {
    const result = await invokeNative('getPendingResult', 'getPendingResultAsync');
    return result ? normalizePickerResult(result) : null;
  },
};
`;
}


export function renderExpoImagePickerPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, but picker and camera flows still need device-side validation.';

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

module.exports = {
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
  UIImagePickerPresentationStyle: {
    AUTOMATIC: 'automatic',
    FULL_SCREEN: 'fullScreen',
    PAGE_SHEET: 'pageSheet',
    FORM_SHEET: 'formSheet',
    CURRENT_CONTEXT: 'currentContext',
    OVER_FULL_SCREEN: 'overFullScreen',
  },
  requestCameraPermissionsAsync() {
    return unavailable('requestCameraPermissionsAsync');
  },
  requestMediaLibraryPermissionsAsync() {
    return unavailable('requestMediaLibraryPermissionsAsync');
  },
  getCameraPermissionsAsync() {
    return unavailable('getCameraPermissionsAsync');
  },
  getMediaLibraryPermissionsAsync() {
    return unavailable('getMediaLibraryPermissionsAsync');
  },
  launchCameraAsync(options) {
    return unavailable('launchCameraAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  launchImageLibraryAsync(options) {
    return unavailable('launchImageLibraryAsync(' + JSON.stringify(options ?? {}) + ')');
  },
};
`;
}

