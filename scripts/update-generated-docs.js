#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const render = require(path.join(repoRoot, 'build', 'docs', 'render.js'));

function replaceGeneratedBlock(contents, markerName, nextContent) {
  const startMarker = `<!-- GENERATED:${markerName}:start -->`;
  const endMarker = `<!-- GENERATED:${markerName}:end -->`;
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    'g',
  );

  if (!pattern.test(contents)) {
    throw new Error(`Missing generated block markers for ${markerName}.`);
  }

  return contents.replace(
    pattern,
    `${startMarker}\n${nextContent}\n${endMarker}`,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateFile(relativePath, replacements) {
  const absolutePath = path.join(repoRoot, relativePath);
  let contents = fs.readFileSync(absolutePath, 'utf8');

  for (const replacement of replacements) {
    contents = replaceGeneratedBlock(contents, replacement.marker, replacement.content);
  }

  fs.writeFileSync(absolutePath, contents);
}

function main() {
  updateFile('README.md', [
    {
      marker: 'readme-current-status',
      content: render.renderReadmeCurrentStatus('zh'),
    },
    {
      marker: 'readme-support-matrix',
      content: render.renderReadmeSupportMatrixSection('zh'),
    },
  ]);
  updateFile('README.en.md', [
    {
      marker: 'readme-current-status',
      content: render.renderReadmeCurrentStatus('en'),
    },
    {
      marker: 'readme-support-matrix',
      content: render.renderReadmeSupportMatrixSection('en'),
    },
  ]);
  updateFile('docs/support-matrix.md', [
    {
      marker: 'support-matrix-verified-matrix',
      content: render.renderSupportMatrixVerifiedMatrix('zh'),
    },
    {
      marker: 'support-matrix-verified-allowlist',
      content: render.renderSupportMatrixVerifiedAllowlist(),
    },
    {
      marker: 'support-matrix-capability-telemetry',
      content: render.renderSupportMatrixCapabilityTelemetry('zh'),
    },
    {
      marker: 'support-matrix-preview-capabilities',
      content: render.renderSupportMatrixPreviewCapabilities('zh'),
    },
    {
      marker: 'support-matrix-ui-stack',
      content: render.renderSupportMatrixUiStackRules('zh'),
    },
    {
      marker: 'support-matrix-release-tracks',
      content: render.renderSupportMatrixReleaseTracks('zh'),
    },
  ]);
}

main();
