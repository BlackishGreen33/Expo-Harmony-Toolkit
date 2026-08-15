const path = require('node:path');
const semver = require('semver');

const BUNDLE_RELATIVE_PATH = path.join(
  'harmony',
  'entry',
  'src',
  'main',
  'resources',
  'rawfile',
  'bundle.harmony.js',
);

function selectReleaseMode(version) {
  const parsedVersion = semver.parse(version);

  if (!parsedVersion) {
    throw new Error(`Package version ${version} is not valid semver.`);
  }

  return parsedVersion.major >= 2 ? 'v2' : 'v1';
}

function validateDoctorReport(project, rawOutput) {
  let report;

  try {
    report = JSON.parse(rawOutput.trim());
  } catch (error) {
    throw new Error(`Doctor stdout is not valid JSON: ${formatError(error)}`);
  }

  const expectedFields = {
    targetTier: project.targetTier,
    coverageProfile: project.expectedCoverageProfile,
    eligibility: project.expectedEligibility,
  };
  const mismatches = Object.entries(expectedFields)
    .filter(([field, expected]) => report?.[field] !== expected)
    .map(([field, expected]) => `${field}: expected ${expected}, received ${String(report?.[field])}`);

  if (mismatches.length > 0) {
    throw new Error(`Doctor report does not match the sample manifest:\n${mismatches.join('\n')}`);
  }

  return report;
}

function parseSyncSummary(rawOutput) {
  const writtenMatch = rawOutput.match(/^- written:\s*(\d+)\s*$/m);
  const skippedMatch = rawOutput.match(/^- skipped:\s*(\d+)\s*$/m);

  if (!writtenMatch || !skippedMatch) {
    throw new Error('Sync stdout does not contain numeric written and skipped summaries.');
  }

  return {
    written: Number(writtenMatch[1]),
    skipped: Number(skippedMatch[1]),
  };
}

async function executeReleaseSmoke(options) {
  const releaseMode = selectReleaseMode(options.version);
  let tempRoot;

  try {
    tempRoot = await options.createTempRoot();
    const tarballPath = await options.createTarball(tempRoot);

    if (releaseMode === 'v2') {
      await auditPackedConsumer({
        ...options,
        tarballPath,
        tempRoot,
      });
      await runV2PortableMatrix({
        ...options,
        tarballPath,
        tempRoot,
      });
      return;
    }

    await runLegacySmoke({
      ...options,
      tarballPath,
      tempRoot,
    });
  } finally {
    if (tempRoot) {
      await options.removePath(tempRoot);
    }
  }
}

async function auditPackedConsumer(options) {
  const project = { id: 'consumer-audit' };
  const consumerRoot = path.join(options.tempRoot, project.id);

  await runProjectStage(project, 'materialize', () =>
    options.writeJson(path.join(consumerRoot, 'package.json'), {
      name: 'expo-harmony-toolkit-release-consumer',
      version: '0.0.0',
      private: true,
    }),
  );
  await runProjectStage(project, 'install-tarball', () =>
    options.runCommand(
      'pnpm',
      ['add', '--ignore-scripts', '--save-exact', options.tarballPath],
      { cwd: consumerRoot },
    ),
  );
  const auditResult = await runProjectStage(project, 'audit', () =>
    options.runCommand('pnpm', ['audit', '--prod', '--json'], {
      cwd: consumerRoot,
      acceptableExitCodes: [0, 1],
    }),
  );
  await runProjectStage(project, 'audit-validate', () =>
    validateConsumerAuditReport(auditResult.stdout),
  );
}

function validateConsumerAuditReport(rawOutput) {
  let report;

  try {
    report = JSON.parse(rawOutput.trim());
  } catch (error) {
    throw new Error(`Audit stdout is not valid JSON: ${formatError(error)}`);
  }

  const critical = report?.metadata?.vulnerabilities?.critical;

  if (!Number.isInteger(critical) || critical < 0) {
    throw new Error('Audit report does not contain a non-negative critical vulnerability count.');
  }

  if (critical > 0) {
    throw new Error(`Packed consumer dependency graph contains ${critical} critical advisories.`);
  }

  return report;
}

async function runV2PortableMatrix(options) {
  for (const project of options.v2Projects) {
    const sourceRoot = path.resolve(options.repoRoot, project.root);
    const projectRoot = path.join(options.tempRoot, project.id);

    await runProjectStage(project, 'materialize', () =>
      options.materializeSample(sourceRoot, projectRoot),
    );
    await runProjectStage(project, 'install-tarball', () =>
      options.runCommand(
        'pnpm',
        ['add', '--ignore-scripts', '--save-dev', options.tarballPath],
        { cwd: projectRoot },
      ),
    );

    const doctorResult = await runProjectStage(project, 'doctor', () =>
      options.runCommand(
        'pnpm',
        [
          'exec',
          'expo-harmony',
          'doctor',
          '--project-root',
          '.',
          '--target-tier',
          project.targetTier,
          '--json',
        ],
        { cwd: projectRoot },
      ),
    );
    await runProjectStage(project, 'doctor-validate', () =>
      validateDoctorReport(project, doctorResult.stdout),
    );
    await runProjectStage(project, 'init', () =>
      options.runCommand(
        'pnpm',
        ['exec', 'expo-harmony', 'init', '--project-root', '.', '--force'],
        { cwd: projectRoot },
      ),
    );
    await runProjectStage(project, 'first-sync', () =>
      options.runCommand(
        'pnpm',
        ['exec', 'expo-harmony', 'sync-template', '--project-root', '.', '--force'],
        { cwd: projectRoot },
      ),
    );
    const secondSyncResult = await runProjectStage(project, 'second-sync', () =>
      options.runCommand(
        'pnpm',
        ['exec', 'expo-harmony', 'sync-template', '--project-root', '.', '--force'],
        { cwd: projectRoot },
      ),
    );
    await runProjectStage(project, 'second-sync-validate', () => {
      const summary = parseSyncSummary(secondSyncResult.stdout);

      if (summary.written !== 0 || summary.skipped !== 0) {
        throw new Error(
          `Second forced sync must be idempotent; received written=${summary.written}, skipped=${summary.skipped}.`,
        );
      }
    });
    await runProjectStage(project, 'bundle', () =>
      options.runCommand(
        'pnpm',
        ['exec', 'expo-harmony', 'bundle', '--project-root', '.'],
        { cwd: projectRoot },
      ),
    );
    await runProjectStage(project, 'bundle-marker', async () => {
      const bundleContents = await options.readFile(path.join(projectRoot, BUNDLE_RELATIVE_PATH));

      if (!bundleContents.includes(project.marker)) {
        throw new Error(`Bundle does not contain ${project.marker}.`);
      }
    });

    if (!options.skipHap) {
      await runProjectStage(project, 'debug-hap', () =>
        options.runCommand(
          'pnpm',
          [
            'exec',
            'expo-harmony',
            'build-hap',
            '--project-root',
            '.',
            '--mode',
            'debug',
          ],
          { cwd: projectRoot },
        ),
      );
    }
  }
}

async function runLegacySmoke(options) {
  const project = { id: 'legacy-smoke' };
  const projectRoot = path.join(options.tempRoot, 'sample');
  const doctorArgs =
    options.releaseChannel === 'next'
      ? ['doctor', '--project-root', '.', '--target-tier', 'preview']
      : ['doctor', '--project-root', '.', '--strict'];

  await runProjectStage(project, 'materialize', () =>
    options.materializeSample(options.legacySampleRoot, projectRoot),
  );
  await runProjectStage(project, 'install-tarball', () =>
    options.runCommand(
      'pnpm',
      ['add', '--ignore-scripts', '--save-dev', options.tarballPath],
      { cwd: projectRoot },
    ),
  );
  await runProjectStage(project, 'doctor', () =>
    options.runCommand('pnpm', ['exec', 'expo-harmony', ...doctorArgs], { cwd: projectRoot }),
  );
  await runProjectStage(project, 'init', () =>
    options.runCommand(
      'pnpm',
      ['exec', 'expo-harmony', 'init', '--project-root', '.', '--force'],
      { cwd: projectRoot },
    ),
  );
  await runProjectStage(project, 'bundle', () =>
    options.runCommand(
      'pnpm',
      ['exec', 'expo-harmony', 'bundle', '--project-root', '.'],
      { cwd: projectRoot },
    ),
  );

  if (!options.skipHap) {
    await runProjectStage(project, 'debug-hap', () =>
      options.runCommand(
        'pnpm',
        ['exec', 'expo-harmony', 'build-hap', '--project-root', '.', '--mode', 'debug'],
        { cwd: projectRoot },
      ),
    );
  }
}

async function runProjectStage(project, stage, action) {
  try {
    return await action();
  } catch (error) {
    throw new Error(`[${project.id}:${stage}] ${formatError(error)}`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  BUNDLE_RELATIVE_PATH,
  auditPackedConsumer,
  executeReleaseSmoke,
  parseSyncSummary,
  runV2PortableMatrix,
  selectReleaseMode,
  validateConsumerAuditReport,
  validateDoctorReport,
};
