import fs from 'fs-extra';
import path from 'path';
import {
  DESIRED_PACKAGE_SCRIPTS,
  GENERATED_DIR,
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
  SyncResult,
  TemplateFileDefinition,
  ToolkitConfig,
  ToolkitManifest,
} from '../types';
import {
  createGeneratedSha,
  deriveHarmonyIdentifiers,
  loadProject,
  resolveRnohHvigorPluginFilename,
} from './project';
import { buildDoctorReport, writeDoctorReport } from './report';

const TEMPLATE_ROOT = path.resolve(__dirname, '..', '..', 'templates', 'harmony');

const TEMPLATE_FILE_PATHS = [
  'README.md',
  'build-profile.json5',
  'codelinter.json',
  'hvigor/hvigor-config.json5',
  'hvigorfile.ts',
  'oh-package.json5',
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

export async function syncProjectTemplate(projectRoot: string, force = false): Promise<SyncResult> {
  const loadedProject = await loadProject(projectRoot);
  const identifiers = deriveHarmonyIdentifiers(loadedProject.expoConfig, loadedProject.packageJson);
  const previousToolkitConfig = await readToolkitConfig(loadedProject.projectRoot);
  const desiredFiles = await buildManagedFiles(loadedProject, identifiers, previousToolkitConfig);
  const previousManifest = await readManifest(loadedProject.projectRoot);
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

      if (!force && !managedByToolkit) {
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
  const hvigorPluginFilename = await resolveRnohHvigorPluginFilename(loadedProject.projectRoot);
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
        contents,
        binary,
      };
    }),
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
    {
      relativePath: 'metro.harmony.config.js',
      contents: renderMetroConfig(identifiers),
    },
    {
      relativePath: path.join(GENERATED_DIR, TOOLKIT_CONFIG_FILENAME),
      contents: JSON.stringify(toolkitConfig, null, 2) + '\n',
    },
  ];
}

async function syncPackageScripts(projectRoot: string, _force: boolean): Promise<string[]> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
  const scripts = { ...(packageJson.scripts ?? {}) };
  const warnings: string[] = [];
  let didChange = false;

  for (const [scriptName, desiredCommand] of Object.entries(DESIRED_PACKAGE_SCRIPTS)) {
    const currentCommand = scripts[scriptName];

    if (!currentCommand) {
      scripts[scriptName] = desiredCommand;
      didChange = true;
      continue;
    }

    if (currentCommand === desiredCommand) {
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

function renderMetroConfig(identifiers: HarmonyIdentifiers): string {
  return `const { getDefaultConfig } = require('expo/metro-config');
const { createHarmonyMetroConfig } = require('@react-native-oh/react-native-harmony/metro.config');

const defaultConfig = getDefaultConfig(__dirname);
const harmonyConfig = createHarmonyMetroConfig({
  reactNativeHarmonyPackageName: '@react-native-oh/react-native-harmony',
});

module.exports = {
  ...defaultConfig,
  ...harmonyConfig,
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
