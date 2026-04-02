import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { buildEnvReport } from '../src/core/env';

async function createTempProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-env-'));
  await fs.writeJson(
    path.join(projectRoot, 'package.json'),
    {
      name: 'env-fixture',
      version: '1.0.0',
      private: true,
    },
    { spaces: 2 },
  );

  return projectRoot;
}

async function createFakeDevEcoStudio(projectRoot: string): Promise<string> {
  const devecoRoot = path.join(projectRoot, 'DevEco-Studio.app');
  await fs.outputFile(
    path.join(devecoRoot, 'Contents', 'sdk', 'default', 'openharmony', 'toolchains', 'hdc'),
    '',
  );
  await fs.outputFile(path.join(devecoRoot, 'Contents', 'tools', 'hvigor', 'bin', 'hvigorw.js'), '');
  await fs.outputFile(path.join(devecoRoot, 'Contents', 'tools', 'ohpm', 'bin', 'ohpm'), '');
  return devecoRoot;
}

async function writeLocalSigningConfig(projectRoot: string): Promise<void> {
  await fs.outputJson(
    path.join(projectRoot, '.expo-harmony', 'signing.local.json'),
    {
      signingConfigs: [
        {
          name: 'default',
          type: 'HarmonyOS',
          material: {
            storeFile: './signing/release.p12',
          },
        },
      ],
      products: [
        {
          name: 'default',
          signingConfig: 'default',
        },
      ],
    },
    { spaces: 2 },
  );
}

describe('env report', () => {
  it('reports a ready environment when DevEco tools are discoverable and local signing is configured', async () => {
    const projectRoot = await createTempProject();
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await fs.outputFile(path.join(projectRoot, 'harmony', 'build-profile.json5'), 'signingConfigs: [],\n');
    await writeLocalSigningConfig(projectRoot);

    const report = await buildEnvReport(projectRoot, {
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('ready');
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.devecoStudioPath).toBe(devecoRoot);
    expect(report.hvigorPath).toContain('hvigorw.js');
    expect(report.hdcPath).toContain(path.join('openharmony', 'toolchains', 'hdc'));
    expect(report.signingConfigured).toBe(true);
    expect(report.advisories.some((issue) => issue.code === 'env.signing.missing')).toBe(false);
  }, 15000);

  it('keeps signing advisory behavior when neither local signing nor build-profile signing is configured', async () => {
    const projectRoot = await createTempProject();
    const devecoRoot = await createFakeDevEcoStudio(projectRoot);
    await fs.outputFile(path.join(projectRoot, 'harmony', 'build-profile.json5'), 'signingConfigs: [],\n');

    const report = await buildEnvReport(projectRoot, {
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        EXPO_HARMONY_DEVECO_STUDIO_PATH: devecoRoot,
        EXPO_HARMONY_JAVA_PATH: '/usr/bin/java',
        PATH: '',
      },
    });

    expect(report.status).toBe('ready');
    expect(report.signingConfigured).toBe(false);
    expect(report.advisories.some((issue) => issue.code === 'env.signing.missing')).toBe(true);
  }, 15000);

  it('reports missing DevEco tools as blocking issues when default path discovery is disabled', async () => {
    const projectRoot = await createTempProject();

    const report = await buildEnvReport(projectRoot, {
      env: {
        ...process.env,
        EXPO_HARMONY_DISABLE_DEFAULT_PATHS: '1',
        PATH: '',
      },
    });

    const issueCodes = report.blockingIssues.map((issue) => issue.code);

    expect(report.status).toBe('blocked');
    expect(issueCodes).toContain('env.deveco_sdk.missing');
    expect(issueCodes).toContain('env.hvigor.missing');
    expect(issueCodes).toContain('env.hdc.missing');
  }, 15000);
});
