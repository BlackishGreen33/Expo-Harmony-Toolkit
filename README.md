# Expo Harmony Toolkit

`expo-harmony-toolkit` 是一個實驗性的 Expo 到 HarmonyOS 遷移工具包。

它當前提供的是 `v0.1 遷移工具包` 能力，而不是「Expo 已正式支援 HarmonyOS」：
- Expo config plugin 根入口 `app.plugin.js`
- CLI：`expo-harmony doctor`
- CLI：`expo-harmony init`
- CLI：`expo-harmony sync-template`
- 內建 vendored `harmony/` 模板
- Expo 模組與常見第三方依賴的相容性掃描

## 當前邊界
- 只支援 Managed/CNG Expo 專案
- 只保證掃描、腳手架生成、模板同步與冪等更新
- 不保證任何 Expo 專案一定能產出 `.hap`
- 不自動處理 Expo native modules 的 Harmony 適配

## 快速開始

```bash
pnpm install
pnpm build
pnpm test
```

針對任意 Expo 專案：

```bash
expo-harmony doctor --project-root /path/to/app
expo-harmony init --project-root /path/to/app
expo-harmony sync-template --project-root /path/to/app
```

## 輸出內容
- `harmony/`: vendored Harmony sidecar
- `metro.harmony.config.js`: Harmony 專用 Metro sidecar config
- `.expo-harmony/manifest.json`: 受管檔案清單
- `.expo-harmony/doctor-report.json`: 掃描報告
- `.expo-harmony/toolkit-config.json`: 工具生成的側車配置

## 路線圖
- `v0.1`: 遷移工具包
- `v0.2`: 官方 sample 可打包
- `v0.5`: 受限矩陣可打包
- `v1.0`: 正式平台承諾

更完整的階段說明見 [docs/roadmap.md](./docs/roadmap.md)。
