import fs from 'fs-extra';
import path from 'path';
import { buildDoctorReport } from '../src/core/report';
import { syncProjectTemplate } from '../src/core/template';
import {
  createSampleWorkspace,
  removeSampleWorkspace,
  runToolkitCommand,
  snapshotSampleSource,
} from './helpers/sampleHarness';

const sampleRoot = path.join(__dirname, '..', 'examples', 'official-native-capabilities-sample');

describe('official native capabilities sample', () => {
  it('passes preview doctor expectations, scaffolds native-capability shims, and bundles a harmony artifact', async () => {
    const sourceSnapshot = await snapshotSampleSource(sampleRoot);
    const workspaceRoot = await createSampleWorkspace(sampleRoot);

    try {
      const report = await buildDoctorReport(workspaceRoot, {
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

      const syncResult = await syncProjectTemplate(workspaceRoot, true);
      expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-file-system/index.js');
      expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-image-picker/index.js');
      expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-location/index.js');
      expect(syncResult.writtenFiles).toContain('.expo-harmony/shims/expo-camera/index.js');

      const moduleConfig = await fs.readFile(
        path.join(workspaceRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
        'utf8',
      );
      expect(moduleConfig).toContain('ohos.permission.CAMERA');
      expect(moduleConfig).toContain('ohos.permission.MICROPHONE');
      expect(moduleConfig).toContain('ohos.permission.READ_IMAGEVIDEO');
      expect(moduleConfig).toContain('ohos.permission.LOCATION');
      expect(moduleConfig).toContain('ohos.permission.APPROXIMATELY_LOCATION');
      expect(moduleConfig).toContain('ohos.permission.LOCATION_IN_BACKGROUND');
      expect(moduleConfig).toContain('ohos.permission.ACCELEROMETER');

      const bundleOutput = path.join(
        workspaceRoot,
        'harmony',
        'entry',
        'src',
        'main',
        'resources',
        'rawfile',
        'bundle.harmony.js',
      );

      await runToolkitCommand(workspaceRoot, ['bundle', '--project-root', '.']);

      expect(await fs.pathExists(bundleOutput)).toBe(true);
      const bundleContents = await fs.readFile(bundleOutput, 'utf8');
      expect(bundleContents).toContain('ExpoHarmonyFileSystem');
      expect(bundleContents).toContain('Create sandbox directory');
      expect(bundleContents).toContain('Write UTF-8 file');
      expect(bundleContents).toContain('Base64 roundtrip');
      expect(bundleContents).toContain('Read partial file');
      expect(bundleContents).toContain('Check md5 info');
      expect(bundleContents).toContain('Download remote file');
      expect(bundleContents).toContain('Full file-system flow OK.');
      expect(bundleContents).toContain('expo-file-system');
      expect(bundleContents).toContain('expo-image-picker');
      expect(bundleContents).toContain('Multi-select library');
      expect(bundleContents).toContain('Mixed library selection');
      expect(bundleContents).toContain('Camera video capture');
      expect(bundleContents).toContain('Check pending result');
      expect(bundleContents).toContain('Latest picker result');
      expect(bundleContents).toContain('expo-location');
      expect(bundleContents).toContain('Reverse geocode latest fix');
      expect(bundleContents).toContain('Start watch position');
      expect(bundleContents).toContain('Start heading watch');
      expect(bundleContents).toContain('Request background permission');
      expect(bundleContents).toContain('expo-camera');
      expect(bundleContents).toContain('Take picture');
      expect(bundleContents).toContain('Pause preview');
      expect(bundleContents).toContain('Start video recording');
      expect(bundleContents).toContain('Request microphone permission');
    } finally {
      await removeSampleWorkspace(workspaceRoot);
    }

    expect(await snapshotSampleSource(sampleRoot)).toBe(sourceSnapshot);
  }, 180000);
});
