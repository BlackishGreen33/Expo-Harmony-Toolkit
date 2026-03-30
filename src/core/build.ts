import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import JSON5 from 'json5';
import os from 'os';
import path from 'path';
import { TOOLKIT_VERSION } from './constants';
import { buildEnvReport } from './env';
import { normalizeKnownJavaScriptDependencies } from './javascriptDependencies';
import { loadProject } from './project';
import {
  BUILD_REQUIRED_MANAGED_FILE_PATHS,
  buildDesiredPackageScripts,
  normalizeKnownHarmonyPackageJsons,
  resolveHarmonyBundleEntryFile,
  syncProjectTemplate,
  usesExpoRouter,
} from './template';
import { BlockingIssue, BuildReport, BuildStepReport } from '../types';

const execFileAsync = promisify(execFile);
const RNOH_GENERATED_TS_SHIM_RELATIVE_PATH = path.join(
  'oh_modules',
  '@rnoh',
  'react-native-openharmony',
  'ts.ts',
);
const RNOH_GENERATED_MODULE_ROOT_RELATIVE_PATH = path.join(
  'oh_modules',
  '@rnoh',
  'react-native-openharmony',
);
const RNOH_NORMALIZED_TS_TARGET_RELATIVE_PATH = path.join(
  'expo-harmony-local-deps',
  'rnoh-react-native-openharmony-react_native_openharmony',
  'ts.ts',
);
const RNOH_CLI_AUTOLINKING_TEMPLATE_RELATIVE_PATHS = [
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'dist',
    'autolinking',
    'Autolinking.js',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'src',
    'autolinking',
    'Autolinking.ts',
  ),
];

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

interface NormalizedLocalHarPackage {
  packageName: string;
  moduleName: string;
  directoryPath: string;
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

  const syncResult = await syncProjectTemplate(loadedProject.projectRoot, false, {
    forceManagedPaths: BUILD_REQUIRED_MANAGED_FILE_PATHS,
    skipJavaScriptDependencyNormalization: options.skipTemplateSync,
  });
  warnings.push(...syncResult.warnings);

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
  let normalizedLocalHarPackages: NormalizedLocalHarPackage[] = [];
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

async function normalizeLocalHarDependencies(harmonyProjectRoot: string): Promise<{
  restore: () => Promise<void>;
  packages: NormalizedLocalHarPackage[];
}> {
  const packagePaths = [
    path.join(harmonyProjectRoot, 'oh-package.json5'),
    path.join(harmonyProjectRoot, 'entry', 'oh-package.json5'),
  ];
  const extractionRoot = path.join(harmonyProjectRoot, 'expo-harmony-local-deps');
  const archiveCache = new Map<string, string>();
  const originalContents = new Map<string, string>();
  const packagesByDirectoryPath = new Map<string, NormalizedLocalHarPackage>();

  await fs.ensureDir(extractionRoot);

  for (const packagePath of packagePaths) {
    if (!(await fs.pathExists(packagePath))) {
      continue;
    }

    const rawContents = await fs.readFile(packagePath, 'utf8');
    const parsed = JSON5.parse(rawContents) as Record<string, unknown>;
    let didChange = false;

    for (const sectionName of ['dependencies', 'devDependencies', 'overrides']) {
      const section = parsed[sectionName];
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        continue;
      }

      for (const [packageName, specifier] of Object.entries(section)) {
        if (typeof specifier !== 'string' || !specifier.startsWith('file:') || !specifier.endsWith('.har')) {
          continue;
        }

        const archivePath = path.resolve(harmonyProjectRoot, specifier.slice('file:'.length));
        const normalizedDirectory =
          archiveCache.get(archivePath) ??
          (await extractHarArchiveToDirectory(archivePath, extractionRoot, packageName));
        archiveCache.set(archivePath, normalizedDirectory);
        if (!packagesByDirectoryPath.has(normalizedDirectory)) {
          packagesByDirectoryPath.set(
            normalizedDirectory,
            await readNormalizedLocalHarPackageMetadata(normalizedDirectory, packageName),
          );
        }

        let relativeDirectory = path.relative(harmonyProjectRoot, normalizedDirectory);
        if (!relativeDirectory.startsWith('.')) {
          relativeDirectory = `./${relativeDirectory}`;
        }
        const nextSpecifier = `file:${relativeDirectory.split(path.sep).join('/')}`;

        if (nextSpecifier !== specifier) {
          (section as Record<string, string>)[packageName] = nextSpecifier;
          didChange = true;
        }
      }
    }

    if (didChange) {
      originalContents.set(packagePath, rawContents);
      await fs.writeFile(packagePath, JSON.stringify(parsed, null, 2) + '\n');
    }
  }

  return {
    packages: [...packagesByDirectoryPath.values()],
    restore: async () => {
      for (const [packagePath, rawContents] of originalContents) {
        await fs.writeFile(packagePath, rawContents);
      }
    },
  };
}

async function extractHarArchiveToDirectory(
  archivePath: string,
  extractionRoot: string,
  packageName: string,
): Promise<string> {
  if (!(await fs.pathExists(archivePath))) {
    throw new Error(`Local Harmony archive not found: ${archivePath}`);
  }

  const destinationPath = path.join(
    extractionRoot,
    `${sanitizePackageName(packageName)}-${path.basename(archivePath, path.extname(archivePath))}`,
  );
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-har-'));

  try {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', stagingRoot], {
      maxBuffer: 20 * 1024 * 1024,
    });

    const packagedRoot = path.join(stagingRoot, 'package');
    const sourceRoot = (await fs.pathExists(path.join(packagedRoot, 'oh-package.json5')))
      ? packagedRoot
      : stagingRoot;

    if (!(await fs.pathExists(path.join(sourceRoot, 'oh-package.json5')))) {
      throw new Error(`oh-package.json5 not found after extracting ${archivePath}`);
    }

    await fs.remove(destinationPath);
    await fs.ensureDir(destinationPath);

    for (const entryName of await fs.readdir(sourceRoot)) {
      await fs.move(path.join(sourceRoot, entryName), path.join(destinationPath, entryName), {
        overwrite: true,
      });
    }

    await ensureNormalizedLocalHarCompatibilityShims(destinationPath, packageName);

    return destinationPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to normalize local Harmony archive ${archivePath}: ${message}`);
  } finally {
    await fs.remove(stagingRoot);
  }
}

async function ensureNormalizedLocalHarCompatibilityShims(
  directoryPath: string,
  packageName: string,
): Promise<void> {
  if (packageName === '@react-native-oh-tpl/react-native-gesture-handler') {
    const gestureHandlerPackageHeaderPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'RnohReactNativeHarmonyGestureHandlerPackage.h',
    );
    const gestureHandlerPackagePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'RnohReactNativeHarmonyGestureHandlerPackage.cpp',
    );
    const gestureHandlerTurboModulePath = path.join(
      directoryPath,
      'src',
      'main',
      'ets',
      'rnoh',
      'RNGestureHandlerModule.ts',
    );
    if (await fs.pathExists(gestureHandlerTurboModulePath)) {
      const gestureHandlerTurboModuleContents = await fs.readFile(
        gestureHandlerTurboModulePath,
        'utf8',
      );
      let nextGestureHandlerTurboModuleContents = gestureHandlerTurboModuleContents;

      nextGestureHandlerTurboModuleContents = nextGestureHandlerTurboModuleContents.replace(
        /^import \{ TM \} from ["']@rnoh\/react-native-openharmony\/generated\/ts["'];?\r?\n/m,
        '',
      );
      nextGestureHandlerTurboModuleContents = nextGestureHandlerTurboModuleContents.replace(
        /\s+implements TM\.RNGestureHandlerModule\.Spec/,
        '',
      );

      if (nextGestureHandlerTurboModuleContents !== gestureHandlerTurboModuleContents) {
        await fs.writeFile(
          gestureHandlerTurboModulePath,
          nextGestureHandlerTurboModuleContents,
        );
      }
    }

    const gestureHandlerGeneratedDirectoryPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'generated',
    );
    await fs.ensureDir(gestureHandlerGeneratedDirectoryPath);
    await fs.writeFile(
      path.join(
        gestureHandlerGeneratedDirectoryPath,
        'RNGestureHandlerButtonComponentDescriptor.h',
      ),
      createGestureHandlerCompatibilityDescriptorHeader('RNGestureHandlerButton'),
    );
    await fs.writeFile(
      path.join(
        gestureHandlerGeneratedDirectoryPath,
        'RNGestureHandlerRootViewComponentDescriptor.h',
      ),
      createGestureHandlerCompatibilityDescriptorHeader('RNGestureHandlerRootView'),
    );

    if (await fs.pathExists(gestureHandlerPackageHeaderPath)) {
      const gestureHandlerPackageHeaderContents = await fs.readFile(
        gestureHandlerPackageHeaderPath,
        'utf8',
      );
      const nextGestureHandlerPackageHeaderContents =
        patchGestureHandlerCompatibilityPackageHeader(
          gestureHandlerPackageHeaderContents,
        );

      if (
        nextGestureHandlerPackageHeaderContents !== gestureHandlerPackageHeaderContents
      ) {
        await fs.writeFile(
          gestureHandlerPackageHeaderPath,
          nextGestureHandlerPackageHeaderContents,
        );
      }
    }

    if (!(await fs.pathExists(gestureHandlerPackagePath))) {
      return;
    }

    const gestureHandlerPackageContents = await fs.readFile(
      gestureHandlerPackagePath,
      'utf8',
    );
    const nextGestureHandlerPackageContents =
      patchGestureHandlerCompatibilityPackageSource(gestureHandlerPackageContents);

    if (nextGestureHandlerPackageContents !== gestureHandlerPackageContents) {
      await fs.writeFile(
        gestureHandlerPackagePath,
        nextGestureHandlerPackageContents,
      );
    }

    if (
      !nextGestureHandlerPackageContents.includes(
        '<react/renderer/debug/SystraceSection.h>',
      )
    ) {
      return;
    }

    const systraceCompatibilityShimPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'react',
      'renderer',
      'debug',
      'SystraceSection.h',
    );

    await fs.ensureDir(path.dirname(systraceCompatibilityShimPath));
    await fs.writeFile(
      systraceCompatibilityShimPath,
      '#pragma once\n#include <cxxreact/SystraceSection.h>\n',
    );
    return;
  }

  if (packageName === '@react-native-oh-tpl/react-native-reanimated') {
    const reanimatedCmakeListsPath = path.join(directoryPath, 'src', 'main', 'cpp', 'CMakeLists.txt');
    const reanimatedMountHookHeaderPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'Fabric',
      'ReanimatedMountHook.h',
    );
    const reanimatedMountHookSourcePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'Fabric',
      'ReanimatedMountHook.cpp',
    );
    const nativeReanimatedModuleSourcePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'NativeModules',
      'NativeReanimatedModule.cpp',
    );

    if (await fs.pathExists(reanimatedCmakeListsPath)) {
      const reanimatedCmakeListsContents = await fs.readFile(reanimatedCmakeListsPath, 'utf8');

      if (reanimatedCmakeListsContents.includes('REACT_NATIVE_MINOR_VERSION=72')) {
        await fs.writeFile(
          reanimatedCmakeListsPath,
          reanimatedCmakeListsContents.replace(
            'REACT_NATIVE_MINOR_VERSION=72',
            'REACT_NATIVE_MINOR_VERSION=82',
          ),
        );
      }
    }

    if (await fs.pathExists(reanimatedMountHookHeaderPath)) {
      const reanimatedMountHookHeaderContents = await fs.readFile(reanimatedMountHookHeaderPath, 'utf8');

      if (reanimatedMountHookHeaderContents.includes('double mountTime) noexcept override;')) {
        await fs.writeFile(
          reanimatedMountHookHeaderPath,
          reanimatedMountHookHeaderContents.replace(
            'double mountTime) noexcept override;',
            'HighResTimeStamp mountTime) noexcept override;',
          ),
        );
      }
    }

    if (await fs.pathExists(reanimatedMountHookSourcePath)) {
      const reanimatedMountHookSourceContents = await fs.readFile(reanimatedMountHookSourcePath, 'utf8');

      if (reanimatedMountHookSourceContents.includes('double) noexcept {')) {
        await fs.writeFile(
          reanimatedMountHookSourcePath,
          reanimatedMountHookSourceContents.replace(
            'double) noexcept {',
            'HighResTimeStamp) noexcept {',
          ),
        );
      }
    }

    if (await fs.pathExists(nativeReanimatedModuleSourcePath)) {
      const nativeReanimatedModuleSourceContents = await fs.readFile(
        nativeReanimatedModuleSourcePath,
        'utf8',
      );
      let nextNativeReanimatedModuleSourceContents = nativeReanimatedModuleSourceContents;

      if (nextNativeReanimatedModuleSourceContents.includes('<react/renderer/core/TraitCast.h>')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '<react/renderer/core/TraitCast.h>',
          '<react/renderer/core/LayoutableShadowNode.h>',
        );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('#include <react/utils/CoreFeatures.h>')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '#include <react/utils/CoreFeatures.h>\n',
          '',
        );
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '#include <react/utils/CoreFeatures.h>\r\n',
          '',
        );
      }

      if (
        nextNativeReanimatedModuleSourceContents.includes(
          'traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        )
      ) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          'traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
          'dynamic_cast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('shadowNodeFromValue(rt, shadowNodeWrapper)')) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /auto (\w+) = shadowNodeFromValue\(rt, shadowNodeWrapper\);/g,
            'auto $1 = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeWrapper);',
          );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('shadowNodeFromValue(rt, shadowNodeValue)')) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /(ShadowNode::Shared|auto) (\w+) = shadowNodeFromValue\(rt, shadowNodeValue\);/g,
            'auto $2 = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeValue);',
          );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('bool CoreFeatures::useNativeState;')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          /#if REACT_NATIVE_MINOR_VERSION >= 73 && defined\(RCT_NEW_ARCH_ENABLED\)\r?\n\/\/ Android can't find the definition of this static field\r?\nbool CoreFeatures::useNativeState;\r?\n#endif\r?\n/m,
          '',
        );
      }

      if (
        nextNativeReanimatedModuleSourceContents.includes('/* .shouldYield = */ [this]() {')
      ) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /#if REACT_NATIVE_MINOR_VERSION >= 72\r?\n\s*\/\* \.mountSynchronously = \*\/ true,\r?\n#endif\r?\n\s*\/\* \.shouldYield = \*\/ \[this\]\(\) \{\r?\n\s*return propsRegistry_->shouldReanimatedSkipCommit\(\);\r?\n\s*\}/m,
            '#if REACT_NATIVE_MINOR_VERSION >= 72\n'
              + '              /* .mountSynchronously = */ true,\n'
              + '#endif\n'
              + '              /* .source = */ ShadowTree::CommitSource::Unknown',
          );
      }

      if (nextNativeReanimatedModuleSourceContents !== nativeReanimatedModuleSourceContents) {
        await fs.writeFile(
          nativeReanimatedModuleSourcePath,
          nextNativeReanimatedModuleSourceContents,
        );
      }
    }

    return;
  }

  if (packageName !== '@react-native-oh-tpl/react-native-svg') {
    return;
  }

  const svgGeneratedPropsPath = path.join(
    directoryPath,
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
  const svgPathComponentInstancePath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'componentInstances',
    'RNSVGPathComponentInstance.h',
  );
  const svgImageComponentDescriptorPath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'svgImage',
    'RNSVGImageComponentDescriptor.h',
  );
  const svgImageShadowNodePath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'svgImage',
    'RNSVGImageShadowNode.h',
  );

  if (await fs.pathExists(svgGeneratedPropsPath)) {
    const svgGeneratedPropsContents = await fs.readFile(svgGeneratedPropsPath, 'utf8');

    if (svgGeneratedPropsContents.includes('butter::map<std::string, RawValue>')) {
      await fs.writeFile(
        svgGeneratedPropsPath,
        svgGeneratedPropsContents.replace(
          /butter::map<std::string, RawValue>/g,
          'std::unordered_map<std::string, RawValue>',
        ),
      );
    }
  }

  if (await fs.pathExists(svgImageComponentDescriptorPath)) {
    const svgImageComponentDescriptorContents = await fs.readFile(
      svgImageComponentDescriptorPath,
      'utf8',
    );
    let nextSvgImageComponentDescriptorContents = svgImageComponentDescriptorContents;

    if (
      nextSvgImageComponentDescriptorContents.includes(
        'void adopt(ShadowNode::Unshared const &shadowNode) const override {',
      )
    ) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'void adopt(ShadowNode::Unshared const &shadowNode) const override {',
          'void adopt(ShadowNode& shadowNode) const override {',
        );
    }

    if (
      nextSvgImageComponentDescriptorContents.includes(
        'auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);',
      )
    ) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);',
          'auto& imageShadowNode = static_cast<RNSVGImageShadowNode&>(shadowNode);',
        );
    }

    if (nextSvgImageComponentDescriptorContents.includes('imageShadowNode->setImageManager(imageManager_);')) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'imageShadowNode->setImageManager(imageManager_);',
          'imageShadowNode.setImageManager(imageManager_);',
        );
    }

    if (nextSvgImageComponentDescriptorContents !== svgImageComponentDescriptorContents) {
      await fs.writeFile(
        svgImageComponentDescriptorPath,
        nextSvgImageComponentDescriptorContents,
      );
    }
  }

  if (await fs.pathExists(svgImageShadowNodePath)) {
    const svgImageShadowNodeContents = await fs.readFile(svgImageShadowNodePath, 'utf8');
    let nextSvgImageShadowNodeContents = svgImageShadowNodeContents;
    const svgImageShadowNodeNewline = svgImageShadowNodeContents.includes('\r\n') ? '\r\n' : '\n';

    if (
      !nextSvgImageShadowNodeContents.includes(
        '#include <react/renderer/core/ShadowNodeFamily.h>',
      )
      && nextSvgImageShadowNodeContents.includes(
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
      )
    ) {
      nextSvgImageShadowNodeContents = nextSvgImageShadowNodeContents.replace(
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>'
          + `${svgImageShadowNodeNewline}#include <react/renderer/core/ShadowNodeFamily.h>`,
      );
    }

    const svgImageInitialStateSignaturePattern =
      /static RNSVGImageState initialStateData\(ShadowNodeFragment const &fragment,\r?\n\s*ShadowNodeFamilyFragment const &familyFragment,\r?\n\s*ComponentDescriptor const &componentDescriptor\) \{/m;

    if (svgImageInitialStateSignaturePattern.test(nextSvgImageShadowNodeContents)) {
      nextSvgImageShadowNodeContents = nextSvgImageShadowNodeContents.replace(
        svgImageInitialStateSignaturePattern,
        'static RNSVGImageState initialStateData(const Props::Shared& /*props*/,'
          + `${svgImageShadowNodeNewline}`
          + '                                            const ShadowNodeFamily::Shared& /*family*/,'
          + `${svgImageShadowNodeNewline}`
          + '                                            const ComponentDescriptor& /*componentDescriptor*/) {',
      );
    }

    if (nextSvgImageShadowNodeContents !== svgImageShadowNodeContents) {
      await fs.writeFile(svgImageShadowNodePath, nextSvgImageShadowNodeContents);
    }
  }

  if (!(await fs.pathExists(svgPathComponentInstancePath))) {
    return;
  }

  const svgPathComponentInstanceContents = await fs.readFile(svgPathComponentInstancePath, 'utf8');

  if (!svgPathComponentInstanceContents.includes('Float m_cacheScale;')) {
    return;
  }

  await fs.writeFile(
    svgPathComponentInstancePath,
    svgPathComponentInstanceContents.replace(
      'Float m_cacheScale;',
      'facebook::react::Float m_cacheScale;',
    ),
  );
}

function createGestureHandlerCompatibilityDescriptorHeader(
  componentName: 'RNGestureHandlerButton' | 'RNGestureHandlerRootView',
): string {
  return [
    '#pragma once',
    '',
    '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
    '#include <react/renderer/core/ConcreteComponentDescriptor.h>',
    '',
    'namespace facebook::react {',
    '',
    `inline constexpr char ${componentName}ComponentName[] = "${componentName}";`,
    '',
    `using ${componentName}ShadowNode = ConcreteViewShadowNode<${componentName}ComponentName>;`,
    `using ${componentName}ComponentDescriptor = ConcreteComponentDescriptor<${componentName}ShadowNode>;`,
    '',
    '} // namespace facebook::react',
    '',
  ].join('\n');
}

function patchGestureHandlerCompatibilityPackageHeader(contents: string): string {
  if (contents.includes('createComponentDescriptorProviders() override;')) {
    return contents;
  }

  return contents.replace(
    '    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers() override;\n',
    [
      '    std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() override;',
      '',
      '    ComponentJSIBinderByString createComponentJSIBinderByName() override;',
      '',
      '    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers() override;',
    ].join('\n'),
  );
}

function patchGestureHandlerCompatibilityPackageSource(contents: string): string {
  let nextContents = contents;

  if (
    !nextContents.includes(
      '#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"',
    )
  ) {
    nextContents = nextContents.replace(
      '#include "RNOH/RNInstanceCAPI.h"\n',
      '#include "RNOH/RNInstanceCAPI.h"\n#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"\n',
    );
  }

  if (
    !nextContents.includes(
      '#include "generated/RNGestureHandlerButtonComponentDescriptor.h"',
    )
  ) {
    nextContents = nextContents.replace(
      '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n',
      '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n#include "generated/RNGestureHandlerButtonComponentDescriptor.h"\n#include "generated/RNGestureHandlerRootViewComponentDescriptor.h"\n',
    );
  }

  if (!nextContents.includes('class RNGestureHandlerComponentJSIBinder')) {
    nextContents = nextContents.replace(
      'using namespace rnoh;\nusing namespace facebook;\n\n',
      [
        'using namespace rnoh;',
        'using namespace facebook;',
        '',
        'class RNGestureHandlerComponentJSIBinder : public ViewComponentJSIBinder {',
        'protected:',
        '    facebook::jsi::Object createNativeProps(facebook::jsi::Runtime &rt) override {',
        '        auto nativeProps = ViewComponentJSIBinder::createNativeProps(rt);',
        '        nativeProps.setProperty(rt, "exclusive", "boolean");',
        '        nativeProps.setProperty(rt, "foreground", "boolean");',
        '        nativeProps.setProperty(rt, "borderless", "boolean");',
        '        nativeProps.setProperty(rt, "enabled", "boolean");',
        '        nativeProps.setProperty(rt, "rippleColor", "Color");',
        '        nativeProps.setProperty(rt, "rippleRadius", "number");',
        '        nativeProps.setProperty(rt, "touchSoundDisabled", "boolean");',
        '        return nativeProps;',
        '    }',
        '',
        '    facebook::jsi::Object createDirectEventTypes(facebook::jsi::Runtime &rt) override {',
        '        auto events = ViewComponentJSIBinder::createDirectEventTypes(rt);',
        '        events.setProperty(rt, "onGestureHandlerEvent", createDirectEvent(rt, "onGestureHandlerEvent"));',
        '        events.setProperty(',
        '            rt,',
        '            "onGestureHandlerStateChange",',
        '            createDirectEvent(rt, "onGestureHandlerStateChange"));',
        '        events.setProperty(rt, "topOnGestureHandlerEvent", createDirectEvent(rt, "onGestureHandlerEvent"));',
        '        events.setProperty(',
        '            rt,',
        '            "topOnGestureHandlerStateChange",',
        '            createDirectEvent(rt, "onGestureHandlerStateChange"));',
        '        return events;',
        '    }',
        '};',
        '',
      ].join('\n'),
    );
  }

  if (
    !nextContents.includes(
      'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders()',
    )
  ) {
    nextContents = nextContents.replace(
      'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {\n',
      [
        'std::vector<facebook::react::ComponentDescriptorProvider>',
        'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders() {',
        '    return {',
        '        facebook::react::concreteComponentDescriptorProvider<',
        '            facebook::react::RNGestureHandlerButtonComponentDescriptor>(),',
        '        facebook::react::concreteComponentDescriptorProvider<',
        '            facebook::react::RNGestureHandlerRootViewComponentDescriptor>(),',
        '    };',
        '}',
        '',
        'ComponentJSIBinderByString',
        'RnohReactNativeHarmonyGestureHandlerPackage::createComponentJSIBinderByName() {',
        '    auto componentJSIBinder = std::make_shared<RNGestureHandlerComponentJSIBinder>();',
        '    return {',
        '        {"RNGestureHandlerButton", componentJSIBinder},',
        '        {"RNGestureHandlerRootView", componentJSIBinder},',
        '    };',
        '}',
        '',
        'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {',
      ].join('\n'),
    );
  }

  return nextContents;
}

function sanitizePackageName(packageName: string): string {
  return packageName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function readNormalizedLocalHarPackageMetadata(
  directoryPath: string,
  packageName: string,
): Promise<NormalizedLocalHarPackage> {
  await ensureNormalizedLocalHarModuleJson5(directoryPath);

  const moduleJsonPaths = [
    path.join(directoryPath, 'src', 'main', 'module.json5'),
    path.join(directoryPath, 'src', 'main', 'module.json'),
  ];
  let moduleName = sanitizePackageName(packageName);

  for (const moduleJsonPath of moduleJsonPaths) {
    if (!(await fs.pathExists(moduleJsonPath))) {
      continue;
    }

    try {
      const parsed = JSON5.parse(await fs.readFile(moduleJsonPath, 'utf8')) as {
        module?: { name?: unknown };
      };
      if (typeof parsed?.module?.name === 'string' && parsed.module.name.trim().length > 0) {
        moduleName = parsed.module.name.trim();
        break;
      }
    } catch {
      // Ignore malformed module metadata and fall back to a sanitized package name.
    }
  }

  return {
    packageName,
    moduleName,
    directoryPath,
  };
}

async function ensureNormalizedLocalHarModuleJson5(directoryPath: string): Promise<void> {
  const moduleJson5Path = path.join(directoryPath, 'src', 'main', 'module.json5');
  const moduleJsonPath = path.join(directoryPath, 'src', 'main', 'module.json');
  const sourcePath =
    (await fs.pathExists(moduleJsonPath))
      ? moduleJsonPath
      : ((await fs.pathExists(moduleJson5Path)) ? moduleJson5Path : null);

  if (!sourcePath) {
    return;
  }

  const parsed = JSON5.parse(await fs.readFile(sourcePath, 'utf8')) as {
    module?: Record<string, unknown>;
  };
  const legacyModule =
    parsed.module && typeof parsed.module === 'object' && !Array.isArray(parsed.module)
      ? parsed.module
      : {};
  const normalizedModule: Record<string, unknown> = {
    name:
      typeof legacyModule.name === 'string' && legacyModule.name.trim().length > 0
        ? legacyModule.name.trim()
        : path.basename(directoryPath).replace(/[^a-zA-Z0-9]+/g, '_'),
    type: typeof legacyModule.type === 'string' ? legacyModule.type : 'har',
    deviceTypes:
      Array.isArray(legacyModule.deviceTypes) && legacyModule.deviceTypes.length > 0
        ? legacyModule.deviceTypes
        : ['default'],
    installationFree:
      typeof legacyModule.installationFree === 'boolean' ? legacyModule.installationFree : false,
  };
  const passthroughKeys = [
    'srcEntrance',
    'srcEntry',
    'description',
    'process',
    'mainElement',
    'uiSyntax',
    'metadata',
    'abilities',
    'extensionAbilities',
    'requestPermissions',
    'definePermissions',
    'testRunner',
    'dependencies',
    'libIsolation',
    'routerMap',
    'appStartup',
    'crossAppSharedConfig',
  ] as const;

  for (const key of passthroughKeys) {
    const value = legacyModule[key];
    if (value !== undefined) {
      normalizedModule[key] = value;
    }
  }

  if (typeof legacyModule.virtualMachine === 'string') {
    normalizedModule.virtualMachine = legacyModule.virtualMachine.includes('ark') ? 'ark' : 'default';
  }

  await fs.writeFile(
    moduleJson5Path,
    JSON.stringify(
      {
        module: normalizedModule,
      },
      null,
      2,
    ) + '\n',
  );
}

async function ensureHarmonyBuildProfileSupportsNormalizedLocalDeps(
  harmonyProjectRoot: string,
  localHarPackages: NormalizedLocalHarPackage[],
): Promise<() => Promise<void>> {
  if (localHarPackages.length === 0) {
    return async () => {};
  }

  const buildProfilePath = path.join(harmonyProjectRoot, 'build-profile.json5');
  if (!(await fs.pathExists(buildProfilePath))) {
    return async () => {};
  }

  const rawContents = await fs.readFile(buildProfilePath, 'utf8');
  const parsed = JSON5.parse(rawContents) as {
    app?: { products?: Array<Record<string, unknown>> };
    modules?: Array<Record<string, unknown>>;
  };
  let didChange = false;

  const products = Array.isArray(parsed.app?.products) ? parsed.app.products : [];
  for (const product of products) {
    let buildOption = product.buildOption;
    if (!buildOption || typeof buildOption !== 'object' || Array.isArray(buildOption)) {
      buildOption = {};
      product.buildOption = buildOption;
      didChange = true;
    }

    let strictMode = (buildOption as Record<string, unknown>).strictMode;
    if (!strictMode || typeof strictMode !== 'object' || Array.isArray(strictMode)) {
      strictMode = {};
      (buildOption as Record<string, unknown>).strictMode = strictMode;
      didChange = true;
    }

    if ((strictMode as Record<string, unknown>).useNormalizedOHMUrl !== true) {
      (strictMode as Record<string, unknown>).useNormalizedOHMUrl = true;
      didChange = true;
    }
  }

  if (!Array.isArray(parsed.modules)) {
    parsed.modules = [];
    didChange = true;
  }

  for (const localHarPackage of localHarPackages) {
    let relativeDirectory = path.relative(harmonyProjectRoot, localHarPackage.directoryPath);
    relativeDirectory = relativeDirectory.split(path.sep).join('/');
    if (!relativeDirectory.startsWith('.')) {
      relativeDirectory = `./${relativeDirectory}`;
    }

    const existingModule = parsed.modules.find((moduleEntry) => {
      return (
        moduleEntry?.srcPath === relativeDirectory ||
        moduleEntry?.name === localHarPackage.moduleName
      );
    });

    if (existingModule) {
      if (existingModule.srcPath !== relativeDirectory) {
        existingModule.srcPath = relativeDirectory;
        didChange = true;
      }
      continue;
    }

    parsed.modules.push({
      name: localHarPackage.moduleName,
      srcPath: relativeDirectory,
    });
    didChange = true;
  }

  if (!didChange) {
    return async () => {};
  }

  await fs.writeFile(buildProfilePath, JSON.stringify(parsed, null, 2) + '\n');

  return async () => {
    await fs.writeFile(buildProfilePath, rawContents);
  };
}

async function ensureRnohGeneratedTsShim(harmonyProjectRoot: string): Promise<void> {
  const shimPath = path.join(harmonyProjectRoot, RNOH_GENERATED_TS_SHIM_RELATIVE_PATH);
  let relativeTarget = path.relative(
    path.dirname(shimPath),
    path.join(harmonyProjectRoot, RNOH_NORMALIZED_TS_TARGET_RELATIVE_PATH),
  );

  relativeTarget = relativeTarget.replace(/\\/g, '/').replace(/\.ts$/, '');

  if (!relativeTarget.startsWith('.')) {
    relativeTarget = `./${relativeTarget}`;
  }

  await fs.ensureDir(path.dirname(shimPath));
  await fs.writeFile(shimPath, `export * from '${relativeTarget}';\n`);
}

async function alignRnohCodegenWithNormalizedLocalPackage(
  harmonyProjectRoot: string,
  localHarPackages: NormalizedLocalHarPackage[],
): Promise<() => Promise<void>> {
  const rnohPackage = localHarPackages.find(
    (localPackage) => localPackage.packageName === '@rnoh/react-native-openharmony',
  );
  if (!rnohPackage) {
    return async () => {};
  }

  const hvigorFilePath = path.join(harmonyProjectRoot, 'entry', 'hvigorfile.ts');
  if (!(await fs.pathExists(hvigorFilePath))) {
    return async () => {};
  }

  const originalHvigorFile = await fs.readFile(hvigorFilePath, 'utf8');
  let relativeRnohModulePath = path.relative(harmonyProjectRoot, rnohPackage.directoryPath);
  relativeRnohModulePath = relativeRnohModulePath.split(path.sep).join('/');
  if (!relativeRnohModulePath.startsWith('.')) {
    relativeRnohModulePath = `./${relativeRnohModulePath}`;
  }

  const updatedHvigorFile = originalHvigorFile.replace(
    /rnohModulePath:\s*['"][^'"]+['"]/,
    `rnohModulePath: '${relativeRnohModulePath}'`,
  );
  if (updatedHvigorFile !== originalHvigorFile) {
    await fs.writeFile(hvigorFilePath, updatedHvigorFile);
  }

  const generatedModuleRootPath = path.join(harmonyProjectRoot, RNOH_GENERATED_MODULE_ROOT_RELATIVE_PATH);
  const backupRootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-rnoh-module-'));
  const backupModuleRootPath = path.join(backupRootPath, 'react-native-openharmony');
  let movedGeneratedModuleRoot = false;

  if (await fs.pathExists(generatedModuleRootPath)) {
    await fs.move(generatedModuleRootPath, backupModuleRootPath, { overwrite: true });
    movedGeneratedModuleRoot = true;
  }

  return async () => {
    if (updatedHvigorFile !== originalHvigorFile) {
      await fs.writeFile(hvigorFilePath, originalHvigorFile);
    }

    if (movedGeneratedModuleRoot) {
      await fs.remove(generatedModuleRootPath);
      await fs.ensureDir(path.dirname(generatedModuleRootPath));
      await fs.move(backupModuleRootPath, generatedModuleRootPath, { overwrite: true });
    }

    await fs.remove(backupRootPath);
  };
}

async function normalizeProjectRnohCliAutolinkingTemplates(
  projectRoot: string,
): Promise<() => Promise<void>> {
  const originalContentsByPath = new Map<string, string>();

  for (const relativePath of RNOH_CLI_AUTOLINKING_TEMPLATE_RELATIVE_PATHS) {
    const targetPath = path.join(projectRoot, relativePath);
    if (!(await fs.pathExists(targetPath))) {
      continue;
    }

    const currentContents = await fs.readFile(targetPath, 'utf8');
    const normalizedContents = normalizeRnohCliAutolinkingTemplateContents(currentContents);

    if (normalizedContents === currentContents) {
      continue;
    }

    originalContentsByPath.set(targetPath, currentContents);
    await fs.writeFile(targetPath, normalizedContents);
  }

  return async () => {
    for (const [targetPath, originalContents] of originalContentsByPath.entries()) {
      await fs.writeFile(targetPath, originalContents);
    }
  };
}

function normalizeRnohCliAutolinkingTemplateContents(contents: string): string {
  return contents
    .replace(
      /import type \{ RNPackageContext, RNOHPackage \} from '@rnoh\/react-native-openharmony';/g,
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
    )
    .replace(
      /export function createRNOHPackages\(ctx: RNPackageContext\): RNOHPackage\[\] \{/g,
      'export function createRNOHPackages(ctx: RNPackageContext): RNPackage[] {',
    );
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
