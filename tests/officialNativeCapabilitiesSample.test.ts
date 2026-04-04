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
  let sourceSnapshot = '';
  let workspaceRoot = '';
  let bundleContents = '';
  let moduleConfig = '';
  let report: Awaited<ReturnType<typeof buildDoctorReport>>;
  const routeSourceByPath = new Map<string, string>();

  beforeAll(async () => {
    sourceSnapshot = await snapshotSampleSource(sampleRoot);
    workspaceRoot = await createSampleWorkspace(sampleRoot);

    report = await buildDoctorReport(workspaceRoot, {
      targetTier: 'preview',
    });

    await syncProjectTemplate(workspaceRoot, true, {
      doctorReport: report,
    });

    moduleConfig = await fs.readFile(
      path.join(workspaceRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
      'utf8',
    );

    await runToolkitCommand(workspaceRoot, ['bundle', '--project-root', '.']);

    bundleContents = await fs.readFile(
      path.join(
        workspaceRoot,
        'harmony',
        'entry',
        'src',
        'main',
        'resources',
        'rawfile',
        'bundle.harmony.js',
      ),
      'utf8',
    );

    for (const routePath of ['file-system', 'image-picker', 'location', 'camera']) {
      routeSourceByPath.set(
        routePath,
        await fs.readFile(path.join(sampleRoot, 'app', `${routePath}.tsx`), 'utf8'),
      );
    }
  }, 180000);

  afterAll(async () => {
    if (workspaceRoot) {
      await removeSampleWorkspace(workspaceRoot);
    }

    expect(await snapshotSampleSource(sampleRoot)).toBe(sourceSnapshot);
  }, 60000);

  it('passes preview doctor expectations and writes preview-specific permissions plus shims', async () => {
    expect(report.expoSdkVersion).toBe(55);
    expect(report.targetTier).toBe('preview');
    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(report.coverageProfile).toBe('managed-native-heavy');
    expect(report.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining([
        'expo-file-system',
        'expo-image-picker',
        'expo-location',
        'expo-camera',
      ]),
    );
    expect(report.nextActions).toContain(
      'Keep combined sample smoke for regression coverage, but track bundle/debug/device/release evidence separately for each preview capability before promotion.',
    );
    expect(moduleConfig).toContain('ohos.permission.CAMERA');
    expect(moduleConfig).toContain('ohos.permission.MICROPHONE');
    expect(moduleConfig).toContain('ohos.permission.READ_IMAGEVIDEO');
    expect(moduleConfig).toContain('ohos.permission.LOCATION');
    expect(moduleConfig).toContain('ohos.permission.APPROXIMATELY_LOCATION');
    expect(moduleConfig).toContain('ohos.permission.LOCATION_IN_BACKGROUND');
    expect(moduleConfig).toContain('ohos.permission.ACCELEROMETER');
    expect(await fs.pathExists(path.join(workspaceRoot, '.expo-harmony', 'shims', 'expo-file-system', 'index.js'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(workspaceRoot, '.expo-harmony', 'shims', 'expo-image-picker', 'index.js'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(workspaceRoot, '.expo-harmony', 'shims', 'expo-location', 'index.js'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(workspaceRoot, '.expo-harmony', 'shims', 'expo-camera', 'index.js'))).toBe(
      true,
    );
  });

  it('keeps a dedicated file-system route and bundle acceptance slice', () => {
    const routeSource = routeSourceByPath.get('file-system') ?? '';

    expect(routeSource).toContain('expo-file-system functional check');
    expect(routeSource).toContain('Run full file-system flow');
    expect(routeSource).toContain('Check md5 info');
    expect(bundleContents).toContain('ExpoHarmonyFileSystem');
    expect(bundleContents).toContain('Create sandbox directory');
    expect(bundleContents).toContain('Write UTF-8 file');
    expect(bundleContents).toContain('Base64 roundtrip');
    expect(bundleContents).toContain('Read partial file');
    expect(bundleContents).toContain('Check md5 info');
    expect(bundleContents).toContain('Download remote file');
    expect(bundleContents).toContain('Full file-system flow OK.');
  });

  it('keeps a dedicated image-picker route and bundle acceptance slice', () => {
    const routeSource = routeSourceByPath.get('image-picker') ?? '';

    expect(routeSource).toContain('expo-image-picker functional check');
    expect(routeSource).toContain('Single image library');
    expect(routeSource).toContain('Multi-select library');
    expect(routeSource).toContain('Check pending result');
    expect(bundleContents).toContain('expo-image-picker');
    expect(bundleContents).toContain('Multi-select library');
    expect(bundleContents).toContain('Mixed library selection');
    expect(bundleContents).toContain('Camera video capture');
    expect(bundleContents).toContain('Check pending result');
    expect(bundleContents).toContain('Latest picker result');
  });

  it('keeps a dedicated location route and bundle acceptance slice', () => {
    const routeSource = routeSourceByPath.get('location') ?? '';

    expect(routeSource).toContain('expo-location functional check');
    expect(routeSource).toContain('Request background permission');
    expect(routeSource).toContain('Start watch position');
    expect(routeSource).toContain('Start heading watch');
    expect(bundleContents).toContain('expo-location');
    expect(bundleContents).toContain('Reverse geocode latest fix');
    expect(bundleContents).toContain('Start watch position');
    expect(bundleContents).toContain('Start heading watch');
    expect(bundleContents).toContain('Request background permission');
  });

  it('keeps a dedicated camera route and bundle acceptance slice', () => {
    const routeSource = routeSourceByPath.get('camera') ?? '';

    expect(routeSource).toContain('expo-camera functional check');
    expect(routeSource).toContain('Pause preview');
    expect(routeSource).toContain('Take picture');
    expect(routeSource).toContain('Start video recording');
    expect(bundleContents).toContain('expo-camera');
    expect(bundleContents).toContain('Take picture');
    expect(bundleContents).toContain('Pause preview');
    expect(bundleContents).toContain('Start video recording');
    expect(bundleContents).toContain('Request microphone permission');
  });
});
