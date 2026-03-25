# 官方 App Shell Sample 打包指南

這份指南只適用於倉庫內的 `examples/official-app-shell-sample`。

它的目標是驗證 `v0.8` App Shell 矩陣下的最小鏈路：
1. `doctor --strict`
2. `init`
3. `bundle:harmony`
4. 用 DevEco Studio 打開 `harmony/`
5. 配置簽名
6. Run / Build HAP

## 前提
- 已在倉庫根目錄執行 `pnpm install`
- 已能使用 DevEco Studio
- 已有可用的 HarmonyOS 簽名環境

## 執行步驟

```bash
cd examples/official-app-shell-sample
pnpm harmony:doctor:strict
pnpm harmony:init
pnpm bundle:harmony
```

`bundle:harmony` 會帶 `--reset-cache`。這是刻意設計的，因為 `harmony:init` 會重生成 `index.harmony.js` 與 `.expo-harmony/shims/*`；如果 Metro 沿用舊 cache，DevEco 可能仍然拿到上一版入口圖，導致新生成的 runtime shim 沒進 bundle。

成功後會產出：
- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/doctor-report.json`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

## DevEco Studio
- 用 DevEco Studio 打開 `examples/official-app-shell-sample/harmony`
- 等待索引與同步完成
- 完成 Signing Config
- 選擇 `entry`
- Run 或 Build HAP

## 常見問題
- 如果 DevEco Studio 報 `add_subdirectory given source .../oh_modules/@rnoh/react-native-openharmony/src/main/cpp which is not an existing directory`
- 先回到 sample 目錄重新執行：

```bash
pnpm harmony:init
```

- 這會刷新生成的 `harmony/entry/src/main/cpp/CMakeLists.txt`，讓它在公開 `oh_modules` 沒有展開原始碼時，自動 fallback 到 `oh_modules/.ohpm/.../src/main/cpp`
- 然後回到 DevEco Studio 做一次 Sync Project 或重新 Run

- 如果 DevEco Studio 報大量 `use of undeclared identifier 'assert'`
- 這通常不是業務代碼問題，而是 RNOH 公開 include path 內自帶的 `RNOH/assert.h` 蓋到了 SDK 的標準 `assert.h`
- 先回到 sample 目錄重新執行：

```bash
pnpm harmony:init
```

- 然後在 DevEco Studio 重新 Sync / Build
- 如果 IDE 還黏著舊的 native cache，再執行一次 `Build > Clean Project`，或關掉工程後刪掉 `harmony/entry/.cxx` 再重新打開

- 如果模擬器啟動後出現紅屏，內容類似：
  - `[runtime not ready]: TypeError: Cannot read property 'NativeModule' of undefined`
- 先回到 sample 目錄重新執行：

```bash
pnpm harmony:init
pnpm bundle:harmony
```

- 這會刷新 `metro.harmony.config.js` 與 `.expo-harmony/shims/expo-modules-core/index.js`
- `v0.8` 的 App Shell sample 依賴一個 Harmony 專用 `expo-modules-core` shim，否則 `expo-router` / `expo-linking` / `expo-constants` 會在啟動時掉回 Expo 官方原生 runtime 路徑，進而因為 `globalThis.expo.NativeModule` 不存在而崩潰
- 如果重新 bundle 後 DevEco 仍載入舊資產，再重新 Run 一次，必要時先 `Build > Clean Project`

- 如果模擬器啟動後出現紅屏，內容類似：
  - `[runtime not ready]: ReferenceError: Property 'FormData' doesn't exist`
- 這通常表示 DevEco 仍然在使用舊的 `bundle.harmony.js`，而不是最新帶有 runtime prelude 的那版
- 先回到 sample 目錄重新執行：

```bash
pnpm harmony:init
pnpm bundle:harmony
```

- 確認 `index.harmony.js` 第一行是：
  - `require('./.expo-harmony/shims/runtime-prelude.js');`
- 然後回 DevEco Studio：
  - `Build > Clean Project`
  - 卸載模擬器裡已安裝的舊 app
  - 重新 `Run 'entry'`

## 人工驗收
- 首頁正常顯示 `Constants.expoConfig?.name`
- 首頁正常顯示 `Linking.createURL('/details')`
- 可從首頁進入 `/details`
- 可從詳情頁返回首頁

## 承諾邊界
- 這份流程只對官方 App Shell sample 做 `v0.8` 受限矩陣驗證
- 它不代表任意 Expo 專案都能直接打包成 HarmonyOS 應用
- App Shell 以外的 Expo modules 與第三方依賴仍需經過 `doctor --strict` 與後續人工適配
- 受限矩陣的完整條件見 [support-matrix.md](./support-matrix.md)
