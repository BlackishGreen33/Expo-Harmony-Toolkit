import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { createHarmonyPackageResolver } from '../src/metro';

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
