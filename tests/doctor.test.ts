import path from 'path';
import { buildDoctorReport } from '../src/core/report';

const managedFixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const missingIdentifiersRoot = path.join(__dirname, '..', 'fixtures', 'missing-identifiers-app');

describe('doctor report', () => {
  it('classifies known Expo and third-party dependencies and marks the legacy fixture as ineligible', async () => {
    const report = await buildDoctorReport(managedFixtureRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));
    const issueCodes = report.blockingIssues.map((issue) => issue.code);

    expect(report.matrixId).toBe('expo55-rnoh082-minimal');
    expect(report.eligibility).toBe('ineligible');
    expect(report.expoSdkVersion).toBe(53);
    expect(byName.get('expo')?.status).toBe('supported');
    expect(byName.get('expo-constants')?.status).toBe('manual');
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

  it('flags missing native identifiers as a blocking issue', async () => {
    const report = await buildDoctorReport(missingIdentifiersRoot);

    expect(report.eligibility).toBe('ineligible');
    expect(report.blockingIssues.some((issue) => issue.code === 'config.native_identifier.missing')).toBe(true);
  });
});
