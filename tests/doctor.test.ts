import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { buildDoctorReport } from '../src/core/report';

const managedFixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');
const missingIdentifiersRoot = path.join(__dirname, '..', 'fixtures', 'missing-identifiers-app');
const minimalRouterRoot = path.join(__dirname, '..', 'fixtures', 'minimal-router-app');
const routerMissingPluginRoot = path.join(__dirname, '..', 'fixtures', 'router-missing-plugin-app');

describe('doctor report', () => {
  it('classifies known Expo and third-party dependencies and marks the legacy fixture as ineligible', async () => {
    const report = await buildDoctorReport(managedFixtureRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));
    const issueCodes = report.blockingIssues.map((issue) => issue.code);

    expect(report.matrixId).toBe('expo55-rnoh082-app-shell');
    expect(report.eligibility).toBe('ineligible');
    expect(report.expoSdkVersion).toBe(53);
    expect(byName.get('expo')?.status).toBe('supported');
    expect(byName.get('expo-constants')?.status).toBe('supported');
    expect(byName.get('expo-camera')?.status).toBe('unknown');
    expect(byName.get('react-native-reanimated')?.status).toBe('manual');
    expect(byName.get('expo-camera')?.blocking).toBe(true);
    expect(report.summary.unknown).toBeGreaterThan(0);
    expect(issueCodes).toContain('matrix.expo_sdk.unsupported');
    expect(issueCodes).toContain('dependency.not_allowed');
    expect(report.warnings).toContain(
      'Unknown dependencies were detected. The toolkit can scaffold the project, but runtime portability is not guaranteed.',
    );
  });

  it('marks the official sample as eligible for the validated matrix', async () => {
    const report = await buildDoctorReport(sampleRoot);

    expect(report.expoSdkVersion).toBe(55);
    expect(report.eligibility).toBe('eligible');
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.dependencies.every((dependency) => dependency.blocking === false)).toBe(true);
  });

  it('marks the official app-shell sample as eligible and exposes schemes/plugins in the report', async () => {
    const report = await buildDoctorReport(appShellSampleRoot);

    expect(report.matrixId).toBe('expo55-rnoh082-app-shell');
    expect(report.eligibility).toBe('eligible');
    expect(report.expoConfig.schemes).toEqual(['expoharmonyappshell']);
    expect(report.expoConfig.plugins).toContain('expo-router');
    expect(report.blockingIssues).toHaveLength(0);
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
    await fs.copy(appShellSampleRoot, tempRoot);

    const packageJsonPath = path.join(tempRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.scripts['bundle:harmony'] =
      'node ./node_modules/react-native/cli.js bundle-harmony --dev false --entry-file "$PWD/index.js" --bundle-output "$PWD/harmony/entry/src/main/resources/rawfile/bundle.harmony.js" --assets-dest "$PWD/harmony/entry/src/main/resources/rawfile/assets" --config "$PWD/metro.harmony.config.js"';
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    const report = await buildDoctorReport(tempRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.bundle_script.mismatch')).toBe(true);
  });
});
