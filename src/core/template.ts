import fs from 'fs-extra';
import path from 'path';
import {
  GENERATED_DIR,
  GENERATED_SHIMS_DIR,
  HARMONY_ROUTER_ENTRY_FILENAME,
  HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH,
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
  DoctorReport,
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
import {
  createGeneratedSha,
  deriveHarmonyIdentifiers,
  loadProject,
  resolveRnohHvigorPluginFilename,
} from './project';
import { normalizeKnownJavaScriptDependencies } from './javascriptDependencies';
import { buildDoctorReport, writeDoctorReport } from './report';
import {
  mergeSigningLocalConfigIntoBuildProfile,
  renderSigningLocalExampleConfig,
  readSigningLocalConfig,
} from './signing';
import {
  AUTOLINKED_FILE_PATHS,
  buildAutolinkedManagedFiles as generateManagedAutolinkedFiles,
} from './autolinking';
import {
  MANAGED_EXPO_HARMONY_MODULE_RENDERERS,
  renderCapabilityModuleShim,
} from './template/capabilityRegistry';
import { renderExpoModulesCoreHarmonyShim } from './template/expoModulesCoreShim';
import {
  renderExpoHarmonyCppPackage,
  renderExpoHarmonyPackage,
  renderPackageProvider,
  renderPackageProviderCpp,
} from './template/nativeFiles';
import { renderMetroConfig } from './template/metro';
import {
  renderHarmonyRuntimePrelude,
  renderReactNativeSafeAreaContextHarmonyShim,
} from './template/runtimeShims';
import {
  buildDesiredPackageScripts,
  collectMetadataWarnings,
  contentsEqual,
  isBinaryTemplate,
  isEquivalentToolkitScript,
  renderRouterHarmonyEntry,
  resolveHarmonyBundleEntryFile,
  sortRecordByKey,
  stabilizeToolkitConfigTimestamp,
  usesExpoRouter,
} from './template/support';
import { SIGNING_LOCAL_EXAMPLE_FILENAME } from './constants';

export {
  buildDesiredPackageScripts,
  resolveHarmonyBundleEntryFile,
  usesExpoRouter,
} from './template/support';

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

interface SyncProjectTemplateOptions {
  forceManagedPaths?: readonly string[];
  skipJavaScriptDependencyNormalization?: boolean;
  doctorReport?: DoctorReport;
}

export async function initProject(projectRoot: string, force = false): Promise<InitResult> {
  const report = await buildDoctorReport(projectRoot);
  const sync = await syncProjectTemplate(projectRoot, force, {
    doctorReport: report,
  });
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
  const doctorReport = options.doctorReport ?? (await buildDoctorReport(loadedProject.projectRoot));
  const desiredFiles = await buildManagedFiles(
    loadedProject,
    identifiers,
    previousToolkitConfig,
    doctorReport,
  );
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
  doctorReport: DoctorReport,
): Promise<TemplateFileDefinition[]> {
  const hasExpoRouter = usesExpoRouter(loadedProject.packageJson);
  const enabledCapabilities = doctorReport.capabilities;
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
  const autolinkedFiles = await generateManagedAutolinkedFiles(
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
    coverageProfile: doctorReport.coverageProfile,
    capabilities: enabledCapabilities.map((capability) => ({
      id: capability.id,
      packageName: capability.packageName,
      supportTier: capability.supportTier,
      runtimeMode: capability.runtimeMode,
      evidence: { ...capability.evidence },
      evidenceSource: { ...capability.evidenceSource },
    })),
    requestedHarmonyPermissions,
    nextActions: [...doctorReport.nextActions],
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
          ...MANAGED_EXPO_HARMONY_MODULE_RENDERERS.map(
            ({ filename, render }) =>
              ({
                relativePath: path.join(
                  'harmony',
                  'entry',
                  'src',
                  'main',
                  'ets',
                  'expoHarmony',
                  filename,
                ),
                contents: render(),
              }) satisfies TemplateFileDefinition,
          ),
        ]
      : []),
    {
      relativePath: path.join(GENERATED_DIR, TOOLKIT_CONFIG_FILENAME),
      contents: JSON.stringify(toolkitConfig, null, 2) + '\n',
    },
    {
      relativePath: path.join(GENERATED_DIR, SIGNING_LOCAL_EXAMPLE_FILENAME),
      contents: renderSigningLocalExampleConfig(),
    },
  ];
}

async function syncPackageScripts(projectRoot: string, _force: boolean): Promise<string[]> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
  const desiredScripts = buildDesiredPackageScripts(packageJson);
  const scripts = { ...(packageJson.scripts ?? {}) };
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

  if (didChange) {
    packageJson.scripts = sortRecordByKey(scripts);
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
    case 'ohos.permission.MICROPHONE':
      return 'Microphone access is required for Harmony preview video recording flows.';
    case 'ohos.permission.READ_IMAGEVIDEO':
      return 'Media library access is required for Harmony preview image selection flows.';
    case 'ohos.permission.LOCATION':
    case 'ohos.permission.APPROXIMATELY_LOCATION':
      return 'Location access is required for Harmony preview location flows.';
    case 'ohos.permission.LOCATION_IN_BACKGROUND':
      return 'Background location access is required for Harmony preview background location flows.';
    case 'ohos.permission.ACCELEROMETER':
      return 'Motion sensor access is required for Harmony preview heading flows.';
    case 'ohos.permission.NOTIFICATION_CONTROLLER':
      return 'Notification access is required for Harmony preview notification flows.';
    default:
      return 'This Harmony permission is required for managed preview native capability flows.';
  }
}

function getHarmonyPermissionWhen(permissionName: string): 'inuse' | 'always' {
  switch (permissionName) {
    case 'ohos.permission.NOTIFICATION_CONTROLLER':
    case 'ohos.permission.LOCATION_IN_BACKGROUND':
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
