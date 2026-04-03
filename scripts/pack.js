#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const PACK_CACHE_DIR = path.join('/tmp', 'expo-harmony-npm-cache');
const PUBLIC_TARBALL_DOC_FILES = [
  'docs/cli-build.md',
  'docs/npm-release.md',
  'docs/official-app-shell-sample.md',
  'docs/official-minimal-sample.md',
  'docs/official-native-capabilities-sample.md',
  'docs/official-ui-stack-sample.md',
  'docs/roadmap.md',
  'docs/signing-and-release.md',
  'docs/support-matrix.md',
];
const FORBIDDEN_TARBALL_PREFIXES = ['acceptance/', 'examples/', 'fixtures/', 'tests/'];

function getPackEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    npm_config_ignore_scripts: 'true',
    NPM_CONFIG_CACHE: baseEnv.NPM_CONFIG_CACHE ?? PACK_CACHE_DIR,
  };
}

function runPack(args, options = {}) {
  const result = spawnSync('npm', ['pack', ...args], {
    cwd: options.cwd ?? repoRoot,
    env: getPackEnv({
      ...process.env,
      ...options.env,
    }),
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    const error = new Error(result.stderr ?? result.stdout ?? 'npm pack failed.');
    error.stdout = result.stdout ?? '';
    error.stderr = result.stderr ?? '';
    error.exitCode = result.status ?? 1;
    throw error;
  }

  return result.stdout ?? '';
}

function parseJsonArrayFromMixedOutput(rawOutput) {
  const jsonStart = rawOutput.indexOf('[');
  const jsonEnd = rawOutput.lastIndexOf(']');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Expected npm pack --json output to contain a JSON array.');
  }

  return JSON.parse(rawOutput.slice(jsonStart, jsonEnd + 1));
}

function listSourceFiles(currentPath) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(nextPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(nextPath);
    }
  }

  return files;
}

function getExpectedBuildFilePaths() {
  const sourceRoot = path.join(repoRoot, 'src');
  const expectedPaths = new Set();

  for (const sourcePath of listSourceFiles(sourceRoot)) {
    const relativeSourcePath = path.relative(sourceRoot, sourcePath);
    const buildBasePath = relativeSourcePath.replace(/\.ts$/, '');
    expectedPaths.add(`build/${buildBasePath}.js`.split(path.sep).join('/'));
    expectedPaths.add(`build/${buildBasePath}.d.ts`.split(path.sep).join('/'));
  }

  return expectedPaths;
}

function getUnexpectedTarballFiles(files) {
  const expectedBuildFilePaths = getExpectedBuildFilePaths();
  const publicDocFiles = new Set(PUBLIC_TARBALL_DOC_FILES);
  const unexpectedPaths = [];

  for (const file of files) {
    const filePath = (file.path ?? '').split(path.sep).join('/');

    if (FORBIDDEN_TARBALL_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
      unexpectedPaths.push(filePath);
      continue;
    }

    if (filePath.startsWith('docs/') && !publicDocFiles.has(filePath)) {
      unexpectedPaths.push(filePath);
      continue;
    }

    if (filePath.startsWith('build/') && !expectedBuildFilePaths.has(filePath)) {
      unexpectedPaths.push(filePath);
    }
  }

  return unexpectedPaths.sort((left, right) => left.localeCompare(right));
}

function validatePackArtifacts(artifacts) {
  const tarballFiles = artifacts[0]?.files ?? [];
  const unexpectedPaths = getUnexpectedTarballFiles(tarballFiles);

  if (unexpectedPaths.length > 0) {
    throw new Error(
      `Tarball contains unexpected files:\n${unexpectedPaths.map((filePath) => `- ${filePath}`).join('\n')}`,
    );
  }
}

function packDryRunArtifacts(options = {}) {
  const rawOutput = runPack(['--json', '--dry-run'], options).trim();
  const artifacts = parseJsonArrayFromMixedOutput(rawOutput);
  validatePackArtifacts(artifacts);
  return artifacts;
}

module.exports = {
  FORBIDDEN_TARBALL_PREFIXES,
  PACK_CACHE_DIR,
  PUBLIC_TARBALL_DOC_FILES,
  getExpectedBuildFilePaths,
  getPackEnv,
  getUnexpectedTarballFiles,
  packDryRunArtifacts,
  parseJsonArrayFromMixedOutput,
  runPack,
  validatePackArtifacts,
};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const rawOutput = runPack(args);

    if (args.includes('--json')) {
      const artifacts = parseJsonArrayFromMixedOutput(rawOutput.trim());
      validatePackArtifacts(artifacts);
    }

    process.stdout.write(rawOutput);
  } catch (error) {
    const packError = error;
    process.stderr.write(String(packError.stderr ?? packError.message ?? error));
    if (packError.stdout) {
      process.stdout.write(String(packError.stdout));
    }
    process.exit(packError.exitCode ?? 1);
  }
}
