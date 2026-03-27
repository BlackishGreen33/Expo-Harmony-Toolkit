import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDoctorReport } from '../src/core/report';
import { initProject } from '../src/core/template';

const execFileAsync = promisify(execFile);
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');

async function cleanupGeneratedArtifacts() {
  await fs.remove(path.join(sampleRoot, 'harmony'));
  await fs.remove(path.join(sampleRoot, '.expo-harmony'));
  await fs.remove(path.join(sampleRoot, 'index.harmony.js'));
  await fs.remove(path.join(sampleRoot, 'metro.harmony.config.js'));
}

describe('official app-shell sample', () => {
  beforeAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  afterAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  it('passes strict doctor expectations, scaffolds, and bundles a harmony artifact', async () => {
    const report = await buildDoctorReport(sampleRoot);
    expect(report.expoSdkVersion).toBe(55);
    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(report.expoConfig.plugins).toContain('expo-router');
    expect(report.expoConfig.schemes).toEqual(['expoharmonyappshell']);

    const initResult = await initProject(sampleRoot, true);
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/pages/Index.ets');
    expect(initResult.sync.writtenFiles).toContain(
      '.expo-harmony/shims/react-native-safe-area-context/index.js',
    );
    expect(initResult.sync.writtenFiles).toContain('.expo-harmony/shims/expo-modules-core/index.js');
    expect(initResult.sync.writtenFiles).toContain('.expo-harmony/shims/runtime-prelude.js');
    const cmakeLists = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'CMakeLists.txt'),
      'utf8',
    );
    expect(cmakeLists).toContain('oh_modules/.ohpm/@rnoh+react-native-openharmony@*');
    expect(cmakeLists).toContain('include("${CMAKE_CURRENT_SOURCE_DIR}/autolinking.cmake")');
    expect(cmakeLists).toContain('autolink_libraries(rnoh_app)');
    expect(cmakeLists).toContain('foreach(RNOH_TARGET rnoh_core rnoh_core_package)');
    expect(cmakeLists).toContain('assert.h');
    const autolinkingCmake = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
      'utf8',
    );
    expect(autolinkingCmake).toContain('function(autolink_libraries target)');
    const etsFactory = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
      'utf8',
    );
    expect(etsFactory).toContain('createRNOHPackages');
    const metroConfig = await fs.readFile(path.join(sampleRoot, 'metro.harmony.config.js'), 'utf8');
    expect(metroConfig).toContain("'expo-modules-core'");
    expect(metroConfig).toContain("'react-native-safe-area-context'");
    expect(metroConfig).toContain('resolveRequest: resolveExpoHarmonyShim');
    expect(metroConfig).toContain('resolveReactNativeCompatibilityWrapper');
    const safeAreaShim = await fs.readFile(
      path.join(sampleRoot, '.expo-harmony', 'shims', 'react-native-safe-area-context', 'index.js'),
      'utf8',
    );
    expect(safeAreaShim).toContain('const initialWindowMetrics = getWindowMetrics()');
    expect(safeAreaShim).toContain('SafeAreaProvider');
    expect(safeAreaShim).toContain('withSafeAreaInsets');
    const expoModulesCoreShim = await fs.readFile(
      path.join(sampleRoot, '.expo-harmony', 'shims', 'expo-modules-core', 'index.js'),
      'utf8',
    );
    expect(expoModulesCoreShim).toContain("executionEnvironment: 'standalone'");
    expect(expoModulesCoreShim).toContain('nativeModules.ExpoLinking = expoLinkingModule');
    const runtimePrelude = await fs.readFile(
      path.join(sampleRoot, '.expo-harmony', 'shims', 'runtime-prelude.js'),
      'utf8',
    );
    expect(runtimePrelude).toContain('react-native/Libraries/Core/InitializeCore');
    expect(runtimePrelude).toContain('patchNativeComponentViewConfigDefaults');
    expect(runtimePrelude).toContain('BaseViewConfig.harmony');
    expect(runtimePrelude).toContain("installGlobalIfMissing('FormData'");
    const harmonyEntry = await fs.readFile(path.join(sampleRoot, 'index.harmony.js'), 'utf8');
    expect(harmonyEntry).toContain("require('./.expo-harmony/shims/runtime-prelude.js');");
    expect(harmonyEntry).toContain('AppRegistry.registerComponent("expo-harmony-app-shell-sample"');
    const packageJson = await fs.readJson(path.join(sampleRoot, 'package.json'));
    expect(packageJson.scripts['harmony:bundle']).toBe('node ../../bin/expo-harmony.js bundle --project-root .');
    expect(packageJson.scripts['harmony:build:debug']).toBe(
      'node ../../bin/expo-harmony.js build-hap --project-root . --mode debug',
    );

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
    expect(bundleContents).toContain('__d(');
    expect(bundleContents).toContain('expoharmonyappshell://');
    expect(bundleContents).not.toContain('globalThis.expo.NativeModule');
    expect(bundleContents).not.toContain('Unable to install Expo modules');

    const secondInit = await initProject(sampleRoot, false);
    expect(secondInit.sync.skippedFiles).toHaveLength(0);
    expect(secondInit.report.eligibility).toBe('eligible');
  }, 120000);
});
