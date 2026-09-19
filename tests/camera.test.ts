import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyCameraTurboModule } from '../src/core/template/renderers/camera';

function harness(permissionValues: Record<string, number> = {}) {
  const input = { open: jest.fn(), close: jest.fn() };
  const preview = { on: jest.fn(), stop: jest.fn(), start: jest.fn(), release: jest.fn() };
  const session = { beginConfig: jest.fn(), addInput: jest.fn(), addOutput: jest.fn(), removeOutput: jest.fn(), commitConfig: jest.fn(), start: jest.fn(), stop: jest.fn(), release: jest.fn() };
  let photoCallback: any;
  const photo = { on: jest.fn((_event, cb) => { photoCallback = cb; }), off: jest.fn(), capture: jest.fn(async () => undefined), getPhotoRotation: () => 0, release: jest.fn() };
  const profile = { format: 1003, size: { width: 48, height: 32 }, frameRateRange: { min: 15, max: 30 } };
  const rgbaProfile = { format: 3, size: { width: 1280, height: 720 } };
  const manager = { getSupportedCameras: () => [{ cameraPosition: 2 }], getSupportedOutputCapability: () => ({ previewProfiles: [profile, rgbaProfile], photoProfiles: [profile], videoProfiles: [profile] }), createCameraInput: () => input, createPreviewOutput: jest.fn(() => preview), createPhotoOutput: () => photo, createSession: () => session };
  const close = jest.fn();
  const unlink = jest.fn(async () => undefined);
  const stat = jest.fn(async () => ({ size: 123 }));
  const write = jest.fn(async (_fd, bytes) => bytes.byteLength);
  const imageRelease = jest.fn();
  const recorder = {
    state: 'idle', on: jest.fn(), prepare: jest.fn(async () => undefined), getInputSurface: async () => 'record-surface', release: jest.fn(),
    start: jest.fn(async () => { recorder.state = 'started'; }), stop: jest.fn(async () => { recorder.state = 'stopped'; }),
    pause: jest.fn(async () => { recorder.state = 'paused'; }), resume: jest.fn(async () => { recorder.state = 'started'; }),
  };
  const video = { start: jest.fn(), stop: jest.fn(), release: jest.fn() };
  Object.assign(manager, { createVideoOutput: jest.fn(() => video) });
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': {
      createAtManager: () => ({
        getSelfPermissionStatus: (name: string) => permissionValues[name] ?? 0,
        requestPermissionsFromUser: async (_context: unknown, names: string[]) => {
          for (const name of names) permissionValues[name] = 0;
        },
      }),
      PermissionStatus: { GRANTED: 0, DENIED: -1, NOT_DETERMINED: 1, INVALID: 2, RESTRICTED: 3 },
    },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class { ctx: any; constructor(ctx: any) { this.ctx = ctx; } } },
    '@ohos.multimedia.camera': { getCameraManager: () => manager, CameraPosition: { CAMERA_POSITION_BACK: 2, CAMERA_POSITION_FRONT: 1 }, SceneMode: { NORMAL_PHOTO: 1, NORMAL_VIDEO: 2 }, CameraFormat: { CAMERA_FORMAT_YUV_420_SP: 1003, CAMERA_FORMAT_RGBA_8888: 3, CAMERA_FORMAT_JPEG: 2000 }, QualityLevel: { QUALITY_LEVEL_HIGH: 0, QUALITY_LEVEL_MEDIUM: 1, QUALITY_LEVEL_LOW: 2 } },
    '@ohos.multimedia.image': { ComponentType: { JPEG: 1 }, createImageSource: () => ({ getImageInfo: async () => ({ size: { width: 48, height: 32 } }), release: imageRelease }) },
    '@ohos.display': { getDefaultDisplaySync: () => ({ rotation: 0 }) },
    '@ohos.util': { generateRandomUUID: () => 'capture' },
    '@ohos.file.fs': { OpenMode: {}, open: async () => ({ fd: 7 }), close, write, unlink, stat },
    '@ohos.multimedia.media': {
      createAVRecorder: async () => recorder, AudioSourceType: {}, VideoSourceType: {}, CodecMimeType: {}, ContainerFormatType: {},
      createAVMetadataExtractor: async () => ({ fetchMetadata: async () => ({ duration: '2000' }), release: jest.fn() }),
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyCameraTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {}, setTimeout, clearTimeout });
  const emit = jest.fn();
  const camera = new exports.ExpoHarmonyCameraTurboModule({ uiAbilityContext: { cacheDir: '/cache' }, rnInstance: { emitDeviceEvent: emit } });
  return { camera, manager, input, preview, session, photo, close, write, unlink, stat, imageRelease, recorder, video, emit, deliverPhoto: () => photoCallback(undefined, { main: { getComponent: async () => ({ byteBuffer: new Uint8Array([1, 2]).buffer }), release: imageRelease } }) };
}

it('connects native input/output, pauses/resumes and releases a camera session', async () => {
  const h = harness();
  const options = { viewId: 'test', surfaceId: 'surface-1', facing: 'back' };
  await h.camera.createPreview(options);
  expect(h.manager.createPreviewOutput).toHaveBeenCalledWith({ format: 3, size: { width: 1280, height: 720 } }, 'surface-1');
  expect(h.emit).not.toHaveBeenCalled();
  h.preview.on.mock.calls.find(([event]) => event === 'frameStart')![1](undefined);
  expect(h.emit).toHaveBeenCalledWith('ExpoHarmonyCameraState', { viewId: 'test', ready: true });
  expect(h.session.addInput).toHaveBeenCalledWith(h.input);
  expect(h.session.addOutput).toHaveBeenCalledWith(h.preview);
  expect(h.session.addOutput).toHaveBeenCalledWith(h.photo);
  expect(h.input.open).toHaveBeenCalledTimes(1);
  expect(h.session.start).toHaveBeenCalledTimes(1);
  await h.camera.pausePreview(options);
  expect(h.preview.stop).toHaveBeenCalledTimes(1);
  await h.camera.resumePreview(options);
  expect(h.preview.start).toHaveBeenCalledTimes(1);
  await h.camera.disposePreview(options);
  expect(h.input.close).toHaveBeenCalledTimes(1);
  expect(h.preview.release).toHaveBeenCalledTimes(1);
  expect(h.photo.release).toHaveBeenCalledTimes(1);
  expect(h.session.release).toHaveBeenCalledTimes(1);
  await expect(h.camera.takePicture(options)).rejects.toThrow('not mounted');
});

it('writes the native photo callback and cleans resources on configuration failure', async () => {
  const h = harness();
  await h.camera.createPreview({ viewId: 'test', surfaceId: 'surface-1' });
  expect(h.photo.on).toHaveBeenCalledTimes(1);
  expect(h.photo.on.mock.invocationCallOrder[0]).toBeLessThan(h.session.commitConfig.mock.invocationCallOrder[0]);
  const pending = h.camera.takePicture({ viewId: 'test', quality: 0.8 });
  await new Promise(resolve => setTimeout(resolve, 0));
  await h.deliverPhoto();
  expect(await pending).toMatchObject({ uri: 'file:///cache/camera-capture.jpg', width: 48, height: 32 });
  expect(h.write).toHaveBeenCalledTimes(1);
  expect(h.close).toHaveBeenCalledTimes(1);
  expect(h.imageRelease).toHaveBeenCalledTimes(2);
  expect(h.photo.off).not.toHaveBeenCalled();
  await h.deliverPhoto();
  expect(h.write).toHaveBeenCalledTimes(1);
  expect(h.imageRelease).toHaveBeenCalledTimes(3);
  await h.camera.disposePreview({ viewId: 'test' });
  h.session.commitConfig.mockRejectedValueOnce(new Error('native config failed'));
  await expect(h.camera.createPreview({ viewId: 'bad', surfaceId: 'surface-2' })).rejects.toThrow('native config failed');
  expect(h.input.close).toHaveBeenCalledTimes(2);
  expect(h.preview.release).toHaveBeenCalledTimes(2);
});

it('controls the native recorder and resolves only after stopping and reading the saved video', async () => {
  const h = harness();
  const options = { viewId: 'video', surfaceId: 'surface-1', mode: 'video' };
  await h.camera.createPreview(options);
  const pending = h.camera.startRecording({ viewId: 'video', maxDuration: 3 });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(h.video.start).toHaveBeenCalledTimes(1);
  expect(h.recorder.prepare).toHaveBeenCalledWith(expect.objectContaining({ maxDuration: 3, url: 'fd://7' }));
  await h.camera.toggleRecording(options);
  expect(h.recorder.state).toBe('paused');
  await h.camera.toggleRecording(options);
  expect(h.recorder.state).toBe('started');
  await h.camera.stopRecording(options);
  expect(await pending).toEqual({ uri: 'file:///cache/camera-capture.mp4', duration: 2000, fileSize: 123, mimeType: 'video/mp4' });
  expect(h.session.removeOutput).toHaveBeenCalledWith(h.video);
  expect(h.recorder.release).toHaveBeenCalledTimes(1);
  expect(h.video.release).toHaveBeenCalledTimes(1);
  h.recorder.prepare.mockRejectedValueOnce(new Error('encoder failed'));
  await expect(h.camera.startRecording({ viewId: 'video' })).rejects.toThrow('encoder failed');
  await h.camera.disposePreview(options);
});

it('bounds a stalled native camera initialization and rejects capture instead of hanging', async () => {
  jest.useFakeTimers();
  try {
    const h = harness();
    h.input.open.mockImplementation(() => new Promise(() => {}));
    const pending = h.camera.createPreview({ viewId: 'stalled', surfaceId: 'surface-1' });
    const rejected = expect(pending).rejects.toThrow('initialization timed out');
    await jest.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(h.input.close).toHaveBeenCalledTimes(1);
    await expect(h.camera.takePicture({ viewId: 'stalled' })).rejects.toThrow('not mounted');
  } finally { jest.useRealTimers(); }
});

it('removes a failed recording before rejecting and allows a clean retry', async () => {
  const h = harness();
  const options = { viewId: 'video', surfaceId: 'surface-1', mode: 'video' };
  await h.camera.createPreview(options);
  h.recorder.prepare.mockRejectedValueOnce(new Error('encoder failed'));
  await expect(h.camera.startRecording(options)).rejects.toThrow('encoder failed');
  expect(h.close).toHaveBeenCalledTimes(1);
  expect(h.unlink).toHaveBeenCalledWith('/cache/camera-capture.mp4');
  expect(h.recorder.release).toHaveBeenCalledTimes(1);

  const pending = h.camera.startRecording(options);
  await new Promise(resolve => setTimeout(resolve, 0));
  await h.camera.stopRecording(options);
  expect(await pending).toMatchObject({ fileSize: 123, mimeType: 'video/mp4' });
  expect(h.unlink).toHaveBeenCalledTimes(1);
  await h.camera.disposePreview(options);
});

it('rejects and removes an empty recording instead of returning a successful URI', async () => {
  const h = harness();
  const options = { viewId: 'video', surfaceId: 'surface-1', mode: 'video' };
  await h.camera.createPreview(options);
  h.stat.mockResolvedValueOnce({ size: 0 });
  const pending = h.camera.startRecording(options);
  const rejected = expect(pending).rejects.toThrow('empty');
  await new Promise(resolve => setTimeout(resolve, 0));
  await Promise.all([
    expect(h.camera.stopRecording(options)).rejects.toThrow('empty'),
    rejected,
  ]);
  expect(h.unlink).toHaveBeenCalledWith('/cache/camera-capture.mp4');
  await h.camera.disposePreview(options);
});

it('cleans up an asynchronous recorder error and preserves its cause', async () => {
  const h = harness();
  const options = { viewId: 'video', surfaceId: 'surface-1', mode: 'video' };
  await h.camera.createPreview(options);
  const pending = h.camera.startRecording(options);
  const rejected = expect(pending).rejects.toThrow('native recording failed');
  await new Promise(resolve => setTimeout(resolve, 0));
  h.recorder.on.mock.calls.find(([event]) => event === 'error')![1](new Error('native recording failed'));
  await rejected;
  expect(h.recorder.release).toHaveBeenCalledTimes(1);
  expect(h.unlink).toHaveBeenCalledWith('/cache/camera-capture.mp4');
  await h.camera.disposePreview(options);
});

it.each([
  [-1, 'denied', false, false],
  [0, 'granted', true, true],
  [1, 'undetermined', false, true],
  [2, 'denied', false, false],
  [3, 'denied', false, false],
])('maps native permission status %s without implying a denied permission is retryable', async (native, status, granted, canAskAgain) => {
  const h = harness({ 'ohos.permission.CAMERA': native as number, 'ohos.permission.MICROPHONE': native as number });
  const expected = { status, granted, canAskAgain, expires: 'never' };
  expect(await h.camera.getCameraPermissionStatus()).toEqual(expected);
  expect(await h.camera.getMicrophonePermissionStatus()).toEqual(expected);
});

it('can recreate a denied preview after a permission grant without retaining native resources', async () => {
  const h = harness({ 'ohos.permission.CAMERA': 1 });
  const options = { viewId: 'denied', surfaceId: 'surface-1' };
  await expect(h.camera.createPreview(options)).rejects.toThrow('permission');
  expect(h.input.open).not.toHaveBeenCalled();
  expect(h.emit).toHaveBeenCalledWith('ExpoHarmonyCameraState', expect.objectContaining({ ready: false }));
  expect(await h.camera.requestCameraPermission()).toMatchObject({ granted: true });
  const pending = h.camera.takePicture(options);
  await new Promise(resolve => setTimeout(resolve, 0));
  await h.deliverPhoto();
  expect(await pending).toMatchObject({ width: 48, height: 32 });
  await h.camera.disposePreview(options);
  expect(h.input.close).toHaveBeenCalledTimes(1);
});

it('cancels an in-flight photo on unmount and releases a late native callback', async () => {
  const h = harness();
  const options = { viewId: 'photo', surfaceId: 'surface-1' };
  await h.camera.createPreview(options);
  const pending = h.camera.takePicture(options);
  const rejected = expect(pending).rejects.toThrow('interrupted');
  await new Promise(resolve => setTimeout(resolve, 0));
  await h.camera.disposePreview(options);
  await rejected;
  await h.deliverPhoto();
  expect(h.write).not.toHaveBeenCalled();
  expect(h.imageRelease).toHaveBeenCalledTimes(1);
  expect(h.input.close).toHaveBeenCalledTimes(1);
});

it('releases a timed-out photo session and permits an explicit remount', async () => {
  jest.useFakeTimers();
  try {
    const h = harness();
    const options = { viewId: 'photo', surfaceId: 'surface-1' };
    await h.camera.createPreview(options);
    const pending = h.camera.takePicture(options);
    const rejected = expect(pending).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(30000);
    await rejected;
    expect(h.input.close).toHaveBeenCalledTimes(1);
    await expect(h.camera.takePicture(options)).rejects.toThrow('not mounted');
    await h.camera.createPreview(options);
    const retry = h.camera.takePicture(options);
    await jest.advanceTimersByTimeAsync(0);
    await h.deliverPhoto();
    expect(await retry).toMatchObject({ width: 48, height: 32 });
    await h.camera.disposePreview(options);
    expect(h.input.close).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

it('stops recording during unmount before releasing the preview session', async () => {
  const h = harness();
  const options = { viewId: 'video', surfaceId: 'surface-1', mode: 'video' };
  await h.camera.createPreview(options);
  const pending = h.camera.startRecording(options);
  await new Promise(resolve => setTimeout(resolve, 0));
  h.session.start.mockClear();
  await h.camera.disposePreview(options);
  expect(await pending).toMatchObject({ fileSize: 123 });
  expect(h.session.start).not.toHaveBeenCalled();
  expect(h.recorder.release).toHaveBeenCalledTimes(1);
  expect(h.input.close).toHaveBeenCalledTimes(1);
  expect(h.unlink).not.toHaveBeenCalled();
});
