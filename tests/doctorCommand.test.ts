import path from 'path';
import { runDoctorCommand } from '../src/commands/doctor';
import { STRICT_DOCTOR_EXIT_CODE } from '../src/core/constants';

const managedFixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');

describe('doctor command strict mode', () => {
  const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

  afterEach(() => {
    process.exitCode = undefined;
    stdoutSpy.mockClear();
  });

  afterAll(() => {
    stdoutSpy.mockRestore();
  });

  it('sets exit code 2 when the project is outside the validated matrix', async () => {
    await runDoctorCommand({
      projectRoot: managedFixtureRoot,
      strict: true,
    });

    expect(process.exitCode).toBe(STRICT_DOCTOR_EXIT_CODE);
  });

  it('does not set an exit code when the project is eligible', async () => {
    await runDoctorCommand({
      projectRoot: sampleRoot,
      strict: true,
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('does not set an exit code for the official app-shell sample either', async () => {
    await runDoctorCommand({
      projectRoot: appShellSampleRoot,
      strict: true,
    });

    expect(process.exitCode).toBeUndefined();
  });
});
