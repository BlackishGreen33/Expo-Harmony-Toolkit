# v1.5 支持矩阵

`v1.5.0` 继续只公开承诺一条矩阵：`expo55-rnoh082-ui-stack`。

这不是“任意 Expo 项目都能直接打包”的承诺，而是对一条 UI-stack 受限矩阵的正式公开承诺，并在 `v1.5` 中把 App Shell 基线扩张到三套常见 UI 依赖。

## 唯一公开矩阵

| 项目 | 要求 |
| --- | --- |
| Expo SDK | `55` |
| React | `19.2.x` |
| React Native | `0.83.x` |
| `@react-native-oh/react-native-harmony` | `0.82.18` |
| `@react-native-oh/react-native-harmony-cli` | `0.82.18` |
| `@react-native-community/cli` | `20.x` |
| `metro` | `0.83.x` |
| App Shell 依赖 | `expo-router` `6.x`、`expo-linking` `55.x`、`expo-constants` `55.x` |
| UI stack 依赖 | `react-native-reanimated` `3.6.0`、`react-native-svg` `15.0.0`、`react-native-gesture-handler` `2.14.1` |
| 原生标识 | 至少设置 `android.package` 或 `ios.bundleIdentifier` |

## 允许依赖白名单

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
- `react-native-gesture-handler`
- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`
- `@react-native-oh-tpl/react-native-gesture-handler`

## UI stack 配对规则

canonical 包与 Harmony adapter 包固定为双向强制：

- `react-native-reanimated` ↔ `@react-native-oh-tpl/react-native-reanimated`
- `react-native-svg` ↔ `@react-native-oh-tpl/react-native-svg`
- `react-native-gesture-handler` ↔ `@react-native-oh-tpl/react-native-gesture-handler`

规则固定为：

- 出现 canonical 包，必须同时出现对应 `@react-native-oh-tpl/*`
- 出现 `@react-native-oh-tpl/*`，也必须同时出现对应 canonical 包
- canonical 包按 semver 校验
- `@react-native-oh-tpl/*` 按 exact dependency specifier 校验

当前固定 exact specifier：

- `@react-native-oh-tpl/react-native-reanimated`: `github:react-native-oh-library/react-native-harmony-reanimated#9fdbe676209937383907be0592291223c6ca7ad7&path:react-native-harmony-reanimated`
- `@react-native-oh-tpl/react-native-svg`: `github:react-native-oh-library/react-native-harmony-svg#97c31d2f72559931d62fa84a9c86e86d343753d3&path:react-native-harmony-svg`
- `@react-native-oh-tpl/react-native-gesture-handler`: `github:react-native-oh-library/react-native-harmony-gesture-handler#ed5bcf2ada6e83f9ec0d50cf239c8d84db3c6462&path:react-native-harmony-gesture-handler`

## `doctor --strict`

对任意项目执行：

```bash
expo-harmony doctor --project-root /path/to/app --strict
```

固定行为：

- 落在矩阵内：exit code `0`
- 不在矩阵内：exit code `2`

`doctor-report.json` 的以下字段继续视为稳定公开契约：

- `matrixId`
- `eligibility`
- `blockingIssues`
- `advisories`
- `expoConfig.schemes`
- `expoConfig.plugins`

当前公开的稳定阻断 issue code 包括：

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

## sidecar 与 autolinking 形态

toolkit 受管的核心产物固定为：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`

实现约束：

- sidecar 生成链调用项目安装的 `react-native-harmony-cli` 中的 `link-harmony` command
- 只对白名单三项 `@react-native-oh-tpl/*` adapter 传入 include allowlist
- 当前上游 `link-harmony` 只有 `gesture-handler` 暴露原生 autolinking metadata，因此 `autolinking.cmake` / `RNOHPackagesFactory.*` 中的 native target 目前由它提供
- `harmony/oh-package.json5` 仍由 toolkit 统一补齐三项 adapter 的 `.har` 依赖，避免 sample、doctor 规则与 sidecar 产物漂移

## 构建与发布 gate

### Hosted CI gate

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball 安装 smoke：`doctor --strict`、`init --force`、`bundle`

### 本地 / Harmony 手动验证

- `official-ui-stack-sample` 在模拟器或真机运行成功
- SVG 正常渲染
- gesture 能触发可见动画
- 动画完成后 router 路由跳转仍正常
- `Build Debug Hap(s)` 成功

说明：

- GitHub hosted CI 默认不阻塞于 `build-hap --mode debug`
- `build-hap` 继续保留为本地或具备 DevEco 工具链环境时的附加验证
- `release` HAP 仍取决于 signing / profile 是否完整配置

## 当前不在承诺范围

- bare Expo
- `expo-image-picker`
- `expo-file-system`
- `expo-location`
- `expo-camera`
- `expo-notifications`
- 多矩阵并行支持
