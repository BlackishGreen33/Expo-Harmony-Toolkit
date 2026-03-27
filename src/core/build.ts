import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import path from 'path';
import { TOOLKIT_VERSION } from './constants';
import { buildEnvReport } from './env';
import { loadProject } from './project';
import {
  buildDesiredPackageScripts,
  resolveHarmonyBundleEntryFile,
  syncProjectTemplate,
  usesExpoRouter,
} from './template';
import { BlockingIssue, BuildReport, BuildStepReport } from '../types';

const execFileAsync = promisify(execFile);

export interface CommandRunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => Promise<CommandRunnerResult>;

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
  const bundleOutputPath = path.join(
    loadedProject.projectRoot,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'rawfile',
    'bundle.harmony.js',
  );
  const assetsDestPath = path.join(
    loadedProject.projectRoot,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'rawfile',
    'assets',
  );
  const entryFileName = resolveHarmonyBundleEntryFile(loadedProject.packageJson);
  const entryFilePath = path.join(loadedProject.projectRoot, entryFileName);
  const metroConfigPath = path.join(loadedProject.projectRoot, 'metro.harmony.config.js');
  const reactNativeCliPath = path.join(loadedProject.projectRoot, 'node_modules', 'react-native', 'cli.js');
  const warnings: string[] = [];
  const blockingIssues: BlockingIssue[] = [];

  if (!options.skipTemplateSync) {
    const syncResult = await syncProjectTemplate(loadedProject.projectRoot, false);
    warnings.push(...syncResult.warnings);
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
  const warnings = [
    ...envReport.warnings.filter(
      (warning) => !warning.startsWith('Harmony sidecar files are not present yet.'),
    ),
    ...envReport.advisories.map((issue) => `${issue.code}: ${issue.message}`),
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
      message: 'Release HAP builds require signingConfigs in harmony/build-profile.json5.',
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
  const ohpmCommand = buildInvocation(envReport.ohpmPath as string, ['install', '--all']);
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
}

export function renderBuildReport(report: BuildReport): string {
  const lines = [
    'Expo Harmony build report',
    `Project: ${report.projectRoot}`,
    `Command: ${report.command}`,
    `Mode: ${report.mode ?? 'n/a'}`,
    `Status: ${report.status}`,
    `Harmony project: ${report.harmonyProjectRoot ?? 'not found'}`,
    `Entry file: ${report.entryFile ?? 'n/a'}`,
    `Bundle output: ${report.bundleOutputPath ?? 'n/a'}`,
    `Artifacts: ${report.artifactPaths.join(', ') || 'none'}`,
    '',
    'Steps:',
    ...report.steps.map(
      (step) => `- [${step.exitCode ?? 'n/a'}] ${step.label}: ${step.command} (cwd ${step.cwd})`,
    ),
  ];

  if (report.blockingIssues.length > 0) {
    lines.push(
      '',
      'Blocking issues:',
      ...report.blockingIssues.map(
        (issue) => `- ${issue.code}: ${issue.message}${issue.subject ? ` (${issue.subject})` : ''}`,
      ),
    );
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}

function getBundleOutputPath(projectRoot: string): string {
  return path.join(
    projectRoot,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'rawfile',
    'bundle.harmony.js',
  );
}

function getAssetsOutputPath(projectRoot: string): string {
  return path.join(
    projectRoot,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'rawfile',
    'assets',
  );
}

function createBuildReport(input: {
  projectRoot: string;
  command: BuildReport['command'];
  mode: BuildReport['mode'];
  status: BuildReport['status'];
  harmonyProjectRoot?: string | null;
  entryFile: string | null;
  bundleOutputPath: string | null;
  assetsDestPath: string | null;
  artifactPaths: string[];
  blockingIssues: BlockingIssue[];
  warnings: string[];
  steps: BuildStepReport[];
}): BuildReport {
  return {
    generatedAt: new Date().toISOString(),
    projectRoot: input.projectRoot,
    toolkitVersion: TOOLKIT_VERSION,
    command: input.command,
    mode: input.mode,
    status: input.status,
    harmonyProjectRoot: input.harmonyProjectRoot ?? path.join(input.projectRoot, 'harmony'),
    entryFile: input.entryFile,
    bundleOutputPath: input.bundleOutputPath,
    assetsDestPath: input.assetsDestPath,
    artifactPaths: input.artifactPaths,
    blockingIssues: input.blockingIssues,
    warnings: input.warnings,
    steps: input.steps,
  };
}

function createStepReport(
  label: string,
  file: string,
  args: string[],
  cwd: string,
  exitCode: number | null,
): BuildStepReport {
  return {
    label,
    command: [file, ...args].join(' '),
    cwd,
    exitCode,
  };
}

function buildInvocation(file: string, args: string[]): { file: string; args: string[] } {
  if (file.endsWith('.js')) {
    return {
      file: process.execPath,
      args: [file, ...args],
    };
  }

  return {
    file,
    args,
  };
}

function createHarmonyBuildEnvironment(
  runtimeEnv: NodeJS.ProcessEnv,
  envReport: Awaited<ReturnType<typeof buildEnvReport>>,
): NodeJS.ProcessEnv {
  const buildEnvironment: NodeJS.ProcessEnv = {
    ...runtimeEnv,
  };

  if (envReport.sdkRoot) {
    buildEnvironment.DEVECO_SDK_HOME = envReport.sdkRoot;
    buildEnvironment.OHOS_BASE_SDK_HOME = envReport.sdkRoot;
  }

  if (envReport.devecoStudioPath) {
    buildEnvironment.NODE_HOME =
      buildEnvironment.NODE_HOME ??
      path.join(envReport.devecoStudioPath, 'Contents', 'tools', 'node');
  }

  return buildEnvironment;
}

async function findHarmonyArtifacts(harmonyProjectRoot: string): Promise<string[]> {
  const discoveredPaths: string[] = [];
  await walkDirectory(harmonyProjectRoot, async (entryPath) => {
    if (entryPath.endsWith('.hap') || entryPath.endsWith('.app') || entryPath.endsWith('.hsp')) {
      discoveredPaths.push(entryPath);
    }
  });
  return discoveredPaths.sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(
  currentPath: string,
  visitor: (entryPath: string) => Promise<void>,
): Promise<void> {
  if (!(await fs.pathExists(currentPath))) {
    return;
  }

  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(nextPath, visitor);
      continue;
    }

    await visitor(nextPath);
  }
}

async function defaultCommandRunner(
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): Promise<CommandRunnerResult> {
  try {
    const result = await execFileAsync(file, args, {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
      stdout: failed.stdout ?? '',
      stderr: failed.stderr ?? failed.message ?? '',
    };
  }
}

export function getDesiredHarmonyScripts(projectRoot: string): Promise<Record<string, string>> {
  return loadProject(projectRoot).then((loadedProject) => buildDesiredPackageScripts(loadedProject.packageJson));
}
