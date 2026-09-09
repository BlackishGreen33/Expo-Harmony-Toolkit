import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHarmonyPackageResolver } from '../src/metro';
import { renderMetroConfig } from '../src/core/template/metro';

it('generated Metro configs use installed Harmony aliases before canonical package roots', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-generated-metro-')));
  try {
    const source = '@harmony-js/react-native-screens';
    const adapter = '@react-native-oh-tpl/react-native-screens';
    await fs.outputJson(path.join(root, 'package.json'), { name: 'app' });
    await fs.outputJson(path.join(root, 'node_modules', source, 'package.json'), { name: 'react-native-screens', version: '4.8.0' });
    await fs.outputJson(path.join(root, 'node_modules', adapter, 'package.json'), {
      name: adapter, peerDependencies: { 'react-native-screens': '4.8.0' }, harmony: { alias: 'react-native-screens' },
    });
    const routerRoot = path.join(root, 'node_modules/expo-router');
    await fs.outputJson(path.join(routerRoot, 'package.json'), { name: 'expo-router' });
    const standardStackFallback = path.join(routerRoot, 'build/layouts/experimental-stack/index.web.js');
    await fs.outputFile(standardStackFallback, 'module.exports = {};');
    const module = { exports: {} as any };
    const context = { originModulePath: path.join(root, 'app.ts'), resolveRequest: (_context: unknown, name: string) => ({ filePath: name }) };
    runInNewContext(renderMetroConfig([], {
      devDependencies: { [source]: 'npm:react-native-screens@4.8.0' },
      dependencies: { 'react-native-screens': '~4.27.0', [adapter]: '4.8.1-rc.3' },
    }), {
      module, __dirname: root, process: { env: {} },
      require: (name: string) => {
        if (name === 'fs') return fs;
        if (name === 'path') return path;
        if (name === 'expo/metro-config') return { getDefaultConfig: () => ({}) };
        if (name === '@react-native-oh/react-native-harmony/metro.config') return { createHarmonyMetroConfig: () => ({}) };
        if (name === 'expo-harmony-toolkit/metro') return { createHarmonyPackageResolver };
        throw new Error(`Unexpected import ${name}`);
      },
    });
    const resolve = module.exports.resolver.resolveRequest;
    expect(resolve(context, 'react-native-screens', 'harmony').filePath).toBe(path.join(root, 'node_modules', adapter));
    const routerContext = { ...context, originModulePath: path.join(routerRoot, 'build/exports.js') };
    expect(resolve(routerContext, './layouts/experimental-stack', 'harmony').filePath).toBe(standardStackFallback);
    expect(resolve(context, './layouts/experimental-stack', 'harmony').filePath).toBe('./layouts/experimental-stack');
    for (const platform of ['ios', 'android']) {
      expect(resolve(context, 'react-native-screens', platform).filePath).toBe('react-native-screens');
      expect(resolve(routerContext, './layouts/experimental-stack', platform).filePath).toBe('./layouts/experimental-stack');
    }
  } finally {
    await fs.remove(root);
  }
});

it('keeps native platforms intact and overlays only the pinned Harmony JS version', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'harmony-metro-')));
  const originalRoot = path.join(root, 'node_modules/animation');
  const sourceRoot = path.join(root, 'node_modules/@harmony-js/animation');
  const adapterRoot = path.join(root, 'node_modules/animation-harmony');
  try {
    await fs.outputJson(path.join(root, 'package.json'), { name: 'app' });
    await fs.outputJson(path.join(originalRoot, 'package.json'), { name: 'animation', version: '4.0.0' });
    await fs.outputJson(path.join(sourceRoot, 'package.json'), { name: 'animation', version: '3.0.0' });
    await fs.outputJson(path.join(adapterRoot, 'package.json'), { name: 'animation-harmony', peerDependencies: { animation: '3.0.0' }, harmony: { alias: 'animation', redirectInternalImports: true } });
    const resolve = createHarmonyPackageResolver(root, { animation: { source: '@harmony-js/animation', adapter: 'animation-harmony' } });
    const context = {
      originModulePath: path.join(root, 'app.ts'),
      resolveRequest: jest.fn((_context, name: string) => {
        if (name === path.join(adapterRoot, 'src/shared')) throw new Error('no overlay');
        return { type: 'sourceFile', filePath: name };
      }),
    };
    expect(resolve(context, 'animation', 'ios')).toBeNull();
    expect(resolve(context, 'animation', 'android')).toBeNull();
    expect(context.resolveRequest).not.toHaveBeenCalled();
    expect(resolve(context, 'animation', 'harmony')).toMatchObject({ filePath: adapterRoot });
    expect(resolve(context, 'animation/src/shared', 'harmony')).toMatchObject({ filePath: path.join(sourceRoot, 'src/shared') });
    expect(resolve({ ...context, originModulePath: path.join(adapterRoot, 'src/index.ts') }, 'animation', 'harmony')).toMatchObject({ filePath: sourceRoot });
    expect(resolve({ ...context, originModulePath: path.join(sourceRoot, 'src/index.ts') }, './native', 'harmony')).toMatchObject({ filePath: path.join(adapterRoot, 'src/native') });
    expect(resolve(context, 'another-package', 'harmony')).toBeNull();
    expect(() => createHarmonyPackageResolver(root, { wrong: { source: '@harmony-js/animation', adapter: 'animation-harmony' } })).toThrow('must pair');
    expect(() => createHarmonyPackageResolver(root, { animation: { source: 'animation', adapter: 'animation-harmony' } })).toThrow('requires animation@3.0.0');
  } finally {
    await fs.remove(root);
  }
});
