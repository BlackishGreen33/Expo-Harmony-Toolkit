import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { materializeProject, alignExpoDependencies, matrices } = require('../scripts/version-compatibility-check');

it('rejects invalid SDK selection before installing or generating files', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/version-compatibility-check.js'), '--sdk=54'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Supported SDK lanes are 55, 56 and 57.');
});

it('materializes isolated native lanes with the SDK bundled Expo module versions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eht-native-matrix-test-'));
  try {
    for (const matrix of matrices) {
      const project = await materializeProject(root, matrix, true);
      expect(await fs.pathExists(path.join(project, 'app', 'camera.tsx'))).toBe(true);
      const config = await fs.readJson(path.join(project, 'app.json'));
      expect(config.expo.android.package).toBe(`com.blackishgreen.ehtsdk${matrix.sdk}native`);
      expect(config.expo.scheme).toBe(`ehtsdk${matrix.sdk}native`);
      await fs.outputJson(path.join(project, 'node_modules', 'expo', 'bundledNativeModules.json'), {
        'expo-file-system': `~${matrix.sdk}.0.11`,
        'expo-status-bar': `~${matrix.sdk}.0.4`,
        'react-native-screens': '~4.27.0',
      });
      await alignExpoDependencies(project);
      const pkg = await fs.readJson(path.join(project, 'package.json'));
      expect(pkg.dependencies['expo-file-system']).toBe(`~${matrix.sdk}.0.11`);
      expect(pkg.dependencies['expo-status-bar']).toBe(`~${matrix.sdk}.0.4`);
      expect(pkg.dependencies.react).toBe(matrix.react);
      expect(pkg.dependencies['react-native']).toBe(matrix.reactNative);
      expect(pkg.dependencies['@harmony-js/react']).toBe('npm:react@19.1.1');
      expect(pkg.dependencies['react-native-screens']).toBe('~4.27.0');
      expect(pkg.devDependencies['@harmony-js/react-native-screens']).toBe('npm:react-native-screens@4.8.0');
    }
  } finally {
    await fs.remove(root);
  }
});
