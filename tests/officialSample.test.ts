import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDoctorReport } from '../src/core/report';
import { initProject } from '../src/core/template';

const execFileAsync = promisify(execFile);
const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');

async function cleanupGeneratedArtifacts() {
  await fs.remove(path.join(sampleRoot, 'harmony'));
  await fs.remove(path.join(sampleRoot, '.expo-harmony'));
  await fs.remove(path.join(sampleRoot, 'metro.harmony.config.js'));
}

describe('official minimal sample', () => {
  beforeAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  afterAll(async () => {
    await cleanupGeneratedArtifacts();
  });

  it('generates a doctor report, scaffolds harmony files, and bundles a harmony artifact', async () => {
    const report = await buildDoctorReport(sampleRoot);
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.expoSdkVersion).toBe(55);
    expect(report.eligibility).toBe('eligible');

    const initResult = await initProject(sampleRoot, true);
    expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/pages/Index.ets');

    const bundleOutput = path.join(
      sampleRoot,
      'harmony',
      'entry',
      'src',
      'main',
      'resources',
      'rawfile',
      'bundle.harmony.js',
    );

    await execFileAsync('pnpm', ['run', 'bundle:harmony'], {
      cwd: sampleRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });

    expect(await fs.pathExists(bundleOutput)).toBe(true);
    const bundleContents = await fs.readFile(bundleOutput, 'utf8');
    expect(bundleContents).toContain('__d(');

    const secondInit = await initProject(sampleRoot, false);
    expect(secondInit.sync.skippedFiles).toHaveLength(0);
    expect(secondInit.report.eligibility).toBe('eligible');
  }, 120000);
});
