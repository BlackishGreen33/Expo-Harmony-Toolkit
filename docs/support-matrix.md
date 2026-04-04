# v1.8 支持矩阵

`v1.8` 继续采用 tiered support model，但从现在开始把“层级”与“晋升距离”拆开表达：

- `supportTier` 表示公开承诺层级
- `runtimeMode` 表示当前运行时接入形态：`shim`、`adapter`、`verified`
- `evidence` 表示距离 verified 还缺哪些证据格
- `evidenceSource` 表示每个证据格来自自动化、人工记录，还是当前无证据
- `coverageProfile` 表示当前项目属于哪条主线输入形态
- `nextActions` 表示 toolkit 为当前项目生成的有序下一步

同时，`v1.8.x` 的 roadmap 已经改成单一 `mainline capability catalog` 方向：

- bare workflow 与第三方 native package 不再被描述成“收官后才考虑的另一条 extension 终局”
- `v2.0.0` 本身被定义成“任何 Expo 项目都能可靠打包成鸿蒙 App”的目标版本
- 但当前公开承诺依旧没有放宽；它们只是进入同一主线 backlog，而不是已经进入 `verified`

`doctor --strict` 继续只代表 `verified`。

## Verified 公开矩阵

唯一 `verified` 矩阵仍是 `expo55-rnoh082-ui-stack`。

<!-- GENERATED:support-matrix-verified-matrix:start -->
| 项目 | 要求 |
| --- | --- |
| Expo SDK | `55` |
| React | `19.1.1` |
| React Native | `0.82.1` |
| `@react-native-oh/react-native-harmony` | `0.82.18` |
| `@react-native-oh/react-native-harmony-cli` | `0.82.18` |
| `@react-native-community/cli` | `20.x` |
| `metro` | `0.83.x` |
| App Shell 依赖 | `expo-router` `55.x`、`expo-linking` `55.x`、`expo-constants` `55.x`、`@expo/metro-runtime` `55.x`、`react-dom` `19.1.1` |
| UI stack 依赖 | `react-native-reanimated` `3.6.0`、`react-native-svg` `15.0.0` |
| 原生标识 | 至少设置 `android.package` 或 `ios.bundleIdentifier` |
<!-- GENERATED:support-matrix-verified-matrix:end -->

## Support Tiers

| 层级 | 含义 | `doctor --strict` | `doctor --target-tier <tier>` |
| --- | --- | --- | --- |
| `verified` | 已进入正式公开承诺，要求完整样例、构建、设备与 release 验收 | 允许 | 允许 |
| `preview` | 已有 managed adapter / bundle / debug build 路径，但仍未完成 verified 证据闭环 | 阻断 | `preview` / `experimental` 允许 |
| `experimental` | 允许继续探索，但预期会有 bridge 漂移或设备侧缺口 | 阻断 | 仅 `experimental` 允许 |
| `unsupported` | 不在 catalog 内，toolkit 无法给出可靠承诺 | 阻断 | 阻断 |

## Verified Allowlist

<!-- GENERATED:support-matrix-verified-allowlist:start -->
- `expo`
- `@expo/metro-runtime`
- `expo-constants`
- `expo-linking`
- `expo-router`
- `react`
- `react-dom`
- `react-native`
- `expo-status-bar`
- `@babel/runtime`
- `@react-native-community/cli`
- `metro`
- `@react-native-oh/react-native-harmony`
- `@react-native-oh/react-native-harmony-cli`
- `expo-harmony-toolkit`
- `react-native-reanimated`
- `@react-native-oh-tpl/react-native-reanimated`
- `react-native-svg`
- `@react-native-oh-tpl/react-native-svg`
<!-- GENERATED:support-matrix-verified-allowlist:end -->

## Capability Telemetry

<!-- GENERATED:support-matrix-capability-telemetry:start -->
所有 capability 从现在开始都同时公开：

- `supportTier`
- `runtimeMode`
- `evidence.bundle`
- `evidence.debugBuild`
- `evidence.device`
- `evidence.release`
- `evidenceSource.bundle`
- `evidenceSource.debugBuild`
- `evidenceSource.device`
- `evidenceSource.release`

判读规则：

- `runtimeMode=shim`：说明当前还在桥接或占位阶段，即使 bundle / debug build 已完成，也不应宣称 verified
- `runtimeMode=adapter`：说明已经进入真实适配路径，但仍缺少某些验收证据
- `runtimeMode=verified`：说明能力已进入正式承诺，且证据闭环完成
<!-- GENERATED:support-matrix-capability-telemetry:end -->

为了避免把“只差真机”与“当前子 API 还没实现到位”混在一起，`v1.8.x` 文档额外使用以下标记：

- `🟡 可用待晋升`：当前子集已经有可信实现，样例和模拟器路径可用；下一步主要缺真机 / release 证据
- `⛔ 完全不支持`：能力仍在 catalog 外，或根本不在当前公开承诺范围

## Preview 能力

<!-- GENERATED:support-matrix-preview-capabilities:start -->
| Expo 能力 | 当前层级 | runtimeMode | evidence | Harmony 依赖方向 | 受管权限 | 官方 sample route |
| --- | --- | --- | --- | --- | --- | --- |
| `expo-file-system` | `preview` | `adapter` | `bundle=yes[automated], debugBuild=yes[automated], device=yes[manual-doc], release=no[none]` | react-native-fs | 无新增必需权限 | `/file-system` |
| `expo-image-picker` | `preview` | `adapter` | `bundle=yes[automated], debugBuild=yes[automated], device=yes[manual-doc], release=no[none]` | react-native-image-picker, react-native-permissions | ohos.permission.CAMERA、ohos.permission.MICROPHONE、ohos.permission.READ_IMAGEVIDEO | `/image-picker` |
| `expo-location` | `preview` | `adapter` | `bundle=yes[automated], debugBuild=yes[automated], device=yes[manual-doc], release=no[none]` | @react-native-community/geolocation, react-native-permissions | ohos.permission.LOCATION、ohos.permission.APPROXIMATELY_LOCATION、ohos.permission.LOCATION_IN_BACKGROUND、ohos.permission.ACCELEROMETER | `/location` |
| `expo-camera` | `preview` | `adapter` | `bundle=yes[automated], debugBuild=yes[automated], device=yes[manual-doc], release=no[none]` | react-native-camera-kit, react-native-permissions | ohos.permission.CAMERA、ohos.permission.MICROPHONE | `/camera` |
<!-- GENERATED:support-matrix-preview-capabilities:end -->

说明：

- 当前四项 preview capability 都已经完成 preview baseline 的 bundle / debug build / route walkthrough
- 四项 preview capability 都已经进入 `adapter` 路径；`device=yes[manual-doc]` 只表示已有人工设备验收记录，仍不代表 verified 或 release-ready
- 当前 preview baseline 的默认 evidenceSource 固定为：`bundle/debugBuild=automated`、`device=manual-doc`、`release=none`
- `v1.8.x` 开始，combined sample smoke 只负责总回归；每项 capability 还必须单独维护 device / release acceptance 记录，见 [acceptance/v1.8.x-capability-board.md](../acceptance/v1.8.x-capability-board.md)
- `expo-file-system`
  - `🟡` 当前主路径是 UTF-8/base64 sandbox I/O、append/partial read、`getInfoAsync({ md5: true })` 与 `downloadAsync`
- `expo-image-picker`
  - `🟡` 当前主路径是单选、多选、mixed library selection、system photo/video capture、pending result 恢复，以及 image/video metadata 展示
- `expo-location`
  - `🟡` 当前主路径是 foreground/background permission、current / watch、heading snapshot/watch、geocode / reverse-geocode
- `expo-camera`
  - `🟡` 当前主路径是 embedded preview、preview pause/resume、still capture、video recording 与 microphone permission

## Experimental 能力

| Expo 能力 / 依赖 | 当前层级 | runtimeMode | evidence | 说明 |
| --- | --- | --- | --- | --- |
| `expo-notifications` | `experimental` | `shim` | `bundle=no, debugBuild=no, device=no, release=no` | 服务链路与交付故事未打通 |
| `react-native-gesture-handler` | `experimental` | matrix 外本地探索 | matrix 外 | 继续保留本地探索 shim，但不在公开 verified 矩阵内 |

## UI Stack 配对规则

<!-- GENERATED:support-matrix-ui-stack:start -->
canonical 包与 Harmony adapter 包固定为双向强制：

- `react-native-reanimated` ↔ `@react-native-oh-tpl/react-native-reanimated`
- `react-native-svg` ↔ `@react-native-oh-tpl/react-native-svg`

规则固定为：

- 出现 canonical 包，必须同时出现对应 `@react-native-oh-tpl/*`
- 出现 `@react-native-oh-tpl/*`，也必须同时出现对应 canonical 包
- canonical 包按 semver 校验
- `@react-native-oh-tpl/*` 按 exact dependency specifier 校验

当前固定 exact specifier：

- `@react-native-oh-tpl/react-native-reanimated`: `github:react-native-oh-library/react-native-harmony-reanimated#9fdbe676209937383907be0592291223c6ca7ad7&path:react-native-harmony-reanimated`
- `@react-native-oh-tpl/react-native-svg`: `github:react-native-oh-library/react-native-harmony-svg#97c31d2f72559931d62fa84a9c86e86d343753d3&path:react-native-harmony-svg`
<!-- GENERATED:support-matrix-ui-stack:end -->

## `doctor`

对任意项目执行：

```bash
expo-harmony doctor --project-root /path/to/app
expo-harmony doctor --project-root /path/to/app --strict
expo-harmony doctor --project-root /path/to/app --target-tier preview
```

固定行为：

- `--strict`：等价于 `--target-tier verified`，不在 verified 矩阵则 exit code `2`
- `--target-tier preview`：允许 verified + preview
- `--target-tier experimental`：允许 verified + preview + experimental

`doctor-report.json` 继续保留现有稳定字段，并新增 capability 级别可读元数据：

- `capabilities[].runtimeMode`
- `capabilities[].evidence.bundle`
- `capabilities[].evidence.debugBuild`
- `capabilities[].evidence.device`
- `capabilities[].evidence.release`
- `capabilities[].evidenceSource.bundle`
- `capabilities[].evidenceSource.debugBuild`
- `capabilities[].evidenceSource.device`
- `capabilities[].evidenceSource.release`
- `coverageProfile`
- `dependencies[].gapCategory`
- `nextActions[]`

判读方式：

- 任一 `evidence.* = false`，表示晋升到 verified 前仍缺证据
- `evidenceSource.device = manual-doc`，表示该证据来自人工验收记录，不应被表述成自动化设备验证
- `runtimeMode !== verified`，表示即使已有部分证据，也仍不属于正式承诺
- `coverageProfile=bare`，表示当前项目已落入 bare workflow 主线规划，但不等于当前 matrix 已正式支持 bare
- `gapCategory=third-party-native-gap`，表示问题不应再被模糊描述成普通 matrix drift，而是主线 blocker
- `nextActions[]` 的顺序即 toolkit 当前建议的处理顺序

当前公开阻断 issue code 继续包括：

- `matrix.expo_sdk.unsupported`
- `dependency.required_missing`
- `dependency.version_mismatch`
- `dependency.specifier_mismatch`
- `dependency.not_allowed`
- `dependency.router_peer_missing`
- `config.router_plugin.missing`
- `config.scheme.missing`
- `config.bundle_script.mismatch`
- `config.native_identifier.missing`
- `metadata.template_version.mismatch`
- `metadata.matrix_id.mismatch`

## Managed Sidecar 行为

toolkit 受管的核心产物仍包括：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`
- `harmony/entry/src/main/module.json5`
- `.expo-harmony/shims/*`
- `.expo-harmony/toolkit-config.json`

当前约束：

- `entry/src/main/module.json5` 的 `requestPermissions` 由 toolkit 根据已启用能力自动补齐
- preview / experimental 能力的 Metro import path 通过 `.expo-harmony/shims/<package>` 接管
- `toolkit-config.json` 会记录 capability 的 `runtimeMode`、`evidence` 与 `evidenceSource`
- `toolkit-config.json` 也会记录当前项目的 `coverageProfile` 与有序 `nextActions`
- verified UI stack 依赖继续走现有 autolinking + `.har` 管理逻辑

## Release Tracks

从 `v1.8` 开始，发布节奏按双轨设计：

<!-- GENERATED:support-matrix-release-tracks:start -->
- `latest`
  - 只承接完整验收的 `verified` 能力
  - 只允许 verified sample / gate 作为发布依据
- `next`
  - 承接 preview fast track
  - 必须至少通过 preview sample、bundle、debug build gate
  - 不得被描述为 verified 或 release-ready
<!-- GENERATED:support-matrix-release-tracks:end -->

## Capability Promotion Gate

能力从 `preview` 晋升到 `verified` 前，必须同时满足：

- 进入真实 runtime path，`runtimeMode` 不再是 `shim`
- 官方 sample 可运行
- `bundle` 成功
- debug `build-hap` 成功
- device-side 场景验收完成
- release signing / release HAP 验收完成
- 文档、矩阵、roadmap、acceptance 记录同 PR 更新

## 当前仍未进入正式公开承诺

- bare Expo
- 多 Expo / RNOH 并行 verified 矩阵
- 任意第三方 native package 的即时正式承诺

说明：

- 上述项目并没有从 roadmap 消失；它们会逐步进入同一条主线 capability catalog
- 这份 support matrix 只记录当前已经公开验证到哪一步，而不是未来愿景本身
