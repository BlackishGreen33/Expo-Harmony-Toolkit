import { CapabilityDefinition } from '../../../types';


export function renderExpoHarmonyCameraTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import camera from '@ohos.multimedia.camera';
import cameraPicker from '@ohos.multimedia.cameraPicker';
import image from '@ohos.multimedia.image';
import { UITurboModuleContext, UITurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
};

type CameraCaptureResult = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  exif: null;
};

type CameraRecordingResult = {
  uri: string;
  duration: number;
  fileSize: number | null;
  mimeType: string;
};

export class ExpoHarmonyCameraTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyCamera';

  private readonly atManager = abilityAccessCtrl.createAtManager();
  private readonly previewStates = new Map<string, 'running' | 'paused'>();
  private readonly activeRecordings = new Map<string, CameraRecordingResult>();

  getConstants(): Record<string, never> {
    return {};
  }

  async getCameraPermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.CAMERA');
  }

  async requestCameraPermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.CAMERA');
  }

  async getMicrophonePermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.MICROPHONE');
  }

  async requestMicrophonePermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.MICROPHONE');
  }

  async createPreview(options?: { viewId?: string }): Promise<{ viewId: string; state: 'running' }> {
    const viewId = typeof options?.viewId === 'string' && options.viewId.length > 0
      ? options.viewId
      : 'expo-harmony-camera-preview';
    this.previewStates.set(viewId, 'running');
    return {
      viewId,
      state: 'running',
    };
  }

  async disposePreview(options?: { viewId?: string }): Promise<void> {
    if (typeof options?.viewId === 'string') {
      this.previewStates.delete(options.viewId);
      this.activeRecordings.delete(options.viewId);
    }
  }

  async pausePreview(options?: { viewId?: string }): Promise<{ paused: boolean }> {
    if (typeof options?.viewId === 'string') {
      this.previewStates.set(options.viewId, 'paused');
    }
    return {
      paused: true,
    };
  }

  async resumePreview(options?: { viewId?: string }): Promise<{ paused: boolean }> {
    if (typeof options?.viewId === 'string') {
      this.previewStates.set(options.viewId, 'running');
    }
    return {
      paused: false,
    };
  }

  async takePicture(options?: { cameraType?: string; viewId?: string }): Promise<CameraCaptureResult> {
    const profile = new cameraPicker.PickerProfile();
    profile.cameraPosition =
      options?.cameraType === 'front'
        ? camera.CameraPosition.CAMERA_POSITION_FRONT
        : camera.CameraPosition.CAMERA_POSITION_BACK;

    const result = await cameraPicker.pick(
      this.ctx.uiAbilityContext,
      [cameraPicker.PickerMediaType.PHOTO],
      profile,
    );

    if (!result || typeof result.resultUri !== 'string' || result.resultUri.length === 0) {
      throw new Error('Camera capture was canceled.');
    }

    const imageSize = await this.getImageSize(result.resultUri);

    return {
      uri: result.resultUri,
      width: imageSize.width,
      height: imageSize.height,
      exif: null,
    };
  }

  async startRecording(options?: { viewId?: string; cameraType?: string }): Promise<CameraRecordingResult> {
    await this.requestPermissionResponse('ohos.permission.MICROPHONE');
    const profile = new cameraPicker.PickerProfile();
    profile.cameraPosition =
      options?.cameraType === 'front'
        ? camera.CameraPosition.CAMERA_POSITION_FRONT
        : camera.CameraPosition.CAMERA_POSITION_BACK;

    const result = await cameraPicker.pick(
      this.ctx.uiAbilityContext,
      [cameraPicker.PickerMediaType.VIDEO],
      profile,
    );

    if (!result || typeof result.resultUri !== 'string' || result.resultUri.length === 0) {
      throw new Error('Camera recording was canceled.');
    }

    const recording = {
      uri: result.resultUri,
      duration: 0,
      fileSize: null,
      mimeType: 'video/mp4',
    };

    if (typeof options?.viewId === 'string') {
      this.activeRecordings.set(options.viewId, recording);
    }

    return recording;
  }

  async stopRecording(options?: { viewId?: string }): Promise<CameraRecordingResult | null> {
    if (typeof options?.viewId === 'string') {
      const recording = this.activeRecordings.get(options.viewId) ?? null;
      this.activeRecordings.delete(options.viewId);
      return recording;
    }

    return null;
  }

  async toggleRecording(options?: { viewId?: string; cameraType?: string }): Promise<CameraRecordingResult | null> {
    if (typeof options?.viewId === 'string' && this.activeRecordings.has(options.viewId)) {
      return this.stopRecording(options);
    }

    return this.startRecording(options);
  }

  private async getPermissionResponse(permissionName: Permissions): Promise<PermissionResponse> {
    const atManagerWithSelfStatus = this.atManager as abilityAccessCtrl.AtManager & {
      getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus;
    };
    const permissionStatus =
      typeof atManagerWithSelfStatus.getSelfPermissionStatus === 'function'
        ? atManagerWithSelfStatus.getSelfPermissionStatus(permissionName)
        : this.atManager.checkAccessTokenSync(
            this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId,
            permissionName,
          ) === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
          ? abilityAccessCtrl.PermissionStatus.GRANTED
          : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;

    return this.createPermissionResponse(permissionStatus);
  }

  private async requestPermissionResponse(permissionName: Permissions): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [permissionName]);
    return this.getPermissionResponse(permissionName);
  }

  private createPermissionResponse(
    permissionStatus: abilityAccessCtrl.PermissionStatus,
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
    };
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
}
`;
}


export function renderExpoCameraHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const React = require('react');
const { TurboModuleRegistry, requireNativeComponent } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyCamera';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);
const NativeCameraView = requireNativeComponent('ExpoHarmonyCameraView');
const DEFAULT_PERMISSION_RESPONSE = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};
let nextCameraViewId = 1;

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
    status: permissionResponse?.status ?? DEFAULT_PERMISSION_RESPONSE.status,
    granted: permissionResponse?.granted === true,
    canAskAgain: permissionResponse?.canAskAgain !== false,
    expires: permissionResponse?.expires ?? DEFAULT_PERMISSION_RESPONSE.expires,
  };
}

function normalizeCameraFacing(facing) {
  return facing === 'front' ? 'front' : 'back';
}

const CameraView = React.forwardRef(function ExpoHarmonyCameraView(props, ref) {
  const viewIdRef = React.useRef(null);

  if (!viewIdRef.current) {
    viewIdRef.current = 'expo-harmony-camera-view-' + String(nextCameraViewId++);
  }

  const viewId = viewIdRef.current;

  React.useEffect(() => {
    void invokeNative('createPreview', 'CameraView.mount', {
      viewId,
      facing: normalizeCameraFacing(props.facing),
      mode: props.mode ?? 'picture',
    }).catch(() => {});

    return () => {
      void invokeNative('disposePreview', 'CameraView.unmount', {
        viewId,
      }).catch(() => {});
    };
  }, [props.facing, props.mode, viewId]);

  React.useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        return invokeNative('takePicture', 'CameraView.takePictureAsync', {
          viewId,
          cameraType: normalizeCameraFacing(props.facing),
          ...options,
        });
      },
      async pausePreview() {
        return invokeNative('pausePreview', 'CameraView.pausePreview', {
          viewId,
        });
      },
      async resumePreview() {
        return invokeNative('resumePreview', 'CameraView.resumePreview', {
          viewId,
        });
      },
      async getAvailablePictureSizesAsync() {
        throw createUnsupportedError('CameraView.getAvailablePictureSizesAsync');
      },
      async getAvailableLensesAsync() {
        throw createUnsupportedError('CameraView.getAvailableLensesAsync');
      },
      async recordAsync(options) {
        return invokeNative('startRecording', 'CameraView.recordAsync', {
          viewId,
          cameraType: normalizeCameraFacing(props.facing),
          ...options,
        });
      },
      async stopRecording() {
        return invokeNative('stopRecording', 'CameraView.stopRecording', {
          viewId,
        });
      },
      async toggleRecordingAsync(options) {
        return invokeNative('toggleRecording', 'CameraView.toggleRecordingAsync', {
          viewId,
          cameraType: normalizeCameraFacing(props.facing),
          ...options,
        });
      },
    }),
    [props.facing, viewId],
  );

  return React.createElement(NativeCameraView, {
    ...props,
    viewId,
    facing: normalizeCameraFacing(props.facing),
    accessibilityLabel: props.accessibilityLabel ?? 'Expo Harmony embedded camera preview',
    style: [
      {
        minHeight: 220,
        overflow: 'hidden',
        backgroundColor: '#111827',
      },
      props.style,
    ],
  });
});

CameraView.displayName = 'ExpoHarmonyCameraView';

async function getCameraPermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('getCameraPermissionStatus', 'getCameraPermissionsAsync'),
  );
}

async function requestCameraPermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('requestCameraPermission', 'requestCameraPermissionsAsync'),
  );
}

async function getMicrophonePermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('getMicrophonePermissionStatus', 'getMicrophonePermissionsAsync'),
  );
}

async function requestMicrophonePermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('requestMicrophonePermission', 'requestMicrophonePermissionsAsync'),
  );
}

module.exports = {
  CameraType: {
    front: 'front',
    back: 'back',
  },
  FlashMode: {
    off: 'off',
    on: 'on',
    auto: 'auto',
    torch: 'torch',
  },
  CameraView,
  Camera: {
    CameraType: {
      front: 'front',
      back: 'back',
    },
    Constants: {
      Type: {
        front: 'front',
        back: 'back',
      },
      FlashMode: {
        off: 'off',
        on: 'on',
        auto: 'auto',
        torch: 'torch',
      },
    },
    getCameraPermissionsAsync,
    requestCameraPermissionsAsync,
    getMicrophonePermissionsAsync,
    requestMicrophonePermissionsAsync,
  },
  getCameraPermissionsAsync,
  requestCameraPermissionsAsync,
  getMicrophonePermissionsAsync,
  requestMicrophonePermissionsAsync,
  async scanFromURLAsync() {
    throw createUnsupportedError('scanFromURLAsync');
  },
};
`;
}

export function renderExpoCameraPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const React = require('react');
const { Text, View } = require('react-native');
const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, and a managed preview surface can render, but device-side camera permission and capture flows still need validation.';
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

const CameraView = React.forwardRef(function ExpoHarmonyCameraPreview(props, ref) {
  React.useImperativeHandle(ref, () => ({
    takePictureAsync(options) {
      return unavailable('CameraView.takePictureAsync(' + JSON.stringify(options ?? {}) + ')');
    },
    pausePreview() {
      return unavailable('CameraView.pausePreview()');
    },
    resumePreview() {
      return unavailable('CameraView.resumePreview()');
    },
  }));

  return React.createElement(
    View,
    {
      style: [
        {
          minHeight: 220,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#14b8a6',
          backgroundColor: '#ccfbf1',
          padding: 20,
        },
        props.style,
      ],
      accessibilityLabel: 'Expo Harmony preview camera surface',
    },
    React.createElement(
      Text,
      {
        style: {
          color: '#0f766e',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
        },
      },
      'Expo Harmony preview camera surface',
    ),
  );
});

CameraView.displayName = 'ExpoHarmonyCameraPreview';

module.exports = {
  CameraType: {
    front: 'front',
    back: 'back',
  },
  FlashMode: {
    off: 'off',
    on: 'on',
    auto: 'auto',
    torch: 'torch',
  },
  CameraView,
  requestCameraPermissionsAsync() {
    return unavailable('requestCameraPermissionsAsync');
  },
  getCameraPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  requestMicrophonePermissionsAsync() {
    return unavailable('requestMicrophonePermissionsAsync');
  },
  getMicrophonePermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  Camera: {
    getCameraPermissionsAsync() {
      return Promise.resolve(getPermissionResponse());
    },
    requestCameraPermissionsAsync() {
      return unavailable('Camera.requestCameraPermissionsAsync');
    },
    getMicrophonePermissionsAsync() {
      return Promise.resolve(getPermissionResponse());
    },
    requestMicrophonePermissionsAsync() {
      return unavailable('Camera.requestMicrophonePermissionsAsync');
    },
  },
  scanFromURLAsync() {
    return unavailable('scanFromURLAsync');
  },
};
`;
}
