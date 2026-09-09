import { CapabilityDefinition } from '../../../types';


export function renderExpoHarmonyImagePickerTurboModule(): string {
  return `import abilityAccessCtrl, { type Permissions } from '@ohos.abilityAccessCtrl';
import photoAccessHelper from '@ohos.file.photoAccessHelper';
import camera from '@ohos.multimedia.camera';
import cameraPicker from '@ohos.multimedia.cameraPicker';
import media from '@ohos.multimedia.media';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import { UITurboModuleContext, UITurboModule } from '@rnoh/react-native-openharmony/ts';
import { UIContext } from '@ohos.arkui.UIContext';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
  accessPrivileges?: 'all' | 'limited' | 'none';
};

type LaunchImageLibraryOptions = {
  mediaTypes?: string | string[];
  allowsEditing?: boolean;
  aspect?: number[];
  quality?: number;
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
};

type LaunchCameraOptions = {
  mediaTypes?: string | string[];
  allowsEditing?: boolean;
  aspect?: number[];
  quality?: number;
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

  constructor(ctx: UITurboModuleContext, private readonly selectCrop: (context: UIContext, pixels: image.PixelMap, width: number, height: number, aspect: number[]) => Promise<image.Region | null>) {
    super(ctx);
  }

  getConstants(): Record<string, never> {
    return {};
  }

  async getMediaLibraryPermissionStatus(_writeOnly?: boolean): Promise<PermissionResponse> {
    // PhotoViewPicker grants access only to user-selected URIs, without a gallery ACL.
    return { status: 'granted', granted: true, canAskAgain: false, expires: 'never', accessPrivileges: 'limited' };
  }

  async requestMediaLibraryPermission(_writeOnly?: boolean): Promise<PermissionResponse> {
    return this.getMediaLibraryPermissionStatus();
  }

  async getCameraPermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.CAMERA', false);
  }

  async requestCameraPermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.CAMERA', false);
  }

  async launchImageLibrary(options?: LaunchImageLibraryOptions): Promise<ImagePickerResult> {
    this.pendingResult = null;
    const photoPicker = new photoAccessHelper.PhotoViewPicker();
    const selection = await photoPicker.select(this.createPhotoSelectOptions(options));
    const selectedUris = this.normalizeSelectedUris(selection?.photoUris);

    if (selectedUris.length === 0) {
      return this.createCanceledResult();
    }

    const assets: ImagePickerAsset[] = [];
    for (const uri of selectedUris) {
      const picked = await this.createImagePickerAsset(uri, uri, this.inferAssetTypeFromMediaTypes(options?.mediaTypes));
      const asset = await this.preparePickedAsset(picked, options);
      if (!asset) return this.createCanceledResult();
      assets.push(asset);
    }

    const result = {
      canceled: false,
      assets,
    };
    this.pendingResult = result;
    return result;
  }

  async launchCamera(options?: LaunchCameraOptions): Promise<ImagePickerResult> {
    this.pendingResult = null;
    this.createPhotoSelectOptions(options);
    const requestedAssetType = this.inferAssetTypeFromMediaTypes(options?.mediaTypes);

    await this.ensurePermissionGranted('ohos.permission.CAMERA', false);
    const mediaTypes = this.normalizeMediaTypes(options?.mediaTypes);
    if (mediaTypes.includes('video')) {
      await this.ensurePermissionGranted('ohos.permission.MICROPHONE', false);
    }

    const selection = await cameraPicker.pick(this.ctx.uiAbilityContext,
      mediaTypes.map((type: string) => type === 'video' ? cameraPicker.PickerMediaType.VIDEO : cameraPicker.PickerMediaType.PHOTO),
      { cameraPosition: options?.cameraType === 'front' ? camera.CameraPosition.CAMERA_POSITION_FRONT : camera.CameraPosition.CAMERA_POSITION_BACK });
    if (!selection?.resultUri) {
      return this.createCanceledResult();
    }

    const assetUri = selection.resultUri;
    const picked = await this.createImagePickerAsset(assetUri, assetUri, selection.mediaType === cameraPicker.PickerMediaType.VIDEO ? 'video' : requestedAssetType ?? 'image');
    const asset = await this.preparePickedAsset(picked, options?.allowsEditing ? { ...options, aspect: options.aspect ?? [1, 1] } : options);
    if (!asset) return this.createCanceledResult();

    const result = {
      canceled: false,
      assets: [asset],
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
    if (options?.allowsEditing && options?.allowsMultipleSelection) {
      throw new Error('allowsEditing and allowsMultipleSelection are mutually exclusive.');
    }
    if (options?.quality !== undefined && (!Number.isFinite(options.quality) || options.quality < 0 || options.quality > 1)) {
      throw new Error('Image quality must be between 0 and 1.');
    }
    if (options?.aspect && (options.aspect.length !== 2 || options.aspect.some((value: number) => !Number.isFinite(value) || value <= 0))) {
      throw new Error('Image aspect must contain two positive numbers.');
    }
    const selectOptions = new photoAccessHelper.PhotoSelectOptions();
    selectOptions.MIMEType = this.resolvePhotoViewMimeType(options?.mediaTypes);
    selectOptions.maxSelectNumber =
      options?.allowsMultipleSelection === true
        ? this.resolveSelectionLimit(options?.selectionLimit)
        : 1;
    selectOptions.isSearchSupported = true;
    selectOptions.isPhotoTakingSupported = isPhotoTakingSupported;
    // System editing has no aspect constraint; use our Image Kit crop dialog for that case.
    selectOptions.isEditSupported = options?.allowsEditing === true && !options.aspect;
    selectOptions.isPreviewForSingleSelectionSupported = selectOptions.isEditSupported;
    return selectOptions;
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

  private inferAssetTypeFromMediaTypes(
    rawMediaTypes?: string | string[],
  ): 'image' | 'video' | null {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return 'video';
    }

    if (normalized.includes('image') && !normalized.includes('video')) {
      return 'image';
    }

    return null;
  }

  private normalizeMediaTypes(rawMediaTypes?: string | string[]): string[] {
    if (rawMediaTypes === 'All' || rawMediaTypes === 'all' || (Array.isArray(rawMediaTypes) && rawMediaTypes.some((value: string) => value === 'All' || value === 'all'))) return ['image', 'video'];
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

  private async createImagePickerAsset(
    assetUri: string,
    originalUri: string,
    fallbackType: 'image' | 'video' | null,
  ): Promise<ImagePickerAsset> {
    // Picker grants access to media URIs, not filesystem paths usable by native consumers.
    if (assetUri.startsWith('file://media/')) {
      const source = fs.openSync(assetUri, fs.OpenMode.READ_ONLY);
      try {
        const extension = this.extractFileName(assetUri)?.match(/\\.[a-z0-9]+$/i)?.[0] ?? '';
        const cachePath = this.ctx.uiAbilityContext.cacheDir + '/image-picker-' + util.generateRandomUUID() + extension;
        await fs.copyFile(source.fd, cachePath);
        assetUri = 'file://' + cachePath;
      } finally {
        fs.closeSync(source);
      }
    }
    const inferredType = this.inferAssetTypeFromUri(assetUri, fallbackType);
    const metadata = inferredType === 'video'
      ? await this.getVideoMetadata(assetUri)
      : { ...(await this.getImageSize(assetUri)), duration: null };
    const fileSize = await this.getFileSize(assetUri);
    const fileName = this.extractFileName(originalUri) ?? this.extractFileName(assetUri);

    return {
      uri: assetUri,
      assetId: originalUri,
      width: metadata.width,
      height: metadata.height,
      type: inferredType,
      fileName,
      fileSize,
      mimeType: this.inferMimeType(assetUri, inferredType),
      duration: metadata.duration,
      exif: null,
      base64: null,
    };
  }

  private async preparePickedAsset(asset: ImagePickerAsset, options?: LaunchImageLibraryOptions): Promise<ImagePickerAsset | null> {
    const crop = options?.allowsEditing === true && !!options.aspect;
    if (asset.type !== 'image' || (!crop && options?.quality === undefined)) return asset;
    const source = image.createImageSource(this.resolveFsTarget(asset.uri) ?? asset.uri);
    let pixels: image.PixelMap | null = null;
    let packer: image.ImagePacker | null = null;
    try {
      const info = await source.getImageInfo();
      if (info.size.width * info.size.height > 32 * 1024 * 1024) throw new Error('Image is too large to edit in memory.');
      pixels = await source.createPixelMap({ editable: true });
      if (crop) {
        const context = this.ctx.getUIContext();
        if (!context) throw new Error('Image editor requires an active UI context.');
        const region = await this.selectCrop(context, pixels, info.size.width, info.size.height, options!.aspect!);
        if (!region) return null;
        await pixels.crop(region);
      }
      const size = (await pixels.getImageInfo()).size;
      const isPng = asset.mimeType === 'image/png';
      const format = isPng ? 'image/png' : 'image/jpeg';
      packer = image.createImagePacker();
      const bytes = await packer.packing(pixels, { format, quality: Math.round((options?.quality ?? 1) * 100) });
      const target = this.ctx.uiAbilityContext.cacheDir + '/image-picker-' + util.generateRandomUUID() + (isPng ? '.png' : '.jpg');
      const file = await fs.open(target, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      try {
        try {
          if (await fs.write(file.fd, bytes) !== bytes.byteLength) throw new Error('Incomplete edited image write.');
        } finally { await fs.close(file); }
      } catch (error) { await fs.unlink(target); throw error; }
      return { ...asset, uri: 'file://' + target, width: size.width, height: size.height, fileSize: bytes.byteLength, fileName: this.extractFileName(target), mimeType: format };
    } finally {
      if (packer) await packer.release();
      if (pixels) await pixels.release();
      await source.release();
    }
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
      imageSource = image.createImageSource(this.resolveFsTarget(assetUri) ?? assetUri);
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

  private async getVideoMetadata(assetUri: string): Promise<{ width: number; height: number; duration: number | null }> {
    const file = await fs.open(this.resolveFsTarget(assetUri) ?? assetUri, fs.OpenMode.READ_ONLY);
    let extractor: media.AVMetadataExtractor | null = null;
    try {
      extractor = await media.createAVMetadataExtractor();
      extractor.fdSrc = { fd: file.fd, offset: 0, length: (await fs.stat(file.fd)).size };
      const metadata = await extractor.fetchMetadata();
      const duration = Number(metadata.duration);
      return { width: Number(metadata.videoWidth ?? 0), height: Number(metadata.videoHeight ?? 0), duration: Number.isFinite(duration) ? duration : null };
    } finally {
      try { if (extractor) await extractor.release(); } finally { await fs.close(file); }
    }
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
