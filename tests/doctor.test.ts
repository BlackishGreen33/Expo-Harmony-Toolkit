import path from 'path';
import { buildDoctorReport } from '../src/core/report';

const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');

describe('doctor report', () => {
  it('classifies known Expo and third-party dependencies', async () => {
    const report = await buildDoctorReport(fixtureRoot);
    const byName = new Map(report.dependencies.map((dependency) => [dependency.name, dependency]));

    expect(report.expoSdkVersion).toBe(53);
    expect(byName.get('expo')?.status).toBe('supported');
    expect(byName.get('expo-constants')?.status).toBe('manual');
    expect(byName.get('expo-camera')?.status).toBe('unknown');
    expect(byName.get('react-native-reanimated')?.status).toBe('manual');
    expect(report.summary.unknown).toBeGreaterThan(0);
    expect(report.warnings).toContain(
      'Unknown dependencies were detected. v0.1 can scaffold the project, but runtime portability is not guaranteed.',
    );
  });
});
