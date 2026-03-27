import fs from 'fs-extra';
import path from 'path';
import {
  BUILD_REPORT_FILENAME,
  ENV_REPORT_FILENAME,
  GENERATED_DIR,
  MANIFEST_FILENAME,
  TOOLKIT_CONFIG_FILENAME,
} from './constants';
import { BuildReport, EnvReport, ToolkitConfig, ToolkitManifest } from '../types';

export function getManifestPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, MANIFEST_FILENAME);
}

export function getToolkitConfigPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, TOOLKIT_CONFIG_FILENAME);
}

export function getEnvReportPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, ENV_REPORT_FILENAME);
}

export function getBuildReportPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, BUILD_REPORT_FILENAME);
}

export async function readManifest(projectRoot: string): Promise<ToolkitManifest | null> {
  const manifestPath = getManifestPath(projectRoot);

  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  return (await fs.readJson(manifestPath)) as ToolkitManifest;
}

export async function readToolkitConfig(projectRoot: string): Promise<ToolkitConfig | null> {
  const toolkitConfigPath = getToolkitConfigPath(projectRoot);

  if (!(await fs.pathExists(toolkitConfigPath))) {
    return null;
  }

  return (await fs.readJson(toolkitConfigPath)) as ToolkitConfig;
}

export async function writeEnvReport(
  projectRoot: string,
  report: EnvReport,
  outputPath?: string,
): Promise<string> {
  const resolvedOutputPath = outputPath ?? getEnvReportPath(projectRoot);
  await fs.ensureDir(path.dirname(resolvedOutputPath));
  await fs.writeJson(resolvedOutputPath, report, { spaces: 2 });
  return resolvedOutputPath;
}

export async function writeBuildReport(
  projectRoot: string,
  report: BuildReport,
  outputPath?: string,
): Promise<string> {
  const resolvedOutputPath = outputPath ?? getBuildReportPath(projectRoot);
  await fs.ensureDir(path.dirname(resolvedOutputPath));
  await fs.writeJson(resolvedOutputPath, report, { spaces: 2 });
  return resolvedOutputPath;
}
