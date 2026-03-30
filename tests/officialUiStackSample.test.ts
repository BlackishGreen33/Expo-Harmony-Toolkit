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
  }, 30000);

  afterAll(async () => {
    await cleanupGeneratedArtifacts();
  }, 30000);

  it('passes strict doctor expectations, scaffolds autolinking outputs, and bundles a harmony artifact', async () => {
    const report = await buildDoctorReport(sampleRoot);
    expect(report.expoSdkVersion).toBe(55);
    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');

    const initResult = await initProject(sampleRoot, true);
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/RNOHPackagesFactory.ets');
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/RNOHPackagesFactory.h');
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/autolinking.cmake');
    expect(initResult.sync.writtenFiles).toContain('harmony/oh_modules/@rnoh/react-native-openharmony/ts.ts');
    const samplePackageJson = await fs.readJson(path.join(sampleRoot, 'package.json'));
    expect(samplePackageJson.pnpm?.overrides).toMatchObject({
      'react-native-reanimated': '3.6.0',
      'react-native-svg': '15.0.0',
    });
    const metroConfig = await fs.readFile(path.join(sampleRoot, 'metro.harmony.config.js'), 'utf8');
    expect(metroConfig).toContain('unstable_serverRoot: __dirname');
    expect(metroConfig).toContain('moduleName.startsWith(`${aliasedModuleName}/`)');

    const autolinkingCmake = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
      'utf8',
    );
    expect(autolinkingCmake).toContain('rnoh_reanimated');
    expect(autolinkingCmake).toContain('@react-native-oh-tpl/react-native-reanimated');
    expect(autolinkingCmake).toContain('rnoh_svg');
    expect(autolinkingCmake).toContain('@react-native-oh-tpl/react-native-svg');
    const etsFactory = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
      'utf8',
    );
    expect(etsFactory).toContain('RNPackage');
    expect(etsFactory).toContain("import { ReanimatedPackage } from '@react-native-oh-tpl/react-native-reanimated/ts';");
    expect(etsFactory).toContain("import { SvgPackage } from '@react-native-oh-tpl/react-native-svg/ts';");
    expect(etsFactory).toContain('new ReanimatedPackage(ctx)');
    expect(etsFactory).toContain('new SvgPackage(ctx)');
    const cppFactory = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
      'utf8',
    );
    expect(cppFactory).toContain('ReanimatedPackage.h');
    expect(cppFactory).toContain('SVGPackage.h');
    expect(cppFactory).toContain('std::make_shared<rnoh::ReanimatedPackage>(ctx)');
    expect(cppFactory).toContain('std::make_shared<rnoh::SVGPackage>(ctx)');
    const rnohGeneratedTsShim = await fs.readFile(
      path.join(sampleRoot, 'harmony', 'oh_modules', '@rnoh', 'react-native-openharmony', 'ts.ts'),
      'utf8',
    );
    expect(rnohGeneratedTsShim).toContain(
      'expo-harmony-local-deps/rnoh-react-native-openharmony-react_native_openharmony/ts',
    );

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
    expect(bundleContents).not.toContain('3.17.5');
    expect(bundleContents).not.toContain('WorkletsModule');

    const secondInit = await initProject(sampleRoot, false);
    expect(secondInit.sync.skippedFiles).toHaveLength(0);
    expect(secondInit.report.eligibility).toBe('eligible');
  }, 180000);
});
