# v1.6 支持矩阵

`v1.6` 开始，toolkit 不再只暴露“单一 allowlist”这一种语言，而是同时公开：

- 一条 `verified` 正式承诺矩阵
- 一组 `preview` 预览能力
- 一组 `experimental` 探索能力

`doctor --strict` 继续只代表 `verified`。

## Verified 公开矩阵

唯一 `verified` 矩阵仍是 `expo55-rnoh082-ui-stack`。

| 项目 | 要求 |
| --- | --- |
| Expo SDK | `55` |
| React | `19.1.1` |
| React Native | `0.82.1` |
| `@react-native-oh/react-native-harmony` | `0.82.18` |
| `@react-native-oh/react-native-harmony-cli` | `0.82.18` |
| `@react-native-community/cli` | `20.x` |
| `metro` | `0.83.x` |
| App Shell 依赖 | `expo-router` `6.x`、`expo-linking` `55.x`、`expo-constants` `55.x` |
| UI stack 依赖 | `react-native-reanimated` `3.6.0`、`react-native-svg` `15.0.0` |
| 原生标识 | 至少设置 `android.package` 或 `ios.bundleIdentifier` |

## Support Tiers

| 层级 | 含义 | `doctor --strict` | `doctor --target-tier <tier>` |
| --- | --- | --- | --- |
| `verified` | 已进入正式公开承诺，要求完整样例、构建、人工验收 | 允许 | 允许 |
| `preview` | 已具备 managed bridge / bundle 路径，但运行时仍待完整验收 | 阻断 | `preview` / `experimental` 允许 |
| `experimental` | 允许继续探索，但预期会有 bridge 漂移或设备侧缺口 | 阻断 | 仅 `experimental` 允许 |
| `unsupported` | 不在 catalog 内，toolkit 无法给出可靠承诺 | 阻断 | 阻断 |

## Verified Allowlist

- `expo`
- `expo-constants`
- `expo-linking`
- `expo-router`
- `react`
- `react-native`
- `expo-status-bar`
- `@babel/runtime`
- `@react-native-community/cli`
- `metro`
- `expo-harmony-toolkit`
- `@react-native-oh/react-native-harmony`
- `@react-native-oh/react-native-harmony-cli`
- `react-native-reanimated`
- `react-native-svg`
- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`

## Preview 能力

| Expo 能力 | 当前层级 | Harmony 依赖方向 | 受管权限 | 官方 sample route |
| --- | --- | --- | --- | --- |
| `expo-file-system` | `preview` | `react-native-fs` | 无新增必需权限 | `/file-system` |
| `expo-image-picker` | `preview` | `react-native-image-picker` + `react-native-permissions` | `ohos.permission.CAMERA`、`ohos.permission.READ_IMAGEVIDEO` | `/image-picker` |

说明：

- preview 能力会进入 `DoctorReport.capabilities`
- toolkit 会生成对应 Metro alias shim，确保 preview 项目能稳定 bundle
- preview 不等于 verified；没有运行时与设备侧证据前，不可对外宣称完全可用

## Experimental 能力

| Expo 能力 / 依赖 | 当前层级 | 说明 |
| --- | --- | --- |
| `expo-location` | `experimental` | 规划走共享 permission bridge + geolocation 方案 |
| `expo-camera` | `experimental` | 相机预览与拍照仍需稳定 Harmony 原生桥 |
| `expo-notifications` | `experimental` | 服务链路与交付故事未打通 |
| `react-native-gesture-handler` | `experimental` | 继续保留本地探索 shim，但不在公开 verified 矩阵内 |

## UI Stack 配对规则

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

`doctor-report.json` 继续保留现有稳定字段，并新增：

- `targetTier`
- `supportSummary`
- `capabilities`
- `dependencies[].supportTier`

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

新增约束：

- `entry/src/main/module.json5` 的 `requestPermissions` 由 toolkit 根据已启用能力自动补齐
- preview / experimental 能力的 Metro import path 通过 `.expo-harmony/shims/<package>` 接管
- verified UI stack 依赖继续走现有 autolinking + `.har` 管理逻辑

## 构建与发布 Gate

### Hosted CI gate

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball 安装 smoke：`doctor --strict`、`init --force`、`bundle`

### Capability acceptance gate

- `official-native-capabilities-sample` 在 `--target-tier preview` 下通过 `doctor`
- `sync-template` 生成对应 preview shims 与 Harmony permissions
- `bundle` 成功产出 `bundle.harmony.js`

### Verified promotion gate

能力从 `preview` 晋升到 `verified` 前，必须同时满足：

- 官方 sample 可运行
- debug `build-hap` 成功
- 设备侧场景验收完成
- 文档、矩阵、roadmap、acceptance 记录同 PR 更新

## 当前不在短期输入范围

- bare Expo
- 多 Expo / RNOH 并行 verified 矩阵
- 任意第三方 native package 的即时正式承诺
