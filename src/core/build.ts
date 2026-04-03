import fs from 'fs-extra';
import path from 'path';
import { buildEnvReport } from './env';
import { normalizeKnownJavaScriptDependencies } from './javascriptDependencies';
import { loadProject } from './project';
import {
  BUILD_REQUIRED_MANAGED_FILE_PATHS,
  buildDesiredPackageScripts,
  resolveHarmonyBundleEntryFile,
  syncProjectTemplate,
  usesExpoRouter,
} from './template';
import { normalizeKnownHarmonyPackageJsons } from './autolinking';
import type { BuildReport, BlockingIssue } from '../types';
import {
  alignRnohCodegenWithNormalizedLocalPackage,
  ensureHarmonyBuildProfileSupportsNormalizedLocalDeps,
  ensureRnohGeneratedTsShim,
  findHarmonyArtifacts,
  normalizeLocalHarDependencies,
} from './build/localHar';
import {
  buildInvocation,
  createHarmonyBuildEnvironment,
  defaultCommandRunner,
} from './build/commands';
import type { CommandRunner } from './build/commands';
import {
  createBuildReport,
  createStepReport,
  getAssetsOutputPath,
  getBundleOutputPath,
  renderBuildReport,
} from './build/reporting';
import { normalizeProjectRnohCliAutolinkingTemplates } from './build/rnohCompatibility';

export type { CommandRunner, CommandRunnerResult } from './build/commands';
export { renderBuildReport } from './build/reporting';

interface BundleProjectOptions {
  env?: NodeJS.ProcessEnv;
  runner?: CommandRunner;
  skipTemplateSync?: boolean;
}

interface BuildHapProjectOptions {
  mode: 'debug' | 'release';
  env?: NodeJS.ProcessEnv;
  runner?: CommandRunner;
}

export async function bundleProject(
  projectRoot: string,
  options: BundleProjectOptions = {},
): Promise<BuildReport> {
  const runtimeEnv = options.env ?? process.env;
  const runCommand = options.runner ?? defaultCommandRunner;
  const loadedProject = await loadProject(projectRoot);
  const bundleOutputPath = getBundleOutputPath(loadedProject.projectRoot);
  const assetsDestPath = getAssetsOutputPath(loadedProject.projectRoot);
  const entryFileName = resolveHarmonyBundleEntryFile(loadedProject.packageJson);
  const entryFilePath = path.join(loadedProject.projectRoot, entryFileName);
  const metroConfigPath = path.join(loadedProject.projectRoot, 'metro.harmony.config.js');
  const reactNativeCliPath = path.join(loadedProject.projectRoot, 'node_modules', 'react-native', 'cli.js');
  const warnings: string[] = [];
  const blockingIssues: BlockingIssue[] = [];

  try {
    const syncResult = await syncProjectTemplate(loadedProject.projectRoot, false, {
      forceManagedPaths: BUILD_REQUIRED_MANAGED_FILE_PATHS,
      skipJavaScriptDependencyNormalization: options.skipTemplateSync,
    });
    warnings.push(...syncResult.warnings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'bundle',
      mode: null,
      status: 'failed',
      entryFile: entryFilePath,
      bundleOutputPath,
      assetsDestPath,
      artifactPaths: [],
      blockingIssues: [
        {
          code: 'build.bundle.failed',
          message,
        },
      ],
      warnings,
      steps: [],
    });
  }

  if (!(await fs.pathExists(reactNativeCliPath))) {
    blockingIssues.push({
      code: 'build.bundle.failed',
      message: `React Native CLI was not found at ${reactNativeCliPath}. Run your package manager install first.`,
    });
  }

  if (!(await fs.pathExists(entryFilePath))) {
    blockingIssues.push({
      code: 'build.bundle.failed',
      message: `Expected Harmony entry file ${entryFileName} does not exist yet. Run expo-harmony init first.`,
    });
  }

  if (!(await fs.pathExists(metroConfigPath))) {
    blockingIssues.push({
      code: 'build.bundle.failed',
      message: 'metro.harmony.config.js is missing. Run expo-harmony init first.',
    });
  }

  const initialReport = createBuildReport({
    projectRoot: loadedProject.projectRoot,
    command: 'bundle',
    mode: null,
    status: blockingIssues.length === 0 ? 'succeeded' : 'failed',
    entryFile: entryFilePath,
    bundleOutputPath,
    assetsDestPath,
    artifactPaths: [],
    blockingIssues,
    warnings,
    steps: [],
  });

  if (blockingIssues.length > 0) {
    initialReport.status = 'failed';
    return initialReport;
  }

  await fs.ensureDir(path.dirname(bundleOutputPath));
  await fs.ensureDir(assetsDestPath);

  const bundleEnvironment: NodeJS.ProcessEnv = { ...runtimeEnv };
  if (usesExpoRouter(loadedProject.packageJson)) {
    bundleEnvironment.EXPO_ROUTER_APP_ROOT = bundleEnvironment.EXPO_ROUTER_APP_ROOT ?? 'app';
  }

  let restoreNormalizedJavaScriptDependencies = async () => {};
  try {
    restoreNormalizedJavaScriptDependencies = await normalizeKnownJavaScriptDependencies(
      loadedProject.projectRoot,
      loadedProject.packageJson as Record<string, unknown>,
      { restoreOnCompletion: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'bundle',
      mode: null,
      status: 'failed',
      entryFile: entryFilePath,
      bundleOutputPath,
      assetsDestPath,
      artifactPaths: [],
      blockingIssues: [
        {
          code: 'build.bundle.failed',
          message,
        },
      ],
      warnings,
      steps: [],
    });
  }

  const bundleArgs = [
    reactNativeCliPath,
    'bundle-harmony',
    '--reset-cache',
    '--dev',
    'false',
    '--entry-file',
    entryFilePath,
    '--bundle-output',
    bundleOutputPath,
    '--assets-dest',
    assetsDestPath,
    '--config',
    metroConfigPath,
  ];
  const bundleCommand = buildInvocation(process.execPath, bundleArgs);
  try {
    const bundleResult = await runCommand(bundleCommand.file, bundleCommand.args, {
      cwd: loadedProject.projectRoot,
      env: bundleEnvironment,
    });
    const steps = [
      createStepReport('bundle-harmony', bundleCommand.file, bundleCommand.args, loadedProject.projectRoot, bundleResult.exitCode),
    ];

    if (bundleResult.exitCode !== 0 || !(await fs.pathExists(bundleOutputPath))) {
      return createBuildReport({
        projectRoot: loadedProject.projectRoot,
        command: 'bundle',
        mode: null,
        status: 'failed',
        entryFile: entryFilePath,
        bundleOutputPath,
        assetsDestPath,
        artifactPaths: [],
        blockingIssues: [
          {
            code: 'build.bundle.failed',
            message:
              bundleResult.stderr.trim() ||
              bundleResult.stdout.trim() ||
              'react-native bundle-harmony failed before bundle.harmony.js was produced.',
          },
        ],
        warnings,
        steps,
      });
    }

    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'bundle',
      mode: null,
      status: 'succeeded',
      entryFile: entryFilePath,
      bundleOutputPath,
      assetsDestPath,
      artifactPaths: [bundleOutputPath],
      blockingIssues: [],
      warnings,
      steps,
    });
  } finally {
    await restoreNormalizedJavaScriptDependencies();
  }
}

export async function buildHapProject(
  projectRoot: string,
  options: BuildHapProjectOptions,
): Promise<BuildReport> {
  const runtimeEnv = options.env ?? process.env;
  const runCommand = options.runner ?? defaultCommandRunner;
  const loadedProject = await loadProject(projectRoot);
  const envReport = await buildEnvReport(loadedProject.projectRoot, {
    env: runtimeEnv,
  });
  const relevantEnvAdvisories = envReport.advisories.filter(
    (issue) => options.mode === 'release' || issue.code !== 'env.signing.missing',
  );
  const warnings = [
    ...envReport.warnings.filter(
      (warning) => !warning.startsWith('Harmony sidecar files are not present yet.'),
    ),
    ...relevantEnvAdvisories.map((issue) => `${issue.code}: ${issue.message}`),
  ];
  const blockingIssues: BlockingIssue[] = [];

  if (!envReport.hvigorPath) {
    blockingIssues.push({
      code: 'build.hap.failed',
      message: 'Hvigor is not available. Run expo-harmony env to inspect the local DevEco setup.',
    });
  }

  if (!envReport.ohpmPath) {
    blockingIssues.push({
      code: 'build.hap.failed',
      message: 'ohpm is not available. CLI HAP builds require the DevEco package manager.',
    });
  }

  if (options.mode === 'release' && !envReport.signingConfigured) {
    blockingIssues.push({
      code: 'env.signing.missing',
      message:
        'Release HAP builds require signingConfigs from .expo-harmony/signing.local.json or harmony/build-profile.json5. Start from .expo-harmony/signing.local.example.json and replace the placeholder credentials.',
    });
  }

  if (blockingIssues.length > 0) {
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'build-hap',
      mode: options.mode,
      status: 'failed',
      entryFile: path.join(
        loadedProject.projectRoot,
        resolveHarmonyBundleEntryFile(loadedProject.packageJson),
      ),
      bundleOutputPath: getBundleOutputPath(loadedProject.projectRoot),
      assetsDestPath: getAssetsOutputPath(loadedProject.projectRoot),
      artifactPaths: [],
      blockingIssues,
      warnings,
      steps: [],
    });
  }

  const bundleReport = await bundleProject(loadedProject.projectRoot, {
    env: runtimeEnv,
    runner: runCommand,
  });
  const harmonyProjectRoot = envReport.harmonyProjectRoot ?? path.join(loadedProject.projectRoot, 'harmony');

  if (bundleReport.status === 'failed') {
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'build-hap',
      mode: options.mode,
      status: 'failed',
      harmonyProjectRoot,
      entryFile: bundleReport.entryFile,
      bundleOutputPath: bundleReport.bundleOutputPath,
      assetsDestPath: bundleReport.assetsDestPath,
      artifactPaths: [],
      blockingIssues: bundleReport.blockingIssues,
      warnings: [...warnings, ...bundleReport.warnings],
      steps: bundleReport.steps,
    });
  }

  if (!(await fs.pathExists(harmonyProjectRoot))) {
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'build-hap',
      mode: options.mode,
      status: 'failed',
      harmonyProjectRoot,
      entryFile: bundleReport.entryFile,
      bundleOutputPath: bundleReport.bundleOutputPath,
      assetsDestPath: bundleReport.assetsDestPath,
      artifactPaths: [],
      blockingIssues: [
        {
          code: 'build.hap.failed',
          message:
            'Harmony sidecar files are still missing after bundle sync. Run expo-harmony init --force to inspect template drift.',
        },
      ],
      warnings: [...warnings, ...bundleReport.warnings],
      steps: bundleReport.steps,
    });
  }

  const steps = [...bundleReport.steps];
  const buildEnvironment = createHarmonyBuildEnvironment(runtimeEnv, envReport);
  let normalizedLocalHarPackages = [] as Awaited<ReturnType<typeof normalizeLocalHarDependencies>>['packages'];
  let restoreNormalizedDependencies = async () => {};
  let restoreNormalizedLocalHarModules = async () => {};
  let restoreNormalizedRnohCliAutolinkingTemplates = async () => {};
  let restoreNormalizedRnohCodegenAlignment = async () => {};
  let restoreNormalizedHarmonyPackageJsons = async () => {};

  try {
    const normalizedLocalHarDependencies = await normalizeLocalHarDependencies(harmonyProjectRoot);
    normalizedLocalHarPackages = normalizedLocalHarDependencies.packages;
    restoreNormalizedDependencies = normalizedLocalHarDependencies.restore;
    restoreNormalizedLocalHarModules = await ensureHarmonyBuildProfileSupportsNormalizedLocalDeps(
      harmonyProjectRoot,
      normalizedLocalHarDependencies.packages,
    );
    restoreNormalizedRnohCliAutolinkingTemplates =
      await normalizeProjectRnohCliAutolinkingTemplates(loadedProject.projectRoot);
    restoreNormalizedHarmonyPackageJsons =
      await normalizeKnownHarmonyPackageJsons(loadedProject.projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'build-hap',
      mode: options.mode,
      status: 'failed',
      harmonyProjectRoot,
      entryFile: bundleReport.entryFile,
      bundleOutputPath: bundleReport.bundleOutputPath,
      assetsDestPath: bundleReport.assetsDestPath,
      artifactPaths: [],
      blockingIssues: [
        {
          code: 'build.hap.failed',
          message,
        },
      ],
      warnings: [...warnings, ...bundleReport.warnings],
      steps,
    });
  }

  restoreNormalizedRnohCodegenAlignment = await alignRnohCodegenWithNormalizedLocalPackage(
    harmonyProjectRoot,
    normalizedLocalHarPackages,
  );

  const ohpmCommand = buildInvocation(envReport.ohpmPath as string, ['install', '--all']);
  try {
    const ohpmResult = await runCommand(ohpmCommand.file, ohpmCommand.args, {
      cwd: harmonyProjectRoot,
      env: buildEnvironment,
    });
    steps.push(
      createStepReport('ohpm install', ohpmCommand.file, ohpmCommand.args, harmonyProjectRoot, ohpmResult.exitCode),
    );

    if (ohpmResult.exitCode !== 0) {
      return createBuildReport({
        projectRoot: loadedProject.projectRoot,
        command: 'build-hap',
        mode: options.mode,
        status: 'failed',
        harmonyProjectRoot,
        entryFile: bundleReport.entryFile,
        bundleOutputPath: bundleReport.bundleOutputPath,
        assetsDestPath: bundleReport.assetsDestPath,
        artifactPaths: [],
        blockingIssues: [
          {
            code: 'build.hap.failed',
            message:
              ohpmResult.stderr.trim() ||
              ohpmResult.stdout.trim() ||
              'ohpm install failed before the HAP build could start.',
          },
        ],
        warnings: [...warnings, ...bundleReport.warnings],
        steps,
      });
    }

    if (!normalizedLocalHarPackages.some((localPackage) => localPackage.packageName === '@rnoh/react-native-openharmony')) {
      await ensureRnohGeneratedTsShim(harmonyProjectRoot);
    }

    const hvigorCommand = buildInvocation(envReport.hvigorPath as string, [
      'assembleHap',
      '--no-daemon',
      '-p',
      'product=default',
      '-p',
      `buildMode=${options.mode}`,
    ]);
    const hvigorResult = await runCommand(hvigorCommand.file, hvigorCommand.args, {
      cwd: harmonyProjectRoot,
      env: buildEnvironment,
    });
    steps.push(
      createStepReport('hvigor assembleHap', hvigorCommand.file, hvigorCommand.args, harmonyProjectRoot, hvigorResult.exitCode),
    );

    const artifactPaths = await findHarmonyArtifacts(harmonyProjectRoot);

    if (hvigorResult.exitCode !== 0 || artifactPaths.length === 0) {
      return createBuildReport({
        projectRoot: loadedProject.projectRoot,
        command: 'build-hap',
        mode: options.mode,
        status: 'failed',
        harmonyProjectRoot,
        entryFile: bundleReport.entryFile,
        bundleOutputPath: bundleReport.bundleOutputPath,
        assetsDestPath: bundleReport.assetsDestPath,
        artifactPaths,
        blockingIssues: [
          {
            code: 'build.hap.failed',
            message:
              hvigorResult.stderr.trim() ||
              hvigorResult.stdout.trim() ||
              'Hvigor finished without producing any HAP artifacts.',
          },
        ],
        warnings: [...warnings, ...bundleReport.warnings],
        steps,
      });
    }

    return createBuildReport({
      projectRoot: loadedProject.projectRoot,
      command: 'build-hap',
      mode: options.mode,
      status: 'succeeded',
      harmonyProjectRoot,
      entryFile: bundleReport.entryFile,
      bundleOutputPath: bundleReport.bundleOutputPath,
      assetsDestPath: bundleReport.assetsDestPath,
      artifactPaths,
      blockingIssues: [],
      warnings: [...warnings, ...bundleReport.warnings],
      steps,
    });
  } finally {
    await restoreNormalizedHarmonyPackageJsons();
    await restoreNormalizedRnohCodegenAlignment();
    await restoreNormalizedRnohCliAutolinkingTemplates();
    await restoreNormalizedLocalHarModules();
    await restoreNormalizedDependencies();
  }
}

export function getDesiredHarmonyScripts(projectRoot: string): Promise<Record<string, string>> {
  return loadProject(projectRoot).then((loadedProject) => buildDesiredPackageScripts(loadedProject.packageJson));
}
