import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyImagePickerTurboModule } from '../src/core/template/renderers/imagePicker';
import { CAPABILITY_DEFINITIONS } from '../src/data/capabilities';

it('uses the selected-file grant and treats picker cancellation as final', async () => {
  const select = jest.fn().mockResolvedValueOnce({ photoUris: [] }).mockResolvedValueOnce({ photoUris: ['file://media/Photo/1'] });
  const pick = jest.fn().mockResolvedValue({ resultUri: 'file:///cache/camera.jpg', mediaType: 'photo' });
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': {
      createAtManager: () => ({ getSelfPermissionStatus: () => 0 }),
      PermissionStatus: { GRANTED: 0, DENIED: 1, RESTRICTED: 2, INVALID: 3 },
    },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.multimedia.camera': { CameraPosition: { CAMERA_POSITION_FRONT: 1, CAMERA_POSITION_BACK: 2 } },
    '@ohos.multimedia.cameraPicker': { pick, PickerMediaType: { PHOTO: 'photo', VIDEO: 'video' } },
    '@ohos.file.photoAccessHelper': {
      PhotoViewPicker: class { select = select; },
      PhotoSelectOptions: class {},
      PhotoViewMIMETypes: { IMAGE_TYPE: 'image', IMAGE_VIDEO_TYPE: 'mixed' },
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyImagePickerTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {} });
  const picker = new exports.ExpoHarmonyImagePickerTurboModule();
  picker.ctx = {};
  picker.ensurePermissionGranted = jest.fn();
  picker.launchLegacyPhotoPicker = jest.fn().mockResolvedValue([]);
  picker.requestAuthorizedUris = jest.fn(async (uris) => uris);
  picker.createImagePickerAsset = jest.fn(async (uri) => ({ uri }));
  picker.preparePickedAsset = jest.fn(async (asset) => asset);
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
  select.mockResolvedValueOnce({ photoUris: [] });
  await picker.launchImageLibrary({ mediaTypes: ['images'], allowsEditing: true });
  expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ isEditSupported: true, isPreviewForSingleSelectionSupported: true }));
  select.mockResolvedValueOnce({ photoUris: ['file://media/Photo/3'] });
  picker.preparePickedAsset.mockResolvedValueOnce(null);
  expect(await picker.launchImageLibrary({ allowsEditing: true, aspect: [4, 3], quality: 0.7 })).toEqual({ canceled: true, assets: null });
  expect(picker.preparePickedAsset).toHaveBeenLastCalledWith({ uri: 'file://media/Photo/3' }, { allowsEditing: true, aspect: [4, 3], quality: 0.7 });
  expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ isEditSupported: false }));
  await expect(picker.launchImageLibrary({ allowsEditing: true, allowsMultipleSelection: true })).rejects.toThrow('mutually exclusive');
  select.mockResolvedValueOnce({ photoUris: ['file://media/Photo/2'] });
  await picker.launchCamera({ mediaTypes: ['images'] });
  expect(pick).toHaveBeenCalledWith(undefined, ['photo'], { cameraPosition: 2 });
  expect(picker.ensurePermissionGranted).toHaveBeenCalledTimes(1);
  expect(picker.ensurePermissionGranted).toHaveBeenCalledWith('ohos.permission.CAMERA', false);
  expect(picker.requestAuthorizedUris).not.toHaveBeenCalled();
  pick.mockResolvedValueOnce({ resultUri: '' });
  expect(await picker.launchCamera({ mediaTypes: ['images'] })).toEqual({ canceled: true, assets: null });
  expect(await picker.getPendingResult()).toBeNull();
  await picker.launchCamera({ mediaTypes: 'All', allowsEditing: true });
  expect(pick).toHaveBeenLastCalledWith(undefined, ['photo', 'video'], { cameraPosition: 2 });
  expect(picker.ensurePermissionGranted).toHaveBeenLastCalledWith('ohos.permission.MICROPHONE', false);
  expect(picker.preparePickedAsset).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ aspect: [1, 1] }));
  select.mockResolvedValueOnce({ photoUris: [] });
  await picker.launchImageLibrary({ mediaTypes: 'All' });
  expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ MIMEType: 'mixed' }));
});

it('crops pixels, applies quality, handles cancellation and cleans partial writes', async () => {
  const crop = jest.fn();
  const release = jest.fn();
  const pixels = { crop, release, getImageInfo: async () => ({ size: { width: 40, height: 30 } }) };
  const selectCrop = jest.fn(async () => ({ x: 2, y: 1, size: { width: 40, height: 30 } }));
  const packing = jest.fn(async () => new Uint8Array([1, 2]).buffer);
  const write = jest.fn(async () => 2);
  const unlink = jest.fn();
  const close = jest.fn();
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': { createAtManager: () => ({}) },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.util': { generateRandomUUID: () => 'edited' },
    '@ohos.file.fs': { open: async () => ({ fd: 1 }), write, close, unlink, OpenMode: {} },
    '@ohos.multimedia.image': {
      createImageSource: () => ({ getImageInfo: async () => ({ size: { width: 48, height: 32 } }), createPixelMap: async () => pixels, release }),
      createImagePacker: () => ({ packing, release }),
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyImagePickerTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => modules[name] ?? {} });
  const picker = new exports.ExpoHarmonyImagePickerTurboModule();
  picker.ctx = { getUIContext: () => ({}), uiAbilityContext: { cacheDir: '/cache' } };
  picker.selectCrop = selectCrop;
  const asset = { uri: 'file:///cache/original.jpg', type: 'image', mimeType: 'image/jpeg' };
  const options = { allowsEditing: true, aspect: [4, 3], quality: 0.7 };
  expect(await picker.preparePickedAsset(asset, options)).toMatchObject({ uri: 'file:///cache/image-picker-edited.jpg', width: 40, height: 30, fileSize: 2 });
  expect(crop).toHaveBeenCalledWith({ x: 2, y: 1, size: { width: 40, height: 30 } });
  expect(packing).toHaveBeenCalledWith(pixels, { format: 'image/jpeg', quality: 70 });
  selectCrop.mockResolvedValueOnce(null as any);
  expect(await picker.preparePickedAsset(asset, options)).toBeNull();
  expect(write).toHaveBeenCalledTimes(1);
  write.mockResolvedValueOnce(1);
  await expect(picker.preparePickedAsset(asset, options)).rejects.toThrow('Incomplete');
  expect(unlink).toHaveBeenCalledWith('/cache/image-picker-edited.jpg');
  expect(close).toHaveBeenCalledTimes(2);
  expect(release).toHaveBeenCalledTimes(8);
});

it('copies a picker URI into the sandbox and closes its descriptor even if copying fails', async () => {
  const file = { fd: 7 };
  const copyFile = jest.fn().mockResolvedValue(undefined);
  const closeSync = jest.fn();
  const close = jest.fn();
  const releaseVideo = jest.fn();
  const fetchMetadata = jest.fn(async () => ({ videoWidth: '1280', videoHeight: '720', duration: '1500' }));
  const createImageSource = jest.fn(() => ({
    getImageInfo: async () => ({ size: { width: 48, height: 32 } }),
    release: async () => undefined,
  }));
  const modules: Record<string, unknown> = {
    '@ohos.abilityAccessCtrl': { createAtManager: () => ({}) },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class {} },
    '@ohos.util': { generateRandomUUID: () => 'selected-media' },
    '@ohos.file.fs': { openSync: jest.fn(() => file), open: async () => file, OpenMode: { READ_ONLY: 0 }, copyFile, closeSync, close, stat: async () => ({ size: 123 }) },
    '@ohos.multimedia.image': { createImageSource },
    '@ohos.multimedia.media': { createAVMetadataExtractor: async () => ({ fetchMetadata, release: releaseVideo }) },
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
  expect(await picker.createImagePickerAsset('file:///cache/captured.mp4', uri, 'video')).toMatchObject({ width: 1280, height: 720, duration: 1500 });
  expect(releaseVideo).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  fetchMetadata.mockRejectedValueOnce(new Error('invalid video'));
  await expect(picker.createImagePickerAsset('file:///cache/invalid.mp4', uri, 'video')).rejects.toThrow('invalid video');
  expect(releaseVideo).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(2);
});
