import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import {
  DOCTOR_REPORT_FILENAME,
  GENERATED_DIR,
  RNOH_CLI_VERSION,
  RNOH_VERSION,
  SUPPORTED_EXPO_SDKS,
  TEMPLATE_VERSION,
  TOOLKIT_VERSION,
} from './constants';
import { DEPENDENCY_CATALOG } from '../data/dependencyCatalog';
import {
  DEFAULT_VALIDATED_MATRIX_ID,
  VALIDATED_RELEASE_MATRICES,
} from '../data/validatedMatrices';
import { readManifest, readToolkitConfig } from './metadata';
import {
  BlockingIssue,
  CompatibilityRecord,
  DetectedDependency,
  DoctorReport,
  PackageJson,
  ValidatedReleaseMatrix,
} from '../types';
import {
  collectDeclaredDependencies,
  collectExpoPlugins,
  collectExpoSchemes,
  detectExpoSdkVersion,
  getExpoSdkWarning,
  loadProject,
} from './project';

const DEFAULT_RECORD: CompatibilityRecord = {
  status: 'unknown',
  note: 'This dependency is not in the current compatibility catalog yet.',
};

export async function buildDoctorReport(projectRoot: string): Promise<DoctorReport> {
  const loadedProject = await loadProject(projectRoot);
  const expoSdkVersion = detectExpoSdkVersion(loadedProject.packageJson);
  const matrix = VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID];
  const expoPlugins = collectExpoPlugins(loadedProject.expoConfig);
  const expoSchemes = collectExpoSchemes(loadedProject.expoConfig);
  const dependencyRecords = new Map<string, DetectedDependency>();
  const declaredDependencies = collectDeclaredDependencies(loadedProject.packageJson);

  for (const dependency of declaredDependencies) {
    dependencyRecords.set(
      dependency.name,
      createDependencyRecord(dependency.name, dependency.version, dependency.source),
    );
  }

  for (const pluginName of expoPlugins) {
    if (!dependencyRecords.has(pluginName)) {
      dependencyRecords.set(pluginName, createDependencyRecord(pluginName, 'configured', 'expo-plugin'));
    }
  }

  const dependencies = [...dependencyRecords.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const blockingIssues = await collectBlockingIssues(
    loadedProject.projectRoot,
    loadedProject.expoConfig,
    loadedProject.packageJson,
    expoPlugins,
    expoSchemes,
    expoSdkVersion,
    dependencies,
    matrix,
  );
  const blockingDependencyNames = new Set(
    blockingIssues
      .filter((issue) => issue.code.startsWith('dependency.') && issue.subject)
      .map((issue) => issue.subject as string),
  );

  const resolvedDependencies = dependencies.map((dependency) => ({
    ...dependency,
    blocking: blockingDependencyNames.has(dependency.name),
  }));

  const warnings = buildWarnings(loadedProject.expoConfig, expoSdkVersion, resolvedDependencies);
  const advisories = buildAdvisories(loadedProject.expoConfig);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: loadedProject.projectRoot,
    appConfigPath: loadedProject.appConfigPath,
    toolkitVersion: TOOLKIT_VERSION,
    templateVersion: TEMPLATE_VERSION,
    matrixId: matrix.id,
    eligibility: blockingIssues.length === 0 ? 'eligible' : 'ineligible',
    rnohVersion: RNOH_VERSION,
    rnohCliVersion: RNOH_CLI_VERSION,
    expoSdkVersion,
    expoConfig: {
      name: loadedProject.expoConfig.name ?? null,
      slug: loadedProject.expoConfig.slug ?? null,
      version: loadedProject.expoConfig.version ?? null,
      androidPackage: loadedProject.expoConfig.android?.package ?? null,
      iosBundleIdentifier: loadedProject.expoConfig.ios?.bundleIdentifier ?? null,
      schemes: expoSchemes,
      plugins: expoPlugins,
    },
    dependencies: resolvedDependencies,
    summary: {
      total: resolvedDependencies.length,
      supported: resolvedDependencies.filter((dependency) => dependency.status === 'supported').length,
      manual: resolvedDependencies.filter((dependency) => dependency.status === 'manual').length,
      unknown: resolvedDependencies.filter((dependency) => dependency.status === 'unknown').length,
    },
    blockingIssues,
    advisories,
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
    `Expo SDK: ${report.expoSdkVersion ?? 'unknown'} (recognized ${SUPPORTED_EXPO_SDKS.join(', ')})`,
    `Matrix: ${report.matrixId ?? 'none'}`,
    `Eligibility: ${report.eligibility}`,
    `Schemes: ${report.expoConfig.schemes.join(', ') || 'none'}`,
    `Plugins: ${report.expoConfig.plugins.join(', ') || 'none'}`,
    `RNOH template: ${report.templateVersion} / runtime ${report.rnohVersion}`,
    `Summary: ${report.summary.supported} supported, ${report.summary.manual} manual, ${report.summary.unknown} unknown (${report.summary.total} total)`,
    '',
    `Dependencies:`,
    ...report.dependencies.map((dependency) => {
      const replacement = dependency.replacement ? ` | replacement: ${dependency.replacement}` : '';
      const blocking = dependency.blocking ? ' | blocking: yes' : '';
      return `- [${dependency.status}] ${dependency.name}@${dependency.version} (${dependency.source}) - ${dependency.note}${replacement}${blocking}`;
    }),
  ];

  if (report.blockingIssues.length > 0) {
    sections.push(
      '',
      'Blocking issues:',
      ...report.blockingIssues.map((issue) =>
        `- ${issue.code}: ${issue.message}${issue.subject ? ` (${issue.subject})` : ''}`,
      ),
    );
  }

  if (report.advisories.length > 0) {
    sections.push('', 'Advisories:', ...report.advisories.map((advisory) => `- ${advisory}`));
  }

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
  const matrixRecord = DEPENDENCY_CATALOG[name] ?? DEFAULT_RECORD;

  return {
    name,
    version,
    source,
    status: matrixRecord.status,
    blocking: false,
    note: matrixRecord.note,
    replacement: matrixRecord.replacement,
    docsUrl: matrixRecord.docsUrl,
  };
}

async function collectBlockingIssues(
  projectRoot: string,
  expoConfig: Record<string, any>,
  packageJson: PackageJson,
  expoPlugins: string[],
  expoSchemes: string[],
  expoSdkVersion: number | null,
  dependencies: DetectedDependency[],
  matrix: ValidatedReleaseMatrix,
): Promise<BlockingIssue[]> {
  const issues: BlockingIssue[] = [];
  const dependencyMap = new Map(dependencies.map((dependency) => [dependency.name, dependency]));

  if (expoSdkVersion !== matrix.expoSdkVersion) {
    issues.push({
      code: 'matrix.expo_sdk.unsupported',
      message: `Expo SDK ${expoSdkVersion ?? 'unknown'} does not match validated matrix Expo SDK ${matrix.expoSdkVersion}.`,
    });
  }

  for (const [dependencyName, rule] of Object.entries(matrix.dependencyRules)) {
    const dependency = dependencyMap.get(dependencyName);

    if (rule.required && !dependency) {
      issues.push({
        code: 'dependency.required_missing',
        message: `Required dependency ${dependencyName} is missing for matrix ${matrix.id}.`,
        subject: dependencyName,
      });
      continue;
    }

    if (!dependency || !rule.version) {
      continue;
    }

    if (!matchesVersionRange(dependency.version, rule.version)) {
      issues.push({
        code: 'dependency.version_mismatch',
        message: `Dependency ${dependencyName} does not satisfy the validated range ${rule.version}.`,
        subject: dependencyName,
      });
    }
  }

  for (const dependency of dependencies) {
    if (!matrix.allowedDependencies.includes(dependency.name)) {
      issues.push({
        code: 'dependency.not_allowed',
        message: `${dependency.name} is outside the validated ${matrix.id} allowlist.`,
        subject: dependency.name,
      });
    }
  }

  if (dependencyMap.has('expo-router')) {
    for (const peerDependencyName of ['expo-linking', 'expo-constants']) {
      if (!dependencyMap.has(peerDependencyName)) {
        issues.push({
          code: 'dependency.router_peer_missing',
          message: `expo-router requires ${peerDependencyName} inside the validated App Shell matrix.`,
          subject: peerDependencyName,
        });
      }
    }

    if (!expoPlugins.includes('expo-router')) {
      issues.push({
        code: 'config.router_plugin.missing',
        message: 'Expo config plugins must include expo-router when expo-router is used inside the App Shell matrix.',
        subject: 'expo-router',
      });
    }

    if (expoSchemes.length === 0) {
      issues.push({
        code: 'config.scheme.missing',
        message: 'Expo config must declare at least one scheme when expo-router is used inside the App Shell matrix.',
      });
    }

    const bundleScript = packageJson.scripts?.['bundle:harmony'];
    if (bundleScript && !bundleScript.includes('index.harmony.js')) {
      issues.push({
        code: 'config.bundle_script.mismatch',
        message: 'Router projects must bundle with the Harmony sidecar entry file index.harmony.js inside the App Shell matrix.',
      });
    }

  }

  if (!expoConfig.android?.package && !expoConfig.ios?.bundleIdentifier) {
    issues.push({
      code: 'config.native_identifier.missing',
      message: 'At least one explicit native identifier is required: android.package or ios.bundleIdentifier.',
    });
  }

  const manifest = await readManifest(projectRoot);
  const toolkitConfig = await readToolkitConfig(projectRoot);

  if (manifest) {
    if (manifest.templateVersion !== TEMPLATE_VERSION) {
      issues.push({
        code: 'metadata.template_version.mismatch',
        message: `Managed manifest template version ${manifest.templateVersion} does not match current template ${TEMPLATE_VERSION}.`,
      });
    }

    if (manifest.matrixId !== matrix.id) {
      issues.push({
        code: 'metadata.matrix_id.mismatch',
        message: `Managed manifest matrix ${manifest.matrixId ?? 'unknown'} does not match current matrix ${matrix.id}.`,
      });
    }
  }

  if (toolkitConfig) {
    if (toolkitConfig.templateVersion !== TEMPLATE_VERSION) {
      issues.push({
        code: 'metadata.template_version.mismatch',
        message: `Toolkit config template version ${toolkitConfig.templateVersion} does not match current template ${TEMPLATE_VERSION}.`,
      });
    }

    if (toolkitConfig.matrixId !== matrix.id) {
      issues.push({
        code: 'metadata.matrix_id.mismatch',
        message: `Toolkit config matrix ${toolkitConfig.matrixId ?? 'unknown'} does not match current matrix ${matrix.id}.`,
      });
    }
  }

  return dedupeIssues(issues);
}

function buildWarnings(
  expoConfig: Record<string, any>,
  expoSdkVersion: number | null,
  dependencies: DetectedDependency[],
): string[] {
  const warnings: string[] = [];
  const expoSdkWarning = getExpoSdkWarning(expoSdkVersion);

  if (expoSdkWarning) {
    warnings.push(expoSdkWarning);
  }

  if (!expoConfig.android?.package && !expoConfig.ios?.bundleIdentifier) {
    warnings.push(
      'Neither android.package nor ios.bundleIdentifier is set in Expo config. v0.8 strict eligibility requires at least one explicit native identifier.',
    );
  }

  if (dependencies.some((dependency) => dependency.status === 'manual')) {
    warnings.push(
      'Manual-review dependencies were detected. They remain outside the v0.8 validated matrix even though the toolkit can still scaffold exploratory files.',
    );
  }

  if (dependencies.some((dependency) => dependency.status === 'unknown')) {
    warnings.push(
      'Unknown dependencies were detected. The toolkit can scaffold the project, but runtime portability is not guaranteed.',
    );
  }

  return warnings;
}

function buildAdvisories(expoConfig: Record<string, any>): string[] {
  const advisories: string[] = [];

  if (!expoConfig.android?.package && expoConfig.ios?.bundleIdentifier) {
    advisories.push(
      'The project is using ios.bundleIdentifier as the only explicit native identifier. Prefer setting android.package as well before claiming release readiness.',
    );
  }

  return advisories;
}

function matchesVersionRange(rawVersion: string, range: string): boolean {
  const coerced = semver.coerce(rawVersion);

  if (!coerced) {
    return false;
  }

  return semver.satisfies(coerced, range, {
    includePrerelease: true,
  });
}

function dedupeIssues(issues: BlockingIssue[]): BlockingIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.subject ?? ''}:${issue.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
