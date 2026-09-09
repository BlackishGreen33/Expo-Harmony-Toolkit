import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyImagePickerTurboModule } from '../src/core/template/renderers/imagePicker';
import { CAPABILITY_DEFINITIONS } from '../src/data/capabilities';

it('uses the selected-file grant and treats picker cancellation as final', async () => {
  const select = jest.fn().mockResolvedValueOnce({ photoUris: [] }).mockResolvedValueOnce({ photoUris: ['file://media/Photo/1'] });
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': {
      createAtManager: () => ({ getSelfPermissionStatus: () => 0 }),
      PermissionStatus: { GRANTED: 0, DENIED: 1, RESTRICTED: 2, INVALID: 3 },
    },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.file.photoAccessHelper': {
      PhotoViewPicker: class { select = select; },
      PhotoSelectOptions: class {},
      PhotoViewMIMETypes: { IMAGE_TYPE: 'image' },
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyImagePickerTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {} });
  const picker = new exports.ExpoHarmonyImagePickerTurboModule();
  picker.ensurePermissionGranted = jest.fn();
  picker.launchLegacyPhotoPicker = jest.fn().mockResolvedValue([]);
  picker.requestAuthorizedUris = jest.fn(async (uris) => uris);
  picker.createImagePickerAsset = jest.fn(async (uri) => ({ uri }));
  expect(await picker.getMediaLibraryPermissionStatus()).toMatchObject({ granted: true, accessPrivileges: 'limited' });
  expect(await picker.requestMediaLibraryPermission()).toMatchObject({ granted: true, accessPrivileges: 'limited' });
  expect(CAPABILITY_DEFINITIONS.find(item => item.packageName === 'expo-image-picker')?.harmonyPermissions).not.toContain('ohos.permission.READ_IMAGEVIDEO');
  expect(await picker.launchImageLibrary({ mediaTypes: ['images'] })).toEqual({ canceled: true, assets: null });
  expect(picker.ensurePermissionGranted).not.toHaveBeenCalled();
  expect(picker.launchLegacyPhotoPicker).not.toHaveBeenCalled();
  expect(picker.requestAuthorizedUris).not.toHaveBeenCalled();
  expect(await picker.launchImageLibrary({ mediaTypes: ['images'] })).toEqual({ canceled: false, assets: [{ uri: 'file://media/Photo/1' }] });
  expect(picker.requestAuthorizedUris).not.toHaveBeenCalled();
  expect(select).toHaveBeenCalledTimes(2);
  select.mockResolvedValueOnce({ photoUris: ['file://media/Photo/2'] });
  await picker.launchCamera({ mediaTypes: ['images'] });
  expect(picker.ensurePermissionGranted).toHaveBeenCalledTimes(1);
  expect(picker.ensurePermissionGranted).toHaveBeenCalledWith('ohos.permission.CAMERA', false);
  expect(picker.requestAuthorizedUris).not.toHaveBeenCalled();
});

it('copies a picker URI into the sandbox and closes its descriptor even if copying fails', async () => {
  const file = { fd: 7 };
  const copyFile = jest.fn().mockResolvedValue(undefined);
  const closeSync = jest.fn();
  const createImageSource = jest.fn(() => ({
    getImageInfo: async () => ({ size: { width: 48, height: 32 } }),
    release: async () => undefined,
  }));
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': { createAtManager: () => ({}) },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.util': { generateRandomUUID: () => 'selected-media' },
    '@ohos.file.fs': { openSync: jest.fn(() => file), OpenMode: { READ_ONLY: 0 }, copyFile, closeSync, stat: async () => ({ size: 123 }) },
    '@ohos.multimedia.image': { createImageSource },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyImagePickerTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {} });
  const picker = new exports.ExpoHarmonyImagePickerTurboModule();
  picker.ctx = { uiAbilityContext: { cacheDir: '/cache' } };
  const uri = 'file://media/Photo/1/photo.png';
  expect(await picker.createImagePickerAsset(uri, uri, 'image')).toMatchObject({
    uri: 'file:///cache/image-picker-selected-media.png', assetId: uri, fileName: 'photo.png', width: 48, height: 32, fileSize: 123,
  });
  expect(copyFile).toHaveBeenCalledWith(7, '/cache/image-picker-selected-media.png');
  expect(createImageSource).toHaveBeenCalledWith('/cache/image-picker-selected-media.png');
  expect(closeSync).toHaveBeenCalledWith(file);
  copyFile.mockRejectedValueOnce(new Error('disk full'));
  await expect(picker.createImagePickerAsset(uri, uri, 'image')).rejects.toThrow('disk full');
  expect(closeSync).toHaveBeenCalledTimes(2);
  await picker.createImagePickerAsset('file:///cache/captured.png', uri, 'image');
  expect(copyFile).toHaveBeenCalledTimes(2);
});
