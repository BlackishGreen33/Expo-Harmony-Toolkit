import fs from 'fs-extra';
import path from 'path';
import { buildDoctorReport } from '../src/core/report';
import { UI_STACK_VALIDATED_ADAPTERS } from '../src/data/uiStack';
import { initProject } from '../src/core/template';
import {
  createSampleWorkspace,
  removeSampleWorkspace,
  runToolkitCommand,
  snapshotSampleSource,
} from './helpers/sampleHarness';

const sampleRoot = path.join(__dirname, '..', 'examples', 'official-ui-stack-sample');

describe('official ui-stack sample', () => {
  it('passes strict doctor expectations, scaffolds autolinking outputs, and bundles a harmony artifact', async () => {
    const sourceSnapshot = await snapshotSampleSource(sampleRoot);
    const workspaceRoot = await createSampleWorkspace(sampleRoot);

    try {
      const report = await buildDoctorReport(workspaceRoot);
      expect(report.expoSdkVersion).toBe(55);
      expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
      expect(report.eligibility).toBe('eligible');

      const initResult = await initProject(workspaceRoot, true);
      expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/RNOHPackagesFactory.ets');
      expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/RNOHPackagesFactory.h');
      expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/cpp/autolinking.cmake');
      expect(initResult.sync.writtenFiles).toContain('harmony/oh_modules/@rnoh/react-native-openharmony/ts.ts');
      const sourcePackageJson = await fs.readJson(path.join(sampleRoot, 'package.json'));
      expect(sourcePackageJson.pnpm?.overrides).toBeUndefined();
      const metroConfig = await fs.readFile(path.join(workspaceRoot, 'metro.harmony.config.js'), 'utf8');
      expect(metroConfig).toContain('unstable_serverRoot: __dirname');
      expect(metroConfig).toContain('moduleName.startsWith(`${aliasedModuleName}/`)');

      const autolinkingCmake = await fs.readFile(
        path.join(workspaceRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
        'utf8',
      );
      expect(autolinkingCmake).toContain('rnoh_reanimated');
      expect(autolinkingCmake).toContain('@react-native-oh-tpl/react-native-reanimated');
      expect(autolinkingCmake).toContain('rnoh_svg');
      expect(autolinkingCmake).toContain('@react-native-oh-tpl/react-native-svg');
      const etsFactory = await fs.readFile(
        path.join(workspaceRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
        'utf8',
      );
      expect(etsFactory).toContain('RNPackage');
      expect(etsFactory).toContain(
        "import { ReanimatedPackage } from '@react-native-oh-tpl/react-native-reanimated/ts';",
      );
      expect(etsFactory).toContain("import { SvgPackage } from '@react-native-oh-tpl/react-native-svg/ts';");
      expect(etsFactory).toContain('new ReanimatedPackage(ctx)');
      expect(etsFactory).toContain('new SvgPackage(ctx)');
      const cppFactory = await fs.readFile(
        path.join(workspaceRoot, 'harmony', 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
        'utf8',
      );
      expect(cppFactory).toContain('ReanimatedPackage.h');
      expect(cppFactory).toContain('SVGPackage.h');
      expect(cppFactory).toContain('std::make_shared<rnoh::ReanimatedPackage>(ctx)');
      expect(cppFactory).toContain('std::make_shared<rnoh::SVGPackage>(ctx)');
      const rnohGeneratedTsShim = await fs.readFile(
        path.join(workspaceRoot, 'harmony', 'oh_modules', '@rnoh', 'react-native-openharmony', 'ts.ts'),
        'utf8',
      );
      expect(rnohGeneratedTsShim).toContain(
        'expo-harmony-local-deps/rnoh-react-native-openharmony-react_native_openharmony/ts',
      );

      const ohPackage = await fs.readFile(path.join(workspaceRoot, 'harmony', 'oh-package.json5'), 'utf8');
      for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
        expect(ohPackage).toContain(adapter.adapterPackageName);
        expect(ohPackage).toContain(
          `file:../node_modules/${adapter.adapterPackageName}/harmony/${adapter.harmonyHarFileName}`,
        );
      }

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
      expect(bundleContents).toContain('react-native-svg');
      expect(bundleContents).toContain('react-native-reanimated');
      expect(bundleContents).toContain('Success signals');
      expect(bundleContents).toContain('Current pathname');
      expect(bundleContents).not.toContain('3.17.5');
      expect(bundleContents).not.toContain('WorkletsModule');

      const secondInit = await initProject(workspaceRoot, false);
      expect(secondInit.sync.skippedFiles).toHaveLength(0);
      expect(secondInit.report.eligibility).toBe('eligible');
    } finally {
      await removeSampleWorkspace(workspaceRoot);
    }

    expect(await snapshotSampleSource(sampleRoot)).toBe(sourceSnapshot);
  }, 180000);
});
