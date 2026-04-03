import { execFile } from 'node:child_process';
import JSON5 from 'json5';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { promisify } from 'node:util';
import { ensureNormalizedLocalHarCompatibilityShims } from './compatibilityShims';

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

export interface NormalizedLocalHarPackage {
  packageName: string;
  moduleName: string;
  directoryPath: string;
}

export async function normalizeLocalHarDependencies(harmonyProjectRoot: string): Promise<{
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

export async function ensureHarmonyBuildProfileSupportsNormalizedLocalDeps(
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

export async function ensureRnohGeneratedTsShim(harmonyProjectRoot: string): Promise<void> {
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

export async function alignRnohCodegenWithNormalizedLocalPackage(
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

export async function findHarmonyArtifacts(harmonyProjectRoot: string): Promise<string[]> {
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
