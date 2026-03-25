# v1.0 支持矩阵

`v1.0.0` 只公开承诺一条矩阵：`expo55-rnoh082-app-shell`。

这不是“任意 Expo 项目都能直接打包”的承诺，而是对这条 App Shell matrix 的正式受限平台承诺。

## 唯一公开矩阵

| 项目 | 要求 |
| --- | --- |
| Expo SDK | `55` |
| `expo-router` | `6.x` |
| `expo-linking` | `55.x` |
| `expo-constants` | `55.x` |
| React | `19.2.x` |
| React Native | `0.83.x` |
| `@react-native-oh/react-native-harmony` | `0.82.18` |
| `@react-native-oh/react-native-harmony-cli` | `0.82.18` |
| `@react-native-community/cli` | `20.x` |
| `metro` | `0.83.x` |
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
- `@react-native-oh/react-native-harmony`
- `@react-native-oh/react-native-harmony-cli`

## App Shell 额外条件

只要使用 `expo-router`，还必须同时满足：

- 已安装 `expo-linking`
- 已安装 `expo-constants`
- Expo config 显式设置 `scheme`
- Expo config `plugins` 包含 `expo-router`

## `doctor --strict`

对任意项目执行：

```bash
expo-harmony doctor --project-root /path/to/app --strict
```

固定行为：

- 落在矩阵内：exit code `0`
- 不在矩阵内：exit code `2`

`doctor-report.json` 的以下字段视为 v1.0 稳定契约：

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
- `dependency.not_allowed`
- `dependency.router_peer_missing`
- `config.router_plugin.missing`
- `config.scheme.missing`
- `config.bundle_script.mismatch`
- `config.native_identifier.missing`
- `metadata.template_version.mismatch`
- `metadata.matrix_id.mismatch`

## 典型反例

以下几类输入会被视为不在 v1.0 承诺内：

- Expo SDK `53` 这一类旧 fixture
- `expo-camera` 这类未验证模块
- `expo-router` 缺少 `scheme`、`plugin` 或 peer 依赖的项目
- 缺少 `android.package` / `ios.bundleIdentifier` 的配置
- 旧版 `.expo-harmony` metadata 与当前 `matrixId` / `templateVersion` 不一致

## Release Gate

v1.0 的正式手动 release gate 以 DevEco Studio GUI 为准：

- `Build Debug Hap(s)` 成功
- 官方 App Shell sample 在模拟器或真机运行成功
- 首页显示 `Constants.expoConfig?.name`
- 首页显示 `Linking.createURL('/details')`
- 可进入 `/details`
- 可从 `/details` 返回首页

当前不把 `hvigor` 纯 CLI 打包链路纳入 v1.0 承诺范围。

## 承诺文字

`v1.0.0` 只对 `examples/official-app-shell-sample` 所代表的 App Shell 能力集合做正式受限平台承诺。

其他 Expo 项目仍可使用 `doctor`、`init`、`sync-template` 做迁移探索，但不会自动落入正式可打包承诺范围。
