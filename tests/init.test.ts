import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initProject, syncProjectTemplate } from '../src/core/template';
import { readManifest, readToolkitConfig } from '../src/core/metadata';

const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const nativePreviewFixtureRoot = path.join(__dirname, '..', 'fixtures', 'native-preview-app');

async function createTempFixture(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-toolkit-'));
  await fs.copy(fixtureRoot, tempRoot);
  return tempRoot;
}

async function createTempPreviewFixture(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-preview-toolkit-'));
  await fs.copy(nativePreviewFixtureRoot, tempRoot);
  return tempRoot;
}

async function writeLocalSigningConfig(projectRoot: string): Promise<void> {
  await fs.outputJson(
    path.join(projectRoot, '.expo-harmony', 'signing.local.json'),
    {
      signingConfigs: [
        {
          name: 'default',
          type: 'HarmonyOS',
          material: {
            storeFile: './signing/release.p12',
          },
        },
      ],
      products: [
        {
          name: 'default',
          signingConfig: 'default',
        },
      ],
    },
    { spaces: 2 },
  );
}

describe('init project', () => {
  it('writes scaffold files and remains idempotent on the second run', async () => {
    const projectRoot = await createTempFixture();

    const firstRun = await initProject(projectRoot, false);
    const secondRun = await initProject(projectRoot, false);
    const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
    const manifest = await readManifest(projectRoot);
    const toolkitConfig = await readToolkitConfig(projectRoot);

    expect(firstRun.sync.writtenFiles).toContain('harmony/README.md');
    expect(await fs.pathExists(path.join(projectRoot, 'metro.harmony.config.js'))).toBe(true);
    expect(packageJson.scripts['harmony:init']).toBe('expo-harmony init');
    expect(packageJson.scripts['harmony:env']).toBe('expo-harmony env');
    expect(packageJson.scripts['harmony:bundle']).toBe('expo-harmony bundle');
    expect(packageJson.scripts['harmony:build:debug']).toBe('expo-harmony build-hap --mode debug');
    expect(packageJson.pnpm?.overrides).toBeUndefined();
    expect(manifest?.toolkitVersion).toBe('1.7.1');
    expect(manifest?.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(toolkitConfig?.toolkitVersion).toBe('1.7.1');
    expect(toolkitConfig?.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(await fs.pathExists(path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, 'harmony', 'oh_modules', '@rnoh', 'react-native-openharmony', 'ts.ts'))).toBe(true);
    expect(await fs.readFile(path.join(projectRoot, 'harmony', 'build-profile.json5'), 'utf8')).toContain(
      'useNormalizedOHMUrl',
    );
    expect(await fs.readFile(path.join(projectRoot, 'harmony', 'entry', 'hvigorfile.ts'), 'utf8')).toContain(
      'autolinking: null',
    );
    expect(await fs.readFile(path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'PackageProvider.ets'), 'utf8')).toContain(
      'RNPackage',
    );
    expect(secondRun.sync.writtenFiles).toHaveLength(0);
    expect(secondRun.sync.skippedFiles).toHaveLength(0);
    expect(secondRun.sync.unchangedFiles.length).toBeGreaterThan(0);
  });

  it('detects drifted managed files without force', async () => {
    const projectRoot = await createTempFixture();

    await initProject(projectRoot, false);
    await fs.writeFile(path.join(projectRoot, 'metro.harmony.config.js'), '// drifted\n');

    const result = await syncProjectTemplate(projectRoot, false);

    expect(result.skippedFiles).toContain('metro.harmony.config.js');
    expect(
      result.warnings.some((warning) =>
        warning.includes('metro.harmony.config.js'),
      ),
    ).toBe(true);
  });

  it('merges local signing input into the managed Harmony build profile', async () => {
    const projectRoot = await createTempFixture();
    await writeLocalSigningConfig(projectRoot);

    await initProject(projectRoot, true);

    const buildProfileContents = await fs.readFile(
      path.join(projectRoot, 'harmony', 'build-profile.json5'),
      'utf8',
    );

    expect(buildProfileContents).toContain('"signingConfigs"');
    expect(buildProfileContents).toContain('"storeFile": "./signing/release.p12"');
    expect(buildProfileContents).toContain('"signingConfig": "default"');
  });

  it('surfaces metadata matrix drift in doctor and sync warnings', async () => {
    const projectRoot = await createTempFixture();

    await initProject(projectRoot, false);
    const manifestPath = path.join(projectRoot, '.expo-harmony', 'manifest.json');
    const manifest = await fs.readJson(manifestPath);

    manifest.matrixId = 'legacy-v0.2';
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    const syncResult = await syncProjectTemplate(projectRoot, false);

    expect(syncResult.warnings.some((warning) => warning.includes('Existing manifest matrix legacy-v0.2'))).toBe(
      true,
    );
  });

  it('injects preview capability permissions and shims into managed outputs', async () => {
    const projectRoot = await createTempPreviewFixture();

    await syncProjectTemplate(projectRoot, true);

    const moduleConfig = await fs.readFile(
      path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
      'utf8',
    );
    const metroConfig = await fs.readFile(path.join(projectRoot, 'metro.harmony.config.js'), 'utf8');
    const fileSystemShim = await fs.readFile(
      path.join(projectRoot, '.expo-harmony', 'shims', 'expo-file-system', 'index.js'),
      'utf8',
    );
    const imagePickerShim = await fs.readFile(
      path.join(projectRoot, '.expo-harmony', 'shims', 'expo-image-picker', 'index.js'),
      'utf8',
    );
    const locationShim = await fs.readFile(
      path.join(projectRoot, '.expo-harmony', 'shims', 'expo-location', 'index.js'),
      'utf8',
    );
    const cameraShim = await fs.readFile(
      path.join(projectRoot, '.expo-harmony', 'shims', 'expo-camera', 'index.js'),
      'utf8',
    );
    const toolkitConfig = await readToolkitConfig(projectRoot);

    expect(moduleConfig).toContain('ohos.permission.CAMERA');
    expect(moduleConfig).toContain('ohos.permission.READ_IMAGEVIDEO');
    expect(moduleConfig).toContain('ohos.permission.LOCATION');
    expect(moduleConfig).toContain('ohos.permission.APPROXIMATELY_LOCATION');
    expect(metroConfig).toContain(".expo-harmony/shims/expo-file-system");
    expect(metroConfig).toContain(".expo-harmony/shims/expo-image-picker");
    expect(metroConfig).toContain(".expo-harmony/shims/expo-location");
    expect(metroConfig).toContain(".expo-harmony/shims/expo-camera");
    expect(fileSystemShim).toContain('ExpoHarmonyFileSystem');
    expect(fileSystemShim).not.toContain('ERR_EXPO_HARMONY_PREVIEW');
    expect(imagePickerShim).toContain('launchImageLibraryAsync');
    expect(locationShim).toContain("createUnsupportedError('watchPositionAsync')");
    expect(locationShim).toContain("createUnsupportedError('getBackgroundPermissionsAsync')");
    expect(cameraShim).toContain('Expo Harmony system camera capture entry');
    expect(cameraShim).toContain("createUnsupportedError('CameraView.pausePreview')");
    expect(toolkitConfig?.capabilities.map((capability) => capability.id)).toEqual([
      'expo-camera',
      'expo-file-system',
      'expo-image-picker',
      'expo-location',
    ]);
    expect(toolkitConfig?.capabilities.every((capability) => capability.runtimeMode === 'adapter')).toBe(
      true,
    );
    expect(toolkitConfig?.capabilities.every((capability) => capability.evidence.bundle)).toBe(true);
    expect(toolkitConfig?.capabilities.every((capability) => capability.evidence.debugBuild)).toBe(true);
    expect(toolkitConfig?.capabilities.every((capability) => capability.evidence.device)).toBe(true);
    expect(toolkitConfig?.capabilities.every((capability) => capability.evidence.release === false)).toBe(
      true,
    );
    expect(toolkitConfig?.requestedHarmonyPermissions).toEqual(
      expect.arrayContaining([
        'ohos.permission.CAMERA',
        'ohos.permission.READ_IMAGEVIDEO',
        'ohos.permission.LOCATION',
        'ohos.permission.APPROXIMATELY_LOCATION',
      ]),
    );
  });
});
