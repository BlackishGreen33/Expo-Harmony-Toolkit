# 官方最小 Sample 打包指南

這份指南只適用於倉庫內的 `examples/official-minimal-sample`。

它的目標是驗證最小鏈路：
1. `doctor`
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
cd examples/official-minimal-sample
pnpm harmony:doctor
pnpm harmony:init
pnpm bundle:harmony
```

成功後會產出：
- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/doctor-report.json`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

## DevEco Studio
- 用 DevEco Studio 打開 `examples/official-minimal-sample/harmony`
- 等待索引與同步完成
- 完成 Signing Config
- 選擇 `entry`
- Run 或 Build HAP

## 承諾邊界
- 這份流程只對官方最小 sample 做最小鏈路驗證
- 它不代表任意 Expo 專案都能直接打包成 HarmonyOS 應用
- 其他 Expo modules 與第三方依賴仍需經過 `doctor` 與後續人工適配
