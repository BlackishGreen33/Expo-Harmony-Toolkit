import { execFile } from 'node:child_process';
import fs from 'fs-extra';
import JSON5 from 'json5';
import os from 'os';
import path from 'path';
import { promisify } from 'node:util';
import { buildHapProject, bundleProject, CommandRunner } from '../src/core/build';
import { initProject, syncProjectTemplate } from '../src/core/template';

const minimalSampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');
const uiStackSampleRoot = path.join(__dirname, '..', 'examples', 'official-ui-stack-sample');
const nativeCapabilitiesSampleRoot = path.join(
  __dirname,
  '..',
  'examples',
  'official-native-capabilities-sample',
);
const execFileAsync = promisify(execFile);
const FAKE_NOOP_LINK_HARMONY_MODULE = `exports.commandLinkHarmony = {
  func: async () => {}
};
`;
const FAKE_THROWING_LINK_HARMONY_MODULE = `exports.commandLinkHarmony = {
  func: async () => {
    throw new Error('simulated link failure');
  }
};
`;

async function createTempFixture(sourceRoot: string): Promise<string> {
  const tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-build-'));
  const tempRoot = path.join(tempBase, 'project');
  await fs.copy(sourceRoot, tempRoot, {
    filter: (sourcePath) => !sourcePath.includes(`${path.sep}node_modules`),
  });
  await fs.ensureDir(path.join(tempRoot, 'node_modules', 'react-native'));
  await fs.outputFile(path.join(tempRoot, 'node_modules', 'react-native', 'cli.js'), '');
  await createFakeHarArchive(
    path.join(
      tempRoot,
      'node_modules',
      '@react-native-oh',
      'react-native-harmony',
      'react_native_openharmony.har',
    ),
    '@rnoh/react-native-openharmony',
  );
  return tempRoot;
}

async function removeHarmonyCliFromFixture(projectRoot: string): Promise<void> {
  await fs.remove(
    path.join(projectRoot, 'node_modules', '@react-native-oh', 'react-native-harmony-cli'),
  );
}

async function installFakeHarmonyCli(
  projectRoot: string,
  linkHarmonyModuleContents: string,
): Promise<void> {
  const cliRoot = path.join(projectRoot, 'node_modules', '@react-native-oh', 'react-native-harmony-cli');
  await fs.remove(cliRoot);
  await fs.outputJson(
    path.join(cliRoot, 'package.json'),
    {
      name: '@react-native-oh/react-native-harmony-cli',
      version: '0.82.18',
    },
    { spaces: 2 },
  );
  await fs.outputFile(
    path.join(cliRoot, 'dist', 'commands', 'link-harmony.js'),
    linkHarmonyModuleContents,
  );
}

async function createFakeDevEcoStudio(projectRoot: string): Promise<string> {
  const devecoRoot = path.join(projectRoot, 'DevEco-Studio.app');
  await fs.outputFile(
    path.join(devecoRoot, 'Contents', 'sdk', 'default', 'openharmony', 'toolchains', 'hdc'),
    '',
  );
  await fs.outputFile(path.join(devecoRoot, 'Contents', 'tools', 'hvigor', 'bin', 'hvigorw.js'), '');
  await fs.outputFile(path.join(devecoRoot, 'Contents', 'tools', 'ohpm', 'bin', 'ohpm'), '');
  return devecoRoot;
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

async function createFakeHarArchive(
  targetPath: string,
  packageName: string,
  extraFiles: Record<string, string> = {},
): Promise<void> {
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-har-fixture-'));
  const packageRoot = path.join(stagingRoot, 'package');
  const moduleName = path
    .basename(packageName)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  await fs.outputFile(
    path.join(packageRoot, 'oh-package.json5'),
    JSON.stringify({ name: packageName, version: '1.0.0' }),
  );
  await fs.outputFile(
    path.join(packageRoot, 'build-profile.json5'),
    JSON.stringify({
      apiType: 'stageMode',
      targets: [{ name: 'default', runtimeOS: 'HarmonyOS' }],
    }),
  );
  await fs.outputFile(path.join(packageRoot, 'index.ets'), 'export default {}\n');
  await fs.outputFile(
    path.join(packageRoot, 'src', 'main', 'module.json'),
    JSON.stringify({
      module: {
        name: moduleName,
        type: 'har',
        packageName,
      },
    }),
  );
  for (const [relativePath, contents] of Object.entries(extraFiles)) {
    await fs.outputFile(path.join(packageRoot, relativePath), contents);
  }
  await fs.ensureDir(path.dirname(targetPath));
  await execFileAsync('tar', ['-czf', targetPath, '-C', stagingRoot, 'package']);
  await fs.remove(stagingRoot);
}

function createSuccessfulRunner(): CommandRunner {
  return async (file, args, options) => {
    if (args.includes('bundle-harmony')) {
      const bundleOutput = args[args.indexOf('--bundle-output') + 1];
      const assetsDest = args[args.indexOf('--assets-dest') + 1];
      await fs.outputFile(bundleOutput, '__d(function(){})\n');
      await fs.ensureDir(assetsDest);
      return {
        exitCode: 0,
        stdout: 'bundled',
        stderr: '',
      };
    }

    if (args[0] === 'install' && args[1] === '--all') {
      return {
        exitCode: 0,
        stdout: 'installed',
        stderr: '',
      };
    }

    if (args.includes('assembleHap')) {
      const hapPath = path.join(
        options.cwd,
        'entry',
        'build',
        'default',
        'outputs',
        'default',
        'entry-default-signed.hap',
      );
      await fs.outputFile(hapPath, 'hap');
      return {
        exitCode: 0,
        stdout: 'built',
        stderr: '',
      };
    }

    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
    };
  };
}

describe('bundle and HAP build reports', () => {
  it('falls back to managed empty autolinking artifacts when the Harmony CLI package is missing', async () => {
    const projectRoot = await createTempFixture(minimalSampleRoot);

    await removeHarmonyCliFromFixture(projectRoot);

    const initResult = await initProject(projectRoot, true);

    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/RNOHPackagesFactory.ets');
    expect(
      await fs.readFile(
        path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
        'utf8',
      ),
    ).toContain('return [');
  }, 120000);

  it('fails init and sync when the Harmony CLI exists but link-harmony throws', async () => {
    const projectRoot = await createTempFixture(minimalSampleRoot);

    await installFakeHarmonyCli(projectRoot, FAKE_THROWING_LINK_HARMONY_MODULE);

    await expect(initProject(projectRoot, true)).rejects.toThrow(
      'Harmony autolinking failed during link-harmony.',
    );
    await expect(syncProjectTemplate(projectRoot, true)).rejects.toThrow(
      'simulated link failure',
    );
  }, 120000);

  it('returns failed bundle and HAP reports when autolinking output generation is incomplete', async () => {
    const projectRoot = await createTempFixture(minimalSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    const runner = createSuccessfulRunner();

    await installFakeHarmonyCli(projectRoot, FAKE_NOOP_LINK_HARMONY_MODULE);

    const bundleReport = await bundleProject(projectRoot, { runner });

    expect(bundleReport.status).toBe('failed');
    expect(bundleReport.blockingIssues[0]?.message).toContain(
      'Harmony autolinking failed during validate-generated-files.',
    );
    expect(bundleReport.blockingIssues[0]?.message).toContain('RNOHPackagesFactory.ets');
    expect(bundleReport.blockingIssues[0]?.message).toContain('autolinking.cmake');

    const hapReport = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(hapReport.status).toBe('failed');
    expect(hapReport.blockingIssues[0]?.message).toContain(
      'Harmony autolinking failed during validate-generated-files.',
    );
  }, 120000);

  it('chooses index.js for minimal samples and index.harmony.js for router samples', async () => {
    const minimalRoot = await createTempFixture(minimalSampleRoot);
    const routerRoot = await createTempFixture(appShellSampleRoot);
    const runner = createSuccessfulRunner();

    await initProject(minimalRoot, true);
    await initProject(routerRoot, true);

    const minimalReport = await bundleProject(minimalRoot, { runner });
    const routerReport = await bundleProject(routerRoot, { runner });

    expect(minimalReport.status).toBe('succeeded');
    expect(minimalReport.entryFile).toBe(path.join(minimalRoot, 'index.js'));
    expect(routerReport.status).toBe('succeeded');
    expect(routerReport.entryFile).toBe(path.join(routerRoot, 'index.harmony.js'));
  }, 120000);

  it('builds a debug HAP for the official native capabilities sample with preview routes enabled', async () => {
    const projectRoot = await createTempFixture(nativeCapabilitiesSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    const runner = createSuccessfulRunner();

    await initProject(projectRoot, true);

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(report.artifactPaths.some((artifactPath) => artifactPath.endsWith('.hap'))).toBe(true);
  }, 120000);

  it('force-refreshes build-required autolinking files without overwriting unrelated drifted templates', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const runner = createSuccessfulRunner();

    await initProject(projectRoot, true);

    const cppFactoryPath = path.join(
      projectRoot,
      'harmony',
      'entry',
      'src',
      'main',
      'cpp',
      'RNOHPackagesFactory.h',
    );
    const metroConfigPath = path.join(projectRoot, 'metro.harmony.config.js');
    const originalCppFactory = await fs.readFile(cppFactoryPath, 'utf8');

    await fs.writeFile(cppFactoryPath, '// drifted autolinking factory\n');
    await fs.writeFile(metroConfigPath, '// drifted metro config\n');

    const report = await bundleProject(projectRoot, {
      runner,
      skipTemplateSync: true,
    });

    expect(report.status).toBe('succeeded');
    expect(await fs.readFile(cppFactoryPath, 'utf8')).toBe(originalCppFactory);
    expect(await fs.readFile(metroConfigPath, 'utf8')).toBe('// drifted metro config\n');
    expect(report.warnings.some((warning) => warning.includes('metro.harmony.config.js'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('RNOHPackagesFactory.h'))).toBe(false);
  }, 120000);

  it('temporarily strips the legacy reanimated class-component invariant for React 19 Harmony bundles', async () => {
    const projectRoot = await createTempFixture(uiStackSampleRoot);

    await initProject(projectRoot, true);

    const reanimatedSourcePath = path.join(
      projectRoot,
      'node_modules',
      'react-native-reanimated',
      'src',
      'createAnimatedComponent',
      'createAnimatedComponent.tsx',
    );
    const reanimatedModulePath = path.join(
      projectRoot,
      'node_modules',
      'react-native-reanimated',
      'lib',
      'module',
      'createAnimatedComponent',
      'createAnimatedComponent.js',
    );
    const legacySourceContents = [
      "import invariant from 'invariant';",
      'export function createAnimatedComponent(Component: any): any {',
      '  invariant(',
      "    typeof Component !== 'function' ||",
      '      (Component.prototype && Component.prototype.isReactComponent),',
      "    `Looks like you're passing a function component \\`${Component.name}\\` to \\`createAnimatedComponent\\` function which supports only class components. Please wrap your function component with \\`React.forwardRef()\\` or use a class component instead.`",
      '  );',
      '  return Component;',
      '}',
      '',
    ].join('\n');
    const legacyModuleContents = [
      "import invariant from 'invariant';",
      'export function createAnimatedComponent(Component, options) {',
      "  invariant(typeof Component !== 'function' || Component.prototype && Component.prototype.isReactComponent, `Looks like you're passing a function component \\`${Component.name}\\` to \\`createAnimatedComponent\\` function which supports only class components. Please wrap your function component with \\`React.forwardRef()\\` or use a class component instead.`);",
      '  return Component;',
      '}',
      '',
    ].join('\n');

    await fs.outputFile(reanimatedSourcePath, legacySourceContents);
    await fs.outputFile(reanimatedModulePath, legacyModuleContents);

    let sawPatchedSourcesDuringBundle = false;

    const runner: CommandRunner = async (_file, args) => {
      if (args.includes('bundle-harmony')) {
        const patchedSourceContents = await fs.readFile(reanimatedSourcePath, 'utf8');
        const patchedModuleContents = await fs.readFile(reanimatedModulePath, 'utf8');

        expect(patchedSourceContents).not.toContain('supports only class components');
        expect(patchedSourceContents).not.toContain("import invariant from 'invariant';");
        expect(patchedModuleContents).not.toContain('supports only class components');
        expect(patchedModuleContents).not.toContain("import invariant from 'invariant';");
        sawPatchedSourcesDuringBundle = true;

        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await bundleProject(projectRoot, {
      runner,
      skipTemplateSync: true,
    });

    expect(report.status).toBe('succeeded');
    expect(sawPatchedSourcesDuringBundle).toBe(true);
    expect(await fs.readFile(reanimatedSourcePath, 'utf8')).toBe(legacySourceContents);
    expect(await fs.readFile(reanimatedModulePath, 'utf8')).toBe(legacyModuleContents);
  }, 120000);

  it('persists the legacy reanimated class-component normalization during template sync for React 19 projects', async () => {
    const projectRoot = await createTempFixture(uiStackSampleRoot);

    const reanimatedSourcePath = path.join(
      projectRoot,
      'node_modules',
      'react-native-reanimated',
      'src',
      'createAnimatedComponent',
      'createAnimatedComponent.tsx',
    );
    const reanimatedModulePath = path.join(
      projectRoot,
      'node_modules',
      'react-native-reanimated',
      'lib',
      'module',
      'createAnimatedComponent',
      'createAnimatedComponent.js',
    );
    const legacySourceContents = [
      "import invariant from 'invariant';",
      'export function createAnimatedComponent(Component: any): any {',
      '  invariant(',
      "    typeof Component !== 'function' ||",
      '      (Component.prototype && Component.prototype.isReactComponent),',
      "    `Looks like you're passing a function component \\`${Component.name}\\` to \\`createAnimatedComponent\\` function which supports only class components. Please wrap your function component with \\`React.forwardRef()\\` or use a class component instead.`",
      '  );',
      '  return Component;',
      '}',
      '',
    ].join('\n');
    const legacyModuleContents = [
      "import invariant from 'invariant';",
      'export function createAnimatedComponent(Component, options) {',
      "  invariant(typeof Component !== 'function' || Component.prototype && Component.prototype.isReactComponent, `Looks like you're passing a function component \\`${Component.name}\\` to \\`createAnimatedComponent\\` function which supports only class components. Please wrap your function component with \\`React.forwardRef()\\` or use a class component instead.`);",
      '  return Component;',
      '}',
      '',
    ].join('\n');

    await fs.outputFile(reanimatedSourcePath, legacySourceContents);
    await fs.outputFile(reanimatedModulePath, legacyModuleContents);

    await syncProjectTemplate(projectRoot, false);

    const normalizedSourceContents = await fs.readFile(reanimatedSourcePath, 'utf8');
    const normalizedModuleContents = await fs.readFile(reanimatedModulePath, 'utf8');

    expect(normalizedSourceContents).not.toContain('supports only class components');
    expect(normalizedSourceContents).not.toContain("import invariant from 'invariant';");
    expect(normalizedModuleContents).not.toContain('supports only class components');
    expect(normalizedModuleContents).not.toContain("import invariant from 'invariant';");
  }, 120000);

  it('surfaces build.hap.failed when hvigor exits unsuccessfully', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);

    await initProject(projectRoot, true);

    const runner: CommandRunner = async (_file, args) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'assembleHap failed',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('failed');
    expect(report.blockingIssues.some((issue) => issue.code === 'build.hap.failed')).toBe(true);
  }, 120000);

  it('builds debug and release HAPs when local signing is configured through signing.local.json', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    const runner = createSuccessfulRunner();

    await initProject(projectRoot, true);
    await writeLocalSigningConfig(projectRoot);

    const debugReport = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(debugReport.status).toBe('succeeded');
    expect(debugReport.artifactPaths.some((artifactPath) => artifactPath.endsWith('.hap'))).toBe(true);

    const releaseReport = await buildHapProject(projectRoot, {
      mode: 'release',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(releaseReport.status).toBe('succeeded');
    expect(releaseReport.blockingIssues).toHaveLength(0);
    expect(releaseReport.artifactPaths.some((artifactPath) => artifactPath.endsWith('.hap'))).toBe(true);
  }, 120000);

  it('bootstraps the Harmony sidecar during build-hap when the project has not been initialized yet', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    const runner = createSuccessfulRunner();

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(await fs.pathExists(path.join(projectRoot, 'harmony'))).toBe(true);
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.warnings.some((warning) => warning.includes('env.signing.missing'))).toBe(false);
    expect(report.warnings).not.toContain(
      'Harmony sidecar files are not present yet. Run expo-harmony init before bundle or build-hap.',
    );
  }, 120000);

  it('injects the DevEco SDK and Node runtime environment for CLI HAP builds', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const capturedEnvironments: NodeJS.ProcessEnv[] = [];
    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if ((args[0] === 'install' && args[1] === '--all') || args.includes('assembleHap')) {
        capturedEnvironments.push(options.env);
      }

      if (args[0] === 'install' && args[1] === '--all') {
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(capturedEnvironments).toHaveLength(2);
    for (const capturedEnvironment of capturedEnvironments) {
      expect(capturedEnvironment.DEVECO_SDK_HOME).toBe(path.join(devecoRoot, 'Contents', 'sdk'));
      expect(capturedEnvironment.OHOS_BASE_SDK_HOME).toBe(path.join(devecoRoot, 'Contents', 'sdk'));
      expect(capturedEnvironment.NODE_HOME).toBe(
        path.join(devecoRoot, 'Contents', 'tools', 'node'),
      );
    }
  }, 120000);

  it('normalizes tarball-backed HAR dependencies for ohpm and restores generated package files afterwards', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const harmonyRootPackagePath = path.join(projectRoot, 'harmony', 'oh-package.json5');
    const harmonyEntryPackagePath = path.join(projectRoot, 'harmony', 'entry', 'oh-package.json5');
    const originalRootPackage = await fs.readFile(harmonyRootPackagePath, 'utf8');
    const originalEntryPackage = await fs.readFile(harmonyEntryPackagePath, 'utf8');
    let normalizedRootSpecifier = '';
    let normalizedEntrySpecifier = '';

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const normalizedRootPackage = JSON.parse(await fs.readFile(harmonyRootPackagePath, 'utf8')) as {
          overrides: Record<string, string>;
        };
        const normalizedEntryPackage = JSON.parse(await fs.readFile(harmonyEntryPackagePath, 'utf8')) as {
          dependencies: Record<string, string>;
        };
        normalizedRootSpecifier = normalizedRootPackage.overrides['@rnoh/react-native-openharmony'];
        normalizedEntrySpecifier =
          normalizedEntryPackage.dependencies['@rnoh/react-native-openharmony'];

        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(normalizedRootSpecifier).toContain('expo-harmony-local-deps');
    expect(normalizedRootSpecifier.endsWith('.har')).toBe(false);
    expect(normalizedEntrySpecifier).toContain('expo-harmony-local-deps');
    expect(normalizedEntrySpecifier.endsWith('.har')).toBe(false);
    expect(await fs.readFile(harmonyRootPackagePath, 'utf8')).toBe(originalRootPackage);
    expect(await fs.readFile(harmonyEntryPackagePath, 'utf8')).toBe(originalEntryPackage);
  }, 120000);

  it('temporarily aligns codegen with the normalized local RNOH package when ohpm removes the shim', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const rnohGeneratedTsShimPath = path.join(
      projectRoot,
      'harmony',
      'oh_modules',
      '@rnoh',
      'react-native-openharmony',
      'ts.ts',
    );

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        await fs.remove(rnohGeneratedTsShimPath);
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        expect(await fs.pathExists(rnohGeneratedTsShimPath)).toBe(false);
        expect(await fs.readFile(path.join(options.cwd, 'entry', 'hvigorfile.ts'), 'utf8')).toContain(
          "rnohModulePath: './expo-harmony-local-deps/rnoh-react-native-openharmony-react_native_openharmony'",
        );
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(await fs.pathExists(rnohGeneratedTsShimPath)).toBe(true);
  }, 120000);

  it('temporarily normalizes the project-local RNOH CLI autolinking template for hvigor builds', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const oldAutolinkingTemplate = `
const ETS_RNOH_PACKAGES_FACTORY_TEMPLATE = \`
import type { RNPackageContext, RNOHPackage } from '@rnoh/react-native-openharmony';

export function createRNOHPackages(ctx: RNPackageContext): RNOHPackage[] {
  return [];
}
\`;
`.trimStart();
    const distAutolinkingPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh',
      'react-native-harmony-cli',
      'dist',
      'autolinking',
      'Autolinking.js',
    );
    const srcAutolinkingPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh',
      'react-native-harmony-cli',
      'src',
      'autolinking',
      'Autolinking.ts',
    );
    await fs.outputFile(distAutolinkingPath, oldAutolinkingTemplate);
    await fs.outputFile(srcAutolinkingPath, oldAutolinkingTemplate);

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        for (const autolinkingPath of [distAutolinkingPath, srcAutolinkingPath]) {
          const contents = await fs.readFile(autolinkingPath, 'utf8');
          expect(contents).toContain(
            "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
          );
          expect(contents).toContain(
            'export function createRNOHPackages(ctx: RNPackageContext): RNPackage[] {',
          );
          expect(contents).not.toContain('RNOHPackage[]');
        }

        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(await fs.readFile(distAutolinkingPath, 'utf8')).toBe(oldAutolinkingTemplate);
    expect(await fs.readFile(srcAutolinkingPath, 'utf8')).toBe(oldAutolinkingTemplate);
  }, 120000);

  it('temporarily registers normalized local HAR modules in the Harmony build profile', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const buildProfilePath = path.join(projectRoot, 'harmony', 'build-profile.json5');
    const originalBuildProfile = await fs.readFile(buildProfilePath, 'utf8');
    let sawNormalizedModuleRegistration = false;

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const buildProfileContents = await fs.readFile(buildProfilePath, 'utf8');
        expect(buildProfileContents).toContain('"useNormalizedOHMUrl": true');
        expect(buildProfileContents).toContain('"name": "react_native_openharmony"');
        expect(buildProfileContents).toContain(
          '"srcPath": "./expo-harmony-local-deps/rnoh-react-native-openharmony-react_native_openharmony"',
        );
        sawNormalizedModuleRegistration = true;
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(sawNormalizedModuleRegistration).toBe(true);
    expect(await fs.readFile(buildProfilePath, 'utf8')).toBe(originalBuildProfile);
  }, 120000);

  it('adds a Systrace compatibility shim for normalized no-codegen gesture-handler HARs', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const gestureHandlerHarPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh-tpl',
      'react-native-gesture-handler',
      'harmony',
      'gesture_handler.har',
    );
    await createFakeHarArchive(gestureHandlerHarPath, '@react-native-oh-tpl/react-native-gesture-handler', {
      'src/main/cpp/RnohReactNativeHarmonyGestureHandlerPackage.h':
        '#pragma once\n'
        + '#include "RNOH/Package.h"\n'
        + '\n'
        + 'namespace rnoh {\n'
        + 'class RnohReactNativeHarmonyGestureHandlerPackage : public Package {\n'
        + 'public:\n'
        + '    RnohReactNativeHarmonyGestureHandlerPackage(Package::Context ctx) : Package(ctx) {}\n'
        + '\n'
        + '    EventEmitRequestHandlers createEventEmitRequestHandlers();\n'
        + '\n'
        + '    ComponentInstanceFactoryDelegate::Shared createComponentInstanceFactoryDelegate();\n'
        + '\n'
        + '    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers() override;\n'
        + '};\n'
        + '} // namespace rnoh\n',
      'src/main/cpp/RnohReactNativeHarmonyGestureHandlerPackage.cpp':
        '#pragma once\n'
        + '#include "RnohReactNativeHarmonyGestureHandlerPackage.h"\n'
        + '#include "RNOH/RNInstanceCAPI.h"\n'
        + '#include "componentInstances/RNGestureHandlerButtonComponentInstance.h"\n'
        + '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n'
        + '#include <react/renderer/debug/SystraceSection.h>\n'
        + '\n'
        + 'using namespace rnoh;\n'
        + 'using namespace facebook;\n'
        + '\n'
        + 'ComponentInstanceFactoryDelegate::Shared\n'
        + 'RnohReactNativeHarmonyGestureHandlerPackage::createComponentInstanceFactoryDelegate() {\n'
        + '    return nullptr;\n'
        + '}\n'
        + '\n'
        + 'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {\n'
        + '    return {};\n'
        + '}\n',
      'src/main/ets/rnoh/RNGestureHandlerModule.ts':
        'import { TurboModule } from "@rnoh/react-native-openharmony/ts"\n'
        + 'import { TM } from "@rnoh/react-native-openharmony/generated/ts"\n'
        + 'export class RNGestureHandlerModule extends TurboModule implements TM.RNGestureHandlerModule.Spec {}\n',
    });

    const harmonyRootPackagePath = path.join(projectRoot, 'harmony', 'oh-package.json5');
    const harmonyRootPackage = JSON5.parse(await fs.readFile(harmonyRootPackagePath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    harmonyRootPackage.dependencies['@react-native-oh-tpl/react-native-gesture-handler'] =
      'file:../node_modules/@react-native-oh-tpl/react-native-gesture-handler/harmony/gesture_handler.har';
    await fs.writeFile(harmonyRootPackagePath, JSON.stringify(harmonyRootPackage, null, 2) + '\n');

    let sawCompatibilityShim = false;

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const compatibilityShimPath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-gesture-handler-gesture_handler',
          'src',
          'main',
          'cpp',
          'react',
          'renderer',
          'debug',
          'SystraceSection.h',
        );
        expect(await fs.readFile(compatibilityShimPath, 'utf8')).toContain(
          '#include <cxxreact/SystraceSection.h>',
        );
        const normalizedGestureHandlerCppRoot = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-gesture-handler-gesture_handler',
          'src',
          'main',
          'cpp',
        );
        const normalizedButtonDescriptorPath = path.join(
          normalizedGestureHandlerCppRoot,
          'generated',
          'RNGestureHandlerButtonComponentDescriptor.h',
        );
        const normalizedRootViewDescriptorPath = path.join(
          normalizedGestureHandlerCppRoot,
          'generated',
          'RNGestureHandlerRootViewComponentDescriptor.h',
        );
        expect(await fs.readFile(normalizedButtonDescriptorPath, 'utf8')).toContain(
          'using RNGestureHandlerButtonShadowNode = ConcreteViewShadowNode<RNGestureHandlerButtonComponentName>;',
        );
        expect(await fs.readFile(normalizedRootViewDescriptorPath, 'utf8')).toContain(
          'using RNGestureHandlerRootViewComponentDescriptor = ConcreteComponentDescriptor<RNGestureHandlerRootViewShadowNode>;',
        );
        const normalizedPackageHeaderPath = path.join(
          normalizedGestureHandlerCppRoot,
          'RnohReactNativeHarmonyGestureHandlerPackage.h',
        );
        const normalizedPackageHeaderContents = await fs.readFile(
          normalizedPackageHeaderPath,
          'utf8',
        );
        expect(normalizedPackageHeaderContents).toContain(
          'createComponentDescriptorProviders() override;',
        );
        expect(normalizedPackageHeaderContents).toContain(
          'createComponentJSIBinderByName() override;',
        );
        const normalizedPackageSourcePath = path.join(
          normalizedGestureHandlerCppRoot,
          'RnohReactNativeHarmonyGestureHandlerPackage.cpp',
        );
        const normalizedPackageSourceContents = await fs.readFile(
          normalizedPackageSourcePath,
          'utf8',
        );
        expect(normalizedPackageSourceContents).toContain(
          'class RNGestureHandlerComponentJSIBinder : public ViewComponentJSIBinder',
        );
        expect(normalizedPackageSourceContents).toContain(
          'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders()',
        );
        expect(normalizedPackageSourceContents).toContain(
          'RnohReactNativeHarmonyGestureHandlerPackage::createComponentJSIBinderByName()',
        );
        const normalizedTurboModulePath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-gesture-handler-gesture_handler',
          'src',
          'main',
          'ets',
          'rnoh',
          'RNGestureHandlerModule.ts',
        );
        const normalizedTurboModuleContents = await fs.readFile(normalizedTurboModulePath, 'utf8');
        expect(normalizedTurboModuleContents).not.toContain(
          '@rnoh/react-native-openharmony/generated/ts',
        );
        expect(normalizedTurboModuleContents).not.toContain(
          'implements TM.RNGestureHandlerModule.Spec',
        );
        sawCompatibilityShim = true;

        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(sawCompatibilityShim).toBe(true);
  }, 120000);

  it('temporarily strips incompatible gesture-handler Harmony codegen metadata during build-hap', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const gestureHandlerPackageJsonPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh-tpl',
      'react-native-gesture-handler',
      'package.json',
    );
    await fs.outputFile(
      gestureHandlerPackageJsonPath,
      JSON.stringify(
        {
          name: '@react-native-oh-tpl/react-native-gesture-handler',
          version: '2.14.17-rc.2',
          harmony: {
            alias: 'react-native-gesture-handler',
            codegenConfig: {
              specPaths: ['./src/specs'],
            },
            redirectInternalImports: true,
          },
        },
        null,
        2,
      ) + '\n',
    );
    const originalPackageJsonContents = await fs.readFile(gestureHandlerPackageJsonPath, 'utf8');
    let sawNormalizedPackageJson = false;

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const gestureHandlerPackageJson = await fs.readJson(gestureHandlerPackageJsonPath);
        expect(gestureHandlerPackageJson.harmony?.codegenConfig).toBeUndefined();
        sawNormalizedPackageJson = true;

        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(sawNormalizedPackageJson).toBe(true);
    expect(await fs.readFile(gestureHandlerPackageJsonPath, 'utf8')).toBe(originalPackageJsonContents);
  }, 120000);

  it('rewrites svg compatibility shims during local HAR normalization', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const svgHarPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh-tpl',
      'react-native-svg',
      'harmony',
      'svg.har',
    );
    await createFakeHarArchive(svgHarPath, '@react-native-oh-tpl/react-native-svg', {
      'src/main/cpp/generated/react/renderer/components/react_native_svg/Props.h':
        'auto map = (butter::map<std::string, RawValue>)value;\n',
      'src/main/cpp/componentInstances/RNSVGPathComponentInstance.h': 'Float m_cacheScale;\n',
      'src/main/cpp/svgImage/RNSVGImageComponentDescriptor.h':
        'void adopt(ShadowNode::Unshared const &shadowNode) const override {\n'
        + '  ConcreteComponentDescriptor::adopt(shadowNode);\n'
        + '  auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);\n'
        + '  imageShadowNode->setImageManager(imageManager_);\n'
        + '}\n',
      'src/main/cpp/svgImage/RNSVGImageShadowNode.h':
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>\n'
        + 'static RNSVGImageState initialStateData(ShadowNodeFragment const &fragment,\n'
        + '                                            ShadowNodeFamilyFragment const &familyFragment,\n'
        + '                                            ComponentDescriptor const &componentDescriptor) {\n'
        + '  auto imageSource = ImageSource{ImageSource::Type::Invalid};\n'
        + '  return {imageSource, {imageSource, nullptr, {}}};\n'
        + '}\n',
    });

    const harmonyRootPackagePath = path.join(projectRoot, 'harmony', 'oh-package.json5');
    const harmonyRootPackage = JSON5.parse(await fs.readFile(harmonyRootPackagePath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    harmonyRootPackage.dependencies['@react-native-oh-tpl/react-native-svg'] =
      'file:../node_modules/@react-native-oh-tpl/react-native-svg/harmony/svg.har';
    await fs.writeFile(harmonyRootPackagePath, JSON.stringify(harmonyRootPackage, null, 2) + '\n');

    let sawSvgCompatibilityRewrite = false;

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const svgGeneratedPropsPath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-svg-svg',
          'src',
          'main',
          'cpp',
          'generated',
          'react',
          'renderer',
          'components',
          'react_native_svg',
          'Props.h',
        );
        const rewrittenContents = await fs.readFile(svgGeneratedPropsPath, 'utf8');
        expect(rewrittenContents).toContain('std::unordered_map<std::string, RawValue>');
        expect(rewrittenContents).not.toContain('butter::map<std::string, RawValue>');
        const svgPathComponentInstancePath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-svg-svg',
          'src',
          'main',
          'cpp',
          'componentInstances',
          'RNSVGPathComponentInstance.h',
        );
        const rewrittenPathComponentInstance = await fs.readFile(svgPathComponentInstancePath, 'utf8');
        expect(rewrittenPathComponentInstance).toContain('facebook::react::Float m_cacheScale;');
        expect(rewrittenPathComponentInstance).not.toMatch(/^\s*Float m_cacheScale;/m);
        const svgImageComponentDescriptorPath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-svg-svg',
          'src',
          'main',
          'cpp',
          'svgImage',
          'RNSVGImageComponentDescriptor.h',
        );
        const rewrittenImageComponentDescriptor = await fs.readFile(
          svgImageComponentDescriptorPath,
          'utf8',
        );
        expect(rewrittenImageComponentDescriptor).toContain(
          'void adopt(ShadowNode& shadowNode) const override {',
        );
        expect(rewrittenImageComponentDescriptor).not.toContain(
          'void adopt(ShadowNode::Unshared const &shadowNode) const override {',
        );
        expect(rewrittenImageComponentDescriptor).toContain(
          'auto& imageShadowNode = static_cast<RNSVGImageShadowNode&>(shadowNode);',
        );
        expect(rewrittenImageComponentDescriptor).not.toContain(
          'auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);',
        );
        expect(rewrittenImageComponentDescriptor).toContain(
          'imageShadowNode.setImageManager(imageManager_);',
        );
        expect(rewrittenImageComponentDescriptor).not.toContain(
          'imageShadowNode->setImageManager(imageManager_);',
        );
        const svgImageShadowNodePath = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
          'react-native-oh-tpl-react-native-svg-svg',
          'src',
          'main',
          'cpp',
          'svgImage',
          'RNSVGImageShadowNode.h',
        );
        const rewrittenImageShadowNode = await fs.readFile(svgImageShadowNodePath, 'utf8');
        expect(rewrittenImageShadowNode).toContain(
          '#include <react/renderer/core/ShadowNodeFamily.h>',
        );
        expect(rewrittenImageShadowNode).toContain(
          'static RNSVGImageState initialStateData(const Props::Shared& /*props*/,',
        );
        expect(rewrittenImageShadowNode).toContain(
          'const ShadowNodeFamily::Shared& /*family*/,',
        );
        expect(rewrittenImageShadowNode).toContain(
          'const ComponentDescriptor& /*componentDescriptor*/) {',
        );
        expect(rewrittenImageShadowNode).not.toContain(
          'static RNSVGImageState initialStateData(ShadowNodeFragment const &fragment,',
        );
        sawSvgCompatibilityRewrite = true;

        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(sawSvgCompatibilityRewrite).toBe(true);
  }, 120000);

  it('bumps reanimated native compile definitions to the current RN minor during local HAR normalization', async () => {
    const projectRoot = await createTempFixture(uiStackSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await initProject(projectRoot, true);

    const reanimatedHarPath = path.join(
      projectRoot,
      'node_modules',
      '@react-native-oh-tpl',
      'react-native-reanimated',
      'harmony',
      'reanimated.har',
    );
    await createFakeHarArchive(reanimatedHarPath, '@react-native-oh-tpl/react-native-reanimated', {
      'src/main/cpp/CMakeLists.txt': 'add_compile_definitions(REACT_NATIVE_MINOR_VERSION=72)\n',
      'src/main/cpp/Common/cpp/Fabric/ReanimatedMountHook.h':
        'void shadowTreeDidMount(\n  RootShadowNode::Shared const &rootShadowNode,\n  double mountTime) noexcept override;\n',
      'src/main/cpp/Common/cpp/Fabric/ReanimatedMountHook.cpp':
        'void ReanimatedMountHook::shadowTreeDidMount(\n  RootShadowNode::Shared const &,\n  double) noexcept {}\n',
      'src/main/cpp/Common/cpp/NativeModules/NativeReanimatedModule.cpp':
        '#include <react/renderer/core/TraitCast.h>\n'
        + '#include <react/utils/CoreFeatures.h>\n'
        + 'auto shadowNode = shadowNodeFromValue(rt, shadowNodeWrapper);\n'
        + 'ShadowNode::Shared commandShadowNode = shadowNodeFromValue(rt, shadowNodeValue);\n'
        + 'auto measuredShadowNode = shadowNodeFromValue(rt, shadowNodeValue);\n'
        + 'auto layoutableShadowNode = traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get());\n'
        + '#if REACT_NATIVE_MINOR_VERSION >= 73 && defined(RCT_NEW_ARCH_ENABLED)\n'
        + '// Android can\'t find the definition of this static field\n'
        + 'bool CoreFeatures::useNativeState;\n'
        + '#endif\n'
        + '#if REACT_NATIVE_MINOR_VERSION >= 72\n'
        + '              /* .mountSynchronously = */ true,\n'
        + '#endif\n'
        + '              /* .shouldYield = */ [this]() {\n'
        + '                return propsRegistry_->shouldReanimatedSkipCommit();\n'
        + '              }\n',
    });

    let sawReanimatedCompatibilityRewrite = false;

    const runner: CommandRunner = async (_file, args, options) => {
      if (args.includes('bundle-harmony')) {
        const bundleOutput = args[args.indexOf('--bundle-output') + 1];
        const assetsDest = args[args.indexOf('--assets-dest') + 1];
        await fs.outputFile(bundleOutput, '__d(function(){})\n');
        await fs.ensureDir(assetsDest);
        return {
          exitCode: 0,
          stdout: 'bundled',
          stderr: '',
        };
      }

      if (args[0] === 'install' && args[1] === '--all') {
        const normalizedDepsRoot = path.join(
          projectRoot,
          'harmony',
          'expo-harmony-local-deps',
        );
        const reanimatedDirectoryName = (await fs.readdir(normalizedDepsRoot)).find((entry) =>
          entry.startsWith('react-native-oh-tpl-react-native-reanimated-'),
        );
        expect(reanimatedDirectoryName).toBeDefined();
        const reanimatedCmakeListsPath = path.join(
          normalizedDepsRoot,
          reanimatedDirectoryName!,
          'src',
          'main',
          'cpp',
          'CMakeLists.txt',
        );
        const rewrittenContents = await fs.readFile(reanimatedCmakeListsPath, 'utf8');
        expect(rewrittenContents).toContain('REACT_NATIVE_MINOR_VERSION=82');
        expect(rewrittenContents).not.toContain('REACT_NATIVE_MINOR_VERSION=72');
        const reanimatedMountHookHeaderPath = path.join(
          normalizedDepsRoot,
          reanimatedDirectoryName!,
          'src',
          'main',
          'cpp',
          'Common',
          'cpp',
          'Fabric',
          'ReanimatedMountHook.h',
        );
        const rewrittenMountHookHeader = await fs.readFile(reanimatedMountHookHeaderPath, 'utf8');
        expect(rewrittenMountHookHeader).toContain('HighResTimeStamp mountTime) noexcept override;');
        expect(rewrittenMountHookHeader).not.toContain('double mountTime) noexcept override;');
        const reanimatedMountHookSourcePath = path.join(
          normalizedDepsRoot,
          reanimatedDirectoryName!,
          'src',
          'main',
          'cpp',
          'Common',
          'cpp',
          'Fabric',
          'ReanimatedMountHook.cpp',
        );
        const rewrittenMountHookSource = await fs.readFile(reanimatedMountHookSourcePath, 'utf8');
        expect(rewrittenMountHookSource).toContain('HighResTimeStamp) noexcept {');
        expect(rewrittenMountHookSource).not.toContain('double) noexcept {');
        const nativeReanimatedModuleSourcePath = path.join(
          normalizedDepsRoot,
          reanimatedDirectoryName!,
          'src',
          'main',
          'cpp',
          'Common',
          'cpp',
          'NativeModules',
          'NativeReanimatedModule.cpp',
        );
        const rewrittenNativeReanimatedModuleSource = await fs.readFile(
          nativeReanimatedModuleSourcePath,
          'utf8',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          '#include <react/renderer/core/LayoutableShadowNode.h>',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          '#include <react/renderer/core/TraitCast.h>',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          '#include <react/utils/CoreFeatures.h>',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          'dynamic_cast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          'traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          'auto shadowNode = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeWrapper);',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          'auto shadowNode = shadowNodeFromValue(rt, shadowNodeWrapper);',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          'auto commandShadowNode = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeValue);',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          'ShadowNode::Shared commandShadowNode = shadowNodeFromValue(rt, shadowNodeValue);',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          'auto measuredShadowNode = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeValue);',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          'auto measuredShadowNode = shadowNodeFromValue(rt, shadowNodeValue);',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          'bool CoreFeatures::useNativeState;',
        );
        expect(rewrittenNativeReanimatedModuleSource).toContain(
          '/* .source = */ ShadowTree::CommitSource::Unknown',
        );
        expect(rewrittenNativeReanimatedModuleSource).not.toContain(
          '/* .shouldYield = */ [this]() {',
        );
        sawReanimatedCompatibilityRewrite = true;

        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      }

      if (args.includes('assembleHap')) {
        const hapPath = path.join(
          options.cwd,
          'entry',
          'build',
          'default',
          'outputs',
          'default',
          'entry-default-unsigned.hap',
        );
        await fs.outputFile(hapPath, 'hap');
        return {
          exitCode: 0,
          stdout: 'built',
          stderr: '',
        };
      }

      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    };

    const report = await buildHapProject(projectRoot, {
      mode: 'debug',
      runner,
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('succeeded');
    expect(sawReanimatedCompatibilityRewrite).toBe(true);
  }, 120000);
});
