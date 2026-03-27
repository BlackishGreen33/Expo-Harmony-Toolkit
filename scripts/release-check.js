#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const smokeSampleRoot = path.resolve(
  process.env.EXPO_HARMONY_RELEASE_SMOKE_SAMPLE ??
    path.join(repoRoot, 'examples', 'official-ui-stack-sample'),
);
const skipHap = process.env.EXPO_HARMONY_RELEASE_SKIP_HAP === '1';
const forbiddenTarballPrefixes = ['examples/', 'fixtures/', 'tests/'];
const packEnv = {
  ...process.env,
  npm_config_ignore_scripts: 'true',
};

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

function parseJsonArrayFromMixedOutput(rawOutput) {
  const jsonStart = rawOutput.indexOf('[');
  const jsonEnd = rawOutput.lastIndexOf(']');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Expected npm pack --json output to contain a JSON array.');
  }

  return JSON.parse(rawOutput.slice(jsonStart, jsonEnd + 1));
}

function shouldCopySample(source) {
  return (
    !source.includes(`${path.sep}node_modules${path.sep}`) &&
    !source.endsWith(`${path.sep}node_modules`) &&
    !source.includes(`${path.sep}harmony${path.sep}`) &&
    !source.endsWith(`${path.sep}harmony`) &&
    !source.includes(`${path.sep}.expo-harmony${path.sep}`) &&
    !source.endsWith(`${path.sep}.expo-harmony`) &&
    !source.endsWith(`${path.sep}index.harmony.js`) &&
    !source.endsWith(`${path.sep}metro.harmony.config.js`)
  );
}

async function main() {
  run('pnpm', ['build']);
  run('pnpm', ['test']);
  run('npm', ['pack', '--dry-run'], {
    env: packEnv,
  });

  const dryRunArtifacts = parseJsonArrayFromMixedOutput(
    runCapture('npm', ['pack', '--json', '--dry-run'], {
      env: packEnv,
    }).trim(),
  );
  const dryRunFiles = dryRunArtifacts[0]?.files ?? [];

  for (const file of dryRunFiles) {
    const filePath = file.path ?? '';

    if (forbiddenTarballPrefixes.some((prefix) => filePath.startsWith(prefix))) {
      throw new Error(`Tarball should not include ${filePath}.`);
    }
  }

  const packOutput = runCapture('npm', ['pack'], {
    env: packEnv,
  })
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tarballFilename = [...packOutput].reverse().find((line) => line.endsWith('.tgz'));

  if (!tarballFilename) {
    throw new Error('npm pack did not return a tarball filename.');
  }

  const tarballPath = path.join(repoRoot, tarballFilename);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-release-smoke-'));
  const tempSampleRoot = path.join(tempRoot, path.basename(smokeSampleRoot));

  try {
    await fs.copy(smokeSampleRoot, tempSampleRoot, {
      filter: shouldCopySample,
    });

    run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], {
      cwd: tempSampleRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });
    run('pnpm', ['add', '--ignore-scripts', '--save-dev', tarballPath], {
      cwd: tempSampleRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });
    run('pnpm', ['exec', 'expo-harmony', 'doctor', '--project-root', '.', '--strict'], {
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
