import fs from 'fs-extra';
import path from 'path';
import { STRICT_ENV_EXIT_CODE, TOOLKIT_VERSION } from './constants';
import { ensureProjectPackageJsonPath, resolveProjectRoot } from './project';
import { BlockingIssue, EnvReport } from '../types';

const DEFAULT_DEVECO_STUDIO_CANDIDATES = [
  '/Applications/DevEco-Studio.app',
  path.join(process.env.HOME ?? '', 'Applications', 'DevEco-Studio.app'),
];

interface BuildEnvReportOptions {
  env?: NodeJS.ProcessEnv;
}

export async function buildEnvReport(
  projectRoot: string,
  options: BuildEnvReportOptions = {},
): Promise<EnvReport> {
  const runtimeEnv = options.env ?? process.env;
  const useDefaultLookups = runtimeEnv.EXPO_HARMONY_DISABLE_DEFAULT_PATHS !== '1';
  const resolvedProjectRoot = await resolveProjectRoot(projectRoot);
  await ensureProjectPackageJsonPath(resolvedProjectRoot);

  const devecoStudioPath = await resolveExistingPath([
    runtimeEnv.EXPO_HARMONY_DEVECO_STUDIO_PATH,
    runtimeEnv.DEVECO_STUDIO_PATH,
    runtimeEnv.DEVECO_STUDIO_HOME,
    ...(useDefaultLookups ? DEFAULT_DEVECO_STUDIO_CANDIDATES : []),
  ]);
  const sdkRootCandidate =
    runtimeEnv.EXPO_HARMONY_DEVECO_SDK_ROOT ??
    runtimeEnv.DEVECO_SDK_HOME ??
    runtimeEnv.OHOS_SDK_HOME ??
    (devecoStudioPath ? path.join(devecoStudioPath, 'Contents', 'sdk') : null);
  const sdkRoot = await resolveExistingPath([sdkRootCandidate]);
  const javaPath = await resolveExistingPath([
    runtimeEnv.EXPO_HARMONY_JAVA_PATH,
    runtimeEnv.JAVA_HOME ? path.join(runtimeEnv.JAVA_HOME, 'bin', 'java') : null,
    useDefaultLookups ? findExecutableInPath('java', runtimeEnv) : null,
  ]);
  const ohpmPath = await resolveExistingPath([
    runtimeEnv.EXPO_HARMONY_OHPM_PATH,
    devecoStudioPath ? path.join(devecoStudioPath, 'Contents', 'tools', 'ohpm', 'bin', 'ohpm') : null,
    useDefaultLookups ? findExecutableInPath('ohpm', runtimeEnv) : null,
  ]);
  const hvigorPath = await resolveExistingPath([
    runtimeEnv.EXPO_HARMONY_HVIGOR_PATH,
    devecoStudioPath ? path.join(devecoStudioPath, 'Contents', 'tools', 'hvigor', 'bin', 'hvigorw.js') : null,
    devecoStudioPath ? path.join(devecoStudioPath, 'Contents', 'tools', 'hvigor', 'bin', 'hvigorw') : null,
    useDefaultLookups ? findExecutableInPath('hvigorw', runtimeEnv) : null,
    useDefaultLookups ? findExecutableInPath('hvigor', runtimeEnv) : null,
  ]);
  const hdcPath = await resolveExistingPath([
    runtimeEnv.EXPO_HARMONY_HDC_PATH,
    sdkRoot ? path.join(sdkRoot, 'default', 'openharmony', 'toolchains', 'hdc') : null,
    useDefaultLookups ? findExecutableInPath('hdc', runtimeEnv) : null,
  ]);
  const harmonyProjectRootCandidate = path.join(resolvedProjectRoot, 'harmony');
  const harmonyProjectRoot = (await fs.pathExists(harmonyProjectRootCandidate))
    ? harmonyProjectRootCandidate
    : null;
  const signingConfigured = harmonyProjectRoot
    ? await detectSigningConfiguration(path.join(harmonyProjectRoot, 'build-profile.json5'))
    : false;
  const blockingIssues: BlockingIssue[] = [];
  const advisories: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (!devecoStudioPath || !sdkRoot) {
    blockingIssues.push({
      code: 'env.deveco_sdk.missing',
      message:
        'DevEco Studio or its Harmony SDK could not be located. Set EXPO_HARMONY_DEVECO_STUDIO_PATH or install DevEco Studio locally.',
    });
  }

  if (!hvigorPath) {
    blockingIssues.push({
      code: 'env.hvigor.missing',
      message:
        'Hvigor could not be located. Install the DevEco hvigor toolchain or set EXPO_HARMONY_HVIGOR_PATH.',
    });
  }

  if (!hdcPath) {
    blockingIssues.push({
      code: 'env.hdc.missing',
      message:
        'The Harmony device connector hdc could not be located. Install the DevEco device toolchain or set EXPO_HARMONY_HDC_PATH.',
    });
  }

  if (!javaPath) {
    warnings.push(
      'Java could not be located from JAVA_HOME or PATH. Hvigor may still fail even when the DevEco SDK is present.',
    );
  }

  if (!ohpmPath) {
    warnings.push(
      'ohpm could not be located. CLI HAP builds will fail until the DevEco package manager is available.',
    );
  }

  if (!harmonyProjectRoot) {
    warnings.push(
      'Harmony sidecar files are not present yet. Run expo-harmony init before bundle or build-hap.',
    );
  } else if (!signingConfigured) {
    advisories.push({
      code: 'env.signing.missing',
      message:
        'Harmony build-profile.json5 does not declare any signingConfigs yet. Debug GUI flows may still work, but release builds require signing.',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: resolvedProjectRoot,
    toolkitVersion: TOOLKIT_VERSION,
    devecoStudioPath,
    sdkRoot,
    harmonyProjectRoot,
    javaPath,
    ohpmPath,
    hvigorPath,
    hdcPath,
    signingConfigured,
    status: blockingIssues.length === 0 ? 'ready' : 'blocked',
    blockingIssues,
    advisories,
    warnings,
  };
}

export function renderEnvReport(report: EnvReport): string {
  const lines = [
    'Expo Harmony env report',
    `Project: ${report.projectRoot}`,
    `Status: ${report.status}`,
    `DevEco Studio: ${report.devecoStudioPath ?? 'not found'}`,
    `SDK root: ${report.sdkRoot ?? 'not found'}`,
    `Harmony project: ${report.harmonyProjectRoot ?? 'not found'}`,
    `Java: ${report.javaPath ?? 'not found'}`,
    `ohpm: ${report.ohpmPath ?? 'not found'}`,
    `hvigor: ${report.hvigorPath ?? 'not found'}`,
    `hdc: ${report.hdcPath ?? 'not found'}`,
    `Signing: ${report.signingConfigured ? 'configured' : 'not configured'}`,
  ];

  if (report.blockingIssues.length > 0) {
    lines.push('', 'Blocking issues:', ...report.blockingIssues.map(renderIssueLine));
  }

  if (report.advisories.length > 0) {
    lines.push('', 'Advisories:', ...report.advisories.map(renderIssueLine));
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}

export function getStrictEnvExitCode(): number {
  return STRICT_ENV_EXIT_CODE;
}

async function resolveExistingPath(candidates: Array<string | null | undefined>): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const resolvedCandidate = path.resolve(candidate);
    if (await fs.pathExists(resolvedCandidate)) {
      return resolvedCandidate;
    }
  }

  return null;
}

function findExecutableInPath(executableName: string, runtimeEnv: NodeJS.ProcessEnv): string | null {
  const pathValue = runtimeEnv.PATH;

  if (!pathValue) {
    return null;
  }

  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) {
      continue;
    }

    const candidatePath = path.join(directory, executableName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

async function detectSigningConfiguration(buildProfilePath: string): Promise<boolean> {
  if (!(await fs.pathExists(buildProfilePath))) {
    return false;
  }

  const contents = await fs.readFile(buildProfilePath, 'utf8');
  const signingConfigsMatch = contents.match(/signingConfigs\s*:\s*\[([\s\S]*?)\]/m);

  if (!signingConfigsMatch) {
    return false;
  }

  return signingConfigsMatch[1].trim().length > 0;
}

function renderIssueLine(issue: BlockingIssue): string {
  return `- ${issue.code}: ${issue.message}${issue.subject ? ` (${issue.subject})` : ''}`;
}
