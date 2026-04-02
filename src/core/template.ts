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
import {
  mergeSigningLocalConfigIntoBuildProfile,
  readSigningLocalConfig,
} from './signing';

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
  const hasManagedExpoHarmonyPackage = enabledCapabilities.some(
    (capability) => capability.runtimeMode !== 'shim',
  );
  const requestedHarmonyPermissions = collectCapabilityHarmonyPermissions(loadedProject.packageJson);
  const signingLocalConfig = await readSigningLocalConfig(loadedProject.projectRoot);
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
          relativePath === 'build-profile.json5'
            ? mergeSigningLocalConfigIntoBuildProfile(
                contents.toString('utf8'),
                signingLocalConfig,
              )
            : relativePath === 'entry/src/main/module.json5'
            ? renderEntryModuleConfig(identifiers.entryModuleName, requestedHarmonyPermissions)
            : relativePath === 'entry/src/main/resources/base/element/string.json'
              ? renderEntryStringResources(
                  `${identifiers.appName} official minimal Harmony sample`,
                  identifiers.appName,
                  requestedHarmonyPermissions,
                )
              : relativePath === 'entry/src/main/ets/PackageProvider.ets'
                ? renderPackageProvider({
                    hasManagedExpoHarmonyPackage,
                  })
                : relativePath === 'entry/src/main/cpp/PackageProvider.cpp'
                  ? renderPackageProviderCpp({
                      hasManagedExpoHarmonyPackage,
                    })
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
    capabilities: enabledCapabilities.map((capability) => ({
      id: capability.id,
      packageName: capability.packageName,
      supportTier: capability.supportTier,
      runtimeMode: capability.runtimeMode,
      evidence: { ...capability.evidence },
    })),
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
    ...(hasManagedExpoHarmonyPackage
      ? [
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'cpp',
              'expoHarmony',
              'ExpoHarmonyPackage.h',
            ),
            contents: renderExpoHarmonyCppPackage(),
          } satisfies TemplateFileDefinition,
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'ets',
              'expoHarmony',
              'ExpoHarmonyPackage.ets',
            ),
            contents: renderExpoHarmonyPackage(),
          } satisfies TemplateFileDefinition,
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'ets',
              'expoHarmony',
              'ExpoHarmonyFileSystemTurboModule.ts',
            ),
            contents: renderExpoHarmonyFileSystemTurboModule(),
          } satisfies TemplateFileDefinition,
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'ets',
              'expoHarmony',
              'ExpoHarmonyImagePickerTurboModule.ts',
            ),
            contents: renderExpoHarmonyImagePickerTurboModule(),
          } satisfies TemplateFileDefinition,
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'ets',
              'expoHarmony',
              'ExpoHarmonyLocationTurboModule.ts',
            ),
            contents: renderExpoHarmonyLocationTurboModule(),
          } satisfies TemplateFileDefinition,
          {
            relativePath: path.join(
              'harmony',
              'entry',
              'src',
              'main',
              'ets',
              'expoHarmony',
              'ExpoHarmonyCameraTurboModule.ts',
            ),
            contents: renderExpoHarmonyCameraTurboModule(),
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

function renderPackageProvider(options: { hasManagedExpoHarmonyPackage: boolean }): string {
  const managedImports = options.hasManagedExpoHarmonyPackage
    ? "import { ExpoHarmonyPackage } from './expoHarmony/ExpoHarmonyPackage';\n"
    : '';
  const managedPackages = options.hasManagedExpoHarmonyPackage ? ', new ExpoHarmonyPackage(ctx)' : '';

  return `import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';
import { createRNOHPackages as createRNOHPackagesAutolinking } from './RNOHPackagesFactory';
${managedImports}
export function getRNOHPackages(ctx: RNPackageContext): RNPackage[] {
  return [...createRNOHPackagesAutolinking(ctx)${managedPackages}];
}
`;
}

function renderPackageProviderCpp(options: { hasManagedExpoHarmonyPackage: boolean }): string {
  const managedInclude = options.hasManagedExpoHarmonyPackage
    ? '#include "expoHarmony/ExpoHarmonyPackage.h"\n'
    : '';
  const managedPackage = options.hasManagedExpoHarmonyPackage
    ? '  packages.push_back(std::make_shared<ExpoHarmonyPackage>(ctx));\n'
    : '';

  return `#include "RNOH/PackageProvider.h"
#include "RNOHPackagesFactory.h"
#include "generated/RNOHGeneratedPackage.h"
${managedInclude}
using namespace rnoh;

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(
    Package::Context ctx) {
  auto packages = createRNOHPackages(ctx);
  packages.push_back(std::make_shared<RNOHGeneratedPackage>(ctx));
${managedPackage}  return packages;
}
`;
}

function renderExpoHarmonyCppPackage(): string {
  return `#pragma once

#include <ReactCommon/TurboModule.h>
#include "RNOH/ArkTSTurboModule.h"
#include "RNOH/Package.h"

namespace rnoh {
using namespace facebook;

static jsi::Value __hostFunction_ExpoHarmonyFileSystemTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyImagePickerTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyLocationTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyCameraTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

class JSI_EXPORT ExpoHarmonyFileSystemTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyFileSystemTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyFileSystemTurboModule_getConstants};
    methodMap_["getInfo"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(getInfo)};
    methodMap_["readAsString"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(readAsString)};
    methodMap_["writeAsString"] = MethodMetadata{
        3, ARK_ASYNC_METHOD_CALLER(writeAsString)};
    methodMap_["deletePath"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(deletePath)};
    methodMap_["makeDirectory"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(makeDirectory)};
    methodMap_["readDirectory"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(readDirectory)};
    methodMap_["copy"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(copy)};
    methodMap_["move"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(move)};
  }
};

class JSI_EXPORT ExpoHarmonyImagePickerTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyImagePickerTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyImagePickerTurboModule_getConstants};
    methodMap_["getMediaLibraryPermissionStatus"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getMediaLibraryPermissionStatus)};
    methodMap_["requestMediaLibraryPermission"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(requestMediaLibraryPermission)};
    methodMap_["getCameraPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getCameraPermissionStatus)};
    methodMap_["requestCameraPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestCameraPermission)};
    methodMap_["launchImageLibrary"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(launchImageLibrary)};
    methodMap_["launchCamera"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(launchCamera)};
  }
};

class JSI_EXPORT ExpoHarmonyLocationTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyLocationTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyLocationTurboModule_getConstants};
    methodMap_["getForegroundPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getForegroundPermissionStatus)};
    methodMap_["requestForegroundPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestForegroundPermission)};
    methodMap_["getBackgroundPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getBackgroundPermissionStatus)};
    methodMap_["requestBackgroundPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestBackgroundPermission)};
    methodMap_["hasServicesEnabled"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(hasServicesEnabled)};
    methodMap_["getProviderStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getProviderStatus)};
    methodMap_["getCurrentPosition"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getCurrentPosition)};
    methodMap_["getLastKnownPosition"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getLastKnownPosition)};
    methodMap_["geocode"] = MethodMetadata{1, ARK_ASYNC_METHOD_CALLER(geocode)};
    methodMap_["reverseGeocode"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(reverseGeocode)};
  }
};

class JSI_EXPORT ExpoHarmonyCameraTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyCameraTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyCameraTurboModule_getConstants};
    methodMap_["getCameraPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getCameraPermissionStatus)};
    methodMap_["requestCameraPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestCameraPermission)};
    methodMap_["getMicrophonePermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getMicrophonePermissionStatus)};
    methodMap_["requestMicrophonePermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestMicrophonePermission)};
    methodMap_["takePicture"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(takePicture)};
  }
};

class ExpoHarmonyTurboModuleFactoryDelegate : public TurboModuleFactoryDelegate {
 public:
  SharedTurboModule createTurboModule(Context ctx, const std::string& name)
      const override {
    if (name == "ExpoHarmonyFileSystem") {
      return std::make_shared<ExpoHarmonyFileSystemTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyImagePicker") {
      return std::make_shared<ExpoHarmonyImagePickerTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyLocation") {
      return std::make_shared<ExpoHarmonyLocationTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyCamera") {
      return std::make_shared<ExpoHarmonyCameraTurboModule>(ctx, name);
    }

    return nullptr;
  }
};

class ExpoHarmonyPackage : public Package {
 public:
  explicit ExpoHarmonyPackage(Package::Context ctx) : Package(ctx) {}

  std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate()
      override {
    return std::make_unique<ExpoHarmonyTurboModuleFactoryDelegate>();
  }
};
} // namespace rnoh
`;
}

function renderCapabilityModuleShim(capability: CapabilityDefinition): string {
  switch (capability.packageName) {
    case 'expo-file-system':
      return capability.runtimeMode !== 'shim'
        ? renderExpoFileSystemHarmonyAdapterShim(capability)
        : renderExpoFileSystemPreviewShim(capability);
    case 'expo-image-picker':
      return capability.runtimeMode !== 'shim'
        ? renderExpoImagePickerHarmonyAdapterShim(capability)
        : renderExpoImagePickerPreviewShim(capability);
    case 'expo-location':
      return capability.runtimeMode !== 'shim'
        ? renderExpoLocationHarmonyAdapterShim(capability)
        : renderExpoLocationPreviewShim(capability);
    case 'expo-camera':
      return capability.runtimeMode !== 'shim'
        ? renderExpoCameraHarmonyAdapterShim(capability)
        : renderExpoCameraPreviewShim(capability);
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

function renderExpoHarmonyPackage(): string {
  return `import type {
  AnyThreadTurboModule,
  AnyThreadTurboModuleContext,
  UITurboModule,
  UITurboModuleContext,
} from '@rnoh/react-native-openharmony';
import {
  RNOHPackage,
} from '@rnoh/react-native-openharmony';
import { ExpoHarmonyFileSystemTurboModule } from './ExpoHarmonyFileSystemTurboModule';
import { ExpoHarmonyImagePickerTurboModule } from './ExpoHarmonyImagePickerTurboModule';
import { ExpoHarmonyLocationTurboModule } from './ExpoHarmonyLocationTurboModule';
import { ExpoHarmonyCameraTurboModule } from './ExpoHarmonyCameraTurboModule';

export class ExpoHarmonyPackage extends RNOHPackage {
  override getAnyThreadTurboModuleFactoryByNameMap(): Map<
    string,
    (ctx: AnyThreadTurboModuleContext) => AnyThreadTurboModule | null
  > {
    return new Map<string, (ctx: AnyThreadTurboModuleContext) => AnyThreadTurboModule | null>()
      .set(
        ExpoHarmonyFileSystemTurboModule.NAME,
        (ctx) => new ExpoHarmonyFileSystemTurboModule(ctx),
      )
      .set(
        ExpoHarmonyLocationTurboModule.NAME,
        (ctx) => new ExpoHarmonyLocationTurboModule(ctx),
      );
  }

  override getUITurboModuleFactoryByNameMap(): Map<
    string,
    (ctx: UITurboModuleContext) => UITurboModule | null
  > {
    return new Map<string, (ctx: UITurboModuleContext) => UITurboModule | null>()
      .set(
        ExpoHarmonyImagePickerTurboModule.NAME,
        (ctx) => new ExpoHarmonyImagePickerTurboModule(ctx),
      )
      .set(
        ExpoHarmonyCameraTurboModule.NAME,
        (ctx) => new ExpoHarmonyCameraTurboModule(ctx),
      );
  }

  override getDebugName() {
    return 'expo-harmony';
  }
}
`;
}

function renderExpoHarmonyFileSystemTurboModule(): string {
  return `import fs from '@ohos.file.fs';
import { AnyThreadTurboModuleContext, AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';

type FileInfoOptions = {
  md5?: boolean;
};

type WriteOptions = {
  encoding?: string;
};

type MakeDirectoryOptions = {
  intermediates?: boolean;
};

type DeleteOptions = {
  idempotent?: boolean;
};

type FileInfoResult = {
  exists: boolean;
  path: string;
  isDirectory: boolean;
  size?: number;
  modificationTime?: number;
  md5?: string;
};

export class ExpoHarmonyFileSystemTurboModule extends AnyThreadTurboModule {
  public static readonly NAME = 'ExpoHarmonyFileSystem';

  public constructor(ctx: AnyThreadTurboModuleContext) {
    super(ctx);
    this.ensureManagedDirectoriesSync();
  }

  getConstants(): {
    documentDirectoryPath: string;
    cacheDirectoryPath: string;
    bundleDirectoryPath: string | null;
  } {
    const abilityContext = this.ctx.uiAbilityContext as {
      bundleCodeDir?: string;
    };

    return {
      documentDirectoryPath: this.documentDirectoryPath,
      cacheDirectoryPath: this.cacheDirectoryPath,
      bundleDirectoryPath:
        typeof abilityContext.bundleCodeDir === 'string' && abilityContext.bundleCodeDir.length > 0
          ? abilityContext.bundleCodeDir
          : null,
    };
  }

  async getInfo(path: string, _options?: FileInfoOptions): Promise<FileInfoResult> {
    const normalizedPath = this.normalizeSandboxPath(path);
    const stat = await this.getStatOrNull(normalizedPath);

    if (!stat) {
      return {
        exists: false,
        path: normalizedPath,
        isDirectory: false,
      };
    }

    return {
      exists: true,
      path: normalizedPath,
      isDirectory: stat.isDirectory(),
      size: Number(stat.size),
      modificationTime: Number(stat.mtime),
    };
  }

  async readAsString(path: string, options?: { encoding?: string }): Promise<string> {
    const normalizedPath = this.normalizeSandboxPath(path);
    const encoding = options?.encoding ?? 'utf8';

    if (encoding !== 'utf8') {
      throw new Error('ExpoHarmonyFileSystem currently supports only UTF-8 string reads.');
    }

    return fs.readText(normalizedPath, {
      encoding: 'utf-8',
    });
  }

  async writeAsString(path: string, contents: string, options?: WriteOptions): Promise<void> {
    const normalizedPath = this.normalizeSandboxPath(path);
    const encoding = options?.encoding ?? 'utf8';

    if (encoding !== 'utf8') {
      throw new Error('ExpoHarmonyFileSystem currently supports only UTF-8 string writes.');
    }

    await this.ensureParentDirectory(normalizedPath);

    const file = await fs.open(
      normalizedPath,
      fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC,
    );

    try {
      await fs.write(file.fd, contents);
    } finally {
      await fs.close(file);
    }
  }

  async deletePath(path: string, options?: DeleteOptions): Promise<void> {
    const normalizedPath = this.normalizeSandboxPath(path);
    await this.deleteInternal(normalizedPath, options?.idempotent === true);
  }

  async makeDirectory(path: string, options?: MakeDirectoryOptions): Promise<void> {
    const normalizedPath = this.normalizeSandboxPath(path);
    await fs.mkdir(normalizedPath, options?.intermediates === true);
  }

  async readDirectory(path: string): Promise<string[]> {
    const normalizedPath = this.normalizeSandboxPath(path);
    const stat = await fs.stat(normalizedPath);

    if (!stat.isDirectory()) {
      throw new Error('readDirectory expects a directory path.');
    }

    return fs.listFile(normalizedPath);
  }

  async copy(from: string, to: string): Promise<void> {
    const fromPath = this.normalizeSandboxPath(from);
    const toPath = this.normalizeSandboxPath(to);
    await this.copyInternal(fromPath, toPath);
  }

  async move(from: string, to: string): Promise<void> {
    const fromPath = this.normalizeSandboxPath(from);
    const toPath = this.normalizeSandboxPath(to);
    const stat = await fs.stat(fromPath);

    await this.ensureParentDirectory(toPath);

    if (stat.isDirectory()) {
      await this.copyInternal(fromPath, toPath);
      await this.deleteInternal(fromPath, false);
      return;
    }

    await fs.moveFile(fromPath, toPath);
  }

  private get documentDirectoryPath(): string {
    return \`\${this.ctx.uiAbilityContext.filesDir}/expo-harmony/document\`;
  }

  private get cacheDirectoryPath(): string {
    return \`\${this.ctx.uiAbilityContext.cacheDir}/expo-harmony/cache\`;
  }

  private ensureManagedDirectoriesSync(): void {
    this.ensureDirectorySync(this.documentDirectoryPath);
    this.ensureDirectorySync(this.cacheDirectoryPath);
  }

  private ensureDirectorySync(directoryPath: string): void {
    if (!fs.accessSync(directoryPath)) {
      fs.mkdirSync(directoryPath, true);
    }
  }

  private async ensureParentDirectory(targetPath: string): Promise<void> {
    const parentPath = this.getParentPath(targetPath);

    if (!parentPath) {
      return;
    }

    const parentStat = await this.getStatOrNull(parentPath);

    if (parentStat) {
      if (!parentStat.isDirectory()) {
        throw new Error(\`Expected parent path to be a directory: \${parentPath}\`);
      }

      return;
    }

    await fs.mkdir(parentPath, true);
  }

  private getParentPath(targetPath: string): string | null {
    let normalizedPath = targetPath;

    while (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    const slashIndex = normalizedPath.lastIndexOf('/');

    if (slashIndex <= 0) {
      return null;
    }

    return normalizedPath.slice(0, slashIndex);
  }

  private async deleteInternal(targetPath: string, idempotent: boolean): Promise<void> {
    const stat = await this.getStatOrNull(targetPath);

    if (!stat) {
      if (idempotent) {
        return;
      }

      throw new Error(\`No file or directory exists at \${targetPath}.\`);
    }

    if (stat.isDirectory()) {
      const entries = await fs.listFile(targetPath);

      for (const entryName of entries) {
        await this.deleteInternal(\`\${targetPath}/\${entryName}\`, idempotent);
      }

      await fs.rmdir(targetPath);
      return;
    }

    await fs.unlink(targetPath);
  }

  private async copyInternal(fromPath: string, toPath: string): Promise<void> {
    const stat = await fs.stat(fromPath);

    await this.ensureParentDirectory(toPath);

    if (stat.isDirectory()) {
      await fs.mkdir(toPath, true);
      const entries = await fs.listFile(fromPath);

      for (const entryName of entries) {
        await this.copyInternal(\`\${fromPath}/\${entryName}\`, \`\${toPath}/\${entryName}\`);
      }

      return;
    }

    await fs.copyFile(fromPath, toPath);
  }

  private async getStatOrNull(targetPath: string): Promise<fs.Stat | null> {
    try {
      return await fs.stat(targetPath);
    } catch (error) {
      if (this.isNoSuchFileError(error)) {
        return null;
      }

      throw error;
    }
  }

  private isNoSuchFileError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      Number((error as { code?: number }).code) === 13900002
    );
  }

  private normalizeSandboxPath(inputPath: string): string {
    if (typeof inputPath !== 'string' || inputPath.length === 0) {
      throw new Error('ExpoHarmonyFileSystem expected a non-empty sandbox path.');
    }

    if (!inputPath.startsWith('/')) {
      throw new Error('ExpoHarmonyFileSystem accepts only absolute sandbox paths.');
    }

    if (inputPath.includes('/../') || inputPath.endsWith('/..') || inputPath.includes('/./')) {
      throw new Error('ExpoHarmonyFileSystem does not accept relative path segments.');
    }

    const allowedRoots = [
      this.ctx.uiAbilityContext.filesDir,
      this.ctx.uiAbilityContext.cacheDir,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);

    const isAllowed = allowedRoots.some(
      (rootPath) => inputPath === rootPath || inputPath.startsWith(\`\${rootPath}/\`),
    );

    if (!isAllowed) {
      throw new Error('ExpoHarmonyFileSystem accepts only app sandbox paths.');
    }

    return inputPath;
  }
}
`;
}

function renderExpoHarmonyImagePickerTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import photoAccessHelper from '@ohos.file.photoAccessHelper';
import picker from '@ohos.file.picker';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
import { UITurboModuleContext, UITurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
  accessPrivileges?: 'all' | 'limited' | 'none';
};

type LaunchImageLibraryOptions = {
  mediaTypes?: string | string[];
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
};

type LaunchCameraOptions = {
  mediaTypes?: string | string[];
  cameraType?: string;
};

type ImagePickerAsset = {
  uri: string;
  assetId: string | null;
  width: number;
  height: number;
  type: 'image' | 'video' | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  exif: null;
  base64: null;
};

type ImagePickerResult = {
  canceled: boolean;
  assets: ImagePickerAsset[] | null;
};

export class ExpoHarmonyImagePickerTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyImagePicker';

  private readonly atManager = abilityAccessCtrl.createAtManager();

  getConstants(): Record<string, never> {
    return {};
  }

  async getMediaLibraryPermissionStatus(_writeOnly?: boolean): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.READ_IMAGEVIDEO', true);
  }

  async requestMediaLibraryPermission(_writeOnly?: boolean): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.READ_IMAGEVIDEO', true);
  }

  async getCameraPermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.CAMERA', false);
  }

  async requestCameraPermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.CAMERA', false);
  }

  async launchImageLibrary(options?: LaunchImageLibraryOptions): Promise<ImagePickerResult> {
    await this.ensurePermissionGranted('ohos.permission.READ_IMAGEVIDEO', true);

    const photoPicker = new photoAccessHelper.PhotoViewPicker();
    const selection = await photoPicker.select(this.createPhotoSelectOptions(options));
    let selectedUris = this.normalizeSelectedUris(selection?.photoUris);

    if (selectedUris.length === 0) {
      selectedUris = await this.launchLegacyPhotoPicker(options);
    }

    if (selectedUris.length === 0) {
      return this.createCanceledResult();
    }

    const authorizedUris = await this.requestAuthorizedUris(selectedUris);
    const assets = await Promise.all(
      authorizedUris.map((uri, index) =>
        this.createImagePickerAsset(uri, selectedUris[index] ?? uri, this.inferAssetTypeFromMediaTypes(options?.mediaTypes)),
      ),
    );

    return {
      canceled: false,
      assets,
    };
  }

  async launchCamera(options?: LaunchCameraOptions): Promise<ImagePickerResult> {
    const requestedAssetType = this.inferAssetTypeFromMediaTypes(options?.mediaTypes);

    if (requestedAssetType === 'video') {
      throw new Error('ExpoHarmonyImagePicker launchCamera currently supports photo capture only.');
    }

    await this.ensurePermissionGranted('ohos.permission.CAMERA', false);
    await this.ensurePermissionGranted('ohos.permission.READ_IMAGEVIDEO', true);

    const cameraEntryPicker = new photoAccessHelper.PhotoViewPicker();
    const selection = await cameraEntryPicker.select(
      this.createPhotoSelectOptions(
        {
          mediaTypes: 'images',
          allowsMultipleSelection: false,
        },
        true,
      ),
    );
    const selectedUris = this.normalizeSelectedUris(selection?.photoUris);

    if (selectedUris.length === 0) {
      return this.createCanceledResult();
    }

    const authorizedUris = await this.requestAuthorizedUris(selectedUris);
    const assetUri = authorizedUris[0] ?? selectedUris[0];

    return {
      canceled: false,
      assets: [await this.createImagePickerAsset(assetUri, selectedUris[0], 'image')],
    };
  }

  private async ensurePermissionGranted(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<void> {
    const permissionResponse = await this.getPermissionResponse(permissionName, isMediaLibraryPermission);

    if (permissionResponse.granted) {
      return;
    }

    const requestedResponse = await this.requestPermissionResponse(permissionName, isMediaLibraryPermission);

    if (!requestedResponse.granted) {
      throw new Error(\`Permission denied for \${permissionName}.\`);
    }
  }

  private async getPermissionResponse(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<PermissionResponse> {
    return this.permissionResponseFromStatus(
      this.resolvePermissionStatus(permissionName),
      isMediaLibraryPermission,
    );
  }

  private async requestPermissionResponse(
    permissionName: Permissions,
    isMediaLibraryPermission: boolean,
  ): Promise<PermissionResponse> {
    const requestResult = await this.atManager.requestPermissionsFromUser(
      this.ctx.uiAbilityContext,
      [permissionName],
    );
    const authResult = Array.isArray(requestResult.authResults)
      ? Number(requestResult.authResults[0] ?? abilityAccessCtrl.GrantStatus.PERMISSION_DENIED)
      : abilityAccessCtrl.GrantStatus.PERMISSION_DENIED;

    if (authResult === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
      return this.permissionResponseFromStatus(
        abilityAccessCtrl.PermissionStatus.GRANTED,
        isMediaLibraryPermission,
      );
    }

    return this.permissionResponseFromStatus(
      abilityAccessCtrl.PermissionStatus.DENIED,
      isMediaLibraryPermission,
    );
  }

  private resolvePermissionStatus(permissionName: Permissions): abilityAccessCtrl.PermissionStatus {
    const atManagerWithSelfStatus = this.atManager as abilityAccessCtrl.AtManager & {
      getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus;
    };

    if (typeof atManagerWithSelfStatus.getSelfPermissionStatus === 'function') {
      return atManagerWithSelfStatus.getSelfPermissionStatus(permissionName);
    }

    const accessTokenId = this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId;
    const grantStatus = this.atManager.checkAccessTokenSync(accessTokenId, permissionName);

    return grantStatus === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
      ? abilityAccessCtrl.PermissionStatus.GRANTED
      : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;
  }

  private permissionResponseFromStatus(
    permissionStatus: abilityAccessCtrl.PermissionStatus,
    isMediaLibraryPermission: boolean,
  ): PermissionResponse {
    const granted = permissionStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const denied =
      permissionStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.INVALID;

    return {
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
      expires: 'never',
      ...(isMediaLibraryPermission
        ? {
            accessPrivileges: granted ? 'all' : 'none',
          }
        : {}),
    };
  }

  private createPhotoSelectOptions(
    options?: LaunchImageLibraryOptions,
    isPhotoTakingSupported: boolean = false,
  ): photoAccessHelper.PhotoSelectOptions {
    const selectOptions = new photoAccessHelper.PhotoSelectOptions();
    selectOptions.MIMEType = this.resolvePhotoViewMimeType(options?.mediaTypes);
    selectOptions.maxSelectNumber =
      options?.allowsMultipleSelection === true
        ? this.resolveSelectionLimit(options?.selectionLimit)
        : 1;
    selectOptions.isSearchSupported = true;
    selectOptions.isPhotoTakingSupported = isPhotoTakingSupported;
    return selectOptions;
  }

  private async launchLegacyPhotoPicker(options?: LaunchImageLibraryOptions): Promise<string[]> {
    const legacyPicker = new picker.PhotoViewPicker(this.ctx.uiAbilityContext);
    const legacyOptions = new picker.PhotoSelectOptions();
    legacyOptions.MIMEType = this.resolveLegacyPhotoViewMimeType(options?.mediaTypes);
    legacyOptions.maxSelectNumber =
      options?.allowsMultipleSelection === true
        ? this.resolveSelectionLimit(options?.selectionLimit)
        : 1;

    const selection = await legacyPicker.select(legacyOptions);
    return this.normalizeSelectedUris(selection?.photoUris);
  }

  private resolveSelectionLimit(selectionLimit?: number): number {
    if (typeof selectionLimit === 'number' && Number.isFinite(selectionLimit) && selectionLimit > 0) {
      return Math.floor(selectionLimit);
    }

    return 20;
  }

  private resolvePhotoViewMimeType(
    rawMediaTypes?: string | string[],
  ): photoAccessHelper.PhotoViewMIMETypes {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return photoAccessHelper.PhotoViewMIMETypes.VIDEO_TYPE;
    }

    if (normalized.includes('video') && normalized.includes('image')) {
      return photoAccessHelper.PhotoViewMIMETypes.IMAGE_VIDEO_TYPE;
    }

    return photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
  }

  private resolveLegacyPhotoViewMimeType(
    rawMediaTypes?: string | string[],
  ): picker.PhotoViewMIMETypes {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return picker.PhotoViewMIMETypes.VIDEO_TYPE;
    }

    if (normalized.includes('video') && normalized.includes('image')) {
      return picker.PhotoViewMIMETypes.IMAGE_VIDEO_TYPE;
    }

    return picker.PhotoViewMIMETypes.IMAGE_TYPE;
  }

  private inferAssetTypeFromMediaTypes(
    rawMediaTypes?: string | string[],
  ): 'image' | 'video' | null {
    const normalized = this.normalizeMediaTypes(rawMediaTypes);

    if (normalized.includes('video') && !normalized.includes('image')) {
      return 'video';
    }

    if (normalized.includes('image')) {
      return 'image';
    }

    return null;
  }

  private normalizeMediaTypes(rawMediaTypes?: string | string[]): string[] {
    if (Array.isArray(rawMediaTypes)) {
      return Array.from(
        new Set(
          rawMediaTypes
            .map((value) => this.normalizeMediaTypeValue(value))
            .filter((value): value is string => value !== null),
        ),
      );
    }

    const singleValue = this.normalizeMediaTypeValue(rawMediaTypes);
    return singleValue ? [singleValue] : ['image'];
  }

  private normalizeMediaTypeValue(rawValue?: string): string | null {
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
      return 'image';
    }

    switch (rawValue) {
      case 'All':
      case 'all':
      case 'images':
      case 'image':
      case 'livePhotos':
        return 'image';
      case 'Videos':
      case 'videos':
      case 'video':
        return 'video';
      default:
        return rawValue.includes('video') ? 'video' : rawValue.includes('image') ? 'image' : null;
    }
  }

  private normalizeSelectedUris(photoUris: Array<string> | undefined | null): string[] {
    if (!Array.isArray(photoUris)) {
      return [];
    }

    return photoUris.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  private async requestAuthorizedUris(photoUris: string[]): Promise<string[]> {
    const helper = photoAccessHelper.getPhotoAccessHelper(this.ctx.uiAbilityContext);

    try {
      const authorizedUris = await helper.requestPhotoUrisReadPermission(photoUris);
      const normalizedAuthorizedUris = this.normalizeSelectedUris(authorizedUris);
      return normalizedAuthorizedUris.length > 0 ? normalizedAuthorizedUris : photoUris;
    } catch (_error) {
      return photoUris;
    }
  }

  private async createImagePickerAsset(
    assetUri: string,
    originalUri: string,
    fallbackType: 'image' | 'video' | null,
  ): Promise<ImagePickerAsset> {
    const inferredType = this.inferAssetTypeFromUri(assetUri, fallbackType);
    const imageSize =
      inferredType === 'image' ? await this.getImageSize(assetUri) : { width: 0, height: 0 };
    const fileSize = await this.getFileSize(assetUri);
    const fileName = this.extractFileName(assetUri) ?? this.extractFileName(originalUri);

    return {
      uri: assetUri,
      assetId: originalUri,
      width: imageSize.width,
      height: imageSize.height,
      type: inferredType,
      fileName,
      fileSize,
      mimeType: this.inferMimeType(assetUri, inferredType),
      duration: null,
      exif: null,
      base64: null,
    };
  }

  private inferAssetTypeFromUri(
    assetUri: string,
    fallbackType: 'image' | 'video' | null,
  ): 'image' | 'video' | null {
    const normalizedUri = assetUri.toLowerCase();

    if (normalizedUri.match(/\\.(mp4|m4v|mov|3gp|webm)(\\?|#|$)/)) {
      return 'video';
    }

    if (normalizedUri.match(/\\.(png|jpe?g|gif|bmp|webp|heic|heif)(\\?|#|$)/)) {
      return 'image';
    }

    return fallbackType;
  }

  private inferMimeType(
    assetUri: string,
    assetType: 'image' | 'video' | null,
  ): string | null {
    const normalizedUri = assetUri.toLowerCase();

    if (normalizedUri.endsWith('.png')) {
      return 'image/png';
    }
    if (normalizedUri.endsWith('.gif')) {
      return 'image/gif';
    }
    if (normalizedUri.endsWith('.webp')) {
      return 'image/webp';
    }
    if (normalizedUri.endsWith('.bmp')) {
      return 'image/bmp';
    }
    if (normalizedUri.endsWith('.heic')) {
      return 'image/heic';
    }
    if (normalizedUri.endsWith('.heif')) {
      return 'image/heif';
    }
    if (normalizedUri.match(/\\.jpe?g(\\?|#|$)/)) {
      return 'image/jpeg';
    }
    if (normalizedUri.match(/\\.(mp4|m4v)(\\?|#|$)/)) {
      return 'video/mp4';
    }
    if (normalizedUri.match(/\\.mov(\\?|#|$)/)) {
      return 'video/quicktime';
    }
    if (normalizedUri.match(/\\.webm(\\?|#|$)/)) {
      return 'video/webm';
    }

    return assetType === 'video' ? 'video/*' : assetType === 'image' ? 'image/*' : null;
  }

  private extractFileName(assetUri: string): string | null {
    if (typeof assetUri !== 'string' || assetUri.length === 0) {
      return null;
    }

    const sanitizedUri = assetUri.split('?')[0]?.split('#')[0] ?? assetUri;
    const lastSlashIndex = sanitizedUri.lastIndexOf('/');
    const rawFileName =
      lastSlashIndex >= 0 ? sanitizedUri.slice(lastSlashIndex + 1) : sanitizedUri;

    if (rawFileName.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawFileName);
    } catch (_error) {
      return rawFileName;
    }
  }

  private async getImageSize(assetUri: string): Promise<{ width: number; height: number }> {
    let imageSource: image.ImageSource | null = null;

    try {
      imageSource = image.createImageSource(assetUri);
      const imageInfo = await imageSource.getImageInfo();
      return {
        width: Number(imageInfo.size?.width ?? 0),
        height: Number(imageInfo.size?.height ?? 0),
      };
    } catch (_error) {
      return {
        width: 0,
        height: 0,
      };
    } finally {
      if (imageSource) {
        try {
          await imageSource.release();
        } catch (_error) {
          // Ignore cleanup errors from ImageSource release.
        }
      }
    }
  }

  private async getFileSize(assetUri: string): Promise<number | null> {
    const fsTarget = this.resolveFsTarget(assetUri);

    if (!fsTarget) {
      return null;
    }

    try {
      const stat = await fs.stat(fsTarget);
      return Number(stat.size ?? 0);
    } catch (_error) {
      return null;
    }
  }

  private resolveFsTarget(assetUri: string): string | null {
    if (assetUri.startsWith('file://')) {
      return assetUri.slice('file://'.length);
    }

    return assetUri.startsWith('/') ? assetUri : null;
  }

  private createCanceledResult(): ImagePickerResult {
    return {
      canceled: true,
      assets: null,
    };
  }
}
`;
}

function renderExpoHarmonyLocationTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import geoLocationManager from '@ohos.geoLocationManager';
import { AnyThreadTurboModuleContext, AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
  android: {
    accuracy: 'fine' | 'coarse' | 'none';
  };
};

type ExpoLocationObject = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
  mocked: false;
};

type ProviderStatus = {
  locationServicesEnabled: boolean;
  backgroundModeEnabled: boolean;
  gpsAvailable: boolean;
  networkAvailable: boolean;
  passiveAvailable: boolean;
};

type ReverseGeocodeResult = {
  city: string | null;
  district: string | null;
  streetNumber: string | null;
  street: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  postalCode: string | null;
  name: string | null;
  isoCountryCode: string | null;
  timezone: null;
  formattedAddress: string | null;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
};

export class ExpoHarmonyLocationTurboModule extends AnyThreadTurboModule {
  public static readonly NAME = 'ExpoHarmonyLocation';

  private readonly atManager = abilityAccessCtrl.createAtManager();

  getConstants(): Record<string, never> {
    return {};
  }

  async getForegroundPermissionStatus(): Promise<PermissionResponse> {
    return this.getLocationPermissionResponse();
  }

  async requestForegroundPermission(): Promise<PermissionResponse> {
    return this.requestLocationPermissionResponse();
  }

  async getBackgroundPermissionStatus(): Promise<PermissionResponse> {
    return this.getLocationPermissionResponse();
  }

  async requestBackgroundPermission(): Promise<PermissionResponse> {
    return this.requestLocationPermissionResponse();
  }

  async hasServicesEnabled(): Promise<boolean> {
    return geoLocationManager.isLocationEnabled();
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    const locationServicesEnabled = geoLocationManager.isLocationEnabled();

    return {
      locationServicesEnabled,
      backgroundModeEnabled: false,
      gpsAvailable: locationServicesEnabled,
      networkAvailable: locationServicesEnabled,
      passiveAvailable: locationServicesEnabled,
    };
  }

  async getCurrentPosition(options?: { accuracy?: number }): Promise<ExpoLocationObject> {
    const location = await geoLocationManager.getCurrentLocation(
      this.createCurrentLocationRequest(options?.accuracy),
    );
    return this.normalizeLocation(location);
  }

  async getLastKnownPosition(_options?: Record<string, unknown>): Promise<ExpoLocationObject | null> {
    try {
      const location = geoLocationManager.getLastLocation();
      return this.hasCoordinates(location) ? this.normalizeLocation(location) : null;
    } catch (_error) {
      return null;
    }
  }

  async geocode(address: string): Promise<GeocodeResult[]> {
    const addresses = await geoLocationManager.getAddressesFromLocationName({
      description: address,
      locale: 'en-US',
      maxItems: 5,
    });

    return addresses.map((addressEntry) => ({
      latitude: Number(addressEntry.latitude ?? 0),
      longitude: Number(addressEntry.longitude ?? 0),
    }));
  }

  async reverseGeocode(location: { latitude: number; longitude: number }): Promise<ReverseGeocodeResult[]> {
    const addresses = await geoLocationManager.getAddressesFromLocation({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      locale: 'en-US',
      maxItems: 5,
    });

    return addresses.map((addressEntry) => ({
      city: addressEntry.locality ?? null,
      district: addressEntry.subLocality ?? null,
      streetNumber: addressEntry.subThoroughfare ?? null,
      street: addressEntry.thoroughfare ?? null,
      region: addressEntry.administrativeArea ?? null,
      subregion: addressEntry.subAdministrativeArea ?? null,
      country: addressEntry.countryName ?? null,
      postalCode: addressEntry.postalCode ?? null,
      name: addressEntry.placeName ?? null,
      isoCountryCode: addressEntry.countryCode ?? null,
      timezone: null,
      formattedAddress:
        addressEntry.addressUrl ??
        (Array.isArray(addressEntry.descriptions) && addressEntry.descriptions.length > 0
          ? addressEntry.descriptions.join(', ')
          : null),
    }));
  }

  private async getLocationPermissionResponse(): Promise<PermissionResponse> {
    const approximateStatus = this.resolvePermissionStatus('ohos.permission.APPROXIMATELY_LOCATION');
    const preciseStatus = this.resolvePermissionStatus('ohos.permission.LOCATION');

    return this.buildPermissionResponse(approximateStatus, preciseStatus);
  }

  private async requestLocationPermissionResponse(): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [
      'ohos.permission.APPROXIMATELY_LOCATION',
      'ohos.permission.LOCATION',
    ]);

    return this.getLocationPermissionResponse();
  }

  private resolvePermissionStatus(permissionName: Permissions): abilityAccessCtrl.PermissionStatus {
    const atManagerWithSelfStatus = this.atManager as abilityAccessCtrl.AtManager & {
      getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus;
    };

    if (typeof atManagerWithSelfStatus.getSelfPermissionStatus === 'function') {
      return atManagerWithSelfStatus.getSelfPermissionStatus(permissionName);
    }

    const accessTokenId = this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId;
    const grantStatus = this.atManager.checkAccessTokenSync(accessTokenId, permissionName);

    return grantStatus === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
      ? abilityAccessCtrl.PermissionStatus.GRANTED
      : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;
  }

  private buildPermissionResponse(
    approximateStatus: abilityAccessCtrl.PermissionStatus,
    preciseStatus: abilityAccessCtrl.PermissionStatus,
  ): PermissionResponse {
    const coarseGranted = approximateStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const fineGranted = preciseStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const granted = coarseGranted || fineGranted;
    const denied =
      (approximateStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
        approximateStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
        approximateStatus === abilityAccessCtrl.PermissionStatus.INVALID) &&
      (preciseStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
        preciseStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
        preciseStatus === abilityAccessCtrl.PermissionStatus.INVALID);

    return {
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
      expires: 'never',
      android: {
        accuracy: fineGranted ? 'fine' : coarseGranted ? 'coarse' : 'none',
      },
    };
  }

  private createCurrentLocationRequest(accuracy?: number): geoLocationManager.CurrentLocationRequest {
    if (typeof accuracy === 'number' && accuracy >= 4) {
      return {
        priority: geoLocationManager.LocationRequestPriority.ACCURACY,
      };
    }

    if (typeof accuracy === 'number' && accuracy <= 2) {
      return {
        priority: geoLocationManager.LocationRequestPriority.LOW_POWER,
      };
    }

    return {
      priority: geoLocationManager.LocationRequestPriority.FIRST_FIX,
    };
  }

  private hasCoordinates(location: geoLocationManager.Location | null | undefined): location is geoLocationManager.Location {
    return (
      !!location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number'
    );
  }

  private normalizeLocation(location: geoLocationManager.Location): ExpoLocationObject {
    return {
      coords: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        altitude: typeof location.altitude === 'number' ? location.altitude : null,
        accuracy: typeof location.accuracy === 'number' ? location.accuracy : null,
        altitudeAccuracy: null,
        heading: typeof location.direction === 'number' ? location.direction : null,
        speed: typeof location.speed === 'number' ? location.speed : null,
      },
      timestamp: Number(location.timeStamp ?? Date.now()),
      mocked: false,
    };
  }
}
`;
}

function renderExpoHarmonyCameraTurboModule(): string {
  return `import type { Permissions } from '@ohos.abilityAccessCtrl';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import camera from '@ohos.multimedia.camera';
import cameraPicker from '@ohos.multimedia.cameraPicker';
import image from '@ohos.multimedia.image';
import { UITurboModuleContext, UITurboModule } from '@rnoh/react-native-openharmony/ts';

type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
};

type CameraCaptureResult = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  exif: null;
};

export class ExpoHarmonyCameraTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyCamera';

  private readonly atManager = abilityAccessCtrl.createAtManager();

  getConstants(): Record<string, never> {
    return {};
  }

  async getCameraPermissionStatus(): Promise<PermissionResponse> {
    return this.getPermissionResponse('ohos.permission.CAMERA');
  }

  async requestCameraPermission(): Promise<PermissionResponse> {
    return this.requestPermissionResponse('ohos.permission.CAMERA');
  }

  async getMicrophonePermissionStatus(): Promise<PermissionResponse> {
    return this.createPermissionResponse(abilityAccessCtrl.PermissionStatus.NOT_DETERMINED);
  }

  async requestMicrophonePermission(): Promise<PermissionResponse> {
    return this.createPermissionResponse(abilityAccessCtrl.PermissionStatus.NOT_DETERMINED);
  }

  async takePicture(options?: { cameraType?: string }): Promise<CameraCaptureResult> {
    const profile = new cameraPicker.PickerProfile();
    profile.cameraPosition =
      options?.cameraType === 'front'
        ? camera.CameraPosition.CAMERA_POSITION_FRONT
        : camera.CameraPosition.CAMERA_POSITION_BACK;

    const result = await cameraPicker.pick(
      this.ctx.uiAbilityContext,
      [cameraPicker.PickerMediaType.PHOTO],
      profile,
    );

    if (!result || typeof result.resultUri !== 'string' || result.resultUri.length === 0) {
      throw new Error('Camera capture was canceled.');
    }

    const imageSize = await this.getImageSize(result.resultUri);

    return {
      uri: result.resultUri,
      width: imageSize.width,
      height: imageSize.height,
      exif: null,
    };
  }

  private async getPermissionResponse(permissionName: Permissions): Promise<PermissionResponse> {
    const atManagerWithSelfStatus = this.atManager as abilityAccessCtrl.AtManager & {
      getSelfPermissionStatus?: (permission: Permissions) => abilityAccessCtrl.PermissionStatus;
    };
    const permissionStatus =
      typeof atManagerWithSelfStatus.getSelfPermissionStatus === 'function'
        ? atManagerWithSelfStatus.getSelfPermissionStatus(permissionName)
        : this.atManager.checkAccessTokenSync(
            this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId,
            permissionName,
          ) === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
          ? abilityAccessCtrl.PermissionStatus.GRANTED
          : abilityAccessCtrl.PermissionStatus.NOT_DETERMINED;

    return this.createPermissionResponse(permissionStatus);
  }

  private async requestPermissionResponse(permissionName: Permissions): Promise<PermissionResponse> {
    await this.atManager.requestPermissionsFromUser(this.ctx.uiAbilityContext, [permissionName]);
    return this.getPermissionResponse(permissionName);
  }

  private createPermissionResponse(
    permissionStatus: abilityAccessCtrl.PermissionStatus,
  ): PermissionResponse {
    const granted = permissionStatus === abilityAccessCtrl.PermissionStatus.GRANTED;
    const denied =
      permissionStatus === abilityAccessCtrl.PermissionStatus.DENIED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.RESTRICTED ||
      permissionStatus === abilityAccessCtrl.PermissionStatus.INVALID;

    return {
      status: granted ? 'granted' : denied ? 'denied' : 'undetermined',
      granted,
      canAskAgain: !denied,
      expires: 'never',
    };
  }

  private async getImageSize(assetUri: string): Promise<{ width: number; height: number }> {
    let imageSource: image.ImageSource | null = null;

    try {
      imageSource = image.createImageSource(assetUri);
      const imageInfo = await imageSource.getImageInfo();
      return {
        width: Number(imageInfo.size?.width ?? 0),
        height: Number(imageInfo.size?.height ?? 0),
      };
    } catch (_error) {
      return {
        width: 0,
        height: 0,
      };
    } finally {
      if (imageSource) {
        try {
          await imageSource.release();
        } catch (_error) {
          // Ignore cleanup errors from ImageSource release.
        }
      }
    }
  }
}
`;
}

function renderExpoFileSystemHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const FILE_SCHEME = 'file://';
const NATIVE_MODULE_NAME = 'ExpoHarmonyFileSystem';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);
const NATIVE_CONSTANTS = NATIVE_MODULE?.getConstants ? NATIVE_MODULE.getConstants() : {};

function createError(code, message) {
  return new CodedError(code, message);
}

function requireNativeModule(operationName) {
  if (NATIVE_MODULE) {
    return NATIVE_MODULE;
  }

  throw createError(
    'ERR_EXPO_HARMONY_NATIVE_MODULE_MISSING',
    '${capability.packageName} expected the ' +
      NATIVE_MODULE_NAME +
      ' TurboModule to be registered, but it was missing while running ' +
      operationName +
      '.',
  );
}

function createUnsupportedError(operationName) {
  return createError(
    'ERR_EXPO_HARMONY_UNSUPPORTED',
    '${capability.packageName} currently supports UTF-8 sandbox file operations only. Unsupported operation: ' +
      operationName +
      '.',
  );
}

function toFileUri(pathValue, ensureTrailingSlash) {
  if (typeof pathValue !== 'string' || pathValue.length === 0) {
    return null;
  }

  const normalizedPath = pathValue.startsWith(FILE_SCHEME)
    ? pathValue.slice(FILE_SCHEME.length)
    : pathValue;
  const withScheme = FILE_SCHEME + normalizedPath;

  if (!ensureTrailingSlash) {
    return withScheme;
  }

  let normalizedSchemePath = withScheme;

  while (normalizedSchemePath.endsWith('/')) {
    normalizedSchemePath = normalizedSchemePath.slice(0, -1);
  }

  return normalizedSchemePath + '/';
}

function normalizeInputPath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    throw createError(
      'ERR_EXPO_HARMONY_INVALID_URI',
      '${capability.packageName} expected a non-empty file URI.',
    );
  }

  const normalizedPath = inputPath.startsWith(FILE_SCHEME)
    ? inputPath.slice(FILE_SCHEME.length)
    : inputPath;

  if (!normalizedPath.startsWith('/')) {
    throw createError(
      'ERR_EXPO_HARMONY_INVALID_URI',
      '${capability.packageName} supports only absolute file:// URIs inside the app sandbox.',
    );
  }

  if (
    normalizedPath.includes('/../') ||
    normalizedPath.endsWith('/..') ||
    normalizedPath.includes('/./')
  ) {
    throw createError(
      'ERR_EXPO_HARMONY_INVALID_URI',
      '${capability.packageName} does not accept relative path segments.',
    );
  }

  return normalizedPath;
}

function normalizeStringEncoding(rawEncoding) {
  if (rawEncoding == null || rawEncoding === 'utf8') {
    return 'utf8';
  }

  if (rawEncoding === 'base64') {
    throw createUnsupportedError('encoding=base64');
  }

  throw createUnsupportedError('encoding=' + String(rawEncoding));
}

function normalizeFileInfoResult(requestedUri, nativeResult) {
  if (!nativeResult || nativeResult.exists !== true) {
    return {
      exists: false,
      isDirectory: false,
      uri: String(requestedUri),
    };
  }

  const normalizedResult = {
    exists: true,
    uri: toFileUri(nativeResult.path, false) ?? String(requestedUri),
    size: Number(nativeResult.size ?? 0),
    isDirectory: nativeResult.isDirectory === true,
    modificationTime: Number(nativeResult.modificationTime ?? 0),
  };

  if (typeof nativeResult.md5 === 'string' && nativeResult.md5.length > 0) {
    normalizedResult.md5 = nativeResult.md5;
  }

  return normalizedResult;
}

function normalizeNativeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code)
        : null;
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : typeof error.name === 'string' && error.name.length > 0
          ? error.name
          : JSON.stringify(error);

    return new Error(code ? '[native:' + code + '] ' + message : message);
  }

  return new Error(String(error));
}

module.exports = {
  documentDirectory: toFileUri(NATIVE_CONSTANTS.documentDirectoryPath, true),
  cacheDirectory: toFileUri(NATIVE_CONSTANTS.cacheDirectoryPath, true),
  bundleDirectory: toFileUri(NATIVE_CONSTANTS.bundleDirectoryPath, true),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
  FileSystemSessionType: {
    BACKGROUND: 0,
    FOREGROUND: 1,
  },
  async getInfoAsync(fileUri, options) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      const result = await requireNativeModule('getInfoAsync').getInfo(normalizedPath, {
        md5: options?.md5 === true,
      });
      return normalizeFileInfoResult(fileUri, result);
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async readAsStringAsync(fileUri, options) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      return await requireNativeModule('readAsStringAsync').readAsString(normalizedPath, {
        encoding: normalizeStringEncoding(options?.encoding),
        position: options?.position,
        length: options?.length,
      });
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async writeAsStringAsync(fileUri, contents, options) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      await requireNativeModule('writeAsStringAsync').writeAsString(
        normalizedPath,
        String(contents),
        {
          encoding: normalizeStringEncoding(options?.encoding),
        },
      );
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async deleteAsync(fileUri, options) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      await requireNativeModule('deleteAsync').deletePath(normalizedPath, {
        idempotent: options?.idempotent === true,
      });
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async makeDirectoryAsync(fileUri, options) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      await requireNativeModule('makeDirectoryAsync').makeDirectory(normalizedPath, {
        intermediates: options?.intermediates === true,
      });
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async readDirectoryAsync(fileUri) {
    const normalizedPath = normalizeInputPath(fileUri);
    try {
      return await requireNativeModule('readDirectoryAsync').readDirectory(normalizedPath);
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async copyAsync(options) {
    const fromPath = normalizeInputPath(options?.from);
    const toPath = normalizeInputPath(options?.to);
    try {
      await requireNativeModule('copyAsync').copy(fromPath, toPath);
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async moveAsync(options) {
    const fromPath = normalizeInputPath(options?.from);
    const toPath = normalizeInputPath(options?.to);
    try {
      await requireNativeModule('moveAsync').move(fromPath, toPath);
    } catch (error) {
      throw normalizeNativeError(error);
    }
  },
  async downloadAsync(url) {
    throw createUnsupportedError('downloadAsync(' + String(url) + ')');
  },
};
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

function renderExpoImagePickerHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyImagePicker';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);

function createError(code, message) {
  return new CodedError(code, message);
}

function requireNativeModule(operationName) {
  if (NATIVE_MODULE) {
    return NATIVE_MODULE;
  }

  throw createError(
    'ERR_EXPO_HARMONY_NATIVE_MODULE_MISSING',
    '${capability.packageName} expected the ' +
      NATIVE_MODULE_NAME +
      ' TurboModule to be registered, but it was missing while running ' +
      operationName +
      '.',
  );
}

function normalizeNativeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code)
        : null;
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : typeof error.name === 'string' && error.name.length > 0
          ? error.name
          : JSON.stringify(error);

    return new Error(code ? '[native:' + code + '] ' + message : message);
  }

  return new Error(String(error));
}

function normalizePickerResult(result) {
  if (!result || result.canceled === true || !Array.isArray(result.assets) || result.assets.length === 0) {
    return {
      canceled: true,
      assets: null,
    };
  }

  return {
    canceled: false,
    assets: result.assets.map((asset) => ({
      uri: String(asset.uri),
      assetId: asset.assetId ?? null,
      width: Number(asset.width ?? 0),
      height: Number(asset.height ?? 0),
      type: asset.type ?? null,
      fileName: asset.fileName ?? null,
      fileSize:
        typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize)
          ? asset.fileSize
          : null,
      mimeType: asset.mimeType ?? null,
      duration:
        typeof asset.duration === 'number' && Number.isFinite(asset.duration)
          ? asset.duration
          : null,
      exif: asset.exif ?? null,
      base64: asset.base64 ?? null,
    })),
  };
}

async function invokeNative(methodName, operationName, ...args) {
  try {
    return await requireNativeModule(operationName)[methodName](...args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

module.exports = {
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
  CameraType: {
    front: 'front',
    back: 'back',
  },
  UIImagePickerPresentationStyle: {
    AUTOMATIC: 'automatic',
    FULL_SCREEN: 'fullScreen',
    PAGE_SHEET: 'pageSheet',
    FORM_SHEET: 'formSheet',
    CURRENT_CONTEXT: 'currentContext',
    OVER_FULL_SCREEN: 'overFullScreen',
  },
  async requestCameraPermissionsAsync() {
    return invokeNative(
      'requestCameraPermission',
      'requestCameraPermissionsAsync',
    );
  },
  async requestMediaLibraryPermissionsAsync(writeOnly) {
    return invokeNative(
      'requestMediaLibraryPermission',
      'requestMediaLibraryPermissionsAsync',
      writeOnly === true,
    );
  },
  async getCameraPermissionsAsync() {
    return invokeNative('getCameraPermissionStatus', 'getCameraPermissionsAsync');
  },
  async getMediaLibraryPermissionsAsync(writeOnly) {
    return invokeNative(
      'getMediaLibraryPermissionStatus',
      'getMediaLibraryPermissionsAsync',
      writeOnly === true,
    );
  },
  async launchCameraAsync(options) {
    return normalizePickerResult(
      await invokeNative('launchCamera', 'launchCameraAsync', options ?? {}),
    );
  },
  async launchImageLibraryAsync(options) {
    return normalizePickerResult(
      await invokeNative('launchImageLibrary', 'launchImageLibraryAsync', options ?? {}),
    );
  },
  async getPendingResultAsync() {
    return null;
  },
};
`;
}

function renderExpoLocationHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyLocation';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);
const ACTIVE_WATCHES = new Map();
let nextWatchId = 1;

function createError(code, message) {
  return new CodedError(code, message);
}

function requireNativeModule(operationName) {
  if (NATIVE_MODULE) {
    return NATIVE_MODULE;
  }

  throw createError(
    'ERR_EXPO_HARMONY_NATIVE_MODULE_MISSING',
    '${capability.packageName} expected the ' +
      NATIVE_MODULE_NAME +
      ' TurboModule to be registered, but it was missing while running ' +
      operationName +
      '.',
  );
}

function normalizeNativeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code)
        : null;
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : typeof error.name === 'string' && error.name.length > 0
          ? error.name
          : JSON.stringify(error);

    return new Error(code ? '[native:' + code + '] ' + message : message);
  }

  return new Error(String(error));
}

async function invokeNative(methodName, operationName, ...args) {
  try {
    return await requireNativeModule(operationName)[methodName](...args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

function normalizePermissionResponse(permissionResponse) {
  return {
    status: permissionResponse?.status ?? 'undetermined',
    granted: permissionResponse?.granted === true,
    canAskAgain: permissionResponse?.canAskAgain !== false,
    expires: permissionResponse?.expires ?? 'never',
    android: permissionResponse?.android ?? { accuracy: 'none' },
    ios: permissionResponse?.ios ?? null,
  };
}

function normalizeLocationObject(location) {
  return {
    coords: {
      latitude: Number(location?.coords?.latitude ?? 0),
      longitude: Number(location?.coords?.longitude ?? 0),
      altitude:
        typeof location?.coords?.altitude === 'number' ? location.coords.altitude : null,
      accuracy:
        typeof location?.coords?.accuracy === 'number' ? location.coords.accuracy : null,
      altitudeAccuracy:
        typeof location?.coords?.altitudeAccuracy === 'number'
          ? location.coords.altitudeAccuracy
          : null,
      heading: typeof location?.coords?.heading === 'number' ? location.coords.heading : null,
      speed: typeof location?.coords?.speed === 'number' ? location.coords.speed : null,
    },
    timestamp: Number(location?.timestamp ?? Date.now()),
    mocked: location?.mocked === true,
  };
}

function normalizeProviderStatus(providerStatus) {
  return {
    locationServicesEnabled: providerStatus?.locationServicesEnabled === true,
    backgroundModeEnabled: providerStatus?.backgroundModeEnabled === true,
    gpsAvailable: providerStatus?.gpsAvailable === true,
    networkAvailable: providerStatus?.networkAvailable === true,
    passiveAvailable: providerStatus?.passiveAvailable === true,
  };
}

function normalizeReverseGeocodeResult(address) {
  return {
    city: address?.city ?? null,
    district: address?.district ?? null,
    streetNumber: address?.streetNumber ?? null,
    street: address?.street ?? null,
    region: address?.region ?? null,
    subregion: address?.subregion ?? null,
    country: address?.country ?? null,
    postalCode: address?.postalCode ?? null,
    name: address?.name ?? null,
    isoCountryCode: address?.isoCountryCode ?? null,
    timezone: address?.timezone ?? null,
    formattedAddress: address?.formattedAddress ?? null,
  };
}

function normalizeGeocodeInput(address) {
  if (typeof address === 'string') {
    return address.trim();
  }

  if (!address || typeof address !== 'object') {
    return '';
  }

  const parts = [
    address.name,
    address.streetNumber,
    address.street,
    address.district,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.join(', ');
}

function normalizeGeocodeResults(results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((result) => ({
    latitude: Number(result?.latitude ?? 0),
    longitude: Number(result?.longitude ?? 0),
    altitude: typeof result?.altitude === 'number' ? result.altitude : null,
    accuracy: typeof result?.accuracy === 'number' ? result.accuracy : null,
  }));
}

function createWatchSubscription(watchId) {
  return {
    remove() {
      const watchState = ACTIVE_WATCHES.get(watchId);

      if (watchState?.timer) {
        clearInterval(watchState.timer);
      }

      ACTIVE_WATCHES.delete(watchId);
    },
  };
}

async function pollWatchPosition(watchId) {
  const watchState = ACTIVE_WATCHES.get(watchId);

  if (!watchState) {
    return;
  }

  try {
    const location = normalizeLocationObject(
      await invokeNative('getCurrentPosition', 'watchPositionAsync', watchState.options),
    );
    watchState.lastLocation = location;
    watchState.callback(location);
  } catch (error) {
    if (typeof watchState.errorHandler === 'function') {
      watchState.errorHandler(normalizeNativeError(error));
    }
  }
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
  async getForegroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'getForegroundPermissionStatus',
        'getForegroundPermissionsAsync',
      ),
    );
  },
  async requestForegroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'requestForegroundPermission',
        'requestForegroundPermissionsAsync',
      ),
    );
  },
  async getBackgroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'getBackgroundPermissionStatus',
        'getBackgroundPermissionsAsync',
      ),
    );
  },
  async requestBackgroundPermissionsAsync() {
    return normalizePermissionResponse(
      await invokeNative(
        'requestBackgroundPermission',
        'requestBackgroundPermissionsAsync',
      ),
    );
  },
  async hasServicesEnabledAsync() {
    return await invokeNative('hasServicesEnabled', 'hasServicesEnabledAsync');
  },
  async getProviderStatusAsync() {
    return normalizeProviderStatus(
      await invokeNative('getProviderStatus', 'getProviderStatusAsync'),
    );
  },
  async getCurrentPositionAsync(options) {
    return normalizeLocationObject(
      await invokeNative('getCurrentPosition', 'getCurrentPositionAsync', options ?? {}),
    );
  },
  async getLastKnownPositionAsync(options) {
    const location = await invokeNative(
      'getLastKnownPosition',
      'getLastKnownPositionAsync',
      options ?? {},
    );
    return location ? normalizeLocationObject(location) : null;
  },
  async geocodeAsync(address) {
    return normalizeGeocodeResults(
      await invokeNative(
        'geocode',
        'geocodeAsync',
        normalizeGeocodeInput(address),
      ),
    );
  },
  async reverseGeocodeAsync(location) {
    const results = await invokeNative(
      'reverseGeocode',
      'reverseGeocodeAsync',
      {
        latitude: Number(location?.latitude ?? 0),
        longitude: Number(location?.longitude ?? 0),
      },
    );

    if (!Array.isArray(results)) {
      return [];
    }

    return results.map(normalizeReverseGeocodeResult);
  },
  async watchPositionAsync(options, callback, errorHandler) {
    if (typeof callback !== 'function') {
      throw createError(
        'ERR_EXPO_HARMONY_INVALID_LISTENER',
        '${capability.packageName} expected watchPositionAsync to receive a callback.',
      );
    }

    const watchId = nextWatchId++;
    const intervalMs = Math.max(
      1000,
      Number.isFinite(options?.timeInterval)
        ? Number(options.timeInterval)
        : 5000,
    );
    const watchState = {
      options: options ?? {},
      callback,
      errorHandler,
      timer: null,
      lastLocation: null,
    };

    ACTIVE_WATCHES.set(watchId, watchState);
    await pollWatchPosition(watchId);

    const registeredWatch = ACTIVE_WATCHES.get(watchId);
    if (registeredWatch) {
      registeredWatch.timer = setInterval(() => {
        void pollWatchPosition(watchId);
      }, intervalMs);
    }

    return createWatchSubscription(watchId);
  },
  async watchHeadingAsync(callback) {
    if (typeof callback !== 'function') {
      throw createError(
        'ERR_EXPO_HARMONY_INVALID_LISTENER',
        '${capability.packageName} expected watchHeadingAsync to receive a callback.',
      );
    }

    const subscription = await module.exports.watchPositionAsync(
      { accuracy: 3, timeInterval: 5000 },
      (location) => {
        callback({
          trueHeading: location.coords.heading ?? 0,
          magHeading: location.coords.heading ?? 0,
          accuracy: location.coords.accuracy ?? 0,
        });
      },
    );

    return subscription;
  },
  async getHeadingAsync() {
    const location = await module.exports.getCurrentPositionAsync({ accuracy: 3 });
    return {
      trueHeading: location.coords.heading ?? 0,
      magHeading: location.coords.heading ?? 0,
      accuracy: location.coords.accuracy ?? 0,
    };
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
  geocodeAsync(address) {
    return unavailable('geocodeAsync(' + JSON.stringify(address ?? null) + ')');
  },
  reverseGeocodeAsync(location) {
    return unavailable('reverseGeocodeAsync(' + JSON.stringify(location ?? null) + ')');
  },
};
`;
}

function renderExpoCameraHarmonyAdapterShim(capability: CapabilityDefinition): string {
  return `'use strict';

const React = require('react');
const { Text, View } = require('react-native');
const { TurboModuleRegistry } = require('react-native');
const { CodedError } = require('expo-modules-core');

const NATIVE_MODULE_NAME = 'ExpoHarmonyCamera';
const NATIVE_MODULE = TurboModuleRegistry.get(NATIVE_MODULE_NAME);
const DEFAULT_PERMISSION_RESPONSE = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

function createError(code, message) {
  return new CodedError(code, message);
}

function createUnsupportedError(operationName) {
  return createError(
    'ERR_EXPO_HARMONY_UNSUPPORTED',
    '${capability.packageName} does not implement ' + operationName + ' on HarmonyOS yet.',
  );
}

function requireNativeModule(operationName) {
  if (NATIVE_MODULE) {
    return NATIVE_MODULE;
  }

  throw createError(
    'ERR_EXPO_HARMONY_NATIVE_MODULE_MISSING',
    '${capability.packageName} expected the ' +
      NATIVE_MODULE_NAME +
      ' TurboModule to be registered, but it was missing while running ' +
      operationName +
      '.',
  );
}

function normalizeNativeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code)
        : null;
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : typeof error.name === 'string' && error.name.length > 0
          ? error.name
          : JSON.stringify(error);

    return new Error(code ? '[native:' + code + '] ' + message : message);
  }

  return new Error(String(error));
}

async function invokeNative(methodName, operationName, ...args) {
  try {
    return await requireNativeModule(operationName)[methodName](...args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

function normalizePermissionResponse(permissionResponse) {
  return {
    status: permissionResponse?.status ?? DEFAULT_PERMISSION_RESPONSE.status,
    granted: permissionResponse?.granted === true,
    canAskAgain: permissionResponse?.canAskAgain !== false,
    expires: permissionResponse?.expires ?? DEFAULT_PERMISSION_RESPONSE.expires,
  };
}

function normalizeCameraFacing(facing) {
  return facing === 'front' ? 'front' : 'back';
}

const CameraView = React.forwardRef(function ExpoHarmonyCameraView(props, ref) {
  const [previewPaused, setPreviewPaused] = React.useState(false);

  React.useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        return invokeNative('takePicture', 'CameraView.takePictureAsync', {
          cameraType: normalizeCameraFacing(props.facing),
          ...options,
        });
      },
      async pausePreview() {
        setPreviewPaused(true);
      },
      async resumePreview() {
        setPreviewPaused(false);
      },
      async getAvailablePictureSizesAsync() {
        return ['1920x1080'];
      },
      async getAvailableLensesAsync() {
        return [];
      },
      async recordAsync() {
        throw createUnsupportedError('CameraView.recordAsync');
      },
      async stopRecording() {
        throw createUnsupportedError('CameraView.stopRecording');
      },
      async toggleRecordingAsync() {
        throw createUnsupportedError('CameraView.toggleRecordingAsync');
      },
    }),
    [props.facing],
  );

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
          borderColor: '#0f172a',
          backgroundColor: previewPaused ? '#cbd5e1' : '#0f172a',
          padding: 20,
          overflow: 'hidden',
        },
        props.style,
      ],
      accessibilityLabel: 'Expo Harmony camera capture surface',
    },
    React.createElement(
      View,
      {
        style: {
          gap: 6,
          alignItems: 'center',
        },
      },
      React.createElement(
        Text,
        {
          style: {
            color: previewPaused ? '#334155' : '#e2e8f0',
            fontSize: 14,
            fontWeight: '700',
            textAlign: 'center',
          },
        },
        'Expo Harmony camera capture surface',
      ),
      React.createElement(
        Text,
        {
          style: {
            color: previewPaused ? '#475569' : '#94a3b8',
            fontSize: 12,
            textAlign: 'center',
          },
        },
        previewPaused
          ? 'Preview paused locally while capture support remains available.'
          : 'Using Harmony system capture flow behind the managed adapter.',
      ),
    ),
  );
});

CameraView.displayName = 'ExpoHarmonyCameraView';

async function getCameraPermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('getCameraPermissionStatus', 'getCameraPermissionsAsync'),
  );
}

async function requestCameraPermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('requestCameraPermission', 'requestCameraPermissionsAsync'),
  );
}

async function getMicrophonePermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative('getMicrophonePermissionStatus', 'getMicrophonePermissionsAsync'),
  );
}

async function requestMicrophonePermissionsAsync() {
  return normalizePermissionResponse(
    await invokeNative(
      'requestMicrophonePermission',
      'requestMicrophonePermissionsAsync',
    ),
  );
}

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
  Camera: {
    CameraType: {
      front: 'front',
      back: 'back',
    },
    Constants: {
      Type: {
        front: 'front',
        back: 'back',
      },
      FlashMode: {
        off: 'off',
        on: 'on',
        auto: 'auto',
        torch: 'torch',
      },
    },
    getCameraPermissionsAsync,
    requestCameraPermissionsAsync,
    getMicrophonePermissionsAsync,
    requestMicrophonePermissionsAsync,
  },
  getCameraPermissionsAsync,
  requestCameraPermissionsAsync,
  getMicrophonePermissionsAsync,
  requestMicrophonePermissionsAsync,
  async scanFromURLAsync() {
    throw createUnsupportedError('scanFromURLAsync');
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
    pausePreview() {
      return unavailable('CameraView.pausePreview()');
    },
    resumePreview() {
      return unavailable('CameraView.resumePreview()');
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
  Camera: {
    getCameraPermissionsAsync() {
      return Promise.resolve(getPermissionResponse());
    },
    requestCameraPermissionsAsync() {
      return unavailable('Camera.requestCameraPermissionsAsync');
    },
    getMicrophonePermissionsAsync() {
      return Promise.resolve(getPermissionResponse());
    },
    requestMicrophonePermissionsAsync() {
      return unavailable('Camera.requestMicrophonePermissionsAsync');
    },
  },
  scanFromURLAsync() {
    return unavailable('scanFromURLAsync');
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
