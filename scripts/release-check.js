#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('fs-extra');
const path = require('node:path');
const {
  FORBIDDEN_TARBALL_PREFIXES,
  packDryRunArtifacts,
  parseJsonArrayFromMixedOutput,
  runPack,
  validatePackArtifacts,
} = require('./pack');
const { materializeSampleWorkspace } = require('./sample-workspace');

const repoRoot = path.resolve(__dirname, '..');
const releaseChannel = process.env.EXPO_HARMONY_RELEASE_CHANNEL === 'next' ? 'next' : 'latest';
const smokeSampleRoot = path.resolve(
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
const smokeSampleDirName = 'sample';
const doctorArgs =
  releaseChannel === 'next'
    ? ['doctor', '--project-root', '.', '--target-tier', 'preview']
    : ['doctor', '--project-root', '.', '--strict'];

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stdout.write(result.stdout ?? '');
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

async function main() {
  run('pnpm', ['build']);
  run('pnpm', ['test']);
  const dryRunArtifacts = packDryRunArtifacts();
  const dryRunFiles = dryRunArtifacts[0]?.files ?? [];

  for (const file of dryRunFiles) {
    const filePath = file.path ?? '';

    if (FORBIDDEN_TARBALL_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
      throw new Error(`Tarball should not include ${filePath}.`);
    }
  }

  const packOutput = runPack(['--json'])
    .trim()
  const packArtifacts = parseJsonArrayFromMixedOutput(packOutput);
  validatePackArtifacts(packArtifacts);
  const tarballFilename = packArtifacts[0]?.filename;

  if (!tarballFilename) {
    throw new Error('npm pack did not return a tarball filename.');
  }

  const tarballPath = path.join(repoRoot, tarballFilename);
  await fs.ensureDir(smokeTempRootBase);
  const tempRoot = await fs.mkdtemp(path.join(smokeTempRootBase, smokeTempPrefix));
  const tempSampleRoot = path.join(tempRoot, smokeSampleDirName);
  try {
    await materializeSampleWorkspace(smokeSampleRoot, tempSampleRoot);
    run('pnpm', ['add', '--ignore-scripts', '--save-dev', tarballPath], {
      cwd: tempSampleRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });
    run('pnpm', ['exec', 'expo-harmony', ...doctorArgs], {
      cwd: tempSampleRoot,
    });
    run('pnpm', ['exec', 'expo-harmony', 'init', '--project-root', '.', '--force'], {
      cwd: tempSampleRoot,
    });
    run('pnpm', ['exec', 'expo-harmony', 'bundle', '--project-root', '.'], {
      cwd: tempSampleRoot,
    });

    if (!skipHap) {
      run('pnpm', ['exec', 'expo-harmony', 'build-hap', '--project-root', '.', '--mode', 'debug'], {
        cwd: tempSampleRoot,
      });
    }
  } finally {
    await fs.remove(tempRoot);
    await fs.remove(tarballPath);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
