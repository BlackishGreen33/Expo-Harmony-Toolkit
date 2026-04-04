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
import { annotateDependencyBuildability } from './dependencyInspection';
import { DEPENDENCY_CATALOG } from '../data/dependencyCatalog';
import {
  DEFAULT_VALIDATED_MATRIX_ID,
  VALIDATED_RELEASE_MATRICES,
} from '../data/validatedMatrices';
import {
  CAPABILITY_BY_PACKAGE,
  getCapabilityDefinitionsForProject,
  isSupportTierAllowed,
} from '../data/capabilities';
import { UI_STACK_VALIDATED_ADAPTERS } from '../data/uiStack';
import { readManifest, readToolkitConfig } from './metadata';
import {
  BlockingIssue,
  CapabilityEvidence,
  CompatibilityRecord,
  CoverageProfile,
  DetectedDependency,
  DoctorTargetTier,
  DoctorReport,
  GapCategory,
  PackageJson,
  ProjectCapabilityReport,
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
import { HARMONY_ROUTER_ENTRY_FILENAME } from './constants';

const DEFAULT_RECORD: CompatibilityRecord = {
  status: 'unknown',
  supportTier: 'unsupported',
  note: 'This dependency is not in the current compatibility catalog yet.',
};

const BARE_WORKFLOW_DIRECTORY_NAMES = ['android', 'ios'] as const;
const BARE_WORKFLOW_DEPENDENCIES = new Set(['expo-build-properties', 'expo-dev-client']);

export async function buildDoctorReport(
  projectRoot: string,
  options: { targetTier?: DoctorTargetTier } = {},
): Promise<DoctorReport> {
  const loadedProject = await loadProject(projectRoot);
  const expoSdkVersion = detectExpoSdkVersion(loadedProject.packageJson);
  const matrix = VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID];
  const targetTier = options.targetTier ?? 'verified';
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

  const dependencies = await annotateDependencyBuildability(
    loadedProject.projectRoot,
    [...dependencyRecords.values()].sort((left, right) => left.name.localeCompare(right.name)),
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
    targetTier,
  );
  const capabilities = getCapabilityDefinitionsForProject(loadedProject.packageJson).map(
    (definition): ProjectCapabilityReport => ({
      id: definition.id,
      packageName: definition.packageName,
      status: definition.status,
      supportTier: definition.supportTier,
      runtimeMode: definition.runtimeMode,
      evidence: { ...definition.evidence },
      evidenceSource: { ...definition.evidenceSource },
      note: definition.note,
      docsUrl: definition.docsUrl,
      nativePackageNames: [...definition.nativePackageNames],
      harmonyPermissions: [...definition.harmonyPermissions],
      sampleRoute: definition.sampleRoute,
      acceptanceChecklist: [...definition.acceptanceChecklist],
    }),
  );
  const coverageProfile = await detectCoverageProfile(
    loadedProject.projectRoot,
    loadedProject.packageJson,
    dependencies,
  );
  const blockingDependencyNames = new Set(
    blockingIssues
      .filter((issue) => issue.code.startsWith('dependency.') && issue.subject)
      .map((issue) => issue.subject as string),
  );

  const resolvedDependencies = dependencies.map((dependency) => ({
    ...dependency,
    gapCategory: resolveDependencyGapCategory(dependency, coverageProfile),
    blocking: blockingDependencyNames.has(dependency.name),
  }));
  const nextActions = buildNextActions({
    targetTier,
    coverageProfile,
    blockingIssues,
    dependencies: resolvedDependencies,
    capabilities,
  });

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
    targetTier,
    coverageProfile,
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
    supportSummary: {
      verified: resolvedDependencies.filter((dependency) => dependency.supportTier === 'verified').length,
      preview: resolvedDependencies.filter((dependency) => dependency.supportTier === 'preview').length,
      experimental: resolvedDependencies.filter((dependency) => dependency.supportTier === 'experimental').length,
      unsupported: resolvedDependencies.filter((dependency) => dependency.supportTier === 'unsupported').length,
    },
    capabilities,
    blockingIssues,
    nextActions,
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
    `Target tier: ${report.targetTier}`,
    `Coverage profile: ${report.coverageProfile}`,
    `Eligibility: ${report.eligibility}`,
    `Schemes: ${report.expoConfig.schemes.join(', ') || 'none'}`,
    `Plugins: ${report.expoConfig.plugins.join(', ') || 'none'}`,
    `RNOH template: ${report.templateVersion} / runtime ${report.rnohVersion}`,
    `Summary: ${report.summary.supported} supported, ${report.summary.manual} manual, ${report.summary.unknown} unknown (${report.summary.total} total)`,
    `Support tiers: ${report.supportSummary.verified} verified, ${report.supportSummary.preview} preview, ${report.supportSummary.experimental} experimental, ${report.supportSummary.unsupported} unsupported`,
    '',
    `Dependencies:`,
    ...report.dependencies.map((dependency) => {
      const replacement = dependency.replacement ? ` | replacement: ${dependency.replacement}` : '';
      const blocking = dependency.blocking ? ' | blocking: yes' : '';
      return `- [${dependency.status}/${dependency.supportTier}] ${dependency.name}@${dependency.version} (${dependency.source}) - ${dependency.note} | buildability: ${renderDependencyBuildabilityRisk(
        dependency.buildabilityRisk,
      )} | gap: ${dependency.gapCategory}${replacement}${blocking}`;
    }),
  ];

  if (report.capabilities.length > 0) {
    sections.push(
      '',
      'Capabilities:',
      ...report.capabilities.map((capability) => {
        const permissions =
          capability.harmonyPermissions.length > 0
            ? ` | permissions: ${capability.harmonyPermissions.join(', ')}`
            : '';
        const missingEvidence = getMissingCapabilityEvidence(capability.evidence);
        const evidence = ` | evidence: ${renderCapabilityEvidence(
          capability.evidence,
          capability.evidenceSource,
        )}`;
        const promotionGaps = buildCapabilityPromotionGaps(capability.runtimeMode, missingEvidence);
        const gapSuffix =
          promotionGaps.length > 0
            ? ` | verified gaps: ${promotionGaps.join(', ')}`
            : '';
        return `- [${capability.status}/${capability.supportTier}] ${capability.packageName} -> ${capability.nativePackageNames.join(', ') || 'toolkit-managed bridge'} | runtime: ${capability.runtimeMode} | sample: ${capability.sampleRoute}${permissions}${evidence}${gapSuffix}`;
      }),
    );
  }

  if (report.blockingIssues.length > 0) {
    sections.push(
      '',
      'Blocking issues:',
      ...report.blockingIssues.map((issue) =>
        `- ${issue.code}: ${issue.message}${issue.subject ? ` (${issue.subject})` : ''}`,
      ),
    );
  }

  if (report.nextActions.length > 0) {
    sections.push('', 'Next actions:', ...report.nextActions.map((action, index) => `${index + 1}. ${action}`));
  }

  if (report.advisories.length > 0) {
    sections.push('', 'Advisories:', ...report.advisories.map((advisory) => `- ${advisory}`));
  }

  if (report.warnings.length > 0) {
    sections.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }

  return sections.join('\n');
}

function renderCapabilityEvidence(
  evidence: CapabilityEvidence,
  evidenceSource: ProjectCapabilityReport['evidenceSource'],
): string {
  return [
    `bundle=${evidence.bundle ? 'yes' : 'no'}[${evidenceSource.bundle}]`,
    `debugBuild=${evidence.debugBuild ? 'yes' : 'no'}[${evidenceSource.debugBuild}]`,
    `device=${evidence.device ? 'yes' : 'no'}[${evidenceSource.device}]`,
    `release=${evidence.release ? 'yes' : 'no'}[${evidenceSource.release}]`,
  ].join(', ');
}

function getMissingCapabilityEvidence(evidence: CapabilityEvidence): Array<keyof CapabilityEvidence> {
  return (Object.entries(evidence) as Array<[keyof CapabilityEvidence, boolean]>)
    .filter(([, present]) => !present)
    .map(([key]) => key);
}

function buildCapabilityPromotionGaps(
  runtimeMode: ProjectCapabilityReport['runtimeMode'],
  missingEvidence: Array<keyof CapabilityEvidence>,
): string[] {
  const gaps = missingEvidence.map((entry) => String(entry));

  if (runtimeMode !== 'verified') {
    gaps.unshift(`runtimeMode:${runtimeMode}->verified`);
  }

  return gaps;
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
    supportTier: matrixRecord.supportTier,
    buildabilityRisk: 'known',
    gapCategory: 'matrix-drift',
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
  targetTier: DoctorTargetTier,
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

    if (!dependency) {
      continue;
    }

    if (rule.version && !matchesVersionRange(dependency.version, rule.version)) {
      issues.push({
        code: 'dependency.version_mismatch',
        message: `Dependency ${dependencyName} does not satisfy the validated range ${rule.version}.`,
        subject: dependencyName,
      });
    }

    if (rule.specifier && !matchesDependencySpecifier(dependency.version, rule.specifier)) {
      issues.push({
        code: 'dependency.specifier_mismatch',
        message: `Dependency ${dependencyName} does not match the validated dependency spec ${rule.specifier}.`,
        subject: dependencyName,
      });
    }
  }

  for (const dependency of dependencies) {
    if (!isDependencyAllowedForTargetTier(dependency.name, matrix, targetTier)) {
      issues.push({
        code: 'dependency.not_allowed',
        message: `${dependency.name} is outside the ${targetTier} support tier for ${matrix.id}.`,
        subject: dependency.name,
      });
    }
  }

  if (dependencyMap.has('expo-router')) {
    for (const peerDependencyName of ['expo-linking', 'expo-constants']) {
      if (!dependencyMap.has(peerDependencyName)) {
        issues.push({
          code: 'dependency.router_peer_missing',
          message: `expo-router requires ${peerDependencyName} inside the validated UI-stack matrix.`,
          subject: peerDependencyName,
        });
      }
    }

    if (!expoPlugins.includes('expo-router')) {
      issues.push({
        code: 'config.router_plugin.missing',
        message: 'Expo config plugins must include expo-router when expo-router is used inside the validated UI-stack matrix.',
        subject: 'expo-router',
      });
    }

    if (expoSchemes.length === 0) {
      issues.push({
        code: 'config.scheme.missing',
        message: 'Expo config must declare at least one scheme when expo-router is used inside the validated UI-stack matrix.',
      });
    }

    const harmonyBundleScript = packageJson.scripts?.['harmony:bundle'];
    const legacyBundleScript = packageJson.scripts?.['bundle:harmony'];

    if (
      harmonyBundleScript &&
      !/(\bexpo-harmony\s+bundle\b|\bexpo-harmony\.js\s+bundle\b)/.test(harmonyBundleScript)
    ) {
      issues.push({
        code: 'config.bundle_script.mismatch',
        message: 'Router projects should bundle through the toolkit command expo-harmony bundle inside the validated UI-stack matrix.',
      });
    }

    if (!harmonyBundleScript && legacyBundleScript && !legacyBundleScript.includes(HARMONY_ROUTER_ENTRY_FILENAME)) {
      issues.push({
        code: 'config.bundle_script.mismatch',
        message: 'Router projects must bundle with the Harmony sidecar entry file index.harmony.js inside the validated UI-stack matrix.',
      });
    }

  }

  for (const pairing of UI_STACK_VALIDATED_ADAPTERS) {
    const hasCanonical = dependencyMap.has(pairing.canonicalPackageName);
    const hasAdapter = dependencyMap.has(pairing.adapterPackageName);

    if (hasCanonical && !hasAdapter) {
      issues.push({
        code: 'dependency.required_missing',
        message: `Using ${pairing.canonicalPackageName} inside the validated UI-stack matrix also requires ${pairing.adapterPackageName}.`,
        subject: pairing.adapterPackageName,
      });
    }

    if (hasAdapter && !hasCanonical) {
      issues.push({
        code: 'dependency.required_missing',
        message: `Using ${pairing.adapterPackageName} inside the validated UI-stack matrix also requires ${pairing.canonicalPackageName}.`,
        subject: pairing.canonicalPackageName,
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

async function detectCoverageProfile(
  projectRoot: string,
  packageJson: PackageJson,
  dependencies: DetectedDependency[],
): Promise<CoverageProfile> {
  for (const directoryName of BARE_WORKFLOW_DIRECTORY_NAMES) {
    if (await fs.pathExists(path.join(projectRoot, directoryName))) {
      return 'bare';
    }
  }

  if (dependencies.some((dependency) => isThirdPartyNativeGapDependency(dependency))) {
    return 'third-party-native-heavy';
  }

  if (
    getCapabilityDefinitionsForProject(packageJson).length > 0 ||
    dependencies.some(
      (dependency) => isOfficialExpoDependencyName(dependency.name) && dependency.supportTier !== 'verified',
    )
  ) {
    return 'managed-native-heavy';
  }

  return 'managed-core';
}

function resolveDependencyGapCategory(
  dependency: DetectedDependency,
  coverageProfile: CoverageProfile,
): GapCategory {
  if (
    coverageProfile === 'bare' &&
    (BARE_WORKFLOW_DEPENDENCIES.has(dependency.name) ||
      dependency.name === 'expo' ||
      dependency.name === 'react-native')
  ) {
    return 'bare-workflow-gap';
  }

  if (isOfficialExpoDependencyName(dependency.name) || CAPABILITY_BY_PACKAGE[dependency.name]) {
    return dependency.supportTier === 'verified' && dependency.status === 'supported'
      ? 'matrix-drift'
      : 'official-module-gap';
  }

  if (isThirdPartyNativeGapDependency(dependency)) {
    return 'third-party-native-gap';
  }

  if (coverageProfile === 'bare') {
    return 'bare-workflow-gap';
  }

  return 'matrix-drift';
}

function isOfficialExpoDependencyName(dependencyName: string): boolean {
  return dependencyName === 'expo' || dependencyName.startsWith('expo-') || dependencyName.startsWith('@expo/');
}

function isThirdPartyNativeGapDependency(dependency: DetectedDependency): boolean {
  if (
    dependency.name === 'react-native-gesture-handler' ||
    dependency.name === '@react-native-oh-tpl/react-native-gesture-handler'
  ) {
    return true;
  }

  if (dependency.buildabilityRisk === 'native-risk') {
    return true;
  }

  return (
    dependency.supportTier !== 'verified' &&
    !isOfficialExpoDependencyName(dependency.name) &&
    dependency.name.startsWith('react-native')
  );
}

function buildNextActions(input: {
  targetTier: DoctorTargetTier;
  coverageProfile: CoverageProfile;
  blockingIssues: BlockingIssue[];
  dependencies: DetectedDependency[];
  capabilities: ProjectCapabilityReport[];
}): string[] {
  const actions: string[] = [];
  const { targetTier, coverageProfile, blockingIssues, dependencies, capabilities } = input;
  const hasPreviewCapabilities = capabilities.some((capability) => capability.supportTier === 'preview');
  const hasRouterBlockingIssues = blockingIssues.some((issue) =>
    [
      'dependency.router_peer_missing',
      'config.router_plugin.missing',
      'config.scheme.missing',
      'config.bundle_script.mismatch',
    ].includes(issue.code),
  );

  if (
    hasBlockingIssueCode(blockingIssues, 'matrix.expo_sdk.unsupported') ||
    hasBlockingIssueCode(blockingIssues, 'dependency.version_mismatch') ||
    hasBlockingIssueCode(blockingIssues, 'dependency.specifier_mismatch') ||
    hasBlockingIssueCode(blockingIssues, 'dependency.required_missing')
  ) {
    actions.push(
      `Align Expo SDK, React Native, RNOH, and validated adapter versions to ${DEFAULT_VALIDATED_MATRIX_ID}, then rerun \`expo-harmony doctor --project-root . --strict\`.`,
    );
  }

  if (targetTier === 'verified' && hasPreviewCapabilities) {
    actions.push(
      'Use `expo-harmony doctor --project-root . --target-tier preview` to measure the current preview-capability baseline while keeping `latest` pinned to verified-only releases.',
    );
  }

  if (hasPreviewCapabilities) {
    actions.push(
      'Keep combined sample smoke for regression coverage, but track bundle/debug/device/release evidence separately for each preview capability before promotion.',
    );
  }

  switch (coverageProfile) {
    case 'managed-core':
      actions.push(
        'Stay on the verified lane: rerun `expo-harmony sync-template --project-root .`, `expo-harmony bundle --project-root .`, and `expo-harmony build-hap --project-root . --mode debug` before claiming release readiness.',
      );
      break;
    case 'managed-native-heavy':
      actions.push(
        'After every native-capability change, rerun `expo-harmony sync-template --project-root .`, `expo-harmony bundle --project-root .`, and `expo-harmony build-hap --project-root . --mode debug` to keep the managed sidecar and preview evidence aligned.',
      );
      break;
    case 'bare':
      actions.push(
        'Keep this project on the bare workflow track for now: preserve the native directories, use `expo-harmony doctor --project-root .` for classification, and only claim verified support after bare workflow support lands in the mainline capability catalog.',
      );
      break;
    case 'third-party-native-heavy':
      actions.push(
        'Isolate third-party native packages and onboard them through the mainline capability catalog one by one; start with `react-native-gesture-handler` if it is present, and treat unknown native surfaces as explicit unblockers rather than matrix drift.',
      );
      break;
  }

  if (hasRouterBlockingIssues) {
    actions.push(
      'Add the missing expo-router peers/plugin/scheme or update the Harmony bundle script to use `expo-harmony bundle`, then rerun doctor before trusting router builds.',
    );
  }

  if (
    blockingIssues.some(
      (issue) =>
        issue.code === 'dependency.not_allowed' &&
        (issue.subject === 'react-native-gesture-handler' ||
          issue.subject === '@react-native-oh-tpl/react-native-gesture-handler'),
    )
  ) {
    actions.push(
      'Keep `react-native-gesture-handler` out of the verified lane until its Harmony adapter path has stable doctor, sample, and build coverage.',
    );
  }

  if (hasBlockingIssueCode(blockingIssues, 'config.native_identifier.missing')) {
    actions.push(
      'Set `android.package` or `ios.bundleIdentifier` in Expo config before expecting a strict Harmony build path.',
    );
  }

  if (dependencies.some((dependency) => dependency.buildabilityRisk === 'native-risk')) {
    actions.push(
      'Inspect unknown native-looking dependencies and either replace them, gate them behind preview work, or onboard them explicitly before promising Harmony portability.',
    );
  }

  if (dependencies.some((dependency) => dependency.buildabilityRisk === 'js-only-unknown')) {
    actions.push(
      'Unknown JavaScript-only packages still sit outside the public matrix; verify bundling manually, but prioritize native gaps first.',
    );
  }

  return dedupeStrings(actions);
}

function hasBlockingIssueCode(issues: BlockingIssue[], code: string): boolean {
  return issues.some((issue) => issue.code === code);
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
      'Neither android.package nor ios.bundleIdentifier is set in Expo config. Strict eligibility requires at least one explicit native identifier inside the validated matrix.',
    );
  }

  if (dependencies.some((dependency) => dependency.status === 'manual')) {
    warnings.push(
      'Manual-review dependencies were detected. They remain outside the current validated matrix even though the toolkit can still scaffold exploratory files.',
    );
  }

  if (dependencies.some((dependency) => dependency.supportTier === 'preview')) {
    warnings.push(
      'Preview-tier dependencies were detected. The toolkit can scaffold and bundle them, but runtime behavior is not part of the verified public promise yet.',
    );
  }

  if (dependencies.some((dependency) => dependency.supportTier === 'experimental')) {
    warnings.push(
      'Experimental-tier dependencies were detected. Expect bridge drift, runtime gaps, or additional manual validation before claiming release readiness.',
    );
  }

  if (dependencies.some((dependency) => dependency.buildabilityRisk === 'js-only-unknown')) {
    warnings.push(
      'Some unknown dependencies look JavaScript-only. They remain outside the public matrix, but they are less likely to block bundling or a debug HAP build outright.',
    );
  }

  if (dependencies.some((dependency) => dependency.buildabilityRisk === 'native-risk')) {
    warnings.push(
      'Some unknown dependencies appear to carry native surfaces. Treat them as real Harmony portability risks until they are explicitly onboarded.',
    );
  }

  if (dependencies.some((dependency) => dependency.buildabilityRisk === 'unresolved')) {
    warnings.push(
      'Some unknown dependencies could not be inspected because their installed package metadata was unavailable. Install dependencies before treating the doctor report as a buildability signal.',
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

function isDependencyAllowedForTargetTier(
  dependencyName: string,
  matrix: ValidatedReleaseMatrix,
  targetTier: DoctorTargetTier,
): boolean {
  if (matrix.allowedDependencies.includes(dependencyName)) {
    return true;
  }

  const capability = CAPABILITY_BY_PACKAGE[dependencyName];

  if (!capability) {
    return false;
  }

  return isSupportTierAllowed(capability.supportTier, targetTier);
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

function matchesDependencySpecifier(rawSpecifier: string, expectedSpecifier: string): boolean {
  return rawSpecifier.trim() === expectedSpecifier.trim();
}

function renderDependencyBuildabilityRisk(buildabilityRisk: DetectedDependency['buildabilityRisk']): string {
  switch (buildabilityRisk) {
    case 'known':
      return 'known';
    case 'js-only-unknown':
      return 'unknown-js';
    case 'native-risk':
      return 'unknown-native';
    case 'unresolved':
      return 'unresolved';
    default:
      return buildabilityRisk;
  }
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

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
