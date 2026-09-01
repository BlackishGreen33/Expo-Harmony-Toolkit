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
const v1113AcceptancePath = path.join(acceptanceRootPath, 'v1.11.3-acceptance.md');
const v1114AcceptancePath = path.join(acceptanceRootPath, 'v1.11.4-acceptance.md');
const v2NonDeviceCloseoutPath = path.join(
  acceptanceRootPath,
  'v2.0.0-non-device-closeout.md',
);

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
    expect(readmeZh).toContain('version-v1.11.4');
    expect(readmeEn).toContain('version-v1.11.4');
    expect(readmeZh).toContain('v2 prerelease 版本发布到 `next`，稳定版本发布到 `latest`');
    expect(readmeEn).toContain('v2 prerelease versions publish to `next`; stable versions publish to `latest`');
    expect(readmeZh).toContain('./docs/v2-sample-lanes.md');
    expect(readmeEn).toContain('./docs/v2-sample-lanes.md');
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

  it('keeps every packed v2 publication statement channel-based instead of time-sensitive', async () => {
    const packageJson = await fs.readJson(packageJsonPath);
    const packedMarkdownPaths = (packageJson.files as string[]).filter(
      (filePath) => /^README(?:\.en)?\.md$/.test(filePath) || /^docs\/.*\.md$/.test(filePath),
    );
    const packedDocuments = await Promise.all(
      packedMarkdownPaths.map((filePath) => fs.readFile(path.join(repoRoot, filePath), 'utf8')),
    );
    const volatileV2PublicationPatterns = [
      /`?v?2\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`?[^。\n.]{0,120}(?:尚未發布|尚未发布|未發布|未发布|unpublished)/i,
      /`?v?2\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`?[^\n]{0,160}(?:(?:目前|当前)[^\n]{0,80}`latest`|current[^\n]{0,80}`latest`)/i,
      /(?:published stable npm `latest` remains|已發布的穩定 `latest` 仍是|已发布的稳定(?: npm )?`latest` 仍是)/i,
    ];

    expect(packedMarkdownPaths).toEqual(
      expect.arrayContaining([
        'README.md',
        'README.en.md',
        'docs/cli-build.md',
        'docs/npm-release.md',
        'docs/roadmap.md',
        'docs/support-matrix.md',
        'docs/v2-sample-lanes.md',
      ]),
    );
    for (const contents of packedDocuments) {
      for (const pattern of volatileV2PublicationPatterns) {
        expect(contents).not.toMatch(pattern);
      }
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

    expect(TOOLKIT_VERSION).toBe('2.0.0-next.1');
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
    const supportMatrix = await fs.readFile(supportMatrixPath, 'utf8');
    const v1113Acceptance = await fs.readFile(v1113AcceptancePath, 'utf8');
    const v1114Acceptance = await fs.readFile(v1114AcceptancePath, 'utf8');
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
    expect(roadmap).toContain('v1.11.3` 已发布到 `latest`');
    expect(roadmap).toContain('v1.11.4` 进行 publication-state reconciliation');
    expect(supportMatrix).toContain('`v1.11.4` 对账 `v1.11.3` 的发布状态');
    expect(roadmap).toContain('v1.11.0-burn-down-ledger.md');
    expect(roadmap).toContain('v1.11.1-acceptance.md');
    expect(roadmap).toContain('v1.11.2-acceptance.md');
    expect(roadmap).toContain('v1.11.3-acceptance.md');
    expect(roadmap).toContain('v1.11.4-acceptance.md');
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
    expect(npmRelease).toContain('精确远端发布状态只记录在各版本 acceptance 文件中');
    expect(npmRelease).not.toContain('npm `latest ->');
    expect(npmRelease).not.toContain('当前只更新仓库代码');
    expect(npmRelease).toContain('official-native-capabilities-sample');
    expect(npmRelease).toContain('5 lane groups / 7 physical projects');
    expect(npmRelease).toContain('v2 prerelease 版本发布到 `next`，稳定版本发布到 `latest`');
    expect(npmRelease).toContain('精确远端发布状态只记录在各版本 acceptance 文件中');
    expect(roadmap).toContain('release HAP 与 simulator 非实机 closeout 已记录在对应 acceptance');
    expect(roadmap).not.toContain('这不代表 stable v2、release HAP、simulator 或实机 evidence 已完成');
    expect(npmRelease).toContain('consumer production dependency graph');
    expect(npmRelease).toContain('critical advisories 为 0');
    expect(npmRelease).toContain('workspace/examples audit 不属于 publish hard gate');
    expect(npmRelease).toContain('push tag 必须精确等于 `v<package version>`');
    expect(npmRelease).toContain('`workflow_dispatch` 不要求 tag');
    expect(npmRelease).toContain('`evidenceSource.device=manual-doc`');
    expect(npmRelease).toContain('第一个公开 `v1.11.x`');
    expect(npmRelease).toContain('非实机 closeout');
    expect(npmRelease).toContain('ccnubox signed simulator app-shell gate');
    expect(v1113Acceptance).toContain('初始 readiness 记录时尚未创建 tag、发布 npm 或创建 GitHub Release');
    expect(v1113Acceptance).toContain('后续 security commit 后已发布 npm、tag 与 GitHub Release');
    expect(v1114Acceptance).toContain('publication-state reconciliation');
    expect(v1114Acceptance).toContain('- 版本：`1.11.4`');
    expect(v1114Acceptance).toContain('- 发布轨：`latest`');
    expect(v1114Acceptance).toContain('本地验证证据');
    expect(v1114Acceptance).toContain('`pnpm exec jest --runInBand tests/docs.test.ts`');
    expect(v1114Acceptance).toContain('`Test Suites: 1 passed, 1 total`');
    expect(v1114Acceptance).toContain('`pnpm build`');
    expect(v1114Acceptance).toContain('`pnpm pack:check`');
    expect(v1114Acceptance).toContain('`expo-harmony-toolkit@1.11.4`');
    expect(v1114Acceptance).toContain('`EXPO_HARMONY_RELEASE_SKIP_HAP=1 pnpm release:check`');
    expect(v1114Acceptance).toContain('`exit 0`');
    expect(v1114Acceptance).toContain('发布证据');
    expect(v1114Acceptance).toContain('`v1.11.4` 指向 `ab01e02dbbe28bdcf3af6062d869007409b40997`');
    expect(v1114Acceptance).toContain('`latest -> 1.11.4`；`next -> 1.9.0`');
    expect(v1114Acceptance).toContain('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/releases/tag/v1.11.4');
    expect(v1114Acceptance).toContain('`publishedAt=2026-08-15T19:25:49Z`；`draft=false`；`prerelease=false`');
    expect(v1114Acceptance).toContain('`31903698914` success，`head=ab01e02dbbe28bdcf3af6062d869007409b40997`');
    expect(v1114Acceptance).toContain('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/actions/runs/31903698914');
    expect(v1114Acceptance).toContain('`31903434400` success');
    expect(v1114Acceptance).toContain('PR `#3` 已 merge');
    const cliBuild = await fs.readFile(path.join(repoRoot, 'docs', 'cli-build.md'), 'utf8');
    expect(cliBuild).toContain('`v1.11.4` 延续');
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
        'v1.11.3-acceptance.md',
        'v1.11.4-acceptance.md',
        'v2.0.0-non-device-closeout.md',
      ]),
    );
  });

  it('records the v2 non-device closeout without claiming device or publication evidence', async () => {
    const closeout = await fs.readFile(v2NonDeviceCloseoutPath, 'utf8');
    const projects = [
      ['managed-verified', 'official-minimal'],
      ['managed-verified', 'official-app-shell'],
      ['managed-verified', 'official-ui-stack'],
      ['preview-foundation', 'official-native-capabilities'],
      ['bare', 'official-bare'],
      ['wave-a', 'official-wave-a'],
      ['wave-b', 'official-wave-b'],
    ] as const;
    const variantProjects = [
      'official-native-capabilities',
      'official-wave-b',
    ];

    expect(closeout).toContain('expo-harmony-toolkit@2.0.0-next.0');
    expect(closeout).toMatch(/Tarball SHA-256:\s*`[a-f0-9]{64}`/);
    expect(closeout).toContain('5 lane groups / 7 physical projects');
    expect(closeout).toContain('| Lane group | Project | portable | debugHap | releaseHap | simulator |');
    expect(closeout).toContain('packed consumer');
    expect(closeout).toContain('critical=0');
    expect(closeout).toContain('workspace/examples');
    expect(closeout).toContain('GHSA-w3rx-r6r6-pgpr');
    expect(closeout).toContain('GHSA-5p2g-fcmc-qvqq');
    expect(closeout).toContain('GHSA-w5hq-g745-h8pq');
    expect(closeout).not.toContain('未发布');
    expect(closeout).toContain('Publication status');
    expect(closeout.match(/^- Publication status：`([^`]+)`/m)?.[1]).toBe('已發布');
    expect(closeout).toContain('next=2.0.0-next.0');
    expect(closeout).toContain('latest=1.11.4');
    expect(closeout).toContain('b5c1fe1443f746d2f6fbc3f07bff974cf8412821');
    expect(closeout).toContain('actions/runs/32637997199');
    expect(closeout).toContain('releases/tag/v2.0.0-next.0');
    expect(closeout).toContain('repository push、PR 或 merge 本身仍不能替代');
    expect(closeout).toContain('simulator pass 不是 device pass');
    expect(closeout).toContain('真机语义保持 deferred');
    expect(closeout).not.toMatch(
      /(?:device|真機)(?: evidence| 語義)?\s*[:：=]\s*`?pass\b/i,
    );
    expect(closeout).not.toMatch(
      /CapabilityEvidence\.release\/device`?\s*[:：=]\s*`?pass\b/i,
    );
    expect(closeout).toContain('file-system');
    expect(closeout).toContain('image-picker');
    expect(closeout).toContain('location');
    expect(closeout).toContain('camera');
    expect(closeout).toContain('push fallback');
    expect(closeout).toContain('screens fallback');
    expect(closeout).toContain('Skia fallback');
    expect(closeout).toContain('19/19 route stability pass');
    expect(closeout).toContain('19/19 functional/fallback pass');
    expect(closeout).toContain('0 個 action blockers');
    expect(closeout).toContain('| official-wave-a | `/gesture-handler` | pass | pass |');
    expect(closeout).toContain('Gesture callback count=0');
    expect(closeout).toContain('Gesture callback count=1');
    expect(closeout).toContain('File roundtrip OK. write/read/cleanup=pass');
    expect(closeout).toContain('Media permission status=denied.');
    expect(closeout).not.toContain('callback action blocked');
    expect(closeout).not.toContain('authoritative simulator rerun pending');
    expect(closeout).not.toContain('| official-wave-a | `/gesture-handler` | not-run |');
    expect(closeout).not.toContain('/third-party-wave-a/gesture-handler');
    expect(closeout).toContain('Artifact SHA-256');
    for (const [laneGroup, project] of projects) {
      expect(closeout).toContain(
        `| ${laneGroup} | ${project} | pass | pass | pass | pass |`,
      );
    }

    const artifactSection = closeout.match(
      /## Artifact SHA-256\s+([\s\S]*?)\s+## Fresh-build provenance/,
    )?.[1];
    expect(artifactSection).toBeDefined();
    const artifactRows = Array.from(
      artifactSection?.matchAll(
        /^\| ([^|\n]+) \| ([^|\n]+) \| (yes|no) \| `([a-f0-9]{64})` \|$/gm,
      ) ?? [],
      ([, project, artifact, signed, sha256]) => ({
        project: project.trim(),
        artifact: artifact.trim(),
        signed,
        sha256,
      }),
    );
    expect(artifactRows).toHaveLength(23);
    expect(new Set(artifactRows.map(({ sha256 }) => sha256)).size).toBe(23);

    const artifactKeys = new Set(
      artifactRows.map(({ project, artifact, signed }) => `${project}|${artifact}|${signed}`),
    );
    for (const [, project] of projects) {
      const releasePrefix = variantProjects.includes(project) ? 'original release' : 'release';
      expect(artifactKeys).toContain(
        `${project}|debug \`entry-default-unsigned.hap\`|no`,
      );
      expect(artifactKeys).toContain(
        `${project}|${releasePrefix} \`entry-default-signed.hap\`|yes`,
      );
      expect(artifactKeys).toContain(
        `${project}|release \`1-entry-default-unsigned.hap\`|no`,
      );
    }
    for (const project of variantProjects) {
      expect(artifactKeys).toContain(
        `${project}|temp-only \`entry-default-simulator-signed.hap\`|yes`,
      );
    }
  });
});
