import { CapabilityDefinition } from '../../../types';

export function renderExpoMediaLibraryHarmonyAdapterShim(
  capability: CapabilityDefinition,
): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const cameraRollModule = require('@react-native-camera-roll/camera-roll');
const CameraRoll = cameraRollModule.CameraRoll ?? cameraRollModule.default ?? cameraRollModule;
const CAMERA_ROLL_PERMISSION_MODULE = TurboModuleRegistry.get('RNCCameraRollPermission');

const PermissionStatus = Object.freeze({
  DENIED: 'denied',
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
});

const MediaType = Object.freeze({
  audio: 'audio',
  photo: 'photo',
  video: 'video',
  unknown: 'unknown',
});

function requireCameraRollMethod(methodName) {
  if (CameraRoll && typeof CameraRoll[methodName] === 'function') {
    return CameraRoll[methodName].bind(CameraRoll);
  }

  throw new Error(
    '${capability.packageName} expected @react-native-camera-roll/camera-roll.' +
      methodName +
      ' to be available on Harmony.',
  );
}

function normalizePermissionStatus(status) {
  if (status === 'granted' || status === 'limited') {
    return PermissionStatus.GRANTED;
  }

  if (status === 'denied' || status === 'blocked' || status === 'unavailable') {
    return PermissionStatus.DENIED;
  }

  return PermissionStatus.UNDETERMINED;
}

function createPermissionResponse(status) {
  const normalizedStatus = normalizePermissionStatus(status);

  return {
    status: normalizedStatus,
    granted: normalizedStatus === PermissionStatus.GRANTED,
    canAskAgain: status !== 'blocked' && status !== 'unavailable',
    expires: 'never',
    accessPrivileges:
      status === 'limited'
        ? 'limited'
        : normalizedStatus === PermissionStatus.GRANTED
          ? 'all'
          : 'none',
  };
}

async function probePermission(writeOnly) {
  if (CAMERA_ROLL_PERMISSION_MODULE?.checkPermission) {
    const readStatus = writeOnly
      ? 'granted'
      : await CAMERA_ROLL_PERMISSION_MODULE.checkPermission('readWrite');
    const writeStatus = await CAMERA_ROLL_PERMISSION_MODULE.checkPermission('addOnly');

    return createPermissionResponse(
      readStatus === 'granted' && writeStatus === 'granted' ? 'granted' : 'denied',
    );
  }

  await requireCameraRollMethod('getPhotos')({ first: 1 });
  return createPermissionResponse('granted');
}

async function getPermissionsAsync(writeOnly = false) {
  return probePermission(writeOnly === true);
}

async function requestPermissionsAsync(writeOnly = false) {
  if (!CAMERA_ROLL_PERMISSION_MODULE) {
    return probePermission(writeOnly === true);
  }

  const statuses = [];

  if (!writeOnly && typeof CAMERA_ROLL_PERMISSION_MODULE.requestAddOnlyPermission === 'function') {
    statuses.push(await CAMERA_ROLL_PERMISSION_MODULE.requestAddOnlyPermission());
  }
  if (typeof CAMERA_ROLL_PERMISSION_MODULE.requestReadWritePermission === 'function') {
    statuses.push(await CAMERA_ROLL_PERMISSION_MODULE.requestReadWritePermission());
  }

  if (statuses.length === 0) {
    return probePermission(writeOnly === true);
  }

  return createPermissionResponse(
    statuses.every((status) => status === 'granted' || status === 'limited')
      ? statuses.includes('limited')
        ? 'limited'
        : 'granted'
      : statuses.find((status) => status !== 'granted') ?? 'denied',
  );
}

function requireLocalUri(localUri) {
  if (typeof localUri !== 'string' || localUri.length === 0) {
    throw new TypeError('${capability.packageName} expected a non-empty local URI.');
  }

  return localUri;
}

function normalizeSavedAsset(savedAsset, requestedUri) {
  const node = savedAsset?.node ?? {};
  const image = node.image ?? {};
  const uri = image.uri ?? savedAsset?.uri ?? requestedUri;

  return {
    id: String(node.id ?? uri),
    filename: String(image.filename ?? uri.split('/').pop() ?? ''),
    uri: String(uri),
    mediaType: node.type === 'video' ? MediaType.video : MediaType.photo,
    width: Number(image.width ?? 0),
    height: Number(image.height ?? 0),
    creationTime: Number(node.timestamp ?? 0) * 1000,
    modificationTime: Number(node.modificationTimestamp ?? node.timestamp ?? 0) * 1000,
    duration: Number(image.playableDuration ?? 0),
    albumId: String(node.group_name ?? ''),
  };
}

async function createAssetAsync(localUri) {
  const normalizedUri = requireLocalUri(localUri);

  if (typeof CameraRoll?.saveAsset === 'function') {
    return normalizeSavedAsset(await CameraRoll.saveAsset(normalizedUri), normalizedUri);
  }

  const savedUri = await requireCameraRollMethod('save')(normalizedUri);
  return normalizeSavedAsset({ uri: savedUri }, normalizedUri);
}

async function saveToLibraryAsync(localUri) {
  const normalizedUri = requireLocalUri(localUri);

  if (typeof CameraRoll?.saveAsset === 'function') {
    await CameraRoll.saveAsset(normalizedUri);
    return;
  }

  await requireCameraRollMethod('save')(normalizedUri);
}

module.exports = {
  PermissionStatus,
  MediaType,
  getPermissionsAsync,
  requestPermissionsAsync,
  createAssetAsync,
  saveToLibraryAsync,
};
`;
}
