# v2 Official Sample Lanes

`v2.0.0-next.0` 目前是尚未發布的工作版本。npm 已發布的穩定 `latest` 仍是 `1.11.4`；本文件的 sample lanes 是 packaging 驗證分組，不是 npm 的 `latest`／`next` release channels。

v2 portable release gate 直接使用 `scripts/v2-sample-lanes.js`，固定覆蓋 5 lane groups / 7 physical projects。每一輪只建立一個 toolkit tarball，先以該 tarball 建立獨立 consumer production graph 並要求 `critical=0`，再由七個 sample 安裝同一個 tarball；禁止以 workspace link 取代發布包證據。workspace/examples audit 另行記錄既有 baseline，不是 publish hard gate。

| Lane group | Official sample | Target tier | Coverage profile | 目的 |
| --- | --- | --- | --- | --- |
| managed verified | `official-minimal-sample` | `verified` | `managed-core` | 最小 managed build path |
| managed verified | `official-app-shell-sample` | `verified` | `managed-core` | router / linking / constants app shell |
| managed verified | `official-ui-stack-sample` | `verified` | `managed-core` | UI-stack adapters |
| preview / foundation | `official-native-capabilities-sample` | `preview` | `managed-native-heavy` | Expo native modules 與 foundation shims |
| bare | `official-bare-sample` | `experimental` | `bare` | bare packaging baseline 與獨立 marker |
| Wave A | `official-wave-a-sample` | `experimental` | `third-party-native-heavy` | gesture、async storage、safe-area limitation、screens fallback |
| Wave B | `official-wave-b-sample` | `experimental` | `third-party-native-heavy` | WebView、media library、Lottie、push fallback、Skia fallback |

## Portable hard gate

每個 project 都在獨立暫存 workspace 依序執行：

1. materialize official sample，不修改來源；
2. 安裝同一個 packed tarball；
3. `doctor --json`，程式化驗證 manifest 指定的 target tier、coverage profile 與 eligibility；
4. `init --force`；
5. 連續兩次 `sync-template --force`，第二次必須 `written=0` 且 `skipped=0`；
6. `bundle`，並驗證 sample 的唯一 marker；
7. 有 DevEco 環境時建立 debug HAP。

`EXPO_HARMONY_RELEASE_SKIP_HAP=1` 只跳過第 7 步。Hosted CI 仍必須完成全部七個 project 的 portable gate；release HAP、simulator 與真機語義證據分別由後續 acceptance 關閉。

## Exception boundary

- push routes 只執行停用 push 或 manual sidecar fallback；
- screens route 僅以 `enableScreens(false)` 執行 fallback；
- Skia route 使用 non-Skia renderer 或停用 surface；
- safe-area 與 foundation shims 是 covered with limitations，不提升既有 support tier 或 public capability evidence。
