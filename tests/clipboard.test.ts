import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyClipboardTurboModule } from '../src/core/template/renderers/clipboard';

it('awaits native pasteboard writes, enforces read consent, emits changes and releases image resources', async () => {
  let data: any;
  const record = (kind: string, value: unknown) => ({ kind, value });
  const pasteData = (kind: string, value: unknown) => {
    const records: any[] = [record(kind, value)];
    return {
      records, addRecord: (entry: unknown) => { records.push(entry); },
      hasMimeType: (type: string) => records.some((entry) => entry.kind === type),
      getPrimaryText: () => records.find((entry) => entry.kind === 'text')?.value,
      getPrimaryHtml: () => records.find((entry) => entry.kind === 'html')?.value,
      getPrimaryUri: () => records.find((entry) => entry.kind === 'url')?.value,
      getPrimaryPixelMap: () => records.find((entry) => entry.kind === 'image')?.value,
    };
  };
  const board = {
    setData: jest.fn(async (value) => { data = value; }),
    getData: jest.fn(async () => data), hasData: async () => !!data,
    hasDataType: (type: string) => data?.hasMimeType(type) ?? false,
    on: jest.fn(), off: jest.fn(),
  };
  const permissions = {
    checkAccessTokenSync: jest.fn().mockReturnValue(0),
    requestPermissionsFromUser: jest.fn().mockResolvedValue({ authResults: [-1] }),
  };
  const order: string[] = [];
  const pixels = { getImageInfo: async () => ({ size: { width: 2, height: 3 } }), release: async () => { order.push('pixels released'); } };
  const packer = { packing: jest.fn(async () => { order.push('packed'); return new Uint8Array([1]).buffer; }), release: async () => { order.push('packer released'); } };
  const source = { getImageInfo: pixels.getImageInfo, createPixelMap: async () => pixels, release: async () => { order.push('source released'); } };
  const modules: Record<string, unknown> = {
    '@ohos.pasteboard': {
      getSystemPasteboard: () => board, createPlainTextData: (value: string) => pasteData('text', value),
      createHtmlData: (value: string) => pasteData('html', value), createUriData: (value: string) => pasteData('url', value),
      createPlainTextRecord: (value: string) => record('text', value), createData: pasteData,
      MIMETYPE_TEXT_PLAIN: 'text', MIMETYPE_TEXT_HTML: 'html', MIMETYPE_TEXT_URI: 'url', MIMETYPE_PIXELMAP: 'image',
    },
    '@ohos.abilityAccessCtrl': { createAtManager: () => permissions, GrantStatus: { PERMISSION_GRANTED: 0 } },
    '@ohos.multimedia.image': { createImageSource: () => source, createImagePacker: () => packer },
    '@ohos.util': { Base64Helper: class { decodeSync(value: string) { return new Uint8Array(Buffer.from(value, 'base64')); } encodeToStringSync(value: Uint8Array) { return Buffer.from(value).toString('base64'); } } },
    '@ohos.url': { URL: { parseURL: (value: string) => new URL(value) } },
    '@rnoh/react-native-openharmony/ts': { UITurboModule: class { constructor(public ctx: unknown) {} __onDestroy__() {} } },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyClipboardTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, Uint8Array, require: (name: string) => modules[name] });
  const emitDeviceEvent = jest.fn();
  const clipboard = new exports.ExpoHarmonyClipboardTurboModule({ rnInstance: { emitDeviceEvent }, uiAbilityContext: { abilityInfo: { applicationInfo: { accessTokenId: 1 } } } });
  expect(await clipboard.getString('plainText')).toBe('');
  await clipboard.setString('native text', 'plainText');
  expect(await clipboard.getString('plainText')).toBe('native text');
  board.on.mock.calls[0][1]();
  expect(emitDeviceEvent).toHaveBeenCalledWith('ExpoHarmonyClipboardChanged', { contentTypes: ['plain-text'] });
  board.setData.mockRejectedValueOnce(new Error('write failed'));
  await expect(clipboard.setString('lost', 'plainText')).rejects.toThrow('write failed');
  expect(await clipboard.getString('plainText')).toBe('native text');
  permissions.checkAccessTokenSync.mockReturnValueOnce(-1);
  const reads = board.getData.mock.calls.length;
  await expect(clipboard.getString('plainText')).rejects.toThrow('denied');
  expect(board.getData).toHaveBeenCalledTimes(reads);
  await clipboard.setUrl('https://example.test');
  expect(await clipboard.getString('plainText')).toBe('https://example.test');
  expect(await clipboard.getUrl()).toBe('https://example.test');
  await clipboard.setImage('AQ==');
  expect(order).toEqual(['pixels released', 'source released']);
  order.length = 0;
  expect(await clipboard.getImage('png', 1)).toEqual({ data: 'data:image/png;base64,AQ==', size: { width: 2, height: 3 } });
  expect(order).toEqual(['packed', 'packer released', 'pixels released']);
  await expect(clipboard.setImage('invalid!')).rejects.toThrow('base64');
  clipboard.__onDestroy__();
  expect(board.off).toHaveBeenCalledWith('update', board.on.mock.calls[0][1]);
});
