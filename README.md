# Expo Harmony Toolkit

`expo-harmony-toolkit` 是一個實驗性的 Expo 到 HarmonyOS 遷移工具包。

它當前已進入 `v0.5` 階段，包含兩層能力：
- Expo config plugin 根入口 `app.plugin.js`
- CLI：`expo-harmony doctor`
- CLI：`expo-harmony init`
- CLI：`expo-harmony sync-template`
- 內建 vendored `harmony/` 模板
- Expo 模組與常見第三方依賴的相容性掃描
- `examples/official-minimal-sample` 官方最小 sample
- 單一受限矩陣 `expo55-rnoh082-minimal`
- `doctor --strict` 準入檢查

## 當前邊界
- 只支援 Managed/CNG Expo 專案
- 只對 `docs/support-matrix.md` 中的唯一受限矩陣承諾可打包
- 其他專案仍只保證掃描、腳手架生成、模板同步與冪等更新
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
expo-harmony doctor --project-root /path/to/app --strict
expo-harmony init --project-root /path/to/app
expo-harmony sync-template --project-root /path/to/app
```

## 工具輸出內容
- `harmony/`: vendored Harmony sidecar
- `metro.harmony.config.js`: Harmony 專用 Metro sidecar config
- `.expo-harmony/manifest.json`: 受管檔案清單
- `.expo-harmony/doctor-report.json`: 掃描報告
- `.expo-harmony/toolkit-config.json`: 工具生成的側車配置

從 `v0.5` 起，`doctor-report.json` 會額外包含：
- `matrixId`
- `eligibility`
- `blockingIssues`
- `advisories`

## 官方最小 Sample

官方 sample 位於 `examples/official-minimal-sample`。

它的目標不是展示完整 Expo 生態，而是作為唯一可承諾的最小鏈路：

```bash
cd examples/official-minimal-sample
pnpm harmony:doctor:strict
pnpm harmony:init
pnpm bundle:harmony
```

完整手動鏈路見 [docs/official-minimal-sample.md](./docs/official-minimal-sample.md)。
受限矩陣與反例說明見 [docs/support-matrix.md](./docs/support-matrix.md)。

## 路線圖
- `v0.1`: 遷移工具包
- `v0.2`: 官方最小 sample 可按文檔手動打包
- `v0.5`: 單一受限矩陣可打包
- `v1.0`: 正式平台承諾

更完整的階段說明見 [docs/roadmap.md](./docs/roadmap.md)。
