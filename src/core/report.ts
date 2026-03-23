import fs from 'fs-extra';
import path from 'path';
import {
  DOCTOR_REPORT_FILENAME,
  GENERATED_DIR,
  RNOH_CLI_VERSION,
  RNOH_VERSION,
  SUPPORTED_EXPO_SDKS,
  TEMPLATE_VERSION,
  TOOLKIT_VERSION,
} from './constants';
import { COMPATIBILITY_MATRIX } from '../data/compatibilityMatrix';
import { CompatibilityRecord, DetectedDependency, DoctorReport } from '../types';
import {
  collectDeclaredDependencies,
  collectExpoPlugins,
  detectExpoSdkVersion,
  getExpoSdkWarning,
  loadProject,
} from './project';

const DEFAULT_RECORD: CompatibilityRecord = {
  status: 'unknown',
  note: 'This dependency is not in the current compatibility matrix yet.',
};

export async function buildDoctorReport(projectRoot: string): Promise<DoctorReport> {
  const loadedProject = await loadProject(projectRoot);
  const expoSdkVersion = detectExpoSdkVersion(loadedProject.packageJson);

  const dependencyRecords = new Map<string, DetectedDependency>();
  const declaredDependencies = collectDeclaredDependencies(loadedProject.packageJson);

  for (const dependency of declaredDependencies) {
    dependencyRecords.set(
      dependency.name,
      createDependencyRecord(dependency.name, dependency.version, dependency.source),
    );
  }

  for (const pluginName of collectExpoPlugins(loadedProject.expoConfig)) {
    if (!dependencyRecords.has(pluginName)) {
      dependencyRecords.set(pluginName, createDependencyRecord(pluginName, 'configured', 'expo-plugin'));
    }
  }

  const dependencies = [...dependencyRecords.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const warnings: string[] = [];
  const expoSdkWarning = getExpoSdkWarning(expoSdkVersion);

  if (expoSdkWarning) {
    warnings.push(expoSdkWarning);
  }

  if (!loadedProject.expoConfig.android?.package) {
    warnings.push('android.package is missing in Expo config. A Harmony bundle identifier fallback will be generated.');
  }

  if (!loadedProject.expoConfig.ios?.bundleIdentifier) {
    warnings.push('ios.bundleIdentifier is missing in Expo config. Harmony sidecar generation will fall back to android.package or slug.');
  }

  if (dependencies.some((dependency) => dependency.status === 'unknown')) {
    warnings.push('Unknown dependencies were detected. The toolkit can scaffold the project, but runtime portability is not guaranteed.');
  }

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: loadedProject.projectRoot,
    appConfigPath: loadedProject.appConfigPath,
    toolkitVersion: TOOLKIT_VERSION,
    templateVersion: TEMPLATE_VERSION,
    rnohVersion: RNOH_VERSION,
    rnohCliVersion: RNOH_CLI_VERSION,
    expoSdkVersion,
    expoConfig: {
      name: loadedProject.expoConfig.name ?? null,
      slug: loadedProject.expoConfig.slug ?? null,
      version: loadedProject.expoConfig.version ?? null,
      androidPackage: loadedProject.expoConfig.android?.package ?? null,
      iosBundleIdentifier: loadedProject.expoConfig.ios?.bundleIdentifier ?? null,
    },
    dependencies,
    summary: {
      total: dependencies.length,
      supported: dependencies.filter((dependency) => dependency.status === 'supported').length,
      manual: dependencies.filter((dependency) => dependency.status === 'manual').length,
      unknown: dependencies.filter((dependency) => dependency.status === 'unknown').length,
    },
    warnings,
  };
}

export async function writeDoctorReport(
  projectRoot: string,
  report: DoctorReport,
  outputPath?: string,
): Promise<string> {
  const resolvedOutputPath =
    outputPath ?? path.join(projectRoot, GENERATED_DIR, DOCTOR_REPORT_FILENAME);

  await fs.ensureDir(path.dirname(resolvedOutputPath));
  await fs.writeJson(resolvedOutputPath, report, { spaces: 2 });

  return resolvedOutputPath;
}

export function renderDoctorReport(report: DoctorReport): string {
  const sections = [
    `Expo Harmony doctor report`,
    `Project: ${report.projectRoot}`,
    `Config: ${report.appConfigPath ?? 'not found'}`,
    `Expo SDK: ${report.expoSdkVersion ?? 'unknown'} (reference ${SUPPORTED_EXPO_SDKS.join(', ')})`,
    `RNOH template: ${report.templateVersion} / runtime ${report.rnohVersion}`,
    `Summary: ${report.summary.supported} supported, ${report.summary.manual} manual, ${report.summary.unknown} unknown (${report.summary.total} total)`,
    '',
    `Dependencies:`,
    ...report.dependencies.map((dependency) => {
      const replacement = dependency.replacement ? ` | replacement: ${dependency.replacement}` : '';
      return `- [${dependency.status}] ${dependency.name}@${dependency.version} (${dependency.source}) - ${dependency.note}${replacement}`;
    }),
  ];

  if (report.warnings.length > 0) {
    sections.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }

  return sections.join('\n');
}

function createDependencyRecord(
  name: string,
  version: string,
  source: DetectedDependency['source'],
): DetectedDependency {
  const matrixRecord = COMPATIBILITY_MATRIX[name] ?? DEFAULT_RECORD;

  return {
    name,
    version,
    source,
    status: matrixRecord.status,
    note: matrixRecord.note,
    replacement: matrixRecord.replacement,
    docsUrl: matrixRecord.docsUrl,
  };
}
