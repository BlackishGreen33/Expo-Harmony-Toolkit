import fs from 'fs-extra';
import path from 'path';
import { GENERATED_DIR, MANIFEST_FILENAME, TOOLKIT_CONFIG_FILENAME } from './constants';
import { ToolkitConfig, ToolkitManifest } from '../types';

export function getManifestPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, MANIFEST_FILENAME);
}

export function getToolkitConfigPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, TOOLKIT_CONFIG_FILENAME);
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
