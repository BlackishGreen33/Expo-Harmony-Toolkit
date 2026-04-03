import { createRequire } from 'node:module';
import fs from 'fs-extra';
import path from 'path';
import { DependencyBuildabilityRisk, DetectedDependency } from '../types';

const NATIVE_DIRECTORY_CANDIDATES = ['android', 'ios', 'harmony'] as const;
const NATIVE_CONFIG_CANDIDATES = [
  'oh-package.json5',
  'react-native.config.js',
  'react-native.config.cjs',
  'react-native.config.mjs',
  'react-native.config.ts',
  'expo-module.config.json',
  'expo-module.config.js',
  'expo-module.config.cjs',
  'expo-module.config.mjs',
  'expo-module.config.ts',
] as const;
const PACKAGE_JSON_NATIVE_HINT_KEYS = [
  'codegenConfig',
  'expo-module',
  'harmony',
  'nativePackageName',
  'podspecPath',
  'react-native',
  'react-native-builder-bob',
] as const;
const PACKAGE_NAME_NATIVE_PATTERNS = [
  /^expo(?:-|$)/,
  /^@expo\//,
  /^react-native(?:-|$)/,
  /^@react-native\//,
  /^@react-native-community\//,
] as const;

type DependencyPackageJson = {
  files?: unknown;
  keywords?: unknown;
} & Record<string, unknown>;

export async function annotateDependencyBuildability(
  projectRoot: string,
  dependencies: DetectedDependency[],
): Promise<DetectedDependency[]> {
  return Promise.all(
    dependencies.map(async (dependency) => ({
      ...dependency,
      buildabilityRisk: await resolveDependencyBuildabilityRisk(projectRoot, dependency),
    })),
  );
}

async function resolveDependencyBuildabilityRisk(
  projectRoot: string,
  dependency: DetectedDependency,
): Promise<DependencyBuildabilityRisk> {
  if (dependency.status !== 'unknown') {
    return 'known';
  }

  const packageJsonPath = resolveInstalledDependencyPackageJson(projectRoot, dependency.name);
  if (!packageJsonPath || !(await fs.pathExists(packageJsonPath))) {
    return 'unresolved';
  }

  const packageRoot = path.dirname(packageJsonPath);
  const dependencyPackageJson = (await fs.readJson(packageJsonPath)) as DependencyPackageJson;

  if (looksLikeNativeDependencyByPackageName(dependency.name)) {
    return 'native-risk';
  }

  if (await hasNativeSurface(packageRoot, dependencyPackageJson)) {
    return 'native-risk';
  }

  return 'js-only-unknown';
}

function resolveInstalledDependencyPackageJson(projectRoot: string, dependencyName: string): string | null {
  try {
    const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
    return projectRequire.resolve(`${dependencyName}/package.json`);
  } catch {
    return null;
  }
}

function looksLikeNativeDependencyByPackageName(dependencyName: string): boolean {
  return PACKAGE_NAME_NATIVE_PATTERNS.some((pattern) => pattern.test(dependencyName));
}

async function hasNativeSurface(
  packageRoot: string,
  dependencyPackageJson: DependencyPackageJson,
): Promise<boolean> {
  for (const directoryName of NATIVE_DIRECTORY_CANDIDATES) {
    if (await fs.pathExists(path.join(packageRoot, directoryName))) {
      return true;
    }
  }

  for (const fileName of NATIVE_CONFIG_CANDIDATES) {
    if (await fs.pathExists(path.join(packageRoot, fileName))) {
      return true;
    }
  }

  if (await hasPodspecFile(packageRoot)) {
    return true;
  }

  if (PACKAGE_JSON_NATIVE_HINT_KEYS.some((key) => dependencyPackageJson[key] !== undefined)) {
    return true;
  }

  const files = Array.isArray(dependencyPackageJson.files)
    ? dependencyPackageJson.files.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (files.some((entry) => hasNativePathHint(entry))) {
    return true;
  }

  const keywords = Array.isArray(dependencyPackageJson.keywords)
    ? dependencyPackageJson.keywords.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (keywords.some((keyword) => keyword === 'react-native' || keyword === 'expo-module')) {
    return true;
  }

  return false;
}

async function hasPodspecFile(packageRoot: string): Promise<boolean> {
  const entries = await fs.readdir(packageRoot);
  return entries.some((entry) => entry.endsWith('.podspec'));
}

function hasNativePathHint(value: string): boolean {
  return /(^|\/)(android|ios|harmony)(\/|$)/.test(value) || value.endsWith('.podspec');
}
