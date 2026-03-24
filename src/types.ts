export type CompatibilityStatus = 'supported' | 'manual' | 'unknown';
export type EligibilityStatus = 'eligible' | 'ineligible';
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
  expoConfig: {
    name: string | null;
    slug: string | null;
    version: string | null;
    androidPackage: string | null;
    iosBundleIdentifier: string | null;
  };
  dependencies: DetectedDependency[];
  summary: DoctorSummary;
  blockingIssues: BlockingIssue[];
  advisories: string[];
  warnings: string[];
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
