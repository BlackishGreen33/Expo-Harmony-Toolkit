import fs from 'fs-extra';
import JSON5 from 'json5';
import os from 'os';
import path from 'path';
import semver from 'semver';
import {
  DESIRED_PACKAGE_SCRIPTS,
  GENERATED_DIR,
  GENERATED_SHIMS_DIR,
  HARMONY_ROUTER_ENTRY_FILENAME,
  HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH,
  MANIFEST_FILENAME,
  RNOH_CLI_VERSION,
  RNOH_VERSION,
  TEMPLATE_VERSION,
  TOOLKIT_VERSION,
  TOOLKIT_CONFIG_FILENAME,
} from './constants';
import { DEFAULT_VALIDATED_MATRIX_ID } from '../data/validatedMatrices';
import { getManifestPath, readManifest, readToolkitConfig } from './metadata';
import {
  HarmonyIdentifiers,
  InitResult,
  LoadedProject,
  ManagedFileRecord,
  PackageJson,
  CapabilityDefinition,
  SyncResult,
  TemplateFileDefinition,
  ToolkitConfig,
  ToolkitManifest,
} from '../types';
import {
  CAPABILITY_DEFINITIONS,
  collectCapabilityHarmonyPermissions,
  getCapabilityDefinitionsForProject,
} from '../data/capabilities';
import { UI_STACK_ADAPTER_PACKAGE_NAMES, UI_STACK_VALIDATED_ADAPTERS } from '../data/uiStack';
import {
  createGeneratedSha,
  deriveHarmonyIdentifiers,
  hasDeclaredDependency,
  loadProject,
  resolveRnohHvigorPluginFilename,
} from './project';
import { normalizeKnownJavaScriptDependencies } from './javascriptDependencies';
import { buildDoctorReport, writeDoctorReport } from './report';

const TEMPLATE_ROOT = path.resolve(__dirname, '..', '..', 'templates', 'harmony');

const TEMPLATE_FILE_PATHS = [
  'README.md',
  'build-profile.json5',
  'codelinter.json',
  'hvigor/hvigor-config.json5',
  'hvigorfile.ts',
  'AppScope/app.json5',
  'AppScope/resources/base/element/string.json',
  'AppScope/resources/base/media/app_icon.png',
  'entry/build-profile.json5',
  'entry/hvigorfile.ts',
  'entry/oh-package.json5',
  'entry/src/main/module.json5',
  'entry/src/main/cpp/CMakeLists.txt',
  'entry/src/main/cpp/PackageProvider.cpp',
  'entry/src/main/ets/PackageProvider.ets',
  'entry/src/main/ets/entryability/EntryAbility.ets',
  'entry/src/main/ets/pages/Index.ets',
  'entry/src/main/ets/workers/RNOHWorker.ets',
  'entry/src/main/resources/base/element/color.json',
  'entry/src/main/resources/base/element/string.json',
  'entry/src/main/resources/base/media/background.png',
  'entry/src/main/resources/base/media/foreground.png',
  'entry/src/main/resources/base/media/layered_image.json',
  'entry/src/main/resources/base/media/startIcon.png',
  'entry/src/main/resources/base/profile/main_pages.json',
  'entry/src/main/resources/rawfile/.gitkeep',
] as const;

const AUTOLINKED_FILE_PATHS = [
  path.join('harmony', 'oh-package.json5'),
  path.join('harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
  path.join('harmony', 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
  path.join('harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
] as const;
const RNOH_GENERATED_TS_SHIM_RELATIVE_PATH = path.join(
  'harmony',
  'oh_modules',
  '@rnoh',
  'react-native-openharmony',
  'ts.ts',
);

export const BUILD_REQUIRED_MANAGED_FILE_PATHS = [
  ...AUTOLINKED_FILE_PATHS,
  RNOH_GENERATED_TS_SHIM_RELATIVE_PATH,
] as const;

type PackageJsonNormalizer = (
  packageJson: Record<string, unknown>,
) => Record<string, unknown> | null;

const HARMONY_PACKAGE_JSON_NORMALIZERS: Record<string, PackageJsonNormalizer> = {
  '@react-native-oh-tpl/react-native-gesture-handler': (packageJson) => {
    const harmony =
      packageJson.harmony && typeof packageJson.harmony === 'object' && !Array.isArray(packageJson.harmony)
        ? { ...packageJson.harmony }
        : null;

    if (!harmony || !('codegenConfig' in harmony)) {
      return null;
    }

    delete harmony.codegenConfig;
    return {
      ...packageJson,
      harmony,
    };
  },
};

interface SyncProjectTemplateOptions {
  forceManagedPaths?: readonly string[];
  skipJavaScriptDependencyNormalization?: boolean;
}

export async function initProject(projectRoot: string, force = false): Promise<InitResult> {
  const report = await buildDoctorReport(projectRoot);
  const sync = await syncProjectTemplate(projectRoot, force);
  const packageWarnings = await syncPackageScripts(projectRoot, force);
  const doctorReportPath = await writeDoctorReport(projectRoot, report);

  return {
    report,
    sync,
    packageWarnings,
    doctorReportPath,
  };
}

export async function syncProjectTemplate(
  projectRoot: string,
  force = false,
  options: SyncProjectTemplateOptions = {},
): Promise<SyncResult> {
  const loadedProject = await loadProject(projectRoot);
  const identifiers = deriveHarmonyIdentifiers(loadedProject.expoConfig, loadedProject.packageJson);
  const previousToolkitConfig = await readToolkitConfig(loadedProject.projectRoot);
  const desiredFiles = await buildManagedFiles(loadedProject, identifiers, previousToolkitConfig);
  const previousManifest = await readManifest(loadedProject.projectRoot);
  const forceManagedPaths = new Set(options.forceManagedPaths ?? []);
  const result: SyncResult = {
    writtenFiles: [],
    unchangedFiles: [],
    skippedFiles: [],
    warnings: [],
    manifestPath: getManifestPath(loadedProject.projectRoot),
  };

  result.warnings.push(...collectMetadataWarnings(previousManifest, previousToolkitConfig));

  const manifestFiles: ManagedFileRecord[] = [];

  for (const file of desiredFiles) {
    const targetPath = path.join(loadedProject.projectRoot, file.relativePath);
    const expectedHash = createGeneratedSha(file.contents);
    const previousRecord = previousManifest?.files.find(
      (record) => record.relativePath === file.relativePath,
    );

    if (await fs.pathExists(targetPath)) {
      const currentContents = await fs.readFile(targetPath);

      if (contentsEqual(currentContents, file.contents, file.binary)) {
        result.unchangedFiles.push(file.relativePath);
        manifestFiles.push({ relativePath: file.relativePath, sha1: expectedHash });
        continue;
      }

      const currentHash = createGeneratedSha(currentContents);
      const managedByToolkit = previousRecord?.sha1 === currentHash;
      const shouldForce = force || forceManagedPaths.has(file.relativePath);

      if (!shouldForce && !managedByToolkit) {
        result.skippedFiles.push(file.relativePath);
        result.warnings.push(
          `Skipped ${file.relativePath} because it drifted from the last generated version. Re-run with --force to overwrite it.`,
        );
        continue;
      }
    }

    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, file.contents);
    result.writtenFiles.push(file.relativePath);
    manifestFiles.push({ relativePath: file.relativePath, sha1: expectedHash });
  }

  if (!options.skipJavaScriptDependencyNormalization) {
    await normalizeKnownJavaScriptDependencies(
      loadedProject.projectRoot,
      loadedProject.packageJson as Record<string, unknown>,
    );
  }

  await fs.ensureDir(path.dirname(result.manifestPath));
  const manifest: ToolkitManifest = {
    generatedAt: new Date().toISOString(),
    toolkitVersion: TOOLKIT_VERSION,
    templateVersion: TEMPLATE_VERSION,
    matrixId: DEFAULT_VALIDATED_MATRIX_ID,
    projectRoot: loadedProject.projectRoot,
    files: manifestFiles,
  };
  await fs.writeJson(result.manifestPath, manifest, { spaces: 2 });

  return result;
}

async function buildManagedFiles(
  loadedProject: LoadedProject,
  identifiers: HarmonyIdentifiers,
  previousToolkitConfig: ToolkitConfig | null,
): Promise<TemplateFileDefinition[]> {
  const hasExpoRouter = usesExpoRouter(loadedProject.packageJson);
  const enabledCapabilities = getCapabilityDefinitionsForProject(loadedProject.packageJson);
  const requestedHarmonyPermissions = collectCapabilityHarmonyPermissions(loadedProject.packageJson);
  const hvigorPluginFilename = await resolveRnohHvigorPluginFilename(loadedProject.projectRoot);
  const renderedHarmonyRootPackage = renderTemplate(
    await fs.readFile(path.join(TEMPLATE_ROOT, 'oh-package.json5'), 'utf8'),
    loadedProject,
    identifiers,
    hvigorPluginFilename,
  );
  const templateFiles = await Promise.all(
    TEMPLATE_FILE_PATHS.map(async (relativePath) => {
      const templatePath = path.join(TEMPLATE_ROOT, relativePath);
      const binary = isBinaryTemplate(relativePath);
      const rawContents = await fs.readFile(templatePath);
      const contents = binary
        ? rawContents
        : renderTemplate(rawContents.toString('utf8'), loadedProject, identifiers, hvigorPluginFilename);

      return {
        relativePath: path.join('harmony', relativePath),
        contents:
          relativePath === 'entry/src/main/module.json5'
            ? renderEntryModuleConfig(identifiers.entryModuleName, requestedHarmonyPermissions)
            : relativePath === 'entry/src/main/resources/base/element/string.json'
              ? renderEntryStringResources(
                  `${identifiers.appName} official minimal Harmony sample`,
                  identifiers.appName,
                  requestedHarmonyPermissions,
                )
            : contents,
        binary,
      };
    }),
  );
  const autolinkedFiles = await buildAutolinkedManagedFiles(
    loadedProject.projectRoot,
    renderedHarmonyRootPackage,
  );

  const nextToolkitConfig: ToolkitConfig = {
    generatedAt: new Date().toISOString(),
    toolkitVersion: TOOLKIT_VERSION,
    templateVersion: TEMPLATE_VERSION,
    matrixId: DEFAULT_VALIDATED_MATRIX_ID,
    rnohVersion: RNOH_VERSION,
    rnohCliVersion: RNOH_CLI_VERSION,
    bundleName: identifiers.bundleName,
    entryModuleName: identifiers.entryModuleName,
    capabilities: enabledCapabilities.map((capability) => capability.id),
    requestedHarmonyPermissions,
    project: {
      name: loadedProject.expoConfig.name ?? identifiers.appName,
      slug: loadedProject.expoConfig.slug ?? identifiers.slug,
      version: loadedProject.expoConfig.version ?? '1.0.0',
      hvigorPluginFilename,
    },
  };
  const toolkitConfig = stabilizeToolkitConfigTimestamp(previousToolkitConfig, nextToolkitConfig);

  return [
    ...templateFiles,
    ...autolinkedFiles,
    {
      relativePath: RNOH_GENERATED_TS_SHIM_RELATIVE_PATH,
      contents: renderRnohGeneratedTsShim(),
    },
    {
      relativePath: 'metro.harmony.config.js',
      contents: renderMetroConfig(enabledCapabilities),
    },
    {
      relativePath: path.join(GENERATED_SHIMS_DIR, 'react-native-safe-area-context', 'index.js'),
      contents: renderReactNativeSafeAreaContextHarmonyShim(),
    },
    {
      relativePath: path.join(GENERATED_SHIMS_DIR, 'expo-modules-core', 'index.js'),
      contents: renderExpoModulesCoreHarmonyShim(loadedProject.expoConfig, identifiers),
    },
    ...CAPABILITY_DEFINITIONS.map(
      (capability) =>
        ({
          relativePath: path.join(GENERATED_SHIMS_DIR, capability.packageName, 'index.js'),
          contents: renderCapabilityModuleShim(capability),
        }) satisfies TemplateFileDefinition,
    ),
    {
      relativePath: HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH,
      contents: renderHarmonyRuntimePrelude(),
    },
    ...(hasExpoRouter
      ? [
          {
            relativePath: HARMONY_ROUTER_ENTRY_FILENAME,
            contents: renderRouterHarmonyEntry(identifiers),
          } satisfies TemplateFileDefinition,
        ]
      : []),
    {
      relativePath: path.join(GENERATED_DIR, TOOLKIT_CONFIG_FILENAME),
      contents: JSON.stringify(toolkitConfig, null, 2) + '\n',
    },
  ];
}

async function buildAutolinkedManagedFiles(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<TemplateFileDefinition[]> {
  const generated = await generateAutolinkingArtifacts(projectRoot, harmonyRootPackageContents);

  return [
    {
      relativePath: AUTOLINKED_FILE_PATHS[0],
      contents: generated.ohPackageContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[1],
      contents: generated.etsFactoryContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[2],
      contents: generated.cppFactoryContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[3],
      contents: generated.cmakeContents,
    },
  ];
}

async function generateAutolinkingArtifacts(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<{
  ohPackageContents: string;
  etsFactoryContents: string;
  cppFactoryContents: string;
  cmakeContents: string;
}> {
  const rnohCliPackageJsonPath = resolveProjectPackageJson(projectRoot, '@react-native-oh/react-native-harmony-cli');
  const managedOhPackageContents = await buildManagedHarmonyRootPackageContents(
    projectRoot,
    harmonyRootPackageContents,
  );
  const managedAutolinkingEntries = await resolveManagedAutolinkingEntries(projectRoot);

  if (!rnohCliPackageJsonPath) {
    return createEmptyAutolinkingArtifacts(managedOhPackageContents, managedAutolinkingEntries);
  }

  try {
    const restoreNormalizedHarmonyPackageJsons =
      await normalizeKnownHarmonyPackageJsons(projectRoot);

    try {
      const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-autolinking-'));

      try {
        const temporaryHarmonyRoot = path.join(temporaryRoot, 'harmony');

        await fs.ensureDir(path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'ets'));
        await fs.ensureDir(path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp'));
        await fs.writeFile(path.join(temporaryHarmonyRoot, 'oh-package.json5'), harmonyRootPackageContents);
        await runRnohLinkHarmonyCommand(projectRoot, rnohCliPackageJsonPath, temporaryHarmonyRoot);

        const normalizedEtsFactoryContents = await normalizeAutolinkingEtsFactoryContents(
          projectRoot,
          await fs.readFile(
            path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
            'utf8',
          ),
        );
        const normalizedCppFactoryContents = await normalizeAutolinkingCppFactoryContents(
          projectRoot,
          await fs.readFile(
            path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
            'utf8',
          ),
        );
        const normalizedCmakeContents = await fs.readFile(
          path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
          'utf8',
        );

        return {
          ohPackageContents: managedOhPackageContents,
          etsFactoryContents: injectManagedAutolinkingIntoEtsFactory(
            normalizedEtsFactoryContents,
            managedAutolinkingEntries,
          ),
          cppFactoryContents: injectManagedAutolinkingIntoCppFactory(
            normalizedCppFactoryContents,
            managedAutolinkingEntries,
          ),
          cmakeContents: injectManagedAutolinkingIntoCmake(
            normalizedCmakeContents,
            managedAutolinkingEntries,
          ),
        };
      } finally {
        await fs.remove(temporaryRoot);
      }
    } finally {
      await restoreNormalizedHarmonyPackageJsons();
    }
  } catch {
    return createEmptyAutolinkingArtifacts(managedOhPackageContents, managedAutolinkingEntries);
  }
}

type ManagedAutolinkingEntry = {
  adapterPackageName: string;
  etsImportPath: string;
  etsPackageName: string;
  cppHeaderName: string;
  cppPackageName: string;
  cmakeTargetName: string;
};

async function resolveManagedAutolinkingEntries(projectRoot: string): Promise<ManagedAutolinkingEntry[]> {
  const entries: Array<ManagedAutolinkingEntry | null> = await Promise.all(
    UI_STACK_VALIDATED_ADAPTERS.map(async (adapter) => {
      if (adapter.supportsAutolinking || !adapter.managedAutolinking) {
        return null;
      }

      const dependencySpecifier = await resolveHarmonyAdapterHarDependency(projectRoot, adapter.adapterPackageName);

      if (!dependencySpecifier) {
        return null;
      }

      return {
        adapterPackageName: adapter.adapterPackageName,
        ...adapter.managedAutolinking,
      } satisfies ManagedAutolinkingEntry;
    }),
  );

  return entries.filter((entry): entry is ManagedAutolinkingEntry => entry !== null);
}

export async function normalizeKnownHarmonyPackageJsons(
  projectRoot: string,
): Promise<() => Promise<void>> {
  const originalContentsByPath = new Map<string, string>();

  for (const [packageName, normalizePackageJson] of Object.entries(HARMONY_PACKAGE_JSON_NORMALIZERS)) {
    const packageJsonPath = resolveProjectPackageJson(projectRoot, packageName);

    if (!packageJsonPath || originalContentsByPath.has(packageJsonPath)) {
      continue;
    }

    try {
      const currentContents = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(currentContents) as Record<string, unknown>;
      const normalizedPackageJson = normalizePackageJson(packageJson);

      if (!normalizedPackageJson) {
        continue;
      }

      originalContentsByPath.set(packageJsonPath, currentContents);
      await fs.writeFile(packageJsonPath, JSON.stringify(normalizedPackageJson, null, 2) + '\n');
    } catch {
      // Ignore malformed adapter package metadata and let downstream tooling surface the failure.
    }
  }

  return async () => {
    for (const [packageJsonPath, originalContents] of originalContentsByPath) {
      await fs.writeFile(packageJsonPath, originalContents);
    }
  };
}

async function normalizeAutolinkingEtsFactoryContents(
  projectRoot: string,
  contents: string,
): Promise<string> {
  let normalizedContents = contents
    .replace(
      /import type \{\s*RNPackageContext\s*,\s*RNOHPackage\s*\} from '@rnoh\/react-native-openharmony';/,
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
    )
    .replace(
      /export function createRNOHPackages\(([^)]*)\):\s*RNOHPackage\[\]/,
      'export function createRNOHPackages($1): RNPackage[]',
    );

  const gestureHandlerPackageJsonPath = resolveProjectPackageJson(
    projectRoot,
    '@react-native-oh-tpl/react-native-gesture-handler',
  );

  if (!gestureHandlerPackageJsonPath) {
    return normalizedContents;
  }

  try {
    const gestureHandlerPackageJson = (await fs.readJson(gestureHandlerPackageJsonPath)) as PackageJson & {
      harmony?: {
        codegenConfig?: unknown;
      };
    };

    if (gestureHandlerPackageJson.harmony?.codegenConfig) {
      return normalizedContents;
    }
  } catch {
    return normalizedContents;
  }

  let gestureHandlerPackageImportName: string | null = null;
  normalizedContents = normalizedContents.replace(
    /import\s+([A-Za-z_$][\w$]*)\s+from ['"]@react-native-oh-tpl\/react-native-gesture-handler['"];?/,
    (_match, importName: string) => {
      gestureHandlerPackageImportName = importName;
      return "import { GestureHandlerPackage } from '@react-native-oh-tpl/react-native-gesture-handler/ts';";
    },
  );

  if (!gestureHandlerPackageImportName) {
    return normalizedContents;
  }

  return normalizedContents.replace(
    new RegExp(`new\\s+${escapeRegExp(gestureHandlerPackageImportName)}\\(ctx\\)`, 'g'),
    'new GestureHandlerPackage(ctx)',
  );
}

function injectManagedAutolinkingIntoEtsFactory(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingImports = entries
    .filter((entry) => !contents.includes(`from '${entry.etsImportPath}'`))
    .map((entry) => `import { ${entry.etsPackageName} } from '${entry.etsImportPath}';`);

  if (missingImports.length > 0) {
    contents = contents.replace(
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
      `import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';\n${missingImports.join('\n')}`,
    );
  }

  const missingFactoryEntries = entries
    .filter((entry) => !contents.includes(`new ${entry.etsPackageName}(ctx)`))
    .map((entry) => `    new ${entry.etsPackageName}(ctx),`);

  if (missingFactoryEntries.length > 0) {
    contents = contents.replace(/return \[\n/, `return [\n${missingFactoryEntries.join('\n')}\n`);
  }

  return contents;
}

async function normalizeAutolinkingCppFactoryContents(
  projectRoot: string,
  contents: string,
): Promise<string> {
  const gestureHandlerPackageJsonPath = resolveProjectPackageJson(
    projectRoot,
    '@react-native-oh-tpl/react-native-gesture-handler',
  );

  if (!gestureHandlerPackageJsonPath) {
    return contents;
  }

  try {
    const gestureHandlerPackageJson = (await fs.readJson(gestureHandlerPackageJsonPath)) as PackageJson & {
      harmony?: {
        codegenConfig?: unknown;
      };
    };

    if (gestureHandlerPackageJson.harmony?.codegenConfig) {
      return contents;
    }
  } catch {
    return contents;
  }

  return contents
    .replace(
      /#include "ReactNativeOhTplReactNativeGestureHandlerPackage\.h"/,
      '#include "RnohReactNativeHarmonyGestureHandlerPackage.h"',
    )
    .replace(
      /\brnoh::ReactNativeOhTplReactNativeGestureHandlerPackage\b/g,
      'rnoh::RnohReactNativeHarmonyGestureHandlerPackage',
    );
}

function injectManagedAutolinkingIntoCppFactory(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingIncludes = entries
    .filter((entry) => !contents.includes(`#include "${entry.cppHeaderName}"`))
    .map((entry) => `#include "${entry.cppHeaderName}"`);

  if (missingIncludes.length > 0) {
    contents = contents.replace(
      '#include "RNOH/Package.h"',
      `#include "RNOH/Package.h"\n${missingIncludes.join('\n')}`,
    );
  }

  const missingFactoryEntries = entries
    .filter((entry) => !contents.includes(`std::make_shared<rnoh::${entry.cppPackageName}>(ctx)`))
    .map((entry) => `    std::make_shared<rnoh::${entry.cppPackageName}>(ctx),`);

  if (missingFactoryEntries.length > 0) {
    contents = contents.replace(/return \{\n/, `return {\n${missingFactoryEntries.join('\n')}\n`);
  }

  return contents;
}

function injectManagedAutolinkingIntoCmake(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingSubdirectories = entries
    .filter((entry) => !contents.includes(`./${entry.cmakeTargetName}`))
    .map(
      (entry) =>
        `    add_subdirectory("\${OH_MODULES_DIR}/${entry.adapterPackageName}/src/main/cpp" ./${entry.cmakeTargetName})`,
    );

  if (missingSubdirectories.length > 0) {
    contents = contents.replace(
      /function\(autolink_libraries target\)\n/,
      `function(autolink_libraries target)\n${missingSubdirectories.join('\n')}\n`,
    );
  }

  const missingLibraryTargets = entries
    .filter((entry) => !contents.includes(`        ${entry.cmakeTargetName}`))
    .map((entry) => `        ${entry.cmakeTargetName}`);

  if (missingLibraryTargets.length > 0) {
    contents = contents.replace(
      /set\(AUTOLINKED_LIBRARIES\n/,
      `set(AUTOLINKED_LIBRARIES\n${missingLibraryTargets.join('\n')}\n`,
    );
  }

  return contents;
}

async function runRnohLinkHarmonyCommand(
  projectRoot: string,
  rnohCliPackageJsonPath: string,
  harmonyProjectPath: string,
): Promise<void> {
  const rnohCliRoot = path.dirname(rnohCliPackageJsonPath);
  const { commandLinkHarmony } = require(path.join(
    rnohCliRoot,
    'dist',
    'commands',
    'link-harmony.js',
  )) as {
    commandLinkHarmony: {
      func: (_argv: unknown[], _config: unknown, rawArgs: Record<string, unknown>) => Promise<void>;
    };
  };

  await commandLinkHarmony.func([], {}, {
    harmonyProjectPath,
    nodeModulesPath: path.join(projectRoot, 'node_modules'),
    cmakeAutolinkPathRelativeToHarmony: './entry/src/main/cpp/autolinking.cmake',
    cppRnohPackagesFactoryPathRelativeToHarmony: './entry/src/main/cpp/RNOHPackagesFactory.h',
    etsRnohPackagesFactoryPathRelativeToHarmony: './entry/src/main/ets/RNOHPackagesFactory.ets',
    ohPackagePathRelativeToHarmony: './oh-package.json5',
    includeNpmPackages: UI_STACK_ADAPTER_PACKAGE_NAMES,
  });
}

async function buildManagedHarmonyRootPackageContents(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<string> {
  const parsedPackageJson = JSON5.parse(harmonyRootPackageContents) as {
    dependencies?: Record<string, string>;
  };
  const dependencies = {
    ...(parsedPackageJson.dependencies ?? {}),
    ...(await readPreservedHarmonyRootDependencies(projectRoot)),
  };

  for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
    const dependencySpecifier = await resolveHarmonyAdapterHarDependency(projectRoot, adapter.adapterPackageName);

    if (dependencySpecifier) {
      dependencies[adapter.adapterPackageName] = dependencySpecifier;
    }
  }

  parsedPackageJson.dependencies = sortRecordByKey(dependencies);
  return JSON5.stringify(parsedPackageJson, null, 2) + '\n';
}

async function readPreservedHarmonyRootDependencies(
  projectRoot: string,
): Promise<Record<string, string>> {
  const harmonyRootPackagePath = path.join(projectRoot, 'harmony', 'oh-package.json5');

  if (!(await fs.pathExists(harmonyRootPackagePath))) {
    return {};
  }

  const currentHarmonyRootPackage = JSON5.parse(
    await fs.readFile(harmonyRootPackagePath, 'utf8'),
  ) as {
    dependencies?: Record<string, unknown>;
  };
  const preservedDependencies: Record<string, string> = {};
  const validatedAdapterPackageNames = new Set<string>(UI_STACK_ADAPTER_PACKAGE_NAMES);

  for (const [packageName, specifier] of Object.entries(
    currentHarmonyRootPackage.dependencies ?? {},
  )) {
    if (typeof specifier !== 'string') {
      continue;
    }

    if (validatedAdapterPackageNames.has(packageName)) {
      continue;
    }

    preservedDependencies[packageName] = specifier;
  }

  return preservedDependencies;
}

async function resolveHarmonyAdapterHarDependency(
  projectRoot: string,
  adapterPackageName: string,
): Promise<string | null> {
  const adapterEntry = UI_STACK_VALIDATED_ADAPTERS.find(
    (candidate) => candidate.adapterPackageName === adapterPackageName,
  );

  if (!adapterEntry) {
    return null;
  }

  const adapterRoot = path.join(projectRoot, 'node_modules', ...adapterPackageName.split('/'));
  const harPath = path.join(adapterRoot, 'harmony', adapterEntry.harmonyHarFileName);

  if (!(await fs.pathExists(harPath))) {
    return null;
  }

  const relativeHarPath = path.relative(path.join(projectRoot, 'harmony'), harPath).replace(/\\/g, '/');
  return `file:${relativeHarPath}`;
}

function createEmptyAutolinkingArtifacts(
  harmonyRootPackageContents: string,
  managedAutolinkingEntries: readonly ManagedAutolinkingEntry[],
): {
  ohPackageContents: string;
  etsFactoryContents: string;
  cppFactoryContents: string;
  cmakeContents: string;
} {
  return {
    ohPackageContents: harmonyRootPackageContents,
    etsFactoryContents: injectManagedAutolinkingIntoEtsFactory(`/*
 * This file was generated by Expo Harmony Toolkit autolinking.
 * DO NOT modify it manually, your changes WILL be overwritten.
 */
import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';

export function createRNOHPackages(_ctx: RNPackageContext): RNPackage[] {
  return [];
}
`,
    managedAutolinkingEntries,
    ),
    cppFactoryContents: injectManagedAutolinkingIntoCppFactory(`/*
 * This file was generated by Expo Harmony Toolkit autolinking.
 * DO NOT modify it manually, your changes WILL be overwritten.
 */
#pragma once
#include "RNOH/Package.h"

std::vector<rnoh::Package::Shared> createRNOHPackages(const rnoh::Package::Context &_ctx) {
  return {};
}
`,
    managedAutolinkingEntries,
    ),
    cmakeContents: injectManagedAutolinkingIntoCmake(`# This file was generated by Expo Harmony Toolkit autolinking.
# DO NOT modify it manually, your changes WILL be overwritten.
cmake_minimum_required(VERSION 3.5)

function(autolink_libraries target)
  set(AUTOLINKED_LIBRARIES
  )

  foreach(lib \${AUTOLINKED_LIBRARIES})
    target_link_libraries(\${target} PUBLIC \${lib})
  endforeach()
endfunction()
`,
    managedAutolinkingEntries,
    ),
  };
}

function resolveProjectPackageJson(projectRoot: string, request: string): string | null {
  const directPackageJsonPath = path.join(projectRoot, 'node_modules', ...request.split('/'), 'package.json');

  if (fs.existsSync(directPackageJsonPath)) {
    return directPackageJsonPath;
  }

  try {
    return require.resolve(path.join(request, 'package.json'), {
      paths: [projectRoot],
    });
  } catch {
    return null;
  }
}

async function syncPackageScripts(projectRoot: string, _force: boolean): Promise<string[]> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
  const desiredScripts = buildDesiredPackageScripts(packageJson);
  const desiredPnpmOverrides = buildDesiredPnpmOverrides(packageJson);
  const scripts = { ...(packageJson.scripts ?? {}) };
  const pnpm = packageJson.pnpm && typeof packageJson.pnpm === 'object' ? { ...packageJson.pnpm } : {};
  const pnpmOverrides = { ...(pnpm.overrides ?? {}) };
  const warnings: string[] = [];
  let didChange = false;

  for (const [scriptName, desiredCommand] of Object.entries(desiredScripts)) {
    const currentCommand = scripts[scriptName];

    if (!currentCommand) {
      scripts[scriptName] = desiredCommand;
      didChange = true;
      continue;
    }

    if (currentCommand === desiredCommand) {
      continue;
    }

    if (isEquivalentToolkitScript(scriptName, currentCommand, desiredCommand)) {
      continue;
    }

    warnings.push(
      `Left package.json script "${scriptName}" unchanged because it already exists with different contents.`,
    );
  }

  for (const [packageName, desiredSpecifier] of Object.entries(desiredPnpmOverrides)) {
    const currentSpecifier = pnpmOverrides[packageName];

    if (!currentSpecifier) {
      pnpmOverrides[packageName] = desiredSpecifier;
      didChange = true;
      continue;
    }

    if (currentSpecifier === desiredSpecifier) {
      continue;
    }

    warnings.push(
      `Left package.json pnpm.overrides["${packageName}"] unchanged because it already exists with different contents.`,
    );
  }

  if (didChange) {
    packageJson.scripts = sortRecordByKey(scripts);
    if (Object.keys(pnpmOverrides).length > 0) {
      pnpm.overrides = sortRecordByKey(pnpmOverrides);
      packageJson.pnpm = pnpm;
    }
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return warnings;
}

function renderTemplate(
  template: string,
  loadedProject: LoadedProject,
  identifiers: HarmonyIdentifiers,
  hvigorPluginFilename: string,
): string {
  const appDescription = `${identifiers.appName} official minimal Harmony sample`;
  const replacements: Record<string, string> = {
    APP_NAME: identifiers.appName,
    APP_SLUG: identifiers.slug,
    APP_VERSION: String(loadedProject.expoConfig.version ?? loadedProject.packageJson.version ?? '1.0.0'),
    APP_DESCRIPTION: appDescription,
    BUNDLE_NAME: identifiers.bundleName,
    ENTRY_MODULE_NAME: identifiers.entryModuleName,
    TEMPLATE_VERSION,
    RNOH_VERSION,
    RNOH_CLI_VERSION,
    RNOH_HVIGOR_PLUGIN_FILENAME: hvigorPluginFilename,
  };

  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => replacements[key] ?? '');
}

function renderRnohGeneratedTsShim(): string {
  let relativeTarget = path.relative(
    path.dirname(RNOH_GENERATED_TS_SHIM_RELATIVE_PATH),
    path.join(
      'harmony',
      'expo-harmony-local-deps',
      'rnoh-react-native-openharmony-react_native_openharmony',
      'ts.ts',
    ),
  );

  relativeTarget = relativeTarget.replace(/\\/g, '/').replace(/\.ts$/, '');

  if (!relativeTarget.startsWith('.')) {
    relativeTarget = `./${relativeTarget}`;
  }

  return `export * from '${relativeTarget}';\n`;
}

function renderEntryModuleConfig(
  entryModuleName: string,
  requestedHarmonyPermissions: readonly string[],
): string {
  const requestPermissions = [
    { name: 'ohos.permission.INTERNET' },
    ...requestedHarmonyPermissions.map((permission) =>
      createUserGrantHarmonyPermission(permission),
    ),
  ];

  return (
    JSON.stringify(
      {
        module: {
          name: entryModuleName,
          type: 'entry',
          description: '$string:module_desc',
          mainElement: 'EntryAbility',
          deviceTypes: ['default'],
          deliveryWithInstall: true,
          installationFree: false,
          pages: '$profile:main_pages',
          requestPermissions,
          abilities: [
            {
              name: 'EntryAbility',
              srcEntry: './ets/entryability/EntryAbility.ets',
              description: '$string:EntryAbility_desc',
              icon: '$media:layered_image',
              label: '$string:EntryAbility_label',
              startWindowIcon: '$media:startIcon',
              startWindowBackground: '$color:start_window_background',
              visible: true,
            },
          ],
        },
      },
      null,
      2,
    ) + '\n'
  );
}

function createUserGrantHarmonyPermission(permissionName: string): {
  name: string;
  reason: string;
  usedScene: {
    abilities: string[];
    when: 'inuse' | 'always';
  };
} {
  return {
    name: permissionName,
    reason: `$string:${getHarmonyPermissionReasonKey(permissionName)}`,
    usedScene: {
      abilities: ['EntryAbility'],
      when: getHarmonyPermissionWhen(permissionName),
    },
  };
}

function getHarmonyPermissionReasonKey(permissionName: string): string {
  return permissionName
    .replace(/^ohos\.permission\./, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') + '_reason';
}

function getHarmonyPermissionReasonValue(permissionName: string): string {
  switch (permissionName) {
    case 'ohos.permission.CAMERA':
      return 'Camera access is required for Harmony preview image capture flows.';
    case 'ohos.permission.READ_IMAGEVIDEO':
      return 'Media library access is required for Harmony preview image selection flows.';
    case 'ohos.permission.LOCATION':
    case 'ohos.permission.APPROXIMATELY_LOCATION':
      return 'Location access is required for Harmony preview location flows.';
    case 'ohos.permission.NOTIFICATION_CONTROLLER':
      return 'Notification access is required for Harmony preview notification flows.';
    default:
      return 'This Harmony permission is required for managed preview native capability flows.';
  }
}

function getHarmonyPermissionWhen(permissionName: string): 'inuse' | 'always' {
  switch (permissionName) {
    case 'ohos.permission.NOTIFICATION_CONTROLLER':
      return 'always';
    default:
      return 'inuse';
  }
}

function renderEntryStringResources(
  appDescription: string,
  appName: string,
  requestedHarmonyPermissions: readonly string[],
): string {
  const stringEntries = [
    {
      name: 'module_desc',
      value: appDescription,
    },
    {
      name: 'EntryAbility_desc',
      value: appDescription,
    },
    {
      name: 'EntryAbility_label',
      value: appName,
    },
    ...requestedHarmonyPermissions.map((permissionName) => ({
      name: getHarmonyPermissionReasonKey(permissionName),
      value: getHarmonyPermissionReasonValue(permissionName),
    })),
  ];

  return JSON.stringify(
    {
      string: stringEntries,
    },
    null,
    2,
  ) + '\n';
}

function renderCapabilityModuleShim(capability: CapabilityDefinition): string {
  switch (capability.packageName) {
    case 'expo-file-system':
      return renderExpoFileSystemPreviewShim(capability);
    case 'expo-image-picker':
      return renderExpoImagePickerPreviewShim(capability);
    case 'expo-location':
      return renderExpoLocationPreviewShim(capability);
    case 'expo-camera':
      return renderExpoCameraPreviewShim(capability);
    default:
      return renderUnsupportedCapabilityShim(capability);
  }
}

function renderMetroConfig(enabledCapabilities: readonly CapabilityDefinition[]): string {
  const previewCapabilityAliases = enabledCapabilities
    .filter((capability) => capability.supportTier === 'preview' || capability.supportTier === 'experimental')
    .map(
      (capability) =>
        `  '${capability.packageName}': path.resolve(__dirname, '.expo-harmony/shims/${capability.packageName}'),`,
    )
    .join('\n');

  return `const fs = require('fs');
const path = require('path');

process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT ?? 'app';

const { getDefaultConfig } = require('expo/metro-config');
const { createHarmonyMetroConfig } = require('@react-native-oh/react-native-harmony/metro.config');

const defaultConfig = getDefaultConfig(__dirname);
const harmonyConfig = createHarmonyMetroConfig({
  reactNativeHarmonyPackageName: '@react-native-oh/react-native-harmony',
});
const expoHarmonyShims = {
  'expo-modules-core': path.resolve(__dirname, '.expo-harmony/shims/expo-modules-core'),
  'react-native-safe-area-context': path.resolve(
    __dirname,
    '.expo-harmony/shims/react-native-safe-area-context',
  ),
${previewCapabilityAliases ? `${previewCapabilityAliases}\n` : ''}};
const uiStackRootModuleAliases = {
  'react-native-gesture-handler': path.resolve(__dirname, 'node_modules/react-native-gesture-handler'),
  'react-native-reanimated': path.resolve(__dirname, 'node_modules/react-native-reanimated'),
  'react-native-svg': path.resolve(__dirname, 'node_modules/react-native-svg'),
};
const resolvePackageAlias = (context, moduleName, platform, aliases) => {
  for (const [aliasedModuleName, aliasedModulePath] of Object.entries(aliases)) {
    if (moduleName === aliasedModuleName) {
      return context.resolveRequest(context, aliasedModulePath, platform);
    }

    if (moduleName.startsWith(\`\${aliasedModuleName}/\`)) {
      return context.resolveRequest(
        context,
        path.join(aliasedModulePath, moduleName.slice(aliasedModuleName.length + 1)),
        platform,
      );
    }
  }

  return null;
};
const resolveUiStackModuleAlias = (context, moduleName, platform) =>
  resolvePackageAlias(context, moduleName, platform, uiStackRootModuleAliases);
const resolveExpoHarmonyModuleAlias = (context, moduleName, platform) =>
  resolvePackageAlias(context, moduleName, platform, expoHarmonyShims);
const reactNativeCompatibilitySourceExts = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json'];
const reactNativeCompatibilityPackageMarkers = [
  path.sep + '@react-native-oh' + path.sep + 'react-native-harmony' + path.sep,
  path.sep + 'react-native' + path.sep,
];
const findFirstExistingCompatibilityModule = (candidateBasePath, platforms) => {
  for (const candidatePlatform of platforms) {
    for (const candidateExtension of reactNativeCompatibilitySourceExts) {
      const candidatePath = candidatePlatform
        ? \`\${candidateBasePath}.\${candidatePlatform}.\${candidateExtension}\`
        : \`\${candidateBasePath}.\${candidateExtension}\`;

      if (fs.existsSync(candidatePath)) {
        return { candidatePath, candidatePlatform };
      }
    }
  }

  return null;
};
const resolveReactNativeCompatibilityWrapper = (context, moduleName, platform) => {
  if (platform !== 'harmony' || !context.originModulePath || !moduleName.startsWith('.')) {
    return null;
  }

  const originModulePath = context.originModulePath;
  const isReactNativeCompatibilityWrapper = reactNativeCompatibilityPackageMarkers.some((marker) =>
    originModulePath.includes(marker),
  );

  if (!isReactNativeCompatibilityWrapper) {
    return null;
  }

  const originExtension = path.extname(originModulePath);
  const originBasename = path.basename(originModulePath, originExtension);
  const candidateModulePath = path.resolve(path.dirname(originModulePath), moduleName);
  const candidateModuleExtension = path.extname(candidateModulePath);
  const candidateBasename = path.basename(candidateModulePath, candidateModuleExtension);

  const candidateBasePath = candidateModuleExtension
    ? candidateModulePath.slice(0, -candidateModuleExtension.length)
    : candidateModulePath;

  if (candidateBasename === originBasename) {
    const compatibilityWrapperCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
      'harmony',
      'native',
      'android',
      'ios',
    ]);

    if (compatibilityWrapperCandidate) {
      return context.resolveRequest(
        context,
        compatibilityWrapperCandidate.candidatePath,
        compatibilityWrapperCandidate.candidatePlatform || platform,
      );
    }

    return null;
  }

  const standardResolutionCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
    'harmony',
    'native',
    '',
  ]);

  if (standardResolutionCandidate) {
    return null;
  }

  const compatibilityFallbackCandidate = findFirstExistingCompatibilityModule(candidateBasePath, [
    'android',
    'ios',
  ]);

  if (compatibilityFallbackCandidate) {
    return context.resolveRequest(
      context,
      compatibilityFallbackCandidate.candidatePath,
      compatibilityFallbackCandidate.candidatePlatform || platform,
    );
  }

  return null;
};
const resolveExpoHarmonyShim = (context, moduleName, platform) => {
  const uiStackModuleAliasResolution = resolveUiStackModuleAlias(context, moduleName, platform);

  if (uiStackModuleAliasResolution) {
    return uiStackModuleAliasResolution;
  }

  const expoHarmonyModuleAliasResolution = resolveExpoHarmonyModuleAlias(context, moduleName, platform);

  if (expoHarmonyModuleAliasResolution) {
    return expoHarmonyModuleAliasResolution;
  }

  const compatibilityWrapperResolution = resolveReactNativeCompatibilityWrapper(
    context,
    moduleName,
    platform,
  );

  if (compatibilityWrapperResolution) {
    return compatibilityWrapperResolution;
  }

  const harmonyResolveRequest = harmonyConfig.resolver?.resolveRequest;

  if (typeof harmonyResolveRequest === 'function') {
    return harmonyResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = {
  ...defaultConfig,
  ...harmonyConfig,
  projectRoot: __dirname,
  server: {
    ...(defaultConfig.server ?? {}),
    ...(harmonyConfig.server ?? {}),
    unstable_serverRoot: __dirname,
  },
  transformer: {
    ...(defaultConfig.transformer ?? {}),
    ...(harmonyConfig.transformer ?? {}),
  },
  serializer: {
    ...(defaultConfig.serializer ?? {}),
    ...(harmonyConfig.serializer ?? {}),
  },
  resolver: {
    ...(defaultConfig.resolver ?? {}),
    ...(harmonyConfig.resolver ?? {}),
    extraNodeModules: {
      ...((defaultConfig.resolver?.extraNodeModules ?? {})),
      ...((harmonyConfig.resolver?.extraNodeModules ?? {})),
      ...uiStackRootModuleAliases,
      ...expoHarmonyShims,
    },
    resolveRequest: resolveExpoHarmonyShim,
    sourceExts: [
      'harmony.ts',
      'harmony.tsx',
      'harmony.js',
      'harmony.jsx',
      ...((harmonyConfig.resolver?.sourceExts ?? defaultConfig.resolver?.sourceExts ?? ['ts', 'tsx', 'js', 'jsx', 'json'])),
    ],
  },
};
`;
}

function renderUnsupportedCapabilityShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

function createPreviewError() {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    '${capability.packageName} is classified as ${capability.supportTier} for Harmony, but no managed runtime shim has been wired yet.',
  );
}

function unavailable() {
  throw createPreviewError();
}

module.exports = new Proxy(
  {},
  {
    get(_target, propertyName) {
      if (propertyName === '__esModule') {
        return true;
      }

      return unavailable;
    },
  },
);
`;
}

function renderExpoFileSystemPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, but runtime file-system behavior is not verified yet.';

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

module.exports = {
  cacheDirectory: 'file:///expo-harmony/cache/',
  documentDirectory: 'file:///expo-harmony/document/',
  bundleDirectory: 'file:///expo-harmony/bundle/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
  FileSystemSessionType: {
    BACKGROUND: 0,
    FOREGROUND: 1,
  },
  getInfoAsync(path) {
    return unavailable('getInfoAsync(' + String(path) + ')');
  },
  readAsStringAsync(path) {
    return unavailable('readAsStringAsync(' + String(path) + ')');
  },
  writeAsStringAsync(path) {
    return unavailable('writeAsStringAsync(' + String(path) + ')');
  },
  deleteAsync(path) {
    return unavailable('deleteAsync(' + String(path) + ')');
  },
  makeDirectoryAsync(path) {
    return unavailable('makeDirectoryAsync(' + String(path) + ')');
  },
  readDirectoryAsync(path) {
    return unavailable('readDirectoryAsync(' + String(path) + ')');
  },
  copyAsync(options) {
    return unavailable('copyAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  moveAsync(options) {
    return unavailable('moveAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  downloadAsync(url) {
    return unavailable('downloadAsync(' + String(url) + ')');
  },
};
`;
}

function renderExpoImagePickerPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, but picker and camera flows still need device-side validation.';

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

module.exports = {
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
  UIImagePickerPresentationStyle: {
    AUTOMATIC: 'automatic',
    FULL_SCREEN: 'fullScreen',
    PAGE_SHEET: 'pageSheet',
    FORM_SHEET: 'formSheet',
    CURRENT_CONTEXT: 'currentContext',
    OVER_FULL_SCREEN: 'overFullScreen',
  },
  requestCameraPermissionsAsync() {
    return unavailable('requestCameraPermissionsAsync');
  },
  requestMediaLibraryPermissionsAsync() {
    return unavailable('requestMediaLibraryPermissionsAsync');
  },
  getCameraPermissionsAsync() {
    return unavailable('getCameraPermissionsAsync');
  },
  getMediaLibraryPermissionsAsync() {
    return unavailable('getMediaLibraryPermissionsAsync');
  },
  launchCameraAsync(options) {
    return unavailable('launchCameraAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  launchImageLibraryAsync(options) {
    return unavailable('launchImageLibraryAsync(' + JSON.stringify(options ?? {}) + ')');
  },
};
`;
}

function renderExpoLocationPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, but foreground permission, current-position, and watch flows still need device-side validation.';
const DEFAULT_PERMISSION_RESPONSE = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

function getPermissionResponse() {
  return { ...DEFAULT_PERMISSION_RESPONSE };
}

module.exports = {
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync() {
    return unavailable('requestForegroundPermissionsAsync');
  },
  getForegroundPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  requestBackgroundPermissionsAsync() {
    return unavailable('requestBackgroundPermissionsAsync');
  },
  getBackgroundPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  hasServicesEnabledAsync() {
    return Promise.resolve(false);
  },
  getCurrentPositionAsync(options) {
    return unavailable('getCurrentPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  getLastKnownPositionAsync(options) {
    return unavailable('getLastKnownPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
  watchPositionAsync(options) {
    return unavailable('watchPositionAsync(' + JSON.stringify(options ?? {}) + ')');
  },
};
`;
}

function renderExpoCameraPreviewShim(capability: CapabilityDefinition): string {
  return `'use strict';

const React = require('react');
const { Text, View } = require('react-native');
const { CodedError } = require('expo-modules-core');

const PREVIEW_MESSAGE =
  '${capability.packageName} is routed through the Expo Harmony ${capability.supportTier} bridge. Bundling is supported, and a managed preview surface can render, but device-side camera permission and capture flows still need validation.';
const DEFAULT_PERMISSION_RESPONSE = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

function createPreviewError(operationName) {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    PREVIEW_MESSAGE + ' Attempted operation: ' + operationName + '.',
  );
}

async function unavailable(operationName) {
  throw createPreviewError(operationName);
}

function getPermissionResponse() {
  return { ...DEFAULT_PERMISSION_RESPONSE };
}

const CameraView = React.forwardRef(function ExpoHarmonyCameraPreview(props, ref) {
  React.useImperativeHandle(ref, () => ({
    takePictureAsync(options) {
      return unavailable('CameraView.takePictureAsync(' + JSON.stringify(options ?? {}) + ')');
    },
  }));

  return React.createElement(
    View,
    {
      style: [
        {
          minHeight: 220,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#14b8a6',
          backgroundColor: '#ccfbf1',
          padding: 20,
        },
        props.style,
      ],
      accessibilityLabel: 'Expo Harmony preview camera surface',
    },
    React.createElement(
      Text,
      {
        style: {
          color: '#0f766e',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
        },
      },
      'Expo Harmony preview camera surface',
    ),
  );
});

CameraView.displayName = 'ExpoHarmonyCameraPreview';

module.exports = {
  CameraType: {
    front: 'front',
    back: 'back',
  },
  FlashMode: {
    off: 'off',
    on: 'on',
    auto: 'auto',
    torch: 'torch',
  },
  CameraView,
  requestCameraPermissionsAsync() {
    return unavailable('requestCameraPermissionsAsync');
  },
  getCameraPermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
  requestMicrophonePermissionsAsync() {
    return unavailable('requestMicrophonePermissionsAsync');
  },
  getMicrophonePermissionsAsync() {
    return Promise.resolve(getPermissionResponse());
  },
};
`;
}

function renderExpoModulesCoreHarmonyShim(
  expoConfig: Record<string, any>,
  identifiers: HarmonyIdentifiers,
): string {
  const embeddedExpoConfig = buildExpoConfigForShim(expoConfig, identifiers);
  const serializedExpoConfig = JSON.stringify(embeddedExpoConfig, null, 2);
  const primaryScheme = getPrimarySchemeForShim(embeddedExpoConfig, identifiers);
  const linkingUri = primaryScheme ? `${primaryScheme}://` : null;
  const serializedLinkingUri = JSON.stringify(linkingUri);

  return `'use strict';

const { Linking, Platform } = require('react-native');

const embeddedExpoConfig = ${serializedExpoConfig};
const nativeModules = Object.create(null);

class EventSubscription {
  constructor(remove) {
    this._remove = remove;
  }

  remove() {
    if (!this._remove) {
      return;
    }

    const remove = this._remove;
    this._remove = null;
    remove();
  }
}

class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  addListener(eventName, listener) {
    const listeners = this._listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this._listeners.set(eventName, listeners);

    return new EventSubscription(() => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this._listeners.delete(eventName);
      }
    });
  }

  removeAllListeners(eventName) {
    if (typeof eventName === 'string') {
      this._listeners.delete(eventName);
      return;
    }

    this._listeners.clear();
  }

  emit(eventName, payload) {
    const listeners = this._listeners.get(eventName);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(payload);
    }
  }
}

class LegacyEventEmitter extends EventEmitter {}

class NativeModule extends EventEmitter {}

class SharedObject {}

class SharedRef extends SharedObject {}

class CodedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'CodedError';
  }
}

class UnavailabilityError extends CodedError {
  constructor(moduleName, propertyName) {
    super(
      'ERR_UNAVAILABLE',
      propertyName
        ? moduleName + '.' + propertyName + ' is not available on Harmony.'
        : moduleName + ' is not available on Harmony.',
    );
    this.name = 'UnavailabilityError';
  }
}

class ExpoLinkingModule extends NativeModule {
  constructor(initialUrl) {
    super();
    this._currentUrl = initialUrl;
  }

  getLinkingURL() {
    return this._currentUrl;
  }

  _setCurrentUrl(url) {
    this._currentUrl = url;
    this.emit('onURLReceived', {
      url,
    });
  }
}

const expoLinkingModule = new ExpoLinkingModule(${serializedLinkingUri});

if (Linking?.addEventListener) {
  Linking.addEventListener('url', (event) => {
    expoLinkingModule._setCurrentUrl(event?.url ?? null);
  });
}

nativeModules.ExpoLinking = expoLinkingModule;
nativeModules.ExponentConstants = {
  manifest: embeddedExpoConfig,
  appOwnership: null,
  executionEnvironment: 'standalone',
  experienceUrl: ${serializedLinkingUri},
  linkingUri: ${serializedLinkingUri},
  statusBarHeight: 0,
  systemVersion: 'HarmonyOS',
  platform: {
    android: embeddedExpoConfig.android ?? null,
    ios: embeddedExpoConfig.ios ?? null,
    web: null,
  },
};
nativeModules.ExpoAsset = {
  async downloadAsync(url) {
    return url;
  },
};
nativeModules.ExpoFetchModule = {
  NativeRequest: class NativeRequest {
    constructor(_response) {
      this._response = _response;
    }

    async start() {
      throw new UnavailabilityError('ExpoFetchModule', 'NativeRequest.start');
    }

    cancel() {}
  },
};

function requireOptionalNativeModule(name) {
  return nativeModules[name] ?? null;
}

function requireNativeModule(name) {
  const nativeModule = requireOptionalNativeModule(name);

  if (nativeModule) {
    return nativeModule;
  }

  throw new UnavailabilityError(name);
}

function requireNativeViewManager(name) {
  throw new UnavailabilityError(name, 'viewManager');
}

function registerWebModule() {}

async function reloadAppAsync() {}

function installOnUIRuntime() {}

globalThis.expo = {
  ...(globalThis.expo ?? {}),
  EventEmitter,
  LegacyEventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  modules: {
    ...(globalThis.expo?.modules ?? {}),
    ...nativeModules,
  },
};

module.exports = {
  Platform,
  CodedError,
  UnavailabilityError,
  EventEmitter,
  LegacyEventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  requireNativeModule,
  requireOptionalNativeModule,
  requireNativeViewManager,
  registerWebModule,
  reloadAppAsync,
  installOnUIRuntime,
};
`;
}

function renderReactNativeSafeAreaContextHarmonyShim(): string {
  return `'use strict';

const React = require('react');
const { Dimensions, View } = require('react-native');

function getWindowMetrics() {
  const metrics = Dimensions.get('window') ?? { width: 0, height: 0 };

  return {
    frame: {
      x: 0,
      y: 0,
      width: typeof metrics.width === 'number' ? metrics.width : 0,
      height: typeof metrics.height === 'number' ? metrics.height : 0,
    },
    insets: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };
}

const initialWindowMetrics = getWindowMetrics();
const initialWindowSafeAreaInsets = initialWindowMetrics.insets;
const SafeAreaInsetsContext = React.createContext(initialWindowMetrics.insets);
const SafeAreaFrameContext = React.createContext(initialWindowMetrics.frame);

function SafeAreaProvider({ children, initialMetrics = initialWindowMetrics, style }) {
  const metrics = initialMetrics ?? initialWindowMetrics;

  return React.createElement(
    SafeAreaFrameContext.Provider,
    { value: metrics.frame },
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: metrics.insets },
      React.createElement(View, { style: [{ flex: 1 }, style] }, children),
    ),
  );
}

function NativeSafeAreaProvider(props) {
  return React.createElement(SafeAreaProvider, props);
}

function SafeAreaView({ children, style, ...rest }) {
  return React.createElement(View, { ...rest, style }, children);
}

function SafeAreaListener({ children }) {
  return typeof children === 'function' ? children(initialWindowMetrics) : null;
}

function useSafeAreaInsets() {
  return React.useContext(SafeAreaInsetsContext);
}

function useSafeAreaFrame() {
  return React.useContext(SafeAreaFrameContext);
}

function useSafeArea() {
  return useSafeAreaInsets();
}

function withSafeAreaInsets(Component) {
  return React.forwardRef((props, ref) =>
    React.createElement(Component, {
      ...props,
      ref,
      insets: useSafeAreaInsets(),
    }),
  );
}

module.exports = {
  EdgeInsets: undefined,
  initialWindowMetrics,
  initialWindowSafeAreaInsets,
  NativeSafeAreaProvider,
  SafeAreaConsumer: SafeAreaInsetsContext.Consumer,
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaListener,
  SafeAreaProvider,
  SafeAreaView,
  useSafeArea,
  useSafeAreaFrame,
  useSafeAreaInsets,
  withSafeAreaInsets,
};
`;
}

function renderHarmonyRuntimePrelude(): string {
  return `'use strict';

require('react-native/Libraries/Core/InitializeCore');

function requireReactNativeBaseViewConfigHarmony() {
  try {
    return require('react-native/Libraries/NativeComponent/BaseViewConfig.harmony');
  } catch (_error) {
    return null;
  }
}

function requireRnohBaseViewConfigHarmony() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/BaseViewConfig.harmony');
  } catch (_error) {
    return null;
  }
}

function requireReactNativeBaseViewConfig() {
  try {
    return require('react-native/Libraries/NativeComponent/BaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireReactNativePlatformBaseViewConfig() {
  try {
    return require('react-native/Libraries/NativeComponent/PlatformBaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireRnohBaseViewConfig() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/BaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function requireRnohPlatformBaseViewConfig() {
  try {
    return require('@react-native-oh/react-native-harmony/Libraries/NativeComponent/PlatformBaseViewConfig');
  } catch (_error) {
    return null;
  }
}

function patchNativeComponentViewConfigDefaults() {
  const harmonyBaseViewConfigModule =
    requireReactNativeBaseViewConfigHarmony() ?? requireRnohBaseViewConfigHarmony();
  const harmonyBaseViewConfig = harmonyBaseViewConfigModule?.default ?? harmonyBaseViewConfigModule;

  if (!harmonyBaseViewConfig) {
    return;
  }

  for (const moduleExports of [
    requireReactNativeBaseViewConfig(),
    requireReactNativePlatformBaseViewConfig(),
    requireRnohBaseViewConfig(),
    requireRnohPlatformBaseViewConfig(),
  ]) {
    if (moduleExports && typeof moduleExports === 'object') {
      moduleExports.default = harmonyBaseViewConfig;
    }
  }
}

function installGlobalIfMissing(name, factory) {
  if (typeof globalThis[name] !== 'undefined') {
    return;
  }

  const value = factory();

  if (typeof value !== 'undefined') {
    globalThis[name] = value;
  }
}

patchNativeComponentViewConfigDefaults();
installGlobalIfMissing('FormData', () => require('react-native/Libraries/Network/FormData').default);
installGlobalIfMissing('Blob', () => require('react-native/Libraries/Blob/Blob').default);
installGlobalIfMissing('FileReader', () => require('react-native/Libraries/Blob/FileReader').default);
`;
}

function isBinaryTemplate(relativePath: string): boolean {
  return ['.png'].includes(path.extname(relativePath));
}

function contentsEqual(currentContents: Buffer, nextContents: string | Buffer, binary = false): boolean {
  if (binary || Buffer.isBuffer(nextContents)) {
    return currentContents.equals(Buffer.isBuffer(nextContents) ? nextContents : Buffer.from(nextContents));
  }

  return currentContents.toString('utf8') === nextContents;
}

function sortRecordByKey(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function isEquivalentToolkitScript(
  scriptName: string,
  currentCommand: string,
  desiredCommand: string,
): boolean {
  if (currentCommand === desiredCommand) {
    return true;
  }

  const compatibilityPatterns: Record<string, RegExp> = {
    'harmony:doctor': /\bexpo-harmony(?:\.js)?\s+doctor\b/,
    'harmony:init': /\bexpo-harmony(?:\.js)?\s+init\b/,
    'harmony:sync-template': /\bexpo-harmony(?:\.js)?\s+sync-template\b/,
    'harmony:env': /\bexpo-harmony(?:\.js)?\s+env\b/,
    'harmony:bundle': /\bexpo-harmony(?:\.js)?\s+bundle\b/,
    'harmony:build:debug': /\bexpo-harmony(?:\.js)?\s+build-hap\b[\s\S]*--mode\s+debug\b/,
    'harmony:build:release': /\bexpo-harmony(?:\.js)?\s+build-hap\b[\s\S]*--mode\s+release\b/,
  };
  const compatibilityPattern = compatibilityPatterns[scriptName];

  return compatibilityPattern ? compatibilityPattern.test(currentCommand) : false;
}

export function buildDesiredPackageScripts(packageJson: PackageJson): Record<string, string> {
  return {
    ...DESIRED_PACKAGE_SCRIPTS,
  };
}

function buildDesiredPnpmOverrides(packageJson: PackageJson): Record<string, string> {
  const overrides: Record<string, string> = {};

  for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
    const declaredSpecifier =
      packageJson.dependencies?.[adapter.canonicalPackageName] ??
      packageJson.devDependencies?.[adapter.canonicalPackageName] ??
      packageJson.peerDependencies?.[adapter.canonicalPackageName];

    if (!declaredSpecifier) {
      continue;
    }

    const declaredRange = semver.validRange(declaredSpecifier);

    if (!declaredRange || !semver.satisfies(adapter.canonicalVersion, declaredRange)) {
      continue;
    }

    overrides[adapter.canonicalPackageName] = adapter.canonicalVersion;
  }

  return sortRecordByKey(overrides);
}

export function usesExpoRouter(packageJson: PackageJson): boolean {
  return hasDeclaredDependency(packageJson, 'expo-router');
}

export function resolveHarmonyBundleEntryFile(packageJson: PackageJson): string {
  return usesExpoRouter(packageJson) ? HARMONY_ROUTER_ENTRY_FILENAME : 'index.js';
}

function renderRouterHarmonyEntry(identifiers: HarmonyIdentifiers): string {
  return `require('./${HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH}');

const React = require('react');
const { AppRegistry } = require('react-native');
const { registerRootComponent } = require('expo');
const { ExpoRoot } = require('expo-router');

const context = require.context('./app', true, /\\.[jt]sx?$/);

function App() {
  return React.createElement(ExpoRoot, {
    context,
  });
}

registerRootComponent(App);
AppRegistry.registerComponent(${JSON.stringify(identifiers.slug)}, () => App);
`;
}

function buildExpoConfigForShim(
  expoConfig: Record<string, any>,
  identifiers: HarmonyIdentifiers,
): Record<string, unknown> {
  const normalized = toSerializableValue(expoConfig);
  const config =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? { ...normalized }
      : {};

  config.name = config.name ?? identifiers.appName;
  config.slug = config.slug ?? identifiers.slug;
  config.version = config.version ?? '1.0.0';

  if (!config.scheme) {
    config.scheme = getPrimarySchemeForShim(config, identifiers);
  }

  const android =
    config.android && typeof config.android === 'object' && !Array.isArray(config.android)
      ? { ...config.android }
      : {};
  const ios =
    config.ios && typeof config.ios === 'object' && !Array.isArray(config.ios)
      ? { ...config.ios }
      : {};

  android.package = android.package ?? identifiers.androidPackage ?? identifiers.bundleName;
  ios.bundleIdentifier =
    ios.bundleIdentifier ?? identifiers.iosBundleIdentifier ?? identifiers.bundleName;

  config.android = android;
  config.ios = ios;

  return config;
}

function getPrimarySchemeForShim(
  expoConfig: Record<string, unknown>,
  identifiers: HarmonyIdentifiers,
): string {
  const scheme = expoConfig.scheme;

  if (typeof scheme === 'string' && scheme.trim().length > 0) {
    return scheme.trim();
  }

  if (Array.isArray(scheme)) {
    const firstScheme = scheme.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );

    if (firstScheme) {
      return firstScheme.trim();
    }
  }

  return identifiers.androidPackage ?? identifiers.iosBundleIdentifier ?? identifiers.bundleName;
}

function toSerializableValue(value: unknown): any {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => toSerializableValue(entry))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const serializedEntry = toSerializableValue(entry);

      if (serializedEntry !== undefined) {
        result[key] = serializedEntry;
      }
    }

    return result;
  }

  return undefined;
}

function collectMetadataWarnings(
  previousManifest: ToolkitManifest | null,
  previousToolkitConfig: ToolkitConfig | null,
): string[] {
  const warnings: string[] = [];

  if (previousManifest && previousManifest.templateVersion !== TEMPLATE_VERSION) {
    warnings.push(
      `Existing manifest template version ${previousManifest.templateVersion} does not match current template ${TEMPLATE_VERSION}. Sync will refresh managed metadata.`,
    );
  }

  if (previousManifest && previousManifest.matrixId !== DEFAULT_VALIDATED_MATRIX_ID) {
    warnings.push(
      `Existing manifest matrix ${previousManifest.matrixId ?? 'unknown'} does not match current matrix ${DEFAULT_VALIDATED_MATRIX_ID}. Sync will refresh managed metadata.`,
    );
  }

  if (previousToolkitConfig && previousToolkitConfig.templateVersion !== TEMPLATE_VERSION) {
    warnings.push(
      `Existing toolkit-config template version ${previousToolkitConfig.templateVersion} does not match current template ${TEMPLATE_VERSION}. Sync will refresh managed metadata.`,
    );
  }

  if (previousToolkitConfig && previousToolkitConfig.matrixId !== DEFAULT_VALIDATED_MATRIX_ID) {
    warnings.push(
      `Existing toolkit-config matrix ${previousToolkitConfig.matrixId ?? 'unknown'} does not match current matrix ${DEFAULT_VALIDATED_MATRIX_ID}. Sync will refresh managed metadata.`,
    );
  }

  return warnings;
}

function stabilizeToolkitConfigTimestamp(
  previousToolkitConfig: ToolkitConfig | null,
  nextToolkitConfig: ToolkitConfig,
): ToolkitConfig {
  if (!previousToolkitConfig) {
    return nextToolkitConfig;
  }

  const { generatedAt: previousGeneratedAt, ...previousComparable } = previousToolkitConfig;
  const { generatedAt: nextGeneratedAt, ...nextComparable } = nextToolkitConfig;

  if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) {
    return {
      ...nextToolkitConfig,
      generatedAt: previousGeneratedAt,
    };
  }

  return nextToolkitConfig;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
