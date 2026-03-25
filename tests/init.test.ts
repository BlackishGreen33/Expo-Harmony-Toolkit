import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initProject, syncProjectTemplate } from '../src/core/template';
import { readManifest, readToolkitConfig } from '../src/core/metadata';

const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'managed-app');

async function createTempFixture(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-toolkit-'));
  await fs.copy(fixtureRoot, tempRoot);
  return tempRoot;
}

describe('init project', () => {
  it('writes scaffold files and remains idempotent on the second run', async () => {
    const projectRoot = await createTempFixture();

    const firstRun = await initProject(projectRoot, false);
    const secondRun = await initProject(projectRoot, false);
    const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
    const manifest = await readManifest(projectRoot);
    const toolkitConfig = await readToolkitConfig(projectRoot);

    expect(firstRun.sync.writtenFiles).toContain('harmony/README.md');
    expect(await fs.pathExists(path.join(projectRoot, 'metro.harmony.config.js'))).toBe(true);
    expect(packageJson.scripts['harmony:init']).toBe('expo-harmony init');
    expect(manifest?.toolkitVersion).toBe('1.0.0');
    expect(manifest?.matrixId).toBe('expo55-rnoh082-app-shell');
    expect(toolkitConfig?.toolkitVersion).toBe('1.0.0');
    expect(toolkitConfig?.matrixId).toBe('expo55-rnoh082-app-shell');
    expect(secondRun.sync.writtenFiles).toHaveLength(0);
    expect(secondRun.sync.skippedFiles).toHaveLength(0);
    expect(secondRun.sync.unchangedFiles.length).toBeGreaterThan(0);
  });

  it('detects drifted managed files without force', async () => {
    const projectRoot = await createTempFixture();

    await initProject(projectRoot, false);
    await fs.writeFile(path.join(projectRoot, 'metro.harmony.config.js'), '// drifted\n');

    const result = await syncProjectTemplate(projectRoot, false);

    expect(result.skippedFiles).toContain('metro.harmony.config.js');
    expect(
      result.warnings.some((warning) =>
        warning.includes('metro.harmony.config.js'),
      ),
    ).toBe(true);
  });

  it('surfaces metadata matrix drift in doctor and sync warnings', async () => {
    const projectRoot = await createTempFixture();

    await initProject(projectRoot, false);
    const manifestPath = path.join(projectRoot, '.expo-harmony', 'manifest.json');
    const manifest = await fs.readJson(manifestPath);

    manifest.matrixId = 'legacy-v0.2';
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    const syncResult = await syncProjectTemplate(projectRoot, false);

    expect(syncResult.warnings.some((warning) => warning.includes('Existing manifest matrix legacy-v0.2'))).toBe(
      true,
    );
  });
});
