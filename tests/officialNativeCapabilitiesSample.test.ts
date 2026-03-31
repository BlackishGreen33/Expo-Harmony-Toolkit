import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDoctorReport } from '../src/core/report';
import { syncProjectTemplate } from '../src/core/template';

const execFileAsync = promisify(execFile);
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-native-capabilities-sample');

async function cleanupGeneratedArtifacts() {
  await fs.remove(path.join(sampleRoot, 'harmony'));
  await fs.remove(path.join(sampleRoot, '.expo-harmony'));
  await fs.remove(path.join(sampleRoot, 'index.harmony.js'));
  await fs.remove(path.join(sampleRoot, 'metro.harmony.config.js'));
}

describe('official native capabilities sample', () => {
  beforeAll(async () => {
    await cleanupGeneratedArtifacts();
  }, 30000);

  afterAll(async () => {
    await cleanupGeneratedArtifacts();
  }, 30000);

  it('passes preview doctor expectations, scaffolds preview shims, and bundles a harmony artifact', async () => {
    const report = await buildDoctorReport(sampleRoot, {
      targetTier: 'preview',
    });
    expect(report.expoSdkVersion).toBe(55);
    expect(report.targetTier).toBe('preview');
    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(report.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining([
        'expo-file-system',
        'expo-image-picker',
        'expo-location',
        'expo-camera',
      ]),
    );

    const syncResult = await syncProjectTemplate(sampleRoot, true);
    expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-file-system/index.js');
    expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-image-picker/index.js');
    expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-location/index.js');
    expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-camera/index.js');

    const moduleConfig = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
      'utf8',
    );
    expect(moduleConfig).toContain('ohos.permission.CAMERA');
    expect(moduleConfig).toContain('ohos.permission.READ_IMAGEVIDEO');
    expect(moduleConfig).toContain('ohos.permission.LOCATION');
    expect(moduleConfig).toContain('ohos.permission.APPROXIMATELY_LOCATION');

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
    expect(bundleContents).toContain('ERR_EXPO_HARMONY_PREVIEW');
    expect(bundleContents).toContain('expo-file-system');
    expect(bundleContents).toContain('expo-image-picker');
    expect(bundleContents).toContain('expo-location');
    expect(bundleContents).toContain('expo-camera');
  }, 180000);
});
