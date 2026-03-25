# v0.8 支援矩陣

`v0.8` 只承諾一條矩陣：`expo55-rnoh082-app-shell`。

這不是一般 Expo 專案可打包承諾，而是「落在這條矩陣內的 App Shell 能力集合」可打包承諾。

## 唯一支援矩陣

- Expo SDK: `55`
- `expo-router`: `6.x`
- `expo-linking`: `55.x`
- `expo-constants`: `55.x`
- `react`: `19.2.x`
- `react-native`: `0.83.x`
- `@react-native-oh/react-native-harmony`: `0.82.18`
- `@react-native-oh/react-native-harmony-cli`: `0.82.18`
- `@react-native-community/cli`: `20.x`
- `metro`: `0.83.x`
- 明確原生標識：至少設定 `android.package` 或 `ios.bundleIdentifier`

## 允許依賴白名單

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

## App Shell 額外條件

只要使用 `expo-router`，還必須同時滿足：
- 已安裝 `expo-linking`
- 已安裝 `expo-constants`
- Expo config 顯式設定 `scheme`
- Expo config `plugins` 包含 `expo-router`

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
- `expoConfig.schemes`
- `expoConfig.plugins`

## 典型反例

以下幾類輸入會被視為不在 v0.8 承諾內：
- Expo SDK `53` 一類的舊 fixture
- `expo-camera` 這類未驗證模組
- `expo-router` 缺少 `scheme`、`plugin` 或 peer 依賴的專案
- 缺少 `android.package` / `ios.bundleIdentifier` 的配置
- 舊版 `.expo-harmony` metadata 與當前 `matrixId` / `templateVersion` 不一致

## 承諾文字

`v0.8` 只對 `examples/official-app-shell-sample` 所代表的 App Shell 能力集合做可打包承諾。

其他 Expo 專案仍可使用 `doctor`、`init`、`sync-template` 做遷移探索，但不自動落入可打包承諾範圍。
