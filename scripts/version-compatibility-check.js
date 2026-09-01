#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sampleRoot = path.join(repoRoot, 'examples', 'official-minimal-sample');
const cliPath = path.join(repoRoot, 'bin', 'expo-harmony.js');
const matrices = [
  {
    sdk: 55,
    expo: '55.0.31',
    react: '19.2.0',
    reactNative: '0.83.10',
    id: 'expo55-rn083-rnoh082-preview',
  },
  {
    sdk: 56,
    expo: '56.0.21',
    react: '19.2.3',
    reactNative: '0.85.3',
    id: 'expo56-rn085-rnoh082-preview',
  },
  {
    sdk: 57,
    expo: '57.0.19',
    react: '19.2.3',
    reactNative: '0.86.3',
    id: 'expo57-rn086-rnoh082-preview',
  },
];

function run(file, args, cwd) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${file} ${args.join(' ')} failed for ${cwd}.`,
        result.error?.message,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  return result.stdout;
}

async function materializeProject(tempRoot, matrix) {
  const projectRoot = path.join(tempRoot, `sdk-${matrix.sdk}`);
  await fs.copy(sampleRoot, projectRoot, {
    filter: (source) => path.basename(source) !== 'node_modules',
  });
  await Promise.all(
    ['harmony', '.expo-harmony', 'index.harmony.js', 'metro.harmony.config.js'].map(
      (relativePath) => fs.remove(path.join(projectRoot, relativePath)),
    ),
  );

  const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
  packageJson.name = `expo-harmony-sdk-${matrix.sdk}-compat-smoke`;
  packageJson.packageManager = 'pnpm@10.32.1';
  packageJson.dependencies = {
    '@babel/runtime': '^7.28.4',
    '@expo/metro-runtime': `^${matrix.sdk}.0.0`,
    '@react-native-oh/react-native-harmony': '0.82.29',
    '@react-native-oh/react-native-harmony-cli': '0.82.29',
    expo: matrix.expo,
    'expo-constants': `^${matrix.sdk}.0.0`,
    'expo-status-bar': '>=3.0.0 <4.0.0',
    react: matrix.react,
    'react-dom': matrix.react,
    'react-native': matrix.reactNative,
  };
  packageJson.devDependencies = {
    '@react-native-community/cli': '^20.1.2',
    metro: '^0.83.1',
  };
  await fs.writeJson(path.join(projectRoot, 'package.json'), packageJson, { spaces: 2 });

  return projectRoot;
}

async function main() {
  const tempBase = process.platform === 'darwin' ? '/tmp' : os.tmpdir();
  const tempRoot = await fs.mkdtemp(path.join(tempBase, 'eht-compat-'));

  try {
    for (const matrix of matrices) {
      const projectRoot = await materializeProject(tempRoot, matrix);
      run(
        'pnpm',
        ['install', '--ignore-scripts', '--no-frozen-lockfile', '--strict-peer-dependencies=false'],
        projectRoot,
      );
      const report = JSON.parse(
        run(
          process.execPath,
          [cliPath, 'doctor', '--project-root', '.', '--target-tier', 'preview', '--json'],
          projectRoot,
        ).trim(),
      );

      if (
        report.matrixId !== matrix.id ||
        report.matrixSupportTier !== 'preview' ||
        report.eligibility !== 'eligible'
      ) {
        throw new Error(`Expo SDK ${matrix.sdk} doctor report did not select ${matrix.id}.`);
      }

      run(process.execPath, [cliPath, 'init', '--project-root', '.', '--force'], projectRoot);
      run(process.execPath, [cliPath, 'bundle', '--project-root', '.'], projectRoot);

      const manifest = await fs.readJson(
        path.join(projectRoot, '.expo-harmony', 'manifest.json'),
      );
      const bundlePath = path.join(
        projectRoot,
        'harmony',
        'entry',
        'src',
        'main',
        'resources',
        'rawfile',
        'bundle.harmony.js',
      );
      if (manifest.matrixId !== matrix.id || !(await fs.pathExists(bundlePath))) {
        throw new Error(`Expo SDK ${matrix.sdk} did not produce ${matrix.id} bundle metadata.`);
      }

      if (process.env.EXPO_HARMONY_COMPAT_BUILD_HAP === '1') {
        run(
          process.execPath,
          [cliPath, 'build-hap', '--project-root', '.', '--mode', 'debug'],
          projectRoot,
        );
      }

      const checks =
        process.env.EXPO_HARMONY_COMPAT_BUILD_HAP === '1'
          ? 'doctor/init/bundle/build-hap'
          : 'doctor/init/bundle';
      process.stdout.write(`Expo SDK ${matrix.sdk}: ${matrix.id} ${checks} passed.\n`);
    }
  } finally {
    await fs.remove(tempRoot);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, matrices };
