import fs from 'fs-extra';
import path from 'path';
import {
  DESIRED_PACKAGE_SCRIPTS,
  GENERATED_DIR,
  MANIFEST_FILENAME,
  RNOH_CLI_VERSION,
  RNOH_VERSION,
  TEMPLATE_VERSION,
  TOOLKIT_CONFIG_FILENAME,
} from './constants';
import {
  ExpoHarmonyPluginProps,
  HarmonyIdentifiers,
  InitResult,
  LoadedProject,
  ManagedFileRecord,
  PackageJson,
  SyncResult,
  TemplateFileDefinition,
  ToolkitManifest,
} from '../types';
import { createGeneratedSha, deriveHarmonyIdentifiers, loadProject } from './project';
import { buildDoctorReport, writeDoctorReport } from './report';

const TEMPLATE_ROOT = path.resolve(__dirname, '..', '..', 'templates', 'harmony');

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
  const desiredFiles = await buildManagedFiles(loadedProject, identifiers);
  const previousManifest = await readManifest(loadedProject.projectRoot);
  const result: SyncResult = {
    writtenFiles: [],
    unchangedFiles: [],
    skippedFiles: [],
    warnings: [],
    manifestPath: path.join(loadedProject.projectRoot, GENERATED_DIR, MANIFEST_FILENAME),
  };

  const manifestFiles: ManagedFileRecord[] = [];

  for (const file of desiredFiles) {
    const targetPath = path.join(loadedProject.projectRoot, file.relativePath);
    const expectedHash = createGeneratedSha(file.contents);
    const previousRecord = previousManifest?.files.find(
      (record) => record.relativePath === file.relativePath,
    );

    if (await fs.pathExists(targetPath)) {
      const currentContents = await fs.readFile(targetPath, 'utf8');

      if (currentContents === file.contents) {
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
    templateVersion: TEMPLATE_VERSION,
    projectRoot: loadedProject.projectRoot,
    files: manifestFiles,
  };
  await fs.writeJson(result.manifestPath, manifest, { spaces: 2 });

  return result;
}

async function buildManagedFiles(
  loadedProject: LoadedProject,
  identifiers: HarmonyIdentifiers,
): Promise<TemplateFileDefinition[]> {
  const templateFiles = await Promise.all(
    [
      'README.md',
      'build-profile.json5',
      'oh-package.json5',
      'AppScope/app.json5',
      'entry/src/main/module.json5',
      'entry/src/main/resources/base/element/string.json',
      'entry/src/main/resources/rawfile/.gitkeep',
    ].map(async (relativePath) => {
      const templatePath = path.join(TEMPLATE_ROOT, relativePath);
      const contents = await fs.readFile(templatePath, 'utf8');

      return {
        relativePath: path.join('harmony', relativePath),
        contents: renderTemplate(contents, loadedProject, identifiers),
      };
    }),
  );

  const toolkitConfig = {
    templateVersion: TEMPLATE_VERSION,
    rnohVersion: RNOH_VERSION,
    rnohCliVersion: RNOH_CLI_VERSION,
    bundleName: identifiers.bundleName,
    entryModuleName: identifiers.entryModuleName,
    project: {
      name: loadedProject.expoConfig.name ?? identifiers.appName,
      slug: loadedProject.expoConfig.slug ?? identifiers.slug,
      version: loadedProject.expoConfig.version ?? '1.0.0',
    },
  };

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

async function syncPackageScripts(projectRoot: string, force: boolean): Promise<string[]> {
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

    if (force) {
      scripts[scriptName] = desiredCommand;
      didChange = true;
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

async function readManifest(projectRoot: string): Promise<ToolkitManifest | null> {
  const manifestPath = path.join(projectRoot, GENERATED_DIR, MANIFEST_FILENAME);

  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  return (await fs.readJson(manifestPath)) as ToolkitManifest;
}

function renderTemplate(
  template: string,
  loadedProject: LoadedProject,
  identifiers: HarmonyIdentifiers,
): string {
  const replacements: Record<string, string> = {
    APP_NAME: identifiers.appName,
    APP_SLUG: identifiers.slug,
    APP_VERSION: String(loadedProject.expoConfig.version ?? loadedProject.packageJson.version ?? '1.0.0'),
    BUNDLE_NAME: identifiers.bundleName,
    ENTRY_MODULE_NAME: identifiers.entryModuleName,
    TEMPLATE_VERSION,
    RNOH_VERSION,
    RNOH_CLI_VERSION,
  };

  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => replacements[key] ?? '');
}

function renderMetroConfig(identifiers: HarmonyIdentifiers): string {
  return `const { getDefaultConfig } = require('expo/metro-config');
const { createHarmonyMetroConfig } = require('@react-native-oh/react-native-harmony/metro.config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = createHarmonyMetroConfig(defaultConfig, {
  reactNativeHarmonyPackageName: '@react-native-oh/react-native-harmony',
  harmonyProjectPath: './harmony',
  entryModuleName: '${identifiers.entryModuleName}',
});
`;
}

function sortRecordByKey(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
