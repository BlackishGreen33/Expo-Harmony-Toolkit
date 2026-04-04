export type CompatibilityStatus = 'supported' | 'manual' | 'unknown';
export type EligibilityStatus = 'eligible' | 'ineligible';
export type SupportTier = 'verified' | 'preview' | 'experimental' | 'unsupported';
export type DoctorTargetTier = Exclude<SupportTier, 'unsupported'>;
export type CapabilityRuntimeMode = 'shim' | 'adapter' | 'verified';
export type CapabilityEvidenceSource = 'automated' | 'manual-doc' | 'none';
export type DependencyBuildabilityRisk = 'known' | 'js-only-unknown' | 'native-risk' | 'unresolved';
export type CoverageProfile =
  | 'managed-core'
  | 'managed-native-heavy'
  | 'bare'
  | 'third-party-native-heavy';
export type GapCategory =
  | 'matrix-drift'
  | 'official-module-gap'
  | 'third-party-native-gap'
  | 'bare-workflow-gap';
export type DependencySource =
  | 'dependency'
  | 'devDependency'
  | 'peerDependency'
  | 'expo-plugin';

export interface ExpoHarmonyPluginProps {
  bundleName?: string;
  entryModuleName?: string;
  templateVersion?: string;
  overwrite?: boolean;
}

export interface CompatibilityRecord {
  status: CompatibilityStatus;
  supportTier: SupportTier;
  note: string;
  replacement?: string;
  docsUrl?: string;
}

export interface BlockingIssue {
  code: string;
  message: string;
  subject?: string;
}

export interface ValidatedDependencyRule {
  version?: string;
  specifier?: string;
  required?: boolean;
}

export interface ValidatedReleaseMatrix {
  id: string;
  expoSdkVersion: number;
  allowedDependencies: string[];
  dependencyRules: Record<string, ValidatedDependencyRule>;
  nativeIdentifierRequirement: 'android_or_ios';
}

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
}

export interface LoadedProject {
  projectRoot: string;
  packageJson: PackageJson;
  expoConfig: Record<string, any>;
  appConfigPath: string | null;
}

export interface HarmonyIdentifiers {
  appName: string;
  slug: string;
  bundleName: string;
  entryModuleName: string;
  androidPackage: string | null;
  iosBundleIdentifier: string | null;
}

export interface DetectedDependency {
  name: string;
  version: string;
  source: DependencySource;
  status: CompatibilityStatus;
  supportTier: SupportTier;
  buildabilityRisk: DependencyBuildabilityRisk;
  gapCategory: GapCategory;
  blocking: boolean;
  note: string;
  replacement?: string;
  docsUrl?: string;
}

export interface DoctorSummary {
  total: number;
  supported: number;
  manual: number;
  unknown: number;
}

export interface SupportTierSummary {
  verified: number;
  preview: number;
  experimental: number;
  unsupported: number;
}

export interface CapabilityEvidence {
  bundle: boolean;
  debugBuild: boolean;
  device: boolean;
  release: boolean;
}

export interface CapabilityEvidenceSourceMap {
  bundle: CapabilityEvidenceSource;
  debugBuild: CapabilityEvidenceSource;
  device: CapabilityEvidenceSource;
  release: CapabilityEvidenceSource;
}

export interface CapabilityDefinition {
  id: string;
  packageName: string;
  status: CompatibilityStatus;
  supportTier: DoctorTargetTier;
  runtimeMode: CapabilityRuntimeMode;
  evidence: CapabilityEvidence;
  evidenceSource: CapabilityEvidenceSourceMap;
  note: string;
  docsUrl?: string;
  nativePackageNames: string[];
  harmonyPermissions: string[];
  sampleRoute: string;
  acceptanceChecklist: string[];
}

export interface ProjectCapabilityReport {
  id: string;
  packageName: string;
  status: CompatibilityStatus;
  supportTier: DoctorTargetTier;
  runtimeMode: CapabilityRuntimeMode;
  evidence: CapabilityEvidence;
  evidenceSource: CapabilityEvidenceSourceMap;
  note: string;
  docsUrl?: string;
  nativePackageNames: string[];
  harmonyPermissions: string[];
  sampleRoute: string;
  acceptanceChecklist: string[];
}

export interface ManagedCapabilityRecord {
  id: string;
  packageName: string;
  supportTier: DoctorTargetTier;
  runtimeMode: CapabilityRuntimeMode;
  evidence: CapabilityEvidence;
  evidenceSource: CapabilityEvidenceSourceMap;
}

export interface DoctorReport {
  generatedAt: string;
  projectRoot: string;
  appConfigPath: string | null;
  toolkitVersion: string;
  templateVersion: string;
  matrixId: string | null;
  eligibility: EligibilityStatus;
  rnohVersion: string;
  rnohCliVersion: string;
  expoSdkVersion: number | null;
  targetTier: DoctorTargetTier;
  coverageProfile: CoverageProfile;
  expoConfig: {
    name: string | null;
    slug: string | null;
    version: string | null;
    androidPackage: string | null;
    iosBundleIdentifier: string | null;
    schemes: string[];
    plugins: string[];
  };
  dependencies: DetectedDependency[];
  summary: DoctorSummary;
  supportSummary: SupportTierSummary;
  capabilities: ProjectCapabilityReport[];
  blockingIssues: BlockingIssue[];
  nextActions: string[];
  advisories: string[];
  warnings: string[];
}

export interface EnvReport {
  generatedAt: string;
  projectRoot: string;
  toolkitVersion: string;
  devecoStudioPath: string | null;
  sdkRoot: string | null;
  harmonyProjectRoot: string | null;
  javaPath: string | null;
  ohpmPath: string | null;
  hvigorPath: string | null;
  hdcPath: string | null;
  signingConfigured: boolean;
  status: 'ready' | 'blocked';
  blockingIssues: BlockingIssue[];
  advisories: BlockingIssue[];
  warnings: string[];
}

export interface BuildStepReport {
  label: string;
  command: string;
  cwd: string;
  exitCode: number | null;
}

export interface BuildReport {
  generatedAt: string;
  projectRoot: string;
  toolkitVersion: string;
  command: 'bundle' | 'build-hap';
  mode: 'debug' | 'release' | null;
  status: 'succeeded' | 'failed';
  harmonyProjectRoot: string | null;
  entryFile: string | null;
  bundleOutputPath: string | null;
  assetsDestPath: string | null;
  artifactPaths: string[];
  blockingIssues: BlockingIssue[];
  warnings: string[];
  steps: BuildStepReport[];
}

export interface TemplateFileDefinition {
  relativePath: string;
  contents: string | Buffer;
  binary?: boolean;
}

export interface ManagedFileRecord {
  relativePath: string;
  sha1: string;
}

export interface ToolkitManifest {
  generatedAt: string;
  toolkitVersion: string;
  templateVersion: string;
  matrixId: string;
  projectRoot: string;
  files: ManagedFileRecord[];
}

export interface ToolkitConfig {
  generatedAt: string;
  toolkitVersion: string;
  templateVersion: string;
  matrixId: string;
  rnohVersion: string;
  rnohCliVersion: string;
  bundleName: string;
  entryModuleName: string;
  coverageProfile: CoverageProfile;
  capabilities: ManagedCapabilityRecord[];
  requestedHarmonyPermissions: string[];
  nextActions: string[];
  project: {
    name: string;
    slug: string;
    version: string;
    hvigorPluginFilename: string;
  };
}

export interface SyncResult {
  writtenFiles: string[];
  unchangedFiles: string[];
  skippedFiles: string[];
  warnings: string[];
  manifestPath: string;
}

export interface InitResult {
  report: DoctorReport;
  sync: SyncResult;
  packageWarnings: string[];
  doctorReportPath: string;
}
