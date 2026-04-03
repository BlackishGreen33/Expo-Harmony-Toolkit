import path from 'path';
import {
  DESIRED_PACKAGE_SCRIPTS,
  HARMONY_ROUTER_ENTRY_FILENAME,
  HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH,
  TEMPLATE_VERSION,
} from '../constants';
import { hasDeclaredDependency } from '../project';
import { DEFAULT_VALIDATED_MATRIX_ID } from '../../data/validatedMatrices';
import {
  HarmonyIdentifiers,
  PackageJson,
  ToolkitConfig,
  ToolkitManifest,
} from '../../types';

export function isBinaryTemplate(relativePath: string): boolean {
  return ['.png'].includes(path.extname(relativePath));
}

export function contentsEqual(
  currentContents: Buffer,
  nextContents: string | Buffer,
  binary = false,
): boolean {
  if (binary || Buffer.isBuffer(nextContents)) {
    return currentContents.equals(
      Buffer.isBuffer(nextContents) ? nextContents : Buffer.from(nextContents),
    );
  }

  return currentContents.toString('utf8') === nextContents;
}

export function sortRecordByKey(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function isEquivalentToolkitScript(
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

export function buildDesiredPackageScripts(_packageJson: PackageJson): Record<string, string> {
  return {
    ...DESIRED_PACKAGE_SCRIPTS,
  };
}

export function usesExpoRouter(packageJson: PackageJson): boolean {
  return hasDeclaredDependency(packageJson, 'expo-router');
}

export function resolveHarmonyBundleEntryFile(packageJson: PackageJson): string {
  return usesExpoRouter(packageJson) ? HARMONY_ROUTER_ENTRY_FILENAME : 'index.js';
}

export function renderRouterHarmonyEntry(identifiers: HarmonyIdentifiers): string {
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

export function collectMetadataWarnings(
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

export function stabilizeToolkitConfigTimestamp(
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
