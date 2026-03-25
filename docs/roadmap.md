# 路線圖

## v0.1 遷移工具包
- plugin + CLI + vendored 模板
- 相容性掃描
- 冪等模板同步

## v0.2 可打包 Sample
- 倉庫內官方最小 sample
- 文檔化的 `doctor -> init -> bundle -> DevEco/HAP` 鏈路
- 最小 Harmony skeleton 與 bundle 路徑驗證

## v0.5 受限平台承諾
- 單一驗證矩陣 `expo55-rnoh082-minimal`
- 明確的白名單依賴與阻斷規則
- `doctor --strict` fail-fast 準入檢查
- 官方 sample 的 CI 驗證與手動 DevEco release gate

## v0.8 App Shell 能力擴張
- 單一驗證矩陣 `expo55-rnoh082-app-shell`
- `expo-router`、`expo-linking`、`expo-constants` 進入承諾範圍
- 官方 App Shell sample 與 router 邊界 fixtures
- App Shell 級別的手動驗收，不包含完整原生 deep link 生命週期

## v1.0 正式平台承諾
- 更大的 Expo modules 覆蓋面
- 熱門第三方依賴替代策略
- 穩定 release 與回歸驗證流程
