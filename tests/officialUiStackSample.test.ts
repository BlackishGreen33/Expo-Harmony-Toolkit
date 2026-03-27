import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDoctorReport } from '../src/core/report';
import { UI_STACK_VALIDATED_ADAPTERS } from '../src/data/uiStack';
import { initProject } from '../src/core/template';

const execFileAsync = promisify(execFile);
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-ui-stack-sample');

async function cleanupGeneratedArtifacts() {
  await fs.remove(path.join(sampleRoot, 'harmony'));
  await fs.remove(path.join(sampleRoot, '.expo-harmony'));
  await fs.remove(path.join(sampleRoot, 'index.harmony.js'));
  await fs.remove(path.join(sampleRoot, 'metro.harmony.config.js'));
}

describe('official ui-stack sample', () => {
  beforeAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  afterAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  it('passes strict doctor expectations, scaffolds autolinking outputs, and bundles a harmony artifact', async () => {
    const report = await buildDoctorReport(sampleRoot);
    expect(report.expoSdkVersion).toBe(55);
    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');

    const initResult = await initProject(sampleRoot, true);
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/RNOHPackagesFactory.ets');
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/RNOHPackagesFactory.h');
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/autolinking.cmake');

    const autolinkingCmake = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
      'utf8',
    );
    expect(autolinkingCmake).toContain('rnoh_gesture_handler');
    expect(autolinkingCmake).toContain('@react-native-oh-tpl/react-native-gesture-handler');
    expect(autolinkingCmake).not.toContain('@react-native-oh-tpl/react-native-reanimated');
    expect(autolinkingCmake).not.toContain('@react-native-oh-tpl/react-native-svg');

    const ohPackage = await fs.readFile(path.join(sampleRoot, 'harmony', 'oh-package.json5'), 'utf8');
    for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
      expect(ohPackage).toContain(adapter.adapterPackageName);
      expect(ohPackage).toContain(`file:../node_modules/${adapter.adapterPackageName}/harmony/${adapter.harmonyHarFileName}`);
    }

    const bundleOutput = path.join(
      sampleRoot,
      'harmony',
      'entry',
      'src',
      'main',
      'resources',
      'rawfile',
      'bundle.harmony.js',
    );

    await execFileAsync('pnpm', ['run', 'harmony:bundle'], {
      cwd: sampleRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });

    expect(await fs.pathExists(bundleOutput)).toBe(true);
    const bundleContents = await fs.readFile(bundleOutput, 'utf8');
    expect(bundleContents).toContain('react-native-svg');
    expect(bundleContents).toContain('react-native-reanimated');
    expect(bundleContents).toContain('react-native-gesture-handler');

    const secondInit = await initProject(sampleRoot, false);
    expect(secondInit.sync.skippedFiles).toHaveLength(0);
    expect(secondInit.report.eligibility).toBe('eligible');
  }, 180000);
});
