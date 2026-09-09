import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyCameraTurboModule } from '../src/core/template/renderers/camera';

it('passes initialized picker profiles without mutating native read-only instances', async () => {
  const pick = jest.fn().mockResolvedValue({ resultUri: 'file:///cache/capture.jpg' });
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': { createAtManager: () => ({}) },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.multimedia.camera': {
      CameraPosition: { CAMERA_POSITION_FRONT: 1, CAMERA_POSITION_BACK: 2 },
    },
    '@ohos.multimedia.cameraPicker': {
      PickerProfile: class { constructor() { Object.freeze(this); } },
      PickerMediaType: { PHOTO: 'photo', VIDEO: 'video' },
      pick,
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyCameraTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {} });
  const camera = new exports.ExpoHarmonyCameraTurboModule();
  camera.ctx = { uiAbilityContext: {} };
  camera.getImageSize = jest.fn().mockResolvedValue({ width: 48, height: 32 });
  camera.requestPermissionResponse = jest.fn().mockResolvedValue({ granted: true });
  await expect(camera.takePicture({ cameraType: 'front' })).resolves.toMatchObject({ width: 48, height: 32 });
  expect(pick).toHaveBeenLastCalledWith(camera.ctx.uiAbilityContext, ['photo'], { cameraPosition: 1 });
  await camera.startRecording({ cameraType: 'back' });
  expect(pick).toHaveBeenLastCalledWith(camera.ctx.uiAbilityContext, ['video'], { cameraPosition: 2 });
  // A local state map cannot stand in for a native preview/recording session.
  for (const method of ['createPreview', 'pausePreview', 'resumePreview', 'stopRecording', 'toggleRecording']) {
    await expect(camera[method]({ viewId: 'test' })).rejects.toThrow('ERR_EXPO_HARMONY_UNSUPPORTED');
  }
});
