import fs from 'fs-extra';
import path from 'path';
import { buildDoctorReport } from '../src/core/report';
import { initProject } from '../src/core/template';
import {
  createSampleWorkspace,
  removeSampleWorkspace,
  runToolkitCommand,
  snapshotSampleSource,
} from './helpers/sampleHarness';

const sampleRoot = path.join(__dirname, '..', 'examples', 'official-minimal-sample');

describe('official minimal sample', () => {
  it('generates a doctor report, scaffolds harmony files, and bundles a harmony artifact', async () => {
    const sourceSnapshot = await snapshotSampleSource(sampleRoot);
    const workspaceRoot = await createSampleWorkspace(sampleRoot);

    try {
      const report = await buildDoctorReport(workspaceRoot);
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.expoSdkVersion).toBe(55);
      expect(report.eligibility).toBe('eligible');
      expect(report.matrixId).toBe('expo55-rnoh082-ui-stack');

      const initResult = await initProject(workspaceRoot, true);
      expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/pages/Index.ets');
      expect(initResult.sync.writtenFiles).toContain('harmony/entry/src/main/ets/RNOHPackagesFactory.ets');
      expect(initResult.packageWarnings).toHaveLength(0);

      const bundleOutput = path.join(
        workspaceRoot,
        'harmony',
        'entry',
        'src',
        'main',
        'resources',
        'rawfile',
        'bundle.harmony.js',
      );

      await runToolkitCommand(workspaceRoot, ['bundle', '--project-root', '.']);

      expect(await fs.pathExists(bundleOutput)).toBe(true);
      const bundleContents = await fs.readFile(bundleOutput, 'utf8');
      expect(bundleContents).toContain('__d(');
      expect(bundleContents).toContain('What this sample validates');
      expect(bundleContents).toContain('Success looks like');
      expect(bundleContents).toContain('Intentionally excluded');

      const secondInit = await initProject(workspaceRoot, false);
      expect(secondInit.sync.skippedFiles).toHaveLength(0);
      expect(secondInit.report.eligibility).toBe('eligible');
    } finally {
      await removeSampleWorkspace(workspaceRoot);
    }

    expect(await snapshotSampleSource(sampleRoot)).toBe(sourceSnapshot);
  }, 120000);
});
