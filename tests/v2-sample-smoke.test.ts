import fs from 'fs-extra';
import path from 'node:path';
import {
  createSampleWorkspace,
  removeSampleWorkspace,
  runToolkitCommand,
  snapshotSampleSource,
} from './helpers/sampleHarness';

interface SmokeProject {
  readonly id: string;
  readonly root: string;
  readonly targetTier: 'verified' | 'preview' | 'experimental';
  readonly expectedCoverageProfile: string;
  readonly expectedEligibility: 'eligible' | 'ineligible';
  readonly marker: string;
}

const { V2_SAMPLE_PROJECTS } = require('../scripts/v2-sample-lanes.js') as {
  V2_SAMPLE_PROJECTS: readonly SmokeProject[];
};

const repoRoot = path.join(__dirname, '..');
const smokeProjectIds = new Set(['official-bare', 'official-wave-a', 'official-wave-b']);
const smokeProjects = V2_SAMPLE_PROJECTS.filter((project) => smokeProjectIds.has(project.id));

describe('v2 official sample smoke lanes', () => {
  it.each(smokeProjects)(
    '$id passes isolated doctor, init, sync, and bundle without polluting its source',
    async (project) => {
      const sampleRoot = path.join(repoRoot, project.root);
      const sourceSnapshot = await snapshotSampleSource(sampleRoot);
      const workspaceRoot = await createSampleWorkspace(sampleRoot);

      try {
        const doctorReportPath = path.join(workspaceRoot, 'v2-doctor-report.json');
        await runToolkitCommand(workspaceRoot, [
          'doctor',
          '--project-root',
          '.',
          '--target-tier',
          project.targetTier,
          '--output',
          doctorReportPath,
        ]);

        const doctorReport = await fs.readJson(doctorReportPath);
        expect(doctorReport.coverageProfile).toBe(project.expectedCoverageProfile);
        expect(doctorReport.targetTier).toBe(project.targetTier);
        expect(doctorReport.eligibility).toBe(project.expectedEligibility);

        await runToolkitCommand(workspaceRoot, ['init', '--project-root', '.', '--force']);
        await runToolkitCommand(workspaceRoot, ['sync-template', '--project-root', '.', '--force']);
        await runToolkitCommand(workspaceRoot, ['bundle', '--project-root', '.']);

        const bundlePath = path.join(
          workspaceRoot,
          'harmony',
          'entry',
          'src',
          'main',
          'resources',
          'rawfile',
          'bundle.harmony.js',
        );
        expect(await fs.pathExists(bundlePath)).toBe(true);
        expect(await fs.readFile(bundlePath, 'utf8')).toContain(project.marker);
      } finally {
        await removeSampleWorkspace(workspaceRoot);
      }

      expect(await snapshotSampleSource(sampleRoot)).toBe(sourceSnapshot);
    },
    240000,
  );
});
