import fs from 'fs-extra';
import path from 'path';

const {
  getUnexpectedTarballFiles,
  packDryRunArtifacts,
  PUBLIC_TARBALL_DOC_FILES,
} = require('../scripts/pack.js') as {
  getUnexpectedTarballFiles: (files: Array<{ path?: string }>) => string[];
  packDryRunArtifacts: () => Array<{
    files?: Array<{ path?: string }>;
  }>;
  PUBLIC_TARBALL_DOC_FILES: string[];
};

const repoRoot = path.join(__dirname, '..');

describe('packaging', () => {
  it('keeps the npm tarball limited to public docs and compiled source outputs', async () => {
    const staleBuildPath = path.join(repoRoot, 'build', 'stale-orphan.txt');
    await fs.outputFile(staleBuildPath, 'stale\n');

    const artifacts = packDryRunArtifacts();
    const tarballFiles = artifacts[0]?.files ?? [];
    const tarballPaths = tarballFiles
      .map((file) => file.path ?? '')
      .sort((left, right) => left.localeCompare(right));

    expect(getUnexpectedTarballFiles(tarballFiles)).toEqual([]);
    expect(tarballPaths).not.toContain('build/stale-orphan.txt');
    expect(tarballPaths).not.toContain('acceptance/v1.7.3-acceptance.md');
    expect(tarballPaths).not.toContain('docs/v1.7.3-acceptance.md');

    for (const publicDocPath of PUBLIC_TARBALL_DOC_FILES) {
      expect(tarballPaths).toContain(publicDocPath);
    }
  }, 120000);
});
