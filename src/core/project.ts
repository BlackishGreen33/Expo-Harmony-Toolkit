import { getConfig } from '@expo/config';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import path from 'path';
import semver from 'semver';
import { DEFAULT_HVIGOR_PLUGIN_FILENAME, RNOH_CLI_VERSION, SUPPORTED_EXPO_SDKS } from './constants';
import {
  DependencySource,
  ExpoHarmonyPluginProps,
  HarmonyIdentifiers,
  LoadedProject,
  PackageJson,
} from '../types';

const APP_CONFIG_CANDIDATES = [
  'app.json',
  'app.config.ts',
  'app.config.js',
  'app.config.mjs',
  'app.config.cjs',
];

export async function resolveProjectRoot(projectRoot?: string): Promise<string> {
  return path.resolve(projectRoot ?? process.cwd());
}

export async function loadProject(projectRoot: string): Promise<LoadedProject> {
  const resolvedRoot = await resolveProjectRoot(projectRoot);
  const packageJsonPath = await ensureProjectPackageJsonPath(resolvedRoot);

  const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
  const appConfigPath = await findAppConfigPath(resolvedRoot);

  if (!appConfigPath && !hasExpoDependency(packageJson)) {
    throw new Error(
      `No Expo app config found in ${resolvedRoot}. Expected app.json/app.config.* or an expo dependency.`,
    );
  }

  const expoConfig = await readExpoConfig(resolvedRoot, appConfigPath);

  return {
    projectRoot: resolvedRoot,
    packageJson,
    expoConfig,
    appConfigPath,
  };
}

export async function ensureProjectPackageJsonPath(projectRoot: string): Promise<string> {
  const resolvedRoot = await resolveProjectRoot(projectRoot);
  const packageJsonPath = path.join(resolvedRoot, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(`No package.json found at ${resolvedRoot}`);
  }

  return packageJsonPath;
}

export async function findAppConfigPath(projectRoot: string): Promise<string | null> {
  for (const candidate of APP_CONFIG_CANDIDATES) {
    const candidatePath = path.join(projectRoot, candidate);
    if (await fs.pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export function collectDeclaredDependencies(
  packageJson: PackageJson,
): Array<{ name: string; version: string; source: DependencySource }> {
  const entries: Array<{ name: string; version: string; source: DependencySource }> = [];

  for (const [source, section] of [
    ['dependency', packageJson.dependencies],
    ['devDependency', packageJson.devDependencies],
    ['peerDependency', packageJson.peerDependencies],
  ] as const) {
    for (const [name, version] of Object.entries(section ?? {})) {
      entries.push({ name, version, source });
    }
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

export function hasDeclaredDependency(packageJson: PackageJson, dependencyName: string): boolean {
  return Boolean(
    packageJson.dependencies?.[dependencyName] ||
      packageJson.devDependencies?.[dependencyName] ||
      packageJson.peerDependencies?.[dependencyName],
  );
}

export function collectExpoPlugins(expoConfig: Record<string, any>): string[] {
  const plugins = expoConfig.plugins;

  if (!Array.isArray(plugins)) {
    return [];
  }

  const names = new Set<string>();

  for (const plugin of plugins) {
    if (typeof plugin === 'string') {
      names.add(plugin);
      continue;
    }

    if (Array.isArray(plugin) && typeof plugin[0] === 'string') {
      names.add(plugin[0]);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function collectExpoSchemes(expoConfig: Record<string, any>): string[] {
  const rawScheme = expoConfig.scheme;

  if (typeof rawScheme === 'string' && rawScheme.trim().length > 0) {
    return [rawScheme.trim()];
  }

  if (Array.isArray(rawScheme)) {
    return rawScheme
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
      .sort((left, right) => left.localeCompare(right));
  }

  return [];
}

export function deriveHarmonyIdentifiers(
  expoConfig: Record<string, any>,
  packageJson?: PackageJson,
  props?: ExpoHarmonyPluginProps,
): HarmonyIdentifiers {
  const slug = sanitizeSlug(expoConfig.slug ?? packageJson?.name ?? 'expo-harmony-app');
  const appName = String(expoConfig.name ?? packageJson?.name ?? 'Expo Harmony App');
  const androidPackage = normalizeIdentifier(expoConfig.android?.package);
  const iosBundleIdentifier = normalizeIdentifier(expoConfig.ios?.bundleIdentifier);

  return {
    appName,
    slug,
    bundleName:
      normalizeIdentifier(props?.bundleName) ??
      androidPackage ??
      iosBundleIdentifier ??
      `com.expoharmony.${slug}`,
    entryModuleName: sanitizeIdentifierSegment(props?.entryModuleName ?? 'entry'),
    androidPackage,
    iosBundleIdentifier,
  };
}

export function detectExpoSdkVersion(packageJson: PackageJson): number | null {
  const rawVersion =
    packageJson.dependencies?.expo ??
    packageJson.devDependencies?.expo ??
    packageJson.peerDependencies?.expo;

  if (!rawVersion) {
    return null;
  }

  const coerced = semver.coerce(rawVersion);
  return coerced?.major ?? null;
}

export function getExpoSdkWarning(expoSdkVersion: number | null): string | null {
  if (expoSdkVersion === null) {
    return 'Expo SDK version could not be detected from package.json.';
  }

  if (!SUPPORTED_EXPO_SDKS.includes(expoSdkVersion)) {
    return `Expo SDK ${expoSdkVersion} detected. The toolkit currently validates only against Expo SDK ${SUPPORTED_EXPO_SDKS.join(' and ')} project shapes.`;
  }

  return null;
}

export async function resolveRnohHvigorPluginFilename(projectRoot: string): Promise<string> {
  const harmonyCliDir = path.join(
    projectRoot,
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'harmony',
  );

  if (!(await fs.pathExists(harmonyCliDir))) {
    return DEFAULT_HVIGOR_PLUGIN_FILENAME;
  }

  const entries = await fs.readdir(harmonyCliDir);
  const tgzEntry = entries.find((entry) => entry.startsWith('rnoh-hvigor-plugin-') && entry.endsWith('.tgz'));

  return tgzEntry ?? DEFAULT_HVIGOR_PLUGIN_FILENAME;
}

export function createGeneratedSha(contents: string | Buffer): string {
  return crypto.createHash('sha1').update(contents).digest('hex');
}

async function readExpoConfig(
  projectRoot: string,
  appConfigPath: string | null,
): Promise<Record<string, any>> {
  try {
    const { exp } = getConfig(projectRoot, {
      skipSDKVersionRequirement: true,
      isPublicConfig: true,
    });

    return exp;
  } catch (error) {
    if (!appConfigPath || !appConfigPath.endsWith('app.json')) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load Expo config: ${message}`);
    }

    const appJson = await fs.readJson(appConfigPath);
    return (appJson.expo ?? appJson) as Record<string, any>;
  }
}

function hasExpoDependency(packageJson: PackageJson): boolean {
  return Boolean(
    packageJson.dependencies?.expo ||
      packageJson.devDependencies?.expo ||
      packageJson.peerDependencies?.expo,
  );
}

function sanitizeSlug(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'expo-harmony-app';
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  return /^[a-zA-Z][a-zA-Z0-9_.]+$/.test(trimmed) ? trimmed : null;
}

function sanitizeIdentifierSegment(value: string): string {
  const cleaned = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+/, '');

  return cleaned.length > 0 ? cleaned : 'entry';
}
