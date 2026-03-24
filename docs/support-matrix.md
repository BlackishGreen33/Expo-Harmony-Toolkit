# v0.5 支援矩陣

`v0.5` 只承諾一條矩陣：`expo55-rnoh082-minimal`。

這不是一般 Expo 專案可打包承諾，而是「落在這條矩陣內的最小能力集合」可打包承諾。

## 唯一支援矩陣

- Expo SDK: `55`
- `react`: `19.2.x`
- `react-native`: `0.83.x`
- `@react-native-oh/react-native-harmony`: `0.82.18`
- `@react-native-oh/react-native-harmony-cli`: `0.82.18`
- `@react-native-community/cli`: `20.x`
- `metro`: `0.83.x`
- 明確原生標識：至少設定 `android.package` 或 `ios.bundleIdentifier`

## 允許依賴白名單

- `expo`
- `react`
- `react-native`
- `expo-status-bar`
- `@babel/runtime`
- `@react-native-community/cli`
- `metro`
- `@react-native-oh/react-native-harmony`
- `@react-native-oh/react-native-harmony-cli`

## `doctor --strict`

對任意專案執行：

```bash
expo-harmony doctor --project-root /path/to/app --strict
```

行為固定為：
- 落在矩陣內：exit code `0`
- 不在矩陣內：exit code `2`

報告會包含：
- `matrixId`
- `eligibility`
- `blockingIssues`
- `advisories`

## 典型反例

以下幾類輸入會被視為不在 v0.5 承諾內：
- Expo SDK `53` 一類的舊 fixture
- `expo-camera` 這類未驗證模組
- `expo-router` 這類仍需人工驗證的模組
- 缺少 `android.package` / `ios.bundleIdentifier` 的配置
- 舊版 `.expo-harmony` metadata 與當前 `matrixId` / `templateVersion` 不一致

## 承諾文字

`v0.5` 只對 `examples/official-minimal-sample` 所代表的最小能力集合做可打包承諾。

其他 Expo 專案仍可使用 `doctor`、`init`、`sync-template` 做遷移探索，但不自動落入可打包承諾範圍。
