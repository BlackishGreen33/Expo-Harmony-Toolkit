#!/usr/bin/env node

const path = require('node:path');
const semver = require('semver');

const repoRoot = path.resolve(__dirname, '..');

function resolveReleaseMetadata({ version, refName, eventName }) {
  const parsedVersion = parsePackageVersion(version);

  if (eventName === 'push') {
    const expectedRefName = `v${version}`;

    if (refName !== expectedRefName) {
      throw new Error(
        `Release tag ${refName || '(missing)'} does not match package version ${version}; expected ${expectedRefName}.`,
      );
    }
  } else if (eventName !== 'workflow_dispatch') {
    throw new Error(`Unsupported release event ${eventName || '(missing)'}.`);
  }

  return createReleaseMetadata(parsedVersion.prerelease.length > 0 ? 'next' : 'latest');
}

function resolveCiReleaseMetadata(version) {
  const parsedVersion = parsePackageVersion(version);
  const channel =
    parsedVersion.major < 2 || parsedVersion.prerelease.length > 0 ? 'next' : 'latest';

  return createReleaseMetadata(channel);
}

function parsePackageVersion(version) {
  const parsedVersion = semver.parse(version);

  if (!parsedVersion) {
    throw new Error(`Package version ${version} is not valid semver.`);
  }

  return parsedVersion;
}

function createReleaseMetadata(channel) {
  return {
    releaseChannel: channel,
    distTag: channel,
  };
}

function main() {
  const packageJson = require(path.join(repoRoot, 'package.json'));
  const args = process.argv.slice(2);

  if (args.length > 1 || (args.length === 1 && args[0] !== '--ci-gate')) {
    throw new Error('Usage: node scripts/release-channel.js [--ci-gate]');
  }

  const metadata =
    args[0] === '--ci-gate'
      ? resolveCiReleaseMetadata(packageJson.version)
      : resolveReleaseMetadata({
          version: packageJson.version,
          refName: process.env.GITHUB_REF_NAME ?? '',
          eventName: process.env.GITHUB_EVENT_NAME ?? '',
        });

  process.stdout.write(
    `release_channel=${metadata.releaseChannel}\ndist_tag=${metadata.distTag}\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  resolveCiReleaseMetadata,
  resolveReleaseMetadata,
};
