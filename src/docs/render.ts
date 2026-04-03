import {
  PUBLIC_CURRENT_VERSION,
  PUBLIC_RELEASE_TRACKS,
  PREVIEW_CAPABILITY_DEFINITIONS,
  PREVIEW_SAMPLE_PATH,
  PRIMARY_SAMPLE_PATH,
  SUPPORTING_SAMPLE_PATHS,
  VERIFIED_JS_UI_CAPABILITY_NAMES,
  EXPERIMENTAL_CAPABILITY_NAMES,
} from '../data/publicDocs';
import { CAPABILITY_DEFINITIONS } from '../data/capabilities';
import { DEFAULT_VALIDATED_MATRIX_ID, VALIDATED_RELEASE_MATRICES } from '../data/validatedMatrices';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from '../data/uiStack';

export type DocsLocale = 'zh' | 'en';

const matrix = VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID];

export function renderReadmeCurrentStatus(locale: DocsLocale): string {
  const headers =
    locale === 'zh'
      ? ['项目', '说明']
      : ['Item', 'Status'];
  const versionLabel = locale === 'zh' ? '当前版本' : 'Current version';
  const supportModelLabel = locale === 'zh' ? '支持模型' : 'Support model';
  const verifiedMatrixLabel = locale === 'zh' ? '唯一 `verified` 公开矩阵' : 'Public `verified` matrix';
  const inputLabel = locale === 'zh' ? '输入范围' : 'Supported input';
  const verifiedCapabilitiesLabel = locale === 'zh' ? '`verified` JS/UI 能力' : '`verified` JS/UI capabilities';
  const previewLabel = locale === 'zh' ? '`preview` 原生能力' : '`preview` native capabilities';
  const experimentalLabel = locale === 'zh' ? '`experimental` 能力' : '`experimental` capabilities';
  const releaseTracksLabel = locale === 'zh' ? '发布轨' : 'Release tracks';
  const telemetryLabel = locale === 'zh' ? 'capability 遥测' : 'Capability telemetry';
  const buildPathLabel = locale === 'zh' ? '构建链' : 'Build path';
  const primarySampleLabel = locale === 'zh' ? '主 sample' : 'Primary sample';
  const previewSampleLabel = locale === 'zh' ? 'preview sample' : 'Preview sample';
  const supportingSamplesLabel = locale === 'zh' ? '辅助 onboarding samples' : 'Supporting onboarding samples';
  const releaseTracksValue =
    locale === 'zh'
      ? `\`latest\` = ${PUBLIC_RELEASE_TRACKS.latest}；\`next\` = ${PUBLIC_RELEASE_TRACKS.next}`
      : `\`latest\` = fully accepted \`verified\` only; \`next\` = ${PUBLIC_RELEASE_TRACKS.next}`;
  const inputValue = locale === 'zh' ? 'Managed/CNG Expo 项目' : 'Managed/CNG Expo projects';
  const listJoiner = locale === 'zh' ? '、' : ', ';

  return [
    `| ${headers[0]} | ${headers[1]} |`,
    '| --- | --- |',
    `| ${versionLabel} | \`v${PUBLIC_CURRENT_VERSION}\` |`,
    `| ${supportModelLabel} | \`verified + preview + experimental\` |`,
    `| ${verifiedMatrixLabel} | \`${DEFAULT_VALIDATED_MATRIX_ID}\` |`,
    `| ${inputLabel} | ${inputValue} |`,
    `| ${verifiedCapabilitiesLabel} | ${joinInlineCode(VERIFIED_JS_UI_CAPABILITY_NAMES, listJoiner)} |`,
    `| ${previewLabel} | ${joinInlineCode(PREVIEW_CAPABILITY_DEFINITIONS.map((definition) => definition.packageName), listJoiner)} |`,
    `| ${experimentalLabel} | ${joinInlineCode(EXPERIMENTAL_CAPABILITY_NAMES, listJoiner)} |`,
    `| ${releaseTracksLabel} | ${releaseTracksValue} |`,
    `| ${telemetryLabel} | \`runtimeMode\` + \`evidence(...)\` + \`evidenceSource(...)\` |`,
    `| ${buildPathLabel} | \`doctor -> init -> bundle -> build-hap\` |`,
    `| ${primarySampleLabel} | \`${PRIMARY_SAMPLE_PATH}\` |`,
    `| ${previewSampleLabel} | \`${PREVIEW_SAMPLE_PATH}\` |`,
    `| ${supportingSamplesLabel} | ${SUPPORTING_SAMPLE_PATHS.map((samplePath) => `\`${samplePath}\``).join(locale === 'zh' ? '、' : ', ')} |`,
  ].join('\n');
}

export function renderReadmeSupportMatrixSection(locale: DocsLocale): string {
  const verifiedLine =
    locale === 'zh'
      ? `- \`verified\`：唯一公开矩阵仍是 \`${DEFAULT_VALIDATED_MATRIX_ID}\``
      : `- \`verified\`: the only public matrix remains \`${DEFAULT_VALIDATED_MATRIX_ID}\``;
  const previewLine =
    locale === 'zh'
      ? `- \`preview\`：${joinInlineCode(PREVIEW_CAPABILITY_DEFINITIONS.map((definition) => definition.packageName))}`
      : `- \`preview\`: ${joinInlineCode(PREVIEW_CAPABILITY_DEFINITIONS.map((definition) => definition.packageName))}`;
  const experimentalLine =
    locale === 'zh'
      ? `- \`experimental\`：${joinInlineCode(EXPERIMENTAL_CAPABILITY_NAMES)}`
      : `- \`experimental\`: ${joinInlineCode(EXPERIMENTAL_CAPABILITY_NAMES)}`;

  const strictLine =
    locale === 'zh'
      ? '`doctor --strict` 继续只代表 `verified`。`doctor --target-tier preview` 会在同一 runtime matrix 下额外放行 preview 能力，但这不等于它们已经进入正式承诺。'
      : '`doctor --strict` still means `verified` only. `doctor --target-tier preview` allows the same runtime matrix plus preview-tier capabilities, but that does not promote them into the formal public promise.';

  const telemetryLines =
    locale === 'zh'
      ? [
          '- `doctor-report.json` 的 `capabilities[]` 会带出 `runtimeMode`',
          '- `doctor-report.json` 与 `toolkit-config.json` 会带出 `evidence.bundle`、`evidence.debugBuild`、`evidence.device`、`evidence.release`',
          '- `doctor-report.json` 与 `toolkit-config.json` 会带出 `evidenceSource.bundle`、`evidenceSource.debugBuild`、`evidenceSource.device`、`evidenceSource.release`',
          '- `runtimeMode=shim` 说明当前仍未进入 verified runtime path，即使 bundle / debug build 已经可走通',
          '- `evidenceSource.device=manual-doc` 表示当前只有人工设备验收记录，不代表机器自动验证',
        ]
      : [
          '- `doctor-report.json` exposes `capabilities[].runtimeMode`',
          '- `doctor-report.json` and `toolkit-config.json` expose `evidence.bundle`, `evidence.debugBuild`, `evidence.device`, and `evidence.release`',
          '- `doctor-report.json` and `toolkit-config.json` expose `evidenceSource.bundle`, `evidenceSource.debugBuild`, `evidenceSource.device`, and `evidenceSource.release`',
          '- `runtimeMode=shim` means the capability still has not reached a verified runtime path even if bundling and debug-build scaffolding already exist',
          '- `evidenceSource.device=manual-doc` means the current device signal comes from manual acceptance records, not automated verification',
        ];

  return [verifiedLine, previewLine, experimentalLine, '', strictLine, '', ...telemetryLines].join('\n');
}

export function renderSupportMatrixVerifiedMatrix(locale: DocsLocale): string {
  const appShellValue =
    locale === 'zh'
      ? '`expo-router` `55.x`、`expo-linking` `55.x`、`expo-constants` `55.x`、`@expo/metro-runtime` `55.x`、`react-dom` `19.1.1`'
      : '`expo-router` `55.x`, `expo-linking` `55.x`, `expo-constants` `55.x`, `@expo/metro-runtime` `55.x`, `react-dom` `19.1.1`';
  const uiStackValue =
    locale === 'zh'
      ? '`react-native-reanimated` `3.6.0`、`react-native-svg` `15.0.0`'
      : '`react-native-reanimated` `3.6.0`, `react-native-svg` `15.0.0`';

  return [
    '| 项目 | 要求 |',
    '| --- | --- |',
    `| Expo SDK | \`${matrix.expoSdkVersion}\` |`,
    `| React | \`${matrix.dependencyRules.react?.version}\` |`,
    `| React Native | \`${matrix.dependencyRules['react-native']?.version}\` |`,
    `| \`@react-native-oh/react-native-harmony\` | \`${matrix.dependencyRules['@react-native-oh/react-native-harmony']?.version}\` |`,
    `| \`@react-native-oh/react-native-harmony-cli\` | \`${matrix.dependencyRules['@react-native-oh/react-native-harmony-cli']?.version}\` |`,
    '| `@react-native-community/cli` | `20.x` |',
    '| `metro` | `0.83.x` |',
    `| App Shell 依赖 | ${appShellValue} |`,
    `| UI stack 依赖 | ${uiStackValue} |`,
    '| 原生标识 | 至少设置 `android.package` 或 `ios.bundleIdentifier` |',
  ].join('\n');
}

export function renderSupportMatrixVerifiedAllowlist(): string {
  return matrix.allowedDependencies.map((dependencyName) => `- \`${dependencyName}\``).join('\n');
}

export function renderSupportMatrixCapabilityTelemetry(locale: DocsLocale): string {
  const lines =
    locale === 'zh'
      ? [
          '所有 capability 从现在开始都同时公开：',
          '',
          '- `supportTier`',
          '- `runtimeMode`',
          '- `evidence.bundle`',
          '- `evidence.debugBuild`',
          '- `evidence.device`',
          '- `evidence.release`',
          '- `evidenceSource.bundle`',
          '- `evidenceSource.debugBuild`',
          '- `evidenceSource.device`',
          '- `evidenceSource.release`',
          '',
          '判读规则：',
          '',
          '- `runtimeMode=shim`：说明当前还在桥接或占位阶段，即使 bundle / debug build 已完成，也不应宣称 verified',
          '- `runtimeMode=adapter`：说明已经进入真实适配路径，但仍缺少某些验收证据',
          '- `runtimeMode=verified`：说明能力已进入正式承诺，且证据闭环完成',
        ]
      : [
          'All capabilities now publish the following fields together:',
          '',
          '- `supportTier`',
          '- `runtimeMode`',
          '- `evidence.bundle`',
          '- `evidence.debugBuild`',
          '- `evidence.device`',
          '- `evidence.release`',
          '- `evidenceSource.bundle`',
          '- `evidenceSource.debugBuild`',
          '- `evidenceSource.device`',
          '- `evidenceSource.release`',
          '',
          'Reading rules:',
          '',
          '- `runtimeMode=shim`: the capability is still on a bridge or placeholder path and must not be described as verified',
          '- `runtimeMode=adapter`: the capability is on a real adapter path but still lacks part of the evidence needed for verified promotion',
          '- `runtimeMode=verified`: the capability has entered the formal public promise and closed the evidence loop',
        ];

  return lines.join('\n');
}

export function renderSupportMatrixPreviewCapabilities(locale: DocsLocale): string {
  const headers =
    locale === 'zh'
      ? ['Expo 能力', '当前层级', 'runtimeMode', 'evidence', 'Harmony 依赖方向', '受管权限', '官方 sample route']
      : ['Expo capability', 'Support tier', 'runtimeMode', 'evidence', 'Harmony dependency direction', 'Managed permissions', 'Official sample route'];

  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...PREVIEW_CAPABILITY_DEFINITIONS.map((definition) => {
      const dependencyDirection = definition.nativePackageNames.length > 0
        ? definition.nativePackageNames.join(', ')
        : 'toolkit-managed bridge';
      const permissions = definition.harmonyPermissions.length > 0
        ? definition.harmonyPermissions.join(locale === 'zh' ? '、' : ', ')
        : locale === 'zh'
          ? '无新增必需权限'
          : 'no additional required permissions';

      return [
        `\`${definition.packageName}\``,
        `\`${definition.supportTier}\``,
        `\`${definition.runtimeMode}\``,
        `\`${renderEvidence(definition)}\``,
        dependencyDirection,
        permissions,
        `\`${definition.sampleRoute}\``,
      ].join(' | ');
    }).map((row) => `| ${row} |`),
  ].join('\n');
}

export function renderSupportMatrixUiStackRules(locale: DocsLocale): string {
  const intro =
    locale === 'zh'
      ? 'canonical 包与 Harmony adapter 包固定为双向强制：'
      : 'Canonical packages and Harmony adapters stay strictly paired in both directions:';
  const rules =
    locale === 'zh'
      ? [
          '规则固定为：',
          '',
          '- 出现 canonical 包，必须同时出现对应 `@react-native-oh-tpl/*`',
          '- 出现 `@react-native-oh-tpl/*`，也必须同时出现对应 canonical 包',
          '- canonical 包按 semver 校验',
          '- `@react-native-oh-tpl/*` 按 exact dependency specifier 校验',
          '',
          '当前固定 exact specifier：',
        ]
      : [
          'The enforced rules are:',
          '',
          '- canonical packages require their matching `@react-native-oh-tpl/*` adapters',
          '- adapter packages also require their canonical counterparts',
          '- canonical packages are validated with semver ranges',
          '- `@react-native-oh-tpl/*` adapters are validated against exact dependency specifiers',
          '',
          'Pinned exact specifiers:',
        ];

  return [
    intro,
    '',
    ...UI_STACK_VALIDATED_ADAPTERS.map(
      (adapter) => `- \`${adapter.canonicalPackageName}\` ↔ \`${adapter.adapterPackageName}\``,
    ),
    '',
    ...rules,
    '',
    ...UI_STACK_VALIDATED_ADAPTERS.map(
      (adapter) => `- \`${adapter.adapterPackageName}\`: \`${getUiStackAdapterSpecifier(adapter)}\``,
    ),
  ].join('\n');
}

export function renderSupportMatrixReleaseTracks(locale: DocsLocale): string {
  return locale === 'zh'
    ? [
        '- `latest`',
        '  - 只承接完整验收的 `verified` 能力',
        '  - 只允许 verified sample / gate 作为发布依据',
        '- `next`',
        '  - 承接 preview fast track',
        '  - 必须至少通过 preview sample、bundle、debug build gate',
        '  - 不得被描述为 verified 或 release-ready',
      ].join('\n')
    : [
        '- `latest`',
        '  - only carries fully accepted `verified` capabilities',
        '  - only verified samples and gates may justify a release',
        '- `next`',
        '  - carries preview fast-track work',
        '  - must at least pass the preview sample, bundle, and debug-build gates',
        '  - must not be described as verified or release-ready',
      ].join('\n');
}

function joinInlineCode(entries: readonly string[], joiner = ', '): string {
  return entries.map((entry) => `\`${entry}\``).join(joiner);
}

function renderEvidence(definition: (typeof CAPABILITY_DEFINITIONS)[number]): string {
  return [
    `bundle=${definition.evidence.bundle ? 'yes' : 'no'}[${definition.evidenceSource.bundle}]`,
    `debugBuild=${definition.evidence.debugBuild ? 'yes' : 'no'}[${definition.evidenceSource.debugBuild}]`,
    `device=${definition.evidence.device ? 'yes' : 'no'}[${definition.evidenceSource.device}]`,
    `release=${definition.evidence.release ? 'yes' : 'no'}[${definition.evidenceSource.release}]`,
  ].join(', ');
}
