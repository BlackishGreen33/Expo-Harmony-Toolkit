import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { buildHapProject, bundleProject, CommandRunner } from '../src/core/build';
import { initProject } from '../src/core/template';

const minimalSampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');

async function createTempFixture(sourceRoot: string): Promise<string> {
  const tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-build-'));
  const tempRoot = path.join(tempBase, 'project');
  await fs.copy(sourceRoot, tempRoot, {
    filter: (sourcePath) => !sourcePath.includes(`${path.sep}node_modules`),
  });
  await fs.ensureDir(path.join(tempRoot, 'node_modules', 'react-native'));
  await fs.outputFile(path.join(tempRoot, 'node_modules', 'react-native', 'cli.js'), '');
  return tempRoot;
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

  it('builds a debug HAP through the fake runner and preserves release signing checks', async () => {
    const projectRoot = await createTempFixture(appShellSampleRoot);
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    const runner = createSuccessfulRunner();

    await initProject(projectRoot, true);

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

    expect(releaseReport.status).toBe('failed');
    expect(releaseReport.blockingIssues.some((issue) => issue.code === 'env.signing.missing')).toBe(true);
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
});
