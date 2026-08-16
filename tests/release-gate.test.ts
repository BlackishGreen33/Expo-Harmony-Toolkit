import fs from 'fs-extra';
import path from 'node:path';

interface ReleaseProject {
  readonly id: string;
  readonly root: string;
  readonly targetTier: 'verified' | 'preview' | 'experimental';
  readonly expectedCoverageProfile: string;
  readonly expectedEligibility: 'eligible' | 'ineligible';
  readonly marker: string;
}

interface CommandCall {
  readonly file: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly acceptableExitCodes?: readonly number[];
}

const { V2_SAMPLE_PROJECTS } = require('../scripts/v2-sample-lanes.js') as {
  V2_SAMPLE_PROJECTS: readonly ReleaseProject[];
};
const {
  executeReleaseSmoke,
  selectReleaseMode,
} = require('../scripts/release-gate.js') as {
  executeReleaseSmoke: (options: Record<string, unknown>) => Promise<void>;
  selectReleaseMode: (version: string) => 'v1' | 'v2';
};
const {
  resolveCiReleaseMetadata,
  resolveReleaseMetadata,
} = require('../scripts/release-channel.js') as {
  resolveCiReleaseMetadata: (version: string) => {
    readonly releaseChannel: 'latest' | 'next';
    readonly distTag: 'latest' | 'next';
  };
  resolveReleaseMetadata: (options: {
    readonly version: string;
    readonly refName: string;
    readonly eventName: string;
  }) => { readonly releaseChannel: 'latest' | 'next'; readonly distTag: 'latest' | 'next' };
};

function createHarness(overrides: {
  readonly projects?: readonly ReleaseProject[];
  readonly doctorReport?: (project: ReleaseProject) => Record<string, unknown>;
  readonly secondSyncOutput?: string;
  readonly consumerAuditReport?: Record<string, unknown>;
  readonly createTarball?: (tempRoot: string) => Promise<string>;
} = {}) {
  const projects = overrides.projects ?? V2_SAMPLE_PROJECTS;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const commandCalls: CommandCall[] = [];
  const materialized: Array<{ source: string; target: string }> = [];
  const removed: string[] = [];
  const syncCounts = new Map<string, number>();
  const writtenJson: Array<{ filePath: string; value: Record<string, unknown> }> = [];
  let packCount = 0;

  const options = {
    version: '2.0.0-next.0',
    repoRoot: '/repo',
    releaseChannel: 'next',
    skipHap: true,
    v2Projects: projects,
    legacySampleRoot: '/repo/examples/official-native-capabilities-sample',
    createTarball:
      overrides.createTarball ??
      (async (tempRoot: string) => {
        packCount += 1;
        return path.join(tempRoot, 'expo-harmony-toolkit-2.0.0-next.0.tgz');
      }),
    createTempRoot: async () => '/tmp/eht-release-gate-test',
    materializeSample: async (source: string, target: string) => {
      materialized.push({ source, target });
    },
    runCommand: async (
      file: string,
      args: readonly string[],
      commandOptions: { cwd: string; acceptableExitCodes?: readonly number[] },
    ) => {
      commandCalls.push({
        file,
        args: [...args],
        cwd: commandOptions.cwd,
        acceptableExitCodes: commandOptions.acceptableExitCodes,
      });
      const project = projectById.get(path.basename(commandOptions.cwd));

      if (args.includes('doctor') && project) {
        return {
          stdout: JSON.stringify(
            overrides.doctorReport?.(project) ?? {
              targetTier: project.targetTier,
              coverageProfile: project.expectedCoverageProfile,
              eligibility: project.expectedEligibility,
            },
          ),
          stderr: '',
        };
      }

      if (args.includes('sync-template')) {
        const count = (syncCounts.get(commandOptions.cwd) ?? 0) + 1;
        syncCounts.set(commandOptions.cwd, count);
        return {
          stdout:
            count === 2
              ? overrides.secondSyncOutput ?? '- written: 0\n- unchanged: 18\n- skipped: 0\n'
              : '- written: 1\n- unchanged: 17\n- skipped: 0\n',
          stderr: '',
        };
      }

      if (args.includes('audit')) {
        return {
          stdout: JSON.stringify(
            overrides.consumerAuditReport ?? {
              metadata: {
                vulnerabilities: {
                  info: 0,
                  low: 0,
                  moderate: 1,
                  high: 2,
                  critical: 0,
                },
              },
            },
          ),
          stderr: '',
        };
      }

      return { stdout: '', stderr: '' };
    },
    readFile: async (filePath: string) => {
      const project = projectById.get(path.basename(filePath.split('/harmony/')[0]));
      return project?.marker ?? '';
    },
    removePath: async (target: string) => {
      removed.push(target);
    },
    writeJson: async (filePath: string, value: Record<string, unknown>) => {
      writtenJson.push({ filePath, value });
    },
  };

  return {
    commandCalls,
    materialized,
    options,
    removed,
    writtenJson,
    getPackCount: () => packCount,
  };
}

describe('release gate orchestration', () => {
  it('selects the legacy path for v1 and the matrix path for v2 prereleases', () => {
    expect(selectReleaseMode('1.11.4')).toBe('v1');
    expect(selectReleaseMode('2.0.0-next.0')).toBe('v2');
    expect(() => selectReleaseMode('not-semver')).toThrow('valid semver');
  });

  it('derives the publish channel from package semver and requires an exact tag match', () => {
    expect(
      resolveReleaseMetadata({
        version: '2.0.0-next.0',
        refName: 'v2.0.0-next.0',
        eventName: 'push',
      }),
    ).toEqual({ releaseChannel: 'next', distTag: 'next' });
    expect(
      resolveReleaseMetadata({
        version: '2.0.0',
        refName: 'v2.0.0',
        eventName: 'push',
      }),
    ).toEqual({ releaseChannel: 'latest', distTag: 'latest' });
    expect(
      resolveReleaseMetadata({
        version: '2.0.0-next.0',
        refName: 'main',
        eventName: 'workflow_dispatch',
      }),
    ).toEqual({ releaseChannel: 'next', distTag: 'next' });
    expect(() =>
      resolveReleaseMetadata({
        version: '2.0.0-next.0',
        refName: 'v2.0.0',
        eventName: 'push',
      }),
    ).toThrow('does not match package version');
  });

  it('preserves the v1 next CI lane while deriving the v2 CI channel from package semver', () => {
    expect(resolveCiReleaseMetadata('1.11.4')).toEqual({
      releaseChannel: 'next',
      distTag: 'next',
    });
    expect(resolveCiReleaseMetadata('2.0.0-next.0')).toEqual({
      releaseChannel: 'next',
      distTag: 'next',
    });
    expect(resolveCiReleaseMetadata('2.0.0')).toEqual({
      releaseChannel: 'latest',
      distTag: 'latest',
    });
  });

  it('packs once and runs all seven v2 projects against the same tarball even when HAP is skipped', async () => {
    const harness = createHarness();

    await executeReleaseSmoke(harness.options);

    expect(harness.getPackCount()).toBe(1);
    expect(harness.materialized).toHaveLength(7);
    expect(harness.materialized.map(({ target }) => path.basename(target))).toEqual(
      V2_SAMPLE_PROJECTS.map(({ id }) => id),
    );

    const sampleAddCalls = harness.commandCalls.filter(
      ({ args, cwd }) => args.includes('add') && path.basename(cwd) !== 'consumer-audit',
    );
    expect(sampleAddCalls).toHaveLength(7);
    expect(new Set(sampleAddCalls.map(({ args }) => args[args.length - 1]))).toEqual(
      new Set(['/tmp/eht-release-gate-test/expo-harmony-toolkit-2.0.0-next.0.tgz']),
    );
    expect(harness.commandCalls.filter(({ args }) => args.includes('doctor'))).toHaveLength(7);
    expect(harness.commandCalls.filter(({ args }) => args.includes('init'))).toHaveLength(7);
    expect(harness.commandCalls.filter(({ args }) => args.includes('sync-template'))).toHaveLength(14);
    expect(harness.commandCalls.filter(({ args }) => args.includes('bundle'))).toHaveLength(7);
    expect(harness.commandCalls.filter(({ args }) => args.includes('build-hap'))).toHaveLength(0);
    const auditCalls = harness.commandCalls.filter(({ args }) => args.includes('audit'));
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.acceptableExitCodes).toEqual([0, 1]);
    expect(harness.writtenJson[0]?.filePath).toBe(
      '/tmp/eht-release-gate-test/consumer-audit/package.json',
    );
    const consumerInstallCall = harness.commandCalls.find(
      ({ args, cwd }) => args.includes('add') && path.basename(cwd) === 'consumer-audit',
    );
    expect(consumerInstallCall?.args[consumerInstallCall.args.length - 1]).toBe(
      '/tmp/eht-release-gate-test/expo-harmony-toolkit-2.0.0-next.0.tgz',
    );
  });

  it('blocks v2 before the sample matrix when the packed consumer graph contains a critical advisory', async () => {
    const harness = createHarness({
      consumerAuditReport: {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 1,
          },
        },
      },
    });

    await expect(executeReleaseSmoke(harness.options)).rejects.toThrow(
      '[consumer-audit:audit-validate]',
    );
    expect(harness.materialized).toHaveLength(0);
    expect(harness.removed).toContain('/tmp/eht-release-gate-test');
  });

  it('runs a debug HAP for every v2 project when the HAP stage is available', async () => {
    const projects = V2_SAMPLE_PROJECTS.slice(0, 2);
    const harness = createHarness({ projects });

    await executeReleaseSmoke({
      ...harness.options,
      skipHap: false,
    });

    const hapCalls = harness.commandCalls.filter(({ args }) => args.includes('build-hap'));
    expect(hapCalls).toHaveLength(projects.length);
    expect(hapCalls.every(({ args }) => args.includes('debug'))).toBe(true);
  });

  it('keeps the v1 next smoke on its single preview sample', async () => {
    const harness = createHarness({ projects: [] });

    await executeReleaseSmoke({
      ...harness.options,
      version: '1.11.4',
    });

    expect(harness.getPackCount()).toBe(1);
    expect(harness.materialized).toEqual([
      {
        source: '/repo/examples/official-native-capabilities-sample',
        target: '/tmp/eht-release-gate-test/sample',
      },
    ]);
    expect(
      harness.commandCalls.some(
        ({ args }) =>
          args.includes('doctor') &&
          args.includes('--target-tier') &&
          args.includes('preview'),
      ),
    ).toBe(true);
    expect(harness.commandCalls.some(({ args }) => args.includes('audit'))).toBe(false);
  });

  it('fails when doctor exits successfully but its parsed eligibility differs from the manifest', async () => {
    const project = V2_SAMPLE_PROJECTS[0];
    const harness = createHarness({
      projects: [project],
      doctorReport: () => ({
        targetTier: project.targetTier,
        coverageProfile: project.expectedCoverageProfile,
        eligibility: 'ineligible',
      }),
    });

    await expect(executeReleaseSmoke(harness.options)).rejects.toThrow(
      '[official-minimal:doctor-validate]',
    );
  });

  it('fails with project context when the second forced sync still writes or skips files', async () => {
    const project = V2_SAMPLE_PROJECTS[0];
    const harness = createHarness({
      projects: [project],
      secondSyncOutput: '- written: 1\n- unchanged: 17\n- skipped: 0\n',
    });

    await expect(executeReleaseSmoke(harness.options)).rejects.toThrow(
      '[official-minimal:second-sync-validate]',
    );
  });

  it('cleans the temporary workspace and tarball after a project failure', async () => {
    const project = V2_SAMPLE_PROJECTS[0];
    const harness = createHarness({
      projects: [project],
      doctorReport: () => ({
        targetTier: project.targetTier,
        coverageProfile: 'wrong-profile',
        eligibility: project.expectedEligibility,
      }),
    });

    await expect(executeReleaseSmoke(harness.options)).rejects.toThrow('doctor-validate');
    expect(harness.removed).toEqual(
      expect.arrayContaining(['/tmp/eht-release-gate-test']),
    );
  });

  it('cleans the temporary workspace when pack validation fails after creating an artifact', async () => {
    const harness = createHarness({
      createTarball: async () => {
        throw new Error('Tarball contains unexpected files');
      },
    });

    await expect(executeReleaseSmoke(harness.options)).rejects.toThrow(
      'Tarball contains unexpected files',
    );
    expect(harness.removed).toEqual(['/tmp/eht-release-gate-test']);
    expect(harness.materialized).toHaveLength(0);
  });

  it('keeps the neutral hosted release gate and tag publishing on the same gate without shell execution', async () => {
    const repoRoot = path.join(__dirname, '..');
    const [ciWorkflow, releaseWorkflow, releaseCheck, releaseChannel] = await Promise.all([
      fs.readFile(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8'),
      fs.readFile(path.join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8'),
      fs.readFile(path.join(repoRoot, 'scripts', 'release-check.js'), 'utf8'),
      fs.readFile(path.join(repoRoot, 'scripts', 'release-channel.js'), 'utf8'),
    ]);

    expect(ciWorkflow).toContain('EXPO_HARMONY_RELEASE_SKIP_HAP');
    expect(ciWorkflow).toContain('run: pnpm release:check');
    expect(ciWorkflow).toMatch(/^  release-gate:$/m);
    expect(ciWorkflow).toContain('node scripts/release-channel.js --ci-gate');
    expect(ciWorkflow).toContain('- name: Release Gate');
    expect(ciWorkflow).not.toContain('next-lane:');
    expect(ciWorkflow).not.toContain('--ci-next');
    expect(ciWorkflow).not.toContain('- name: Next Release Gate');
    expect(ciWorkflow).toContain(
      'EXPO_HARMONY_RELEASE_CHANNEL: ${{ steps.channel.outputs.release_channel }}',
    );
    expect(ciWorkflow).not.toContain('EXPO_HARMONY_RELEASE_CHANNEL: next');
    expect(releaseWorkflow).toContain('run: pnpm release:check');
    expect(releaseWorkflow).toContain('node scripts/release-channel.js');
    expect(releaseWorkflow.indexOf('- name: Install')).toBeLessThan(
      releaseWorkflow.indexOf('- name: Resolve release channel'),
    );
    expect(releaseCheck).toContain('shell: false');
    expect(releaseCheck).not.toContain('shell: true');
    expect(releaseChannel).toContain("args[0] === '--ci-gate'");
    expect(releaseChannel).not.toContain('--ci-next');
  });
});
