import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';

interface NormalizeKnownJavaScriptDependenciesOptions {
  restoreOnCompletion?: boolean;
}

const REANIMATED_CREATE_ANIMATED_COMPONENT_RELATIVE_PATHS = [
  path.join(
    'node_modules',
    'react-native-reanimated',
    'src',
    'createAnimatedComponent',
    'createAnimatedComponent.tsx',
  ),
  path.join(
    'node_modules',
    'react-native-reanimated',
    'lib',
    'module',
    'createAnimatedComponent',
    'createAnimatedComponent.js',
  ),
];

export async function normalizeKnownJavaScriptDependencies(
  projectRoot: string,
  packageJson: Record<string, unknown>,
  options: NormalizeKnownJavaScriptDependenciesOptions = {},
): Promise<() => Promise<void>> {
  if (!isReact19OrNewer(packageJson)) {
    return async () => {};
  }

  const shouldRestore = options.restoreOnCompletion === true;
  const originalContents = new Map<string, string>();

  for (const relativePath of REANIMATED_CREATE_ANIMATED_COMPONENT_RELATIVE_PATHS) {
    const filePath = path.join(projectRoot, relativePath);

    if (!(await fs.pathExists(filePath))) {
      continue;
    }

    const currentContents = await fs.readFile(filePath, 'utf8');
    const nextContents = patchReanimatedCreateAnimatedComponentInvariant(currentContents);

    if (nextContents === currentContents) {
      continue;
    }

    if (shouldRestore) {
      originalContents.set(filePath, currentContents);
    }

    await fs.writeFile(filePath, nextContents);
  }

  if (!shouldRestore) {
    return async () => {};
  }

  return async () => {
    for (const [filePath, contents] of originalContents) {
      await fs.writeFile(filePath, contents);
    }
  };
}

function patchReanimatedCreateAnimatedComponentInvariant(contents: string): string {
  let nextContents = contents;

  nextContents = nextContents.replace("import invariant from 'invariant';\n", '');
  nextContents = nextContents.replace("import invariant from 'invariant';\r\n", '');

  if (nextContents.includes('supports only class components')) {
    nextContents = nextContents.replace(/  invariant\([\s\S]*?\);\r?\n/m, '');
  }

  return nextContents;
}

function isReact19OrNewer(packageJson: Record<string, unknown>): boolean {
  const reactVersion = resolveDeclaredDependencyVersion(packageJson, 'react');

  if (!reactVersion) {
    return false;
  }

  const coercedVersion = semver.coerce(reactVersion);
  return !!coercedVersion && semver.gte(coercedVersion, '19.0.0');
}

function resolveDeclaredDependencyVersion(
  packageJson: Record<string, unknown>,
  packageName: string,
): string | null {
  for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = packageJson[sectionName];
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      continue;
    }

    const version = (section as Record<string, unknown>)[packageName];
    if (typeof version === 'string' && version.length > 0) {
      return version;
    }
  }

  return null;
}
