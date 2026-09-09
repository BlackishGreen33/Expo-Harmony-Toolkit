import { CapabilityDefinition } from '../../../types';

export function renderExpoHarmonyCameraTurboModule(): string {
  return String.raw`import abilityAccessCtrl, { type Permissions } from '@ohos.abilityAccessCtrl';
import camera from '@ohos.multimedia.camera';
import image from '@ohos.multimedia.image';
import media from '@ohos.multimedia.media';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import display from '@ohos.display';
import { UITurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = { status: 'granted' | 'denied' | 'undetermined'; granted: boolean; canAskAgain: boolean; expires: 'never' };
type PreviewOptions = { viewId: string; surfaceId?: string; facing?: string; mode?: string };
type CaptureResult = { uri: string; width: number; height: number; base64?: string; exif: null };
type RecordingResult = { uri: string; duration: number | null; fileSize: number; mimeType: string };
type Recording = {
  ready: Promise<void>;
  finish?: Promise<void>;
  recorder?: media.AVRecorder;
  output?: camera.VideoOutput;
  file?: fs.File;
  path: string;
  resolve: (value: RecordingResult) => void;
  reject: (error: Error) => void;
};
type Preview = {
  options: PreviewOptions;
  disposed: boolean;
  paused: boolean;
  ready: Promise<void>;
  input?: camera.CameraInput;
  output?: camera.PreviewOutput;
  photo?: camera.PhotoOutput;
  session?: camera.PhotoSession | camera.VideoSession;
  capability?: camera.CameraOutputCapability;
  videoProfile?: camera.VideoProfile;
  onPhoto?: (error: Error, photo: camera.Photo) => Promise<void>;
  cancelPhoto?: () => void;
  recording?: Recording;
};

export class ExpoHarmonyCameraTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyCamera';
  private readonly atManager = abilityAccessCtrl.createAtManager();
  private readonly previews = new Map<string, Preview>();

  getConstants(): Record<string, never> { return {}; }
  async getCameraPermissionStatus(): Promise<PermissionResponse> { return this.getPermissionResponse('ohos.permission.CAMERA'); }
  async requestCameraPermission(): Promise<PermissionResponse> {
    const permission = await this.requestPermissionResponse('ohos.permission.CAMERA');
    if (permission.granted) {
      for (const state of Array.from(this.previews.values())) void this.createPreview(state.options).catch(() => {});
    }
    return permission;
  }
  async getMicrophonePermissionStatus(): Promise<PermissionResponse> { return this.getPermissionResponse('ohos.permission.MICROPHONE'); }
  async requestMicrophonePermission(): Promise<PermissionResponse> { return this.requestPermissionResponse('ohos.permission.MICROPHONE'); }

  async createPreview(options: PreviewOptions): Promise<void> {
    if (!options?.viewId || !options.surfaceId) throw new Error('Camera preview requires a mounted native surface.');
    const previous = this.previews.get(options.viewId);
    if (previous) previous.disposed = true;
    const state: Preview = { options, disposed: false, paused: false, ready: Promise.resolve() };
    this.previews.set(options.viewId, state);
    const initialize = (async (): Promise<void> => {
      if (previous) { await previous.ready.catch(() => {}); await this.releaseResources(previous); }
      try {
        if (!this.getPermissionResponse('ohos.permission.CAMERA').granted) throw new Error('Camera permission is not granted.');
        if (state.disposed) throw new Error('Camera view was unmounted.');
        const manager = camera.getCameraManager(this.ctx.uiAbilityContext);
        const facing = options.facing === 'front' ? camera.CameraPosition.CAMERA_POSITION_FRONT : camera.CameraPosition.CAMERA_POSITION_BACK;
        const device = manager.getSupportedCameras().find((item: camera.CameraDevice) => item.cameraPosition === facing);
        if (!device) throw new Error('The requested camera is not available.');
        const mode = options.mode === 'video' ? camera.SceneMode.NORMAL_VIDEO : camera.SceneMode.NORMAL_PHOTO;
        const capability = manager.getSupportedOutputCapability(device, mode);
        if (!capability.previewProfiles.length) throw new Error('Camera preview has no supported output profile.');
        state.capability = capability;
        state.videoProfile = capability.videoProfiles.find((profile: camera.VideoProfile) => profile.format === camera.CameraFormat.CAMERA_FORMAT_YUV_420_SP);
        const videoSize = state.videoProfile?.size;
        const profiles = options.mode === 'video' && videoSize
          ? capability.previewProfiles.filter((profile: camera.Profile) => profile.size.width * videoSize.height === profile.size.height * videoSize.width)
          : capability.previewProfiles;
        // Harmony emulator camera input requires RGBA 1280x720 when that profile is available.
        const previewProfile = profiles.find((profile: camera.Profile) => profile.format === camera.CameraFormat.CAMERA_FORMAT_RGBA_8888 && profile.size.width === 1280 && profile.size.height === 720) ?? profiles[0];
        if (!previewProfile) throw new Error('No preview profile matches the video aspect ratio.');
        state.input = manager.createCameraInput(device);
        await state.input.open();
        if (state.disposed) throw new Error('Camera view was unmounted.');
        state.output = manager.createPreviewOutput(previewProfile, options.surfaceId!);
        state.output.on('frameStart', (error: Error): void => {
          if (!state.disposed && !error) this.ctx.rnInstance.emitDeviceEvent('ExpoHarmonyCameraState', { viewId: options.viewId, ready: true });
        });
        state.session = manager.createSession(mode) as camera.PhotoSession | camera.VideoSession;
        state.session.beginConfig();
        state.session.addInput(state.input);
        state.session.addOutput(state.output);
        if (options.mode !== 'video') {
          if (!capability.photoProfiles.length) throw new Error('Camera has no supported photo profile.');
          state.photo = manager.createPhotoOutput(capability.photoProfiles.find((profile: camera.Profile) => profile.format === camera.CameraFormat.CAMERA_FORMAT_JPEG) ?? capability.photoProfiles[0]);
          // Register before commitConfig; PhotoOutput forbids off() from inside its callback.
          state.photo.on('photoAvailable', async (error: Error, photo: camera.Photo): Promise<void> => {
            const onPhoto = state.onPhoto;
            state.onPhoto = undefined;
            try { if (onPhoto) await onPhoto(error, photo); }
            finally { if (photo?.main) await photo.main.release(); }
          });
          state.session.addOutput(state.photo);
        }
        await state.session.commitConfig();
        if (state.disposed) throw new Error('Camera view was unmounted.');
        await state.session.start();
        if (state.disposed) throw new Error('Camera view was unmounted.');
      } catch (error) {
        await this.releaseResources(state).catch(() => {});
        throw error;
      }
    })();
    let timer: number = 0;
    state.ready = Promise.race([initialize, new Promise<void>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Camera initialization timed out. Check the camera input source.')), 15000);
    })]);
    try {
      await state.ready;
    } catch (error) {
      if (!state.disposed) this.ctx.rnInstance.emitDeviceEvent('ExpoHarmonyCameraState', { viewId: options.viewId, ready: false, message: (error as Error).message ?? 'Native camera initialization failed.' });
      state.disposed = true;
      void this.releaseResources(state).catch(() => {});
      throw error;
    } finally { clearTimeout(timer); }
  }

  override __onDestroy__(): void {
    for (const viewId of Array.from(this.previews.keys())) void this.disposePreview({ viewId }).catch(() => {});
    super.__onDestroy__();
  }

  async disposePreview(options: { viewId: string }): Promise<void> {
    const state = this.previews.get(options.viewId);
    if (!state) return;
    this.previews.delete(options.viewId);
    state.disposed = true;
    await state.ready.catch(() => {});
    await this.releaseResources(state);
  }

  async pausePreview(options: { viewId: string }): Promise<void> {
    const state = await this.requirePreview(options.viewId);
    if (!state.paused) { await state.output!.stop(); state.paused = true; }
  }
  async resumePreview(options: { viewId: string }): Promise<void> {
    const state = await this.requirePreview(options.viewId);
    if (state.paused) { await state.output!.start(); state.paused = false; }
  }

  async takePicture(options: { viewId: string; quality?: number; base64?: boolean }): Promise<CaptureResult> {
    const state = await this.requirePreview(options.viewId);
    const output = state.photo;
    if (!output) throw new Error('Still capture requires CameraView mode="picture".');
    if (state.paused) throw new Error('Resume the preview before taking a picture.');
    if (state.cancelPhoto) throw new Error('A photo capture is already in progress.');
    const quality = options.quality ?? 1;
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new Error('Photo quality must be between 0 and 1.');
    return new Promise<CaptureResult>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, result?: CaptureResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        state.onPhoto = undefined;
        state.cancelPhoto = undefined;
        if (error) reject(error); else resolve(result!);
      };
      state.onPhoto = async (error: Error, photo: camera.Photo): Promise<void> => {
        try {
          if (settled) return;
          if (error || !photo?.main) throw error || new Error('Camera returned no photo.');
          const component = await photo.main.getComponent(image.ComponentType.JPEG);
          const bytes = component.byteBuffer;
          if (!bytes.byteLength || bytes.byteLength > 32 * 1024 * 1024) throw new Error('Camera photo exceeds the 32 MiB processing limit.');
          const source = image.createImageSource(bytes);
          let size: image.Size;
          try { size = (await source.getImageInfo()).size; } finally { await source.release(); }
          if (state.disposed || settled) throw new Error('Camera capture was interrupted.');
          const target = this.ctx.uiAbilityContext.cacheDir + '/camera-' + util.generateRandomUUID() + '.jpg';
          const file = await fs.open(target, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
          try {
            try { if (await fs.write(file.fd, bytes) !== bytes.byteLength) throw new Error('Incomplete camera photo write.'); }
            finally { await fs.close(file); }
          } catch (writeError) { await fs.unlink(target); throw writeError; }
          if (state.disposed || settled) { await fs.unlink(target); throw new Error('Camera capture was interrupted.'); }
          const result: CaptureResult = { uri: 'file://' + target, width: size.width, height: size.height, exif: null };
          if (options.base64) result.base64 = new util.Base64Helper().encodeToStringSync(new Uint8Array(bytes));
          finish(undefined, result);
        } catch (captureError) { finish(captureError as Error); }
      };
      const timer = setTimeout(() => {
        finish(new Error('Camera photo capture timed out. Remount CameraView before retrying.'));
        void this.disposePreview({ viewId: options.viewId }).catch(() => {});
      }, 30000);
      state.cancelPhoto = (): void => finish(new Error('Camera capture was interrupted.'));
      try {
        void output.capture({
          quality: quality >= 0.7 ? camera.QualityLevel.QUALITY_LEVEL_HIGH : quality >= 0.4 ? camera.QualityLevel.QUALITY_LEVEL_MEDIUM : camera.QualityLevel.QUALITY_LEVEL_LOW,
          rotation: output.getPhotoRotation(display.getDefaultDisplaySync().rotation * 90),
        }).catch((error: Error) => finish(error));
      } catch (error) { finish(error as Error); }
    });
  }

  async startRecording(options: { viewId: string; maxDuration?: number }): Promise<RecordingResult> {
    const state = await this.requirePreview(options.viewId);
    if (state.options.mode !== 'video') throw new Error('Recording requires CameraView mode="video".');
    if (state.recording) throw new Error('Camera is already recording.');
    if (options.maxDuration !== undefined && (!Number.isInteger(options.maxDuration) || options.maxDuration < 1 || options.maxDuration > 2147483647)) throw new Error('maxDuration must be a positive integer in seconds.');
    if (!this.getPermissionResponse('ohos.permission.MICROPHONE').granted) throw new Error('Microphone permission is not granted.');
    return new Promise<RecordingResult>((resolve, reject) => {
      const recording: Recording = { ready: Promise.resolve(), path: this.ctx.uiAbilityContext.cacheDir + '/camera-' + util.generateRandomUUID() + '.mp4', resolve, reject };
      state.recording = recording;
      recording.ready = this.beginRecording(state, recording, options.maxDuration);
      void recording.ready.catch(async (error: Error) => {
        await this.finishRecording(state).catch(() => {});
        reject(error);
      });
    });
  }

  async stopRecording(options: { viewId: string }): Promise<void> {
    const state = await this.requirePreview(options.viewId);
    if (!state.recording) throw new Error('Camera is not recording.');
    await this.finishRecording(state);
  }

  async toggleRecording(options: { viewId: string }): Promise<void> {
    const state = await this.requirePreview(options.viewId);
    const recording = state.recording;
    if (!recording) throw new Error('Camera is not recording.');
    await recording.ready;
    if (recording.recorder!.state === 'paused') await recording.recorder!.resume();
    else await recording.recorder!.pause();
  }

  private async beginRecording(state: Preview, recording: Recording, maxDuration?: number): Promise<void> {
    const profile = state.videoProfile;
    if (!profile) throw new Error('Camera has no YUV video profile supported by AVRecorder.');
    recording.file = await fs.open(recording.path, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
    recording.recorder = await media.createAVRecorder();
    recording.recorder.on('stateChange', (value: media.AVRecorderState): void => {
      if (value === 'stopped' && !recording.finish) void this.finishRecording(state).catch(() => {});
    });
    recording.recorder.on('error', (error: Error): void => {
      recording.reject(error);
      void this.finishRecording(state).catch(() => {});
    });
    await recording.recorder.prepare({
      audioSourceType: media.AudioSourceType.AUDIO_SOURCE_TYPE_MIC,
      videoSourceType: media.VideoSourceType.VIDEO_SOURCE_TYPE_SURFACE_YUV,
      url: 'fd://' + recording.file.fd,
      maxDuration,
      profile: {
        audioBitrate: 48000, audioChannels: 1, audioCodec: media.CodecMimeType.AUDIO_AAC, audioSampleRate: 48000,
        fileFormat: media.ContainerFormatType.CFT_MPEG_4, videoBitrate: 2000000, videoCodec: media.CodecMimeType.VIDEO_AVC,
        videoFrameWidth: profile.size.width, videoFrameHeight: profile.size.height,
        videoFrameRate: Math.min(30, profile.frameRateRange.max),
      },
    });
    const manager = camera.getCameraManager(this.ctx.uiAbilityContext);
    recording.output = manager.createVideoOutput(profile, await recording.recorder.getInputSurface());
    if (state.disposed) throw new Error('Camera view was unmounted.');
    await state.session!.stop();
    state.session!.beginConfig();
    state.session!.addOutput(recording.output);
    await state.session!.commitConfig();
    await state.session!.start();
    await recording.output.start();
    await recording.recorder.start();
  }

  private finishRecording(state: Preview): Promise<void> {
    const recording = state.recording;
    if (!recording) return Promise.resolve();
    if (recording.finish) return recording.finish;
    recording.finish = (async (): Promise<void> => {
      let failure: Error | undefined;
      try {
        await recording.ready;
        if (recording.recorder!.state !== 'stopped') await recording.recorder!.stop();
        await recording.output!.stop();
      } catch (error) { failure = error as Error; }
      try {
        if (recording.output) {
          await state.session!.stop();
          state.session!.beginConfig();
          state.session!.removeOutput(recording.output);
          await state.session!.commitConfig();
          if (!state.disposed) await state.session!.start();
        }
      } catch (error) { failure = failure ?? error as Error; }
      for (const release of [
        async (): Promise<void> => { if (recording.output) await recording.output.release(); },
        async (): Promise<void> => { if (recording.recorder) await recording.recorder.release(); },
        async (): Promise<void> => { if (recording.file) await fs.close(recording.file); },
      ]) { try { await release(); } catch (error) { failure = failure ?? error as Error; } }
      state.recording = undefined;
      if (failure) { recording.reject(failure); throw failure; }
      try {
        const fileSize = (await fs.stat(recording.path)).size;
        const file = await fs.open(recording.path, fs.OpenMode.READ_ONLY);
        let extractor: media.AVMetadataExtractor | undefined;
        let duration: number | null = null;
        try {
          extractor = await media.createAVMetadataExtractor();
          extractor.fdSrc = { fd: file.fd, offset: 0, length: fileSize };
          const value = Number((await extractor.fetchMetadata()).duration);
          if (Number.isFinite(value)) duration = value;
        } finally { try { if (extractor) await extractor.release(); } finally { await fs.close(file); } }
        recording.resolve({ uri: 'file://' + recording.path, duration, fileSize, mimeType: 'video/mp4' });
      } catch (error) { recording.reject(error as Error); throw error; }
    })();
    return recording.finish;
  }

  private async requirePreview(viewId: string): Promise<Preview> {
    const state = this.previews.get(viewId);
    if (!state || state.disposed) throw new Error('Camera view is not mounted.');
    await state.ready;
    if (state.disposed) throw new Error('Camera view is not mounted.');
    return state;
  }

  private async releaseResources(state: Preview): Promise<void> {
    state.cancelPhoto?.();
    await this.finishRecording(state).catch(() => {});
    let failure: Error | undefined;
    const session = state.session, input = state.input, output = state.output, photo = state.photo;
    state.session = undefined; state.input = undefined; state.output = undefined; state.photo = undefined;
    for (const release of [
      async (): Promise<void> => { if (session) await session.stop(); },
      async (): Promise<void> => { if (input) await input.close(); },
      async (): Promise<void> => { if (output) await output.release(); },
      async (): Promise<void> => { if (photo) await photo.release(); },
      async (): Promise<void> => { if (session) await session.release(); },
    ]) { try { await release(); } catch (error) { failure = failure ?? error as Error; } }
    if (failure) throw failure;
  }

  private getPermissionResponse(permissionName: Permissions): PermissionResponse {
    const manager = this.atManager as abilityAccessCtrl.AtManager & { getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus };
    const status = typeof manager.getSelfPermissionStatus === 'function'
      ? manager.getSelfPermissionStatus(permissionName)
      : manager.checkAccessTokenSync(this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId, permissionName) === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
        ? abilityAccessCtrl.PermissionStatus.GRANTED : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;
    const granted = status === abilityAccessCtrl.PermissionStatus.GRANTED;
    const denied = status === abilityAccessCtrl.PermissionStatus.DENIED || status === abilityAccessCtrl.PermissionStatus.RESTRICTED || status === abilityAccessCtrl.PermissionStatus.INVALID;
    return { status: granted ? 'granted' : denied ? 'denied' : 'undetermined', granted, canAskAgain: !denied, expires: 'never' };
  }
  private async requestPermissionResponse(permissionName: Permissions): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [permissionName]);
    return this.getPermissionResponse(permissionName);
  }
}
`;
}


export function renderExpoCameraHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const React = require('react');
const { TurboModuleRegistry, requireNativeComponent, DeviceEventEmitter } = require('react-native');
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

  const callbacks = React.useRef(props);
  callbacks.current = props;
  React.useLayoutEffect(() => {
    const subscription = DeviceEventEmitter.addListener('ExpoHarmonyCameraState', (event) => {
      if (event.viewId !== viewId) return;
      if (event.ready) callbacks.current.onCameraReady?.();
      else callbacks.current.onMountError?.({ message: event.message });
    });
    return () => subscription.remove();
  }, [viewId]);

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
