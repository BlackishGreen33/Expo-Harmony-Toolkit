import fs from 'fs-extra';
import path from 'path';
import {
  renderReadmeCurrentStatus,
  renderReadmeSupportMatrixSection,
  renderSupportMatrixCapabilityTelemetry,
  renderSupportMatrixExperimentalCapabilities,
  renderSupportMatrixPreviewCapabilities,
  renderSupportMatrixReleaseTracks,
  renderSupportMatrixUiStackRules,
  renderSupportMatrixVerifiedAllowlist,
  renderSupportMatrixVerifiedMatrix,
} from '../src/docs/render';
import { TOOLKIT_VERSION } from '../src/core/constants';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from '../src/data/uiStack';

const repoRoot = path.join(__dirname, '..');
const readmeZhPath = path.join(repoRoot, 'README.md');
const readmeEnPath = path.join(repoRoot, 'README.en.md');
const licensePath = path.join(repoRoot, 'LICENSE');
const packageJsonPath = path.join(repoRoot, 'package.json');
const supportMatrixPath = path.join(repoRoot, 'docs', 'support-matrix.md');
const roadmapPath = path.join(repoRoot, 'docs', 'roadmap.md');
const npmReleasePath = path.join(repoRoot, 'docs', 'npm-release.md');
const acceptanceRootPath = path.join(repoRoot, 'acceptance');

function getLocalLinks(contents: string): string[] {
  const markdownMatches = contents.matchAll(/\[[^\]]+\]\((\.\/[^)]+)\)/g);
  const htmlMatches = contents.matchAll(/href="(\.\/[^"]+)"/g);

  return Array.from(
    new Set([
      ...Array.from(markdownMatches, (match) => match[1]),
      ...Array.from(htmlMatches, (match) => match[1]),
    ]),
  );
}

function extractGeneratedBlock(contents: string, markerName: string): string {
  const startMarker = `<!-- GENERATED:${markerName}:start -->`;
  const endMarker = `<!-- GENERATED:${markerName}:end -->`;
  const startIndex = contents.indexOf(startMarker);
  const endIndex = contents.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing generated block markers for ${markerName}.`);
  }

  return contents
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
}

describe('documentation metadata', () => {
  it('ships a root MIT license file', async () => {
    expect(await fs.pathExists(licensePath)).toBe(true);
    expect(await fs.readFile(licensePath, 'utf8')).toContain('MIT License');
  });

  it('keeps the bilingual readmes cross-linked and all local links valid', async () => {
    const readmeZh = await fs.readFile(readmeZhPath, 'utf8');
    const readmeEn = await fs.readFile(readmeEnPath, 'utf8');
    const linkedFiles = [
      ...getLocalLinks(readmeZh),
      ...getLocalLinks(readmeEn),
    ];

    expect(readmeZh).toContain('href="./README.en.md"');
    expect(readmeEn).toContain('href="./README.md"');
    expect(readmeZh).toContain('expo55-rnoh082-ui-stack');
    expect(readmeEn).toContain('expo55-rnoh082-ui-stack');
    expect(readmeZh).toContain('./docs/official-ui-stack-sample.md');
    expect(readmeEn).toContain('./docs/official-ui-stack-sample.md');
    expect(readmeZh).toContain('`latest` 只承诺完整验收的 `verified` 能力');
    expect(readmeEn).toContain('`latest` only carries fully accepted `verified` capabilities');
    expect(readmeZh).toContain('`next`');
    expect(readmeEn).toContain('`next`');
    expect(readmeZh).toContain('`evidenceSource.device=manual-doc`');
    expect(readmeEn).toContain('`evidenceSource.device=manual-doc`');
    expect(readmeZh).toContain('`buildabilityRisk`');
    expect(readmeEn).toContain('`buildabilityRisk`');
    expect(readmeZh).toContain('`coverageProfile`');
    expect(readmeEn).toContain('`coverageProfile`');
    expect(readmeZh).toContain('`nextActions`');
    expect(readmeEn).toContain('`nextActions`');
    expect(readmeZh).toContain('catalog 外项目 intake 分类');
    expect(readmeEn).toContain('catalog-out intake classification');
    expect(readmeZh).toContain('`expo-secure-store`');
    expect(readmeEn).toContain('`expo-secure-store`');
    expect(readmeZh).toContain('`@react-native-async-storage/async-storage`');
    expect(readmeEn).toContain('`@react-native-async-storage/async-storage`');
    expect(readmeZh).toContain('`react-native-screens`');
    expect(readmeEn).toContain('`react-native-screens`');
    expect(readmeZh).toContain('`react-native-safe-area-context`');
    expect(readmeEn).toContain('`react-native-safe-area-context`');
    expect(readmeZh).toContain('./acceptance/');
    expect(readmeEn).toContain('./acceptance/');
    expect(readmeZh).toContain('./acceptance/v1.8.x-capability-board.md');
    expect(readmeEn).toContain('./acceptance/v1.8.x-capability-board.md');
    expect(readmeZh).not.toContain('./docs/v1.7.3-acceptance.md');
    expect(readmeEn).not.toContain('./docs/v1.7.3-acceptance.md');

    for (const link of linkedFiles) {
      const target = path.resolve(repoRoot, link);
      expect(await fs.pathExists(target)).toBe(true);
    }
  });

  it('keeps generated README and support-matrix blocks aligned with the source data', async () => {
    const readmeZh = await fs.readFile(readmeZhPath, 'utf8');
    const readmeEn = await fs.readFile(readmeEnPath, 'utf8');
    const supportMatrix = await fs.readFile(supportMatrixPath, 'utf8');

    expect(extractGeneratedBlock(readmeZh, 'readme-current-status')).toBe(
      renderReadmeCurrentStatus('zh'),
    );
    expect(extractGeneratedBlock(readmeZh, 'readme-support-matrix')).toBe(
      renderReadmeSupportMatrixSection('zh'),
    );
    expect(extractGeneratedBlock(readmeEn, 'readme-current-status')).toBe(
      renderReadmeCurrentStatus('en'),
    );
    expect(extractGeneratedBlock(readmeEn, 'readme-support-matrix')).toBe(
      renderReadmeSupportMatrixSection('en'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-verified-matrix')).toBe(
      renderSupportMatrixVerifiedMatrix('zh'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-verified-allowlist')).toBe(
      renderSupportMatrixVerifiedAllowlist(),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-capability-telemetry')).toBe(
      renderSupportMatrixCapabilityTelemetry('zh'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-preview-capabilities')).toBe(
      renderSupportMatrixPreviewCapabilities('zh'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-experimental-capabilities')).toBe(
      renderSupportMatrixExperimentalCapabilities('zh'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-ui-stack')).toBe(
      renderSupportMatrixUiStackRules('zh'),
    );
    expect(extractGeneratedBlock(supportMatrix, 'support-matrix-release-tracks')).toBe(
      renderSupportMatrixReleaseTracks('zh'),
    );
  });

  it('keeps package metadata aligned with the public repository and license', async () => {
    const packageJson = await fs.readJson(packageJsonPath);

    expect(packageJson.version).toBe(TOOLKIT_VERSION);
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository?.url).toBe('git+https://github.com/BlackishGreen33/Expo-Harmony-Toolkit.git');
    expect(packageJson.homepage).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit#readme');
    expect(packageJson.bugs?.url).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/issues');
  });

  it('documents the validated adapter specifiers in the support matrix', async () => {
    const supportMatrix = await fs.readFile(supportMatrixPath, 'utf8');

    for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
      expect(supportMatrix).toContain(adapter.adapterPackageName);
      expect(supportMatrix).toContain(getUiStackAdapterSpecifier(adapter));
    }
  });

  it('keeps roadmap and release docs aligned with stable/latest plus fast-track/next', async () => {
    const roadmap = await fs.readFile(roadmapPath, 'utf8');
    const npmRelease = await fs.readFile(npmReleasePath, 'utf8');
    const acceptanceEntries = await fs.readdir(acceptanceRootPath);

    expect(roadmap).toContain('2026-05-15');
    expect(roadmap).toContain('2026-06-15');
    expect(roadmap).toContain('2026-08-31');
    expect(roadmap).toContain('2026-09-30');
    expect(roadmap).toContain('2026-10-31');
    expect(roadmap).toContain('2026-11-15');
    expect(roadmap).toContain('2026-11-30');
    expect(roadmap).toContain('2026-12-31');
    expect(roadmap).toContain('mainline capability catalog');
    expect(roadmap).toContain('Intake Hardening + Parallel Promotion');
    expect(roadmap).toContain('Bare Workflow Baseline + App Foundation Modules');
    expect(roadmap).toContain('implementation baseline complete');
    expect(roadmap).toContain('Third-party Native Wave A');
    expect(roadmap).toContain('formal experimental onboarding');
    expect(roadmap).toContain('Third-party Native Wave B + Regression Farm');
    expect(roadmap).toContain('Any-project Intake Freeze');
    expect(roadmap).toContain('released / complete');
    expect(roadmap).toContain('v1.10.0-acceptance.md');
    expect(roadmap).toContain('Final Blocker Burn-down');
    expect(roadmap).toContain('v1.11.0` 是未发布的 burn-down ledger checkpoint');
    expect(roadmap).toContain('v1.11.1` 是第一个公开 `v1.11.x`');
    expect(roadmap).toContain('v1.11.2` 已发布到 `latest`');
    expect(roadmap).toContain('v1.11.0-burn-down-ledger.md');
    expect(roadmap).toContain('v1.11.1-acceptance.md');
    expect(roadmap).toContain('v1.11.2-acceptance.md');
    expect(roadmap).toContain('sidecar.drift.requires-force');
    expect(roadmap).toContain('auto-refreshed build-required files');
    expect(roadmap).toContain('accepted exception');
    expect(roadmap).toContain('不把 debug/release HAP build pass 表述为真机 device 或 runtime pass');
    expect(roadmap).toContain('Any Expo Project Reliable Packaging');
    expect(roadmap).toContain('任何 Expo 项目都能可靠打包成鸿蒙 App');
    expect(roadmap).not.toContain('Long-tail Native Module Extension');
    expect(npmRelease).toContain('`latest`');
    expect(npmRelease).toContain('`next`');
    expect(npmRelease).toContain('稳定工具链 patch');
    expect(npmRelease).toContain('npm `latest -> 1.11.2`');
    expect(npmRelease).toContain('official-native-capabilities-sample');
    expect(npmRelease).toContain('`evidenceSource.device=manual-doc`');
    expect(npmRelease).toContain('第一个公开 `v1.11.x`');
    expect(npmRelease).toContain('非实机 closeout');
    expect(npmRelease).toContain('ccnubox signed simulator app-shell gate');
    const cliBuild = await fs.readFile(path.join(repoRoot, 'docs', 'cli-build.md'), 'utf8');
    expect(cliBuild).toContain('expo-harmony build-hap --mode release\n```');
    expect(acceptanceEntries).toEqual(
      expect.arrayContaining([
        'v1.5.1-acceptance.md',
        'v1.6.0-acceptance.md',
        'v1.7.0-acceptance.md',
        'v1.7.1-acceptance.md',
        'v1.7.2-acceptance.md',
        'v1.7.3-acceptance.md',
        'v1.8.0-acceptance.md',
        'v1.8.x-capability-board.md',
        'v1.8.x-expo-file-system-device.md',
        'v1.8.x-expo-file-system-release.md',
        'v1.8.x-expo-image-picker-device.md',
        'v1.8.x-expo-image-picker-release.md',
        'v1.8.x-expo-location-device.md',
        'v1.8.x-expo-location-release.md',
        'v1.8.x-expo-camera-device.md',
        'v1.8.x-expo-camera-release.md',
        'v1.9.0-acceptance.md',
        'v1.9.2-acceptance.md',
        'v1.9.3-acceptance.md',
        'v1.10.0-acceptance.md',
        'v1.11.0-burn-down-ledger.md',
        'v1.11.1-acceptance.md',
        'v1.11.2-acceptance.md',
      ]),
    );
  });
});
