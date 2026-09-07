# CLI 构建指南

v2 发布轨由 package semver 决定：v2 prerelease 版本发布到 `next`，稳定版本发布到 `latest`；精确发布状态只记录在对应 acceptance 文件中。`v1.11.4` 延续 `verified + preview + experimental` 支持分层，并对账 `v1.11.3` 的发布状态：v1.11.x 剩余 blocker 继续写成 burn-down 台账与降级策略，ccnubox_rn signed simulator app-shell gate 作为既有证据保留；`doctor` 继续分类任意 Expo 项目、标出 blocker 类型并给出有序下一步；`expo55-rnoh082-ui-stack` 仍是唯一 verified 矩阵。

CLI 命令集合不变：

- `doctor`
- `init`
- `sync-template`
- `env`
- `bundle`
- `build-hap`

## 推荐顺序

在项目根目录执行：

```bash
expo-harmony doctor --strict
expo-harmony doctor --target-tier preview
expo-harmony init --force
expo-harmony env --strict
expo-harmony bundle
expo-harmony build-hap --mode debug
```

职责划分：

- `doctor --strict` 负责项目是否落入公开矩阵
- `doctor --target-tier preview` 负责项目是否至少落在 preview 支持层
- `init` / `sync-template` 负责受管 sidecar 与 autolinking 产物
- `env --strict` 负责构建机是否 ready
- `bundle` 负责 `bundle.harmony.js`
- `build-hap` 负责串起 bundle、`ohpm`、`hvigor`

当前 preview capability onboarding 范围：

- `expo-file-system`
- `expo-image-picker`
- `expo-location`
- `expo-camera`
- `expo-secure-store`
- `expo-asset`
- `expo-device`
- `expo-clipboard`
- `expo-haptics`

当前 experimental formal slice：

- `react-native-gesture-handler`
- `@react-native-async-storage/async-storage`
- `react-native-screens`
- `react-native-safe-area-context`
- `react-native-webview`
- `jpush-react-native`
- `expo-media-library`
- `lottie-react-native`
- `@shopify/react-native-skia`

## UI stack 依赖安装注意事项

当前公开矩阵里的两项 Harmony adapter 依赖都固定为 Git URL + exact commit：

- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`

这些 Git 包在某些环境下会在 prepare 阶段尝试拉取上游私有资源。对于仓库开发和官方 sample，推荐：

```bash
pnpm install --ignore-scripts
```

这不会影响：

- `doctor`
- `init`
- `sync-template`
- `bundle`
- `build-hap` 前的 sidecar 生成

因为 toolkit 只需要这些 adapter 的 package metadata、`harmony/*.har` 和已提交文件，不依赖其 prepare 阶段产物。

## sidecar 生成行为

### 保留 iOS／Android 版本的 Harmony JS 配對

Expo 55／56／57 的 preview 專案保留原本的 React／RN，另外安裝 `@harmony-js/react@npm:react@19.1.1`。生成的 Harmony Metro config 會將 `react` 和 JSX runtime 子路徑指向此別名，以匹配 RNOH 0.82.29；既有手寫 config 必須自行保留這個 alias。這不是 React 19.2 新 API 的 runtime parity。

當 Harmony adapter 的 peer 版本落後於 App 的原生平台版本時，以 npm alias 安裝相符的 JS 來源，再在 Harmony resolver 中使用：

```js
const { createHarmonyPackageResolver } = require('expo-harmony-toolkit/metro');
const resolveHarmonyPackage = createHarmonyPackageResolver(__dirname, {
  'react-native-reanimated': {
    source: '@harmony-js/react-native-reanimated', // npm:react-native-reanimated@3.6.0
    adapter: '@react-native-oh-tpl/react-native-reanimated',
  },
});
// 在既有 resolveRequest 中、RNOH resolver 前呼叫；null 表示交給後續 resolver。
const result = resolveHarmonyPackage(context, moduleName, platform);
if (result) return result;
```

此 helper 檢查 adapter alias 與 peer 版本，處理部分檔案 overlay、套件內部相對匯入及避免回指遞迴。非 Harmony 平台不攔截。原生 autolinking 必須排除 `@harmony-js/*`，Harmony 的 Babel worklet plugin 也必須與其 native adapter 配對；單改 Metro alias 不足以證明相容。

Harmony bundle 期間會暫時修正舊 Reanimated 的 React 19 class-component 檢查、舊 Reanimated／Gesture Handler 對 Fabric host instance 的存取，以及 Expo Router 56+ 對缺失 Screens feature flags 的存取，完成後還原。Gesture Handler 的可選 view-flattening 診斷只在 runtime 提供時執行，不停用手勢註冊。這不會補出新版 Screens／Skia 的原生能力；未實作 API 仍需個別驗證。

HAR normalize 也會補上 Screens `4.8.1-rc.3` 遺漏的 `RNSScreenContentWrapper` builder 註冊，並移除 descriptor watcher 初始化後的重複入棧。前者會遺失頁面內容，後者會讓返回操作露出已被取代的舊頁。使用 `--no-har-normalize` 時不會套用這些修正。

RNOH coordinator 也會將冷啟動 `launchURI` 傳入 worker registry，讓 worker 上的 `Linking.getInitialURL()` 與 UI context 取得同一個 URL。

Expo Router 的 Harmony bundle 會等待原生初始 URL 回應，不套用 Android 的 150 ms workaround，以免較慢的啟動把有效連結當成空值。原始套件在 bundle 後還原，iOS／Android 分支保持不變。

Harmony 的應用圖示、桌面前景圖層與啟動畫面圖示會使用 `expo.icon` 指定的本機 PNG，並保留 sidecar drift protection。遠端 URL 或其他圖片格式需先轉成本機 PNG；未設定 icon 時保留範例佔位資源。

檔案下載使用原生 HTTP API，不依賴 ArkTS 的 `global fetch`。回應上限為 25 MiB；HTTP 失敗、超限或寫入不完整時不替換目的檔。`md5` 使用原生 CryptoFramework 的 MD5，不再回傳預覽用的非 MD5 雜湊。

WebView、Skia 與 Lottie 的 ArkUI 視圖也透過 `RNOHPackage` 註冊 builder，保留原有 TurboModule factory。只有 C++ descriptor 或 TurboModule 註冊並不足以顯示這些元件。

包含 WebView 的專案會在 Ability 的 UI 執行緒先初始化 ArkWeb，再啟動 RNOH worker，避免冷啟動時引擎載入競爭造成空白頁。沒有 WebView 的專案不增加引擎初始化。既有手動修改的 `EntryAbility.ets` 仍受 drift protection 保護，需自行保留此呼叫順序。

定位與方向 watch 使用原生持續事件，取消訂閱與 RN instance 銷毀時解除監聽。定位的毫秒間隔會轉為 Harmony API 的秒數；未指定的選項不傳入原生 API。方向資料不假稱已校準或已取得真北偏角；感測器與定位服務的精度仍需獨立驗證。

Lottie `6.4.1` adapter 的 `colorFilters` 會以陣列跨越 JS／C++ 邊界，與 ArkTS 的消費型別保持一致，不再被錯誤解析為字串。

Skia `1.3.8-rc.1` adapter 的 view snapshot 直接使用 RNOH 已解包的字串節點 ID，不再讀取舊版 Result 的 `.ok` 欄位。

CameraRoll 的相簿保存保留 `file:///` 的絕對路徑；保存對話框拒絕、取消或寫入失敗會回傳錯誤，且不會阻塞下一次保存。產生的主 Ability 與 AppScope 共用 `app_name` label 資源，讓 PhotoAccessHelper 能正確取得授權框中的 App 名稱。

ImagePicker 的系統選圖器使用所選檔案授權，不先索取整個相簿的讀取權限，也不重複要求所選 URI 的授權，取消後不再開啟第二個選圖器。所選圖庫檔案會複製到 App 快取，回傳可供原生檔案消費者使用的本地 URI，並保留原始檔名與 asset ID；明確呼叫權限 API 的行為保持不變。

`init` / `sync-template` / `bundle` / `build-hap` 会统一生成：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`

当前规则：

- toolkit 会调用项目安装的 `react-native-harmony-cli` 中的 `link-harmony` command
- 只对白名单两项 `@react-native-oh-tpl/*` adapter 传入 include allowlist
- `reanimated` 与 `svg` 会进入 `autolinking.cmake` 与 `RNOHPackagesFactory.*`
- `reanimated` 与 `svg` 通过 `harmony/oh-package.json5` 中的 `.har` 依赖接入

额外说明：

- `react-native-gesture-handler` 与 Wave A / Wave B 第三方 native packages 已进入 formal experimental onboarding，但仍不属于 verified 公开承诺
- bare workflow 当前只有 intake / debug baseline，不代表 release-ready
- `doctor --strict` 仍只代表完整验收的 verified 能力

toolkit 不会改动用户业务路由、动画逻辑或页面源码；它只负责受管 sidecar、构建链和 metadata。

生成的 entry module 會將 `expo.scheme` 註冊為 `viewData` deep link；未設定時使用應用識別字，與 Linking shim 保持一致。`http`／`https` 及自身 scheme 也會加入 `querySchemes`，供 RNOH `Linking.canOpenURL` 查詢。App 使用支付或通訊軟體等其他協定時，需在自己的 module sidecar 加入實際使用的 scheme；宣告不代表對應 App 已安裝。

## Debug 与 Release

### Debug

```bash
expo-harmony env --strict
expo-harmony build-hap --mode debug
```

### HAR normalize opt-out

默认情况下，`build-hap` 会把 root / entry `oh-package.json5` 里的 `file:*.har` 本地依赖解压到 `harmony/expo-harmony-local-deps`，再让 `ohpm` 消费解压后的目录。这条路径仍是默认 verified build path。

如果项目已经确认当前 DevEco / ohpm 能直接消费纯 HAR，可以显式跳过这一步：

```bash
EXPO_HARMONY_SKIP_HAR_NORMALIZE=1 expo-harmony build-hap --mode debug
expo-harmony build-hap --mode debug --no-har-normalize
```

开启后：

- `file:../node_modules/.../*.har` specifier 会保持原样
- 不生成 `expo-harmony-local-deps`
- 不临时注册 normalized local HAR modules 到 `build-profile.json5`
- 不执行依赖 normalized local RNOH 目录的 codegen / path 兜底
- `ohpm install --all` 与 `hvigor assembleHap` 继续执行

该开关是 escape hatch，不代表 opt-out 路径和默认路径具备完全相同的兼容兜底。

### Release

```bash
expo-harmony env
expo-harmony build-hap --mode release
```

release 依赖：

- DevEco Studio / Harmony SDK
- `hvigor`
- `ohpm`
- 有效的 signing 配置

更多发布细节见 [npm 发布说明](./npm-release.md) 与 [签名与 Release 说明](./signing-and-release.md)。
