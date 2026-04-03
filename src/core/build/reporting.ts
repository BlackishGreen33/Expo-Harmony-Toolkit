import path from 'path';
import { TOOLKIT_VERSION } from '../constants';
import { BlockingIssue, BuildReport, BuildStepReport } from '../../types';

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

export function getBundleOutputPath(projectRoot: string): string {
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

export function getAssetsOutputPath(projectRoot: string): string {
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

export function createBuildReport(input: {
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

export function createStepReport(
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
