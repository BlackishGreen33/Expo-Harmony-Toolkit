import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { TOOLKIT_PACKAGE_NAME } from '../src/core/constants';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from '../src/data/uiStack';
import { buildDoctorReport } from '../src/core/report';

const managedFixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');
const uiStackSampleRoot = path.join(__dirname, '..', 'examples', 'official-ui-stack-sample');
const nativeCapabilitiesSampleRoot = path.join(
  __dirname,
  '..',
  'examples',
  'official-native-capabilities-sample',
);
const missingIdentifiersRoot = path.join(__dirname, '..', 'fixtures', 'missing-identifiers-app');
const nativePreviewRoot = path.join(__dirname, '..', 'fixtures', 'native-preview-app');
const minimalRouterRoot = path.join(__dirname, '..', 'fixtures', 'minimal-router-app');
const routerMissingPluginRoot = path.join(__dirname, '..', 'fixtures', 'router-missing-plugin-app');
const missingReanimatedAdapterRoot = path.join(
  __dirname,
  '..',
  'fixtures',
  'ui-stack-missing-reanimated-adapter-app',
);
const missingSvgAdapterRoot = path.join(
  __dirname,
  '..',
  'fixtures',
  'ui-stack-missing-svg-adapter-app',
);
const missingGestureAdapterRoot = path.join(
  __dirname,
  '..',
  'fixtures',
  'ui-stack-missing-gesture-adapter-app',
);
const specifierMismatchRoot = path.join(
  __dirname,
  '..',
  'fixtures',
  'ui-stack-specifier-mismatch-app',
);

async function cleanupGeneratedArtifacts(projectRoot: string) {
  await fs.remove(path.join(projectRoot, 'harmony'));
  await fs.remove(path.join(projectRoot, '.expo-harmony'));
  await fs.remove(path.join(projectRoot, 'index.harmony.js'));
  await fs.remove(path.join(projectRoot, 'metro.harmony.config.js'));
}

describe('doctor report', () => {
  it('classifies known Expo and third-party dependencies and marks the legacy fixture as ineligible', async () => {
    const report = await buildDoctorReport(managedFixtureRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));
    const issueCodes = report.blockingIssues.map((issue) => issue.code);

    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('ineligible');
    expect(report.expoSdkVersion).toBe(53);
    expect(byName.get('expo')?.status).toBe('supported');
    expect(byName.get('expo-constants')?.status).toBe('supported');
    expect(byName.get('expo-camera')?.status).toBe('manual');
    expect(byName.get('expo-camera')?.supportTier).toBe('experimental');
    expect(byName.get('react-native-reanimated')?.status).toBe('supported');
    expect(byName.get('expo-camera')?.blocking).toBe(true);
    expect(report.summary.manual).toBeGreaterThan(0);
    expect(report.supportSummary.experimental).toBeGreaterThan(0);
    expect(issueCodes).toContain('matrix.expo_sdk.unsupported');
    expect(issueCodes).toContain('dependency.not_allowed');
    expect(issueCodes).toContain('dependency.required_missing');
    expect(report.warnings).toContain(
      'Experimental-tier dependencies were detected. Expect bridge drift, runtime gaps, or additional manual validation before claiming release readiness.',
    );
  });

  it('marks the official sample as eligible for the validated matrix', async () => {
    await cleanupGeneratedArtifacts(sampleRoot);
    const report = await buildDoctorReport(sampleRoot);

    expect(report.expoSdkVersion).toBe(55);
    expect(report.eligibility).toBe('eligible');
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.dependencies.every((dependency) => dependency.blocking === false)).toBe(true);
  });

  it('marks the official app-shell sample as eligible and exposes schemes/plugins in the report', async () => {
    await cleanupGeneratedArtifacts(appShellSampleRoot);
    const report = await buildDoctorReport(appShellSampleRoot);

    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(report.expoConfig.schemes).toEqual(['expoharmonyappshell']);
    expect(report.expoConfig.plugins).toContain('expo-router');
    expect(report.blockingIssues).toHaveLength(0);
  });

  it('marks the official ui-stack sample as eligible for the validated matrix', async () => {
    await cleanupGeneratedArtifacts(uiStackSampleRoot);
    const report = await buildDoctorReport(uiStackSampleRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));

    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(byName.get('react-native-reanimated')?.status).toBe('supported');
    expect(byName.get('@react-native-oh-tpl/react-native-reanimated')?.status).toBe('supported');
    expect(byName.get('react-native-svg')?.status).toBe('supported');
    expect(byName.get('@react-native-oh-tpl/react-native-svg')?.status).toBe('supported');
    expect(report.blockingIssues).toHaveLength(0);
  });

  it('keeps preview native capabilities outside verified eligibility but classifies their support tier explicitly', async () => {
    const report = await buildDoctorReport(nativePreviewRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));

    expect(report.targetTier).toBe('verified');
    expect(report.eligibility).toBe('ineligible');
    expect(byName.get('expo-file-system')?.status).toBe('manual');
    expect(byName.get('expo-file-system')?.supportTier).toBe('preview');
    expect(byName.get('expo-image-picker')?.supportTier).toBe('preview');
    expect(report.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining(['expo-file-system', 'expo-image-picker']),
    );
    expect(report.supportSummary.preview).toBeGreaterThan(0);
    expect(
      report.blockingIssues.some(
        (issue) => issue.code === 'dependency.not_allowed' && issue.subject === 'expo-file-system',
      ),
    ).toBe(true);
  });

  it('marks preview native capabilities as eligible when the doctor target tier is preview', async () => {
    const report = await buildDoctorReport(nativePreviewRoot, {
      targetTier: 'preview',
    });
    const capabilityById = new Map(report.capabilities.map((capability) => [capability.id, capability]));

    expect(report.targetTier).toBe('preview');
    expect(report.eligibility).toBe('eligible');
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.capabilities).toHaveLength(2);
    expect(capabilityById.get('expo-file-system')?.harmonyPermissions).toEqual([]);
    expect(capabilityById.get('expo-image-picker')?.harmonyPermissions).toEqual(
      expect.arrayContaining(['ohos.permission.CAMERA', 'ohos.permission.READ_IMAGEVIDEO']),
    );
  });

  it('keeps the official ui-stack sample adapter specs aligned with the validated source of truth', async () => {
    const packageJson = await fs.readJson(path.join(uiStackSampleRoot, 'package.json'));
    const dependencies = packageJson.dependencies ?? {};

    for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
      expect(dependencies[adapter.canonicalPackageName]).toBe(adapter.canonicalVersion);
      expect(dependencies[adapter.adapterPackageName]).toBe(getUiStackAdapterSpecifier(adapter));
    }
  });

  it('allows the published toolkit package to be installed as a local devDependency', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-toolkit-self-hosted-'));
    await fs.copy(uiStackSampleRoot, tempRoot, {
      filter: (source) =>
        !source.includes(`${path.sep}node_modules${path.sep}`) &&
        !source.endsWith(`${path.sep}node_modules`) &&
        !source.includes(`${path.sep}harmony${path.sep}`) &&
        !source.endsWith(`${path.sep}harmony`) &&
        !source.includes(`${path.sep}.expo-harmony${path.sep}`) &&
        !source.endsWith(`${path.sep}.expo-harmony`) &&
        !source.endsWith(`${path.sep}index.harmony.js`) &&
        !source.endsWith(`${path.sep}metro.harmony.config.js`),
    });

    const packageJsonPath = path.join(tempRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.devDependencies = {
      ...(packageJson.devDependencies ?? {}),
      [TOOLKIT_PACKAGE_NAME]: '1.6.0',
    };
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    const report = await buildDoctorReport(tempRoot);
    const toolkitDependency = report.dependencies.find((dependency) => dependency.name === TOOLKIT_PACKAGE_NAME);

    expect(toolkitDependency?.status).toBe('supported');
    expect(report.eligibility).toBe('eligible');
  });

  it('flags missing native identifiers as a blocking issue', async () => {
    const report = await buildDoctorReport(missingIdentifiersRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.native_identifier.missing')).toBe(true);
  });

  it('flags router peer and scheme issues for the incomplete router fixture', async () => {
    const report = await buildDoctorReport(minimalRouterRoot);
    const issueCodes = report.blockingIssues.map((issue) => issue.code);

    expect(report.eligibility).toBe('ineligible');
    expect(issueCodes).toContain('dependency.router_peer_missing');
    expect(issueCodes).toContain('config.scheme.missing');
  });

  it('flags router plugin issues for the router fixture without plugins config', async () => {
    const report = await buildDoctorReport(routerMissingPluginRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.router_plugin.missing')).toBe(true);
  });

  it('flags outdated router bundle scripts that still point to index.js', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-router-script-'));
    await fs.copy(appShellSampleRoot, tempRoot, {
      filter: (source) =>
        !source.includes(`${path.sep}node_modules${path.sep}`) &&
        !source.endsWith(`${path.sep}node_modules`),
    });

    const packageJsonPath = path.join(tempRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    delete packageJson.scripts['harmony:bundle'];
    packageJson.scripts['bundle:harmony'] =
      'node ./node_modules/react-native/cli.js bundle-harmony --dev false --entry-file "$PWD/index.js" --bundle-output "$PWD/harmony/entry/src/main/resources/rawfile/bundle.harmony.js" --assets-dest "$PWD/harmony/entry/src/main/resources/rawfile/assets" --config "$PWD/metro.harmony.config.js"';
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    const report = await buildDoctorReport(tempRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.bundle_script.mismatch')).toBe(true);
  }, 15000);

  it('flags router bundle scripts that bypass the toolkit bundle command', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-router-command-'));
    await fs.copy(appShellSampleRoot, tempRoot, {
      filter: (source) =>
        !source.includes(`${path.sep}node_modules${path.sep}`) &&
        !source.endsWith(`${path.sep}node_modules`),
    });

    const packageJsonPath = path.join(tempRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.scripts['harmony:bundle'] =
      'react-native bundle-harmony --dev false --entry-file index.harmony.js --bundle-output harmony/entry/src/main/resources/rawfile/bundle.harmony.js --assets-dest harmony/entry/src/main/resources/rawfile/assets --config ./metro.harmony.config.js';
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    const report = await buildDoctorReport(tempRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.bundle_script.mismatch')).toBe(true);
  }, 15000);

  it('flags a missing reanimated adapter as a blocking issue', async () => {
    const report = await buildDoctorReport(missingReanimatedAdapterRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(
      report.blockingIssues.some(
        (issue) =>
          issue.code === 'dependency.required_missing' &&
          issue.subject === '@react-native-oh-tpl/react-native-reanimated',
      ),
    ).toBe(true);
  });

  it('flags a missing svg adapter as a blocking issue', async () => {
    const report = await buildDoctorReport(missingSvgAdapterRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(
      report.blockingIssues.some(
        (issue) =>
          issue.code === 'dependency.required_missing' &&
          issue.subject === '@react-native-oh-tpl/react-native-svg',
      ),
    ).toBe(true);
  });

  it('flags gesture-handler as outside the current public matrix', async () => {
    const report = await buildDoctorReport(missingGestureAdapterRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.dependencies.find((dependency) => dependency.name === 'react-native-gesture-handler')?.status).toBe(
      'manual',
    );
    expect(
      report.blockingIssues.some(
        (issue) =>
          issue.code === 'dependency.not_allowed' && issue.subject === 'react-native-gesture-handler',
      ),
    ).toBe(true);
  });

  it('flags adapter Git spec drift as a blocking issue', async () => {
    const report = await buildDoctorReport(specifierMismatchRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'dependency.specifier_mismatch')).toBe(true);
  });

  it('classifies the official native capabilities sample as preview-eligible', async () => {
    await cleanupGeneratedArtifacts(nativeCapabilitiesSampleRoot);
    const report = await buildDoctorReport(nativeCapabilitiesSampleRoot, {
      targetTier: 'preview',
    });

    expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');
    expect(report.eligibility).toBe('eligible');
    expect(report.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining(['expo-file-system', 'expo-image-picker']),
    );
  });
});
