#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('fs-extra');
const path = require('node:path');
const {
  parseJsonArrayFromMixedOutput,
  runPack,
  validatePackArtifacts,
} = require('./pack');
const { executeReleaseSmoke, selectReleaseMode } = require('./release-gate');
const { resolveReleaseMetadata } = require('./release-channel');
const { materializeSampleWorkspace } = require('./sample-workspace');
const { V2_SAMPLE_LANE_GROUPS, V2_SAMPLE_PROJECTS } = require('./v2-sample-lanes');

const repoRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(repoRoot, 'package.json'));
const releaseChannel = process.env.EXPO_HARMONY_RELEASE_CHANNEL === 'next' ? 'next' : 'latest';
const legacySampleRoot = path.resolve(
  process.env.EXPO_HARMONY_RELEASE_SMOKE_SAMPLE ??
    path.join(
      repoRoot,
      'examples',
      releaseChannel === 'next'
        ? 'official-native-capabilities-sample'
        : 'official-ui-stack-sample',
    ),
);
const skipHap = process.env.EXPO_HARMONY_RELEASE_SKIP_HAP === '1';
const smokeTempRootBase = path.resolve(process.env.EXPO_HARMONY_RELEASE_SMOKE_TEMP_ROOT ?? '/tmp');
const smokeTempPrefix = 'eht-smoke-';

function createProcessRunner() {
  return async function runCommand(file, args, options = {}) {
    const acceptableExitCodes = options.acceptableExitCodes ?? [0];
    const result = spawnSync(file, args, {
      cwd: options.cwd ?? repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...options.env,
      },
      maxBuffer: 20 * 1024 * 1024,
      shell: false,
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error) {
      throw result.error;
    }
    if (!acceptableExitCodes.includes(result.status)) {
      throw new Error(`${file} ${args.join(' ')} exited with status ${String(result.status)}.`);
    }

    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  };
}

async function createTarball(tempRoot) {
  const packOutput = runPack(['--json', '--pack-destination', tempRoot]).trim();
  const packArtifacts = parseJsonArrayFromMixedOutput(packOutput);
  validatePackArtifacts(packArtifacts);
  const tarballFilename = packArtifacts[0]?.filename;

  if (packArtifacts.length !== 1 || !tarballFilename) {
    throw new Error('npm pack did not return a tarball filename.');
  }
  if (
    tarballFilename !== path.basename(tarballFilename) ||
    tarballFilename !== path.win32.basename(tarballFilename)
  ) {
    throw new Error(`npm pack returned a non-portable tarball filename: ${tarballFilename}.`);
  }

  return path.join(tempRoot, tarballFilename);
}

async function createTempRoot() {
  await fs.ensureDir(smokeTempRootBase);
  return fs.mkdtemp(path.join(smokeTempRootBase, smokeTempPrefix));
}

async function main() {
  const runCommand = createProcessRunner();
  const releaseMode = selectReleaseMode(packageJson.version);

  if (releaseMode === 'v2') {
    const expectedChannel = resolveReleaseMetadata({
      version: packageJson.version,
      refName: '',
      eventName: 'workflow_dispatch',
    }).releaseChannel;

    if (releaseChannel !== expectedChannel) {
      throw new Error(
        `EXPO_HARMONY_RELEASE_CHANNEL=${releaseChannel} does not match package version ${packageJson.version}; expected ${expectedChannel}.`,
      );
    }
  }

  if (
    releaseMode === 'v2' &&
    (V2_SAMPLE_LANE_GROUPS.length !== 5 || V2_SAMPLE_PROJECTS.length !== 7)
  ) {
    throw new Error(
      `Expected the v2 manifest to contain 5 lane groups and 7 projects; received ${V2_SAMPLE_LANE_GROUPS.length} groups and ${V2_SAMPLE_PROJECTS.length} projects.`,
    );
  }

  await runCommand('pnpm', ['build']);
  await runCommand('pnpm', ['test']);
  await executeReleaseSmoke({
    version: packageJson.version,
    repoRoot,
    releaseChannel,
    skipHap,
    v2Projects: V2_SAMPLE_PROJECTS,
    legacySampleRoot,
    createTarball,
    createTempRoot,
    materializeSample: materializeSampleWorkspace,
    runCommand,
    readFile: (filePath) => fs.readFile(filePath, 'utf8'),
    removePath: (target) => fs.remove(target),
    writeJson: (filePath, value) => fs.outputJson(filePath, value, { spaces: 2 }),
  });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createProcessRunner,
  createTarball,
  main,
};
