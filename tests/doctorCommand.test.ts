import fs from 'fs-extra';
import path from 'path';
import { runDoctorCommand } from '../src/commands/doctor';
import { STRICT_DOCTOR_EXIT_CODE } from '../src/core/constants';

const managedFixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');
const appShellSampleRoot = path.join(__dirname, '..', 'examples', 'official-app-shell-sample');
const uiStackSampleRoot = path.join(__dirname, '..', 'examples', 'official-ui-stack-sample');
const nativePreviewRoot = path.join(__dirname, '..', 'fixtures', 'native-preview-app');

async function cleanupGeneratedArtifacts(projectRoot: string) {
  await fs.remove(path.join(projectRoot, 'harmony'));
  await fs.remove(path.join(projectRoot, '.expo-harmony'));
  await fs.remove(path.join(projectRoot, 'index.harmony.js'));
  await fs.remove(path.join(projectRoot, 'metro.harmony.config.js'));
}

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
    await cleanupGeneratedArtifacts(sampleRoot);
    await runDoctorCommand({
      projectRoot: sampleRoot,
      strict: true,
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('does not set an exit code for the official ui-stack sample either', async () => {
    await cleanupGeneratedArtifacts(uiStackSampleRoot);
    await runDoctorCommand({
      projectRoot: uiStackSampleRoot,
      strict: true,
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('does not set an exit code for the official app-shell regression sample either', async () => {
    await cleanupGeneratedArtifacts(appShellSampleRoot);
    await runDoctorCommand({
      projectRoot: appShellSampleRoot,
      strict: true,
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('allows preview-tier eligibility when the target tier is preview', async () => {
    await runDoctorCommand({
      projectRoot: nativePreviewRoot,
      targetTier: 'preview',
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('keeps strict mode pinned to verified even when a preview target tier is supplied', async () => {
    await runDoctorCommand({
      projectRoot: nativePreviewRoot,
      strict: true,
      targetTier: 'preview',
    });

    expect(process.exitCode).toBe(STRICT_DOCTOR_EXIT_CODE);
  });
});
