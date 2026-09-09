import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderExpoHarmonyFileSystemTurboModule } from '../src/core/template/renderers/fileSystem';

it('downloads through native HTTP and does not replace the destination on failure', async () => {
  const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
  const response = { responseCode: 200, result: bytes, header: { 'content-type': 'application/pdf' } };
  const request = jest.fn().mockResolvedValue(response);
  const destroy = jest.fn();
  const file = { fd: 7 };
  const fileSystem = {
    OpenMode: { WRITE_ONLY: 1, CREATE: 2, TRUNC: 4 },
    open: jest.fn().mockResolvedValue(file),
    write: jest.fn().mockResolvedValue(4),
    close: jest.fn(), rename: jest.fn(), unlink: jest.fn(),
    mkdir: jest.fn(), accessSync: jest.fn(), stat: jest.fn(),
  };
  const modules: Record<string, unknown> = {
    '@rnoh/react-native-openharmony/ts': { AnyThreadTurboModule: class {} },
    '@ohos.file.fs': fileSystem,
    '@ohos.net.http': { createHttp: () => ({ request, destroy }), HttpDataType: { ARRAY_BUFFER: 2 } },
    '@ohos.util': { generateRandomUUID: () => 'test' },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyFileSystemTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, ArrayBuffer, Uint8Array, require: (name: string) => modules[name] ?? {} });
  const adapter = Object.create(exports.ExpoHarmonyFileSystemTurboModule.prototype);
  adapter.normalizeSandboxPath = (value: string) => value;
  adapter.ensureParentDirectory = jest.fn();
  const destination = '/files/calendar.pdf';
  expect(await adapter.download('http://localhost/calendar.pdf', destination, { headers: { Accept: 'application/pdf' } })).toMatchObject({
    uri: destination, status: 200, headers: response.header,
  });
  expect(request).toHaveBeenCalledWith('http://localhost/calendar.pdf', {
    header: { Accept: 'application/pdf' }, expectDataType: 2, maxLimit: 25 * 1024 * 1024,
  });
  expect(fileSystem.write).toHaveBeenCalledWith(7, bytes);
  expect(fileSystem.close).toHaveBeenCalledWith(file);
  expect(fileSystem.rename).toHaveBeenCalledWith(`${destination}.download-test`, destination);
  expect(destroy).toHaveBeenCalledTimes(1);

  request.mockRejectedValueOnce(new Error('offline'));
  await expect(adapter.download('https://localhost/file', destination)).rejects.toThrow('offline');
  request.mockResolvedValueOnce({ ...response, responseCode: 404 });
  await expect(adapter.download('https://localhost/file', destination)).rejects.toThrow('404');
  request.mockResolvedValueOnce({ ...response, result: new ArrayBuffer(25 * 1024 * 1024 + 1) });
  await expect(adapter.download('https://localhost/file', destination)).rejects.toThrow('too large');
  expect(fileSystem.open).toHaveBeenCalledTimes(1);
  fileSystem.write.mockRejectedValueOnce(new Error('disk full'));
  await expect(adapter.download('https://localhost/file', destination)).rejects.toThrow('disk full');
  expect(fileSystem.close).toHaveBeenCalledTimes(2);
  expect(fileSystem.unlink).toHaveBeenCalledWith(`${destination}.download-test`);
  expect(fileSystem.rename).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(5);

  const existsError = new Error('File exists');
  fileSystem.mkdir.mockRejectedValue(existsError);
  fileSystem.accessSync.mockReturnValue(true);
  fileSystem.stat.mockResolvedValue({ isDirectory: () => true });
  await expect(adapter.makeDirectory('/files/dir', { intermediates: true })).resolves.toBeUndefined();
  await expect(adapter.makeDirectory('/files/dir')).rejects.toThrow(existsError);
  fileSystem.stat.mockResolvedValue({ isDirectory: () => false });
  await expect(adapter.makeDirectory('/files/file', { intermediates: true })).rejects.toThrow(existsError);
});

it('uses the native MD5 algorithm instead of returning a padded preview hash', async () => {
  const createMd = jest.fn(() => {
    const hash = createHash('md5');
    return { update: async ({ data }: { data: Uint8Array }) => { hash.update(data); }, digest: async () => ({ data: hash.digest() }) };
  });
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyFileSystemTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, {
    exports, require: (name: string) => name === '@ohos.security.cryptoFramework' ? { createMd } : { AnyThreadTurboModule: class {} },
  });
  const adapter = Object.create(exports.ExpoHarmonyFileSystemTurboModule.prototype);
  expect(await adapter.computeDigest(new Uint8Array())).toBe('d41d8cd98f00b204e9800998ecf8427e');
  expect(await adapter.computeDigest(new TextEncoder().encode('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72');
  expect(createMd).toHaveBeenCalledWith('MD5');
});

it('materializes bundled and data assets, caches remote files and rejects broken or unsafe sources', async () => {
  const files = new Map<string, Uint8Array>();
  const descriptors = new Map<number, string>();
  let nextFd = 1;
  const fileSystem = {
    OpenMode: { WRITE_ONLY: 1, CREATE: 2, TRUNC: 4 }, accessSync: () => true,
    stat: jest.fn(async (path: string) => {
      if (!files.has(path)) throw { code: 13900002 };
      return { isDirectory: (): boolean => false, size: files.get(path)!.byteLength };
    }),
    open: jest.fn(async (path: string) => { const fd = nextFd++; descriptors.set(fd, path); return { fd }; }),
    write: jest.fn(async (fd: number, data: ArrayBuffer) => { files.set(descriptors.get(fd)!, new Uint8Array(data)); return data.byteLength; }),
    mkdir: jest.fn(), close: jest.fn(), unlink: jest.fn(async (path: string) => { files.delete(path); }),
    rename: jest.fn(async (from: string, to: string) => { files.set(to, files.get(from)!); files.delete(from); }),
  };
  const raw = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const httpRequest = jest.fn().mockResolvedValue({ responseCode: 200, result: new Uint8Array([4, 5, 6]).buffer, header: {} });
  const modules: Record<string, unknown> = {
    '@rnoh/react-native-openharmony/ts': { AnyThreadTurboModule: class { constructor(public ctx: unknown) {} } },
    '@ohos.file.fs': fileSystem,
    '@ohos.net.http': { createHttp: () => ({ request: httpRequest, destroy: jest.fn() }), HttpDataType: { ARRAY_BUFFER: 2 } },
    '@ohos.util': { generateRandomUUID: () => 'test', TextEncoder: class { encodeInto(value: string) { return new TextEncoder().encode(value); } } },
    '@ohos.security.cryptoFramework': { createMd: (algorithm: string) => {
      const hash = createHash(algorithm.toLowerCase());
      return { update: async ({ data }: { data: Uint8Array }) => { hash.update(data); }, digest: async () => ({ data: hash.digest() }) };
    } },
  };
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(renderExpoHarmonyFileSystemTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, ArrayBuffer, Uint8Array, require: (name: string) => modules[name] ?? {} });
  const native = new exports.ExpoHarmonyFileSystemTurboModule({ uiAbilityContext: { filesDir: '/files', cacheDir: '/cache', resourceManager: { getRawFileContent: raw } } });
  const bundled = await native.loadAsset('asset:///icon.png', 'png', 'assets/icon.png');
  expect(raw).toHaveBeenCalledWith('assets/icon.png');
  expect(files.get(bundled.slice(7))).toEqual(new Uint8Array([1, 2, 3]));
  expect(await native.loadAsset('data:image/png;base64,AQID', 'png', null)).toBe(bundled);
  expect(fileSystem.write).toHaveBeenCalledTimes(1);
  raw.mockResolvedValueOnce(new Uint8Array([7, 8, 9]));
  expect(await native.loadAsset('asset:///icon.png', 'png', 'assets/icon.png')).not.toBe(bundled);
  const remote = await native.loadAsset('https://example.test/icon.png', 'png', null);
  expect(files.get(remote.slice(7))).toEqual(new Uint8Array([4, 5, 6]));
  expect(await native.loadAsset('https://example.test/icon.png', 'png', null)).toBe(remote);
  expect(httpRequest).toHaveBeenCalledTimes(1);
  expect(await native.loadAsset(remote, 'png', null)).toBe(remote);
  httpRequest.mockResolvedValueOnce({ responseCode: 404 });
  await expect(native.loadAsset('https://example.test/missing.png', 'png', null)).rejects.toThrow('404');
  await expect(native.loadAsset('file:///outside/icon.png', 'png', null)).rejects.toThrow();
  await expect(native.loadAsset('file:///unused', 'png', 'assets/../private')).rejects.toThrow('path');
  await expect(native.loadAsset('data:image/png;base64,?!', 'png', null)).rejects.toThrow('base64');
  fileSystem.write.mockResolvedValueOnce(0);
  await expect(native.loadAsset('data:image/png;base64,AA==', 'png', null)).rejects.toThrow('Incomplete');
  expect([...files.keys()].some((path) => path.endsWith('.test'))).toBe(false);
  fileSystem.stat.mockResolvedValueOnce({ isDirectory: () => true, size: 0 });
  await expect(native.loadAsset('https://example.test/directory.png', 'png', null)).rejects.toThrow('not a file');
  fileSystem.stat.mockResolvedValueOnce({ isDirectory: () => true, size: 0 });
  await expect(native.loadAsset('data:image/png;base64,AQID', 'png', null)).rejects.toThrow('not a file');
});
