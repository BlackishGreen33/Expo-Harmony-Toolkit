# 官方 Native Capabilities Sample

路径：`examples/official-native-capabilities-sample`

这个 sample 是官方 preview native-capability 与 `v1.9.0` app-foundation walkthrough。构建、模拟器回调、尚未实现的接口和真机 / release 证据分别验收；打包成功不代表所有按钮都有原生实现。

从 `v1.8.x` 开始，这个 sample 的角色会固定成两层：

- combined smoke：负责四项 preview capability 的总回归
- per-capability acceptance：每条 route 继续单独维护 device / release 记录，不再让 combined smoke 代替单项证据

标记说明：

- `🟡` 当前可用子集：这部分已经有可信实现，样例和模拟器路径可用；下一步主要缺真机 / release 证据

## 当前覆盖

- `expo-file-system`
- `expo-image-picker`
- `expo-location`
- `expo-camera`
- `expo-secure-store`
- `expo-asset`
- `expo-device`
- `expo-clipboard`
- `expo-haptics`

当前 route：

- `/file-system`
- `/image-picker`
- `/location`
- `/camera`
- `/secure-store`
- `/asset`
- `/device`
- `/clipboard`
- `/haptics`

对应的逐 capability 追踪板见：

- [v1.8.x capability board](../acceptance/v1.8.x-capability-board.md)

## 每条 route 的真实范围

### `/file-system`

`🟡 当前可用子集`：

- sandbox 目录创建
- UTF-8 写入 / 读回
- base64 roundtrip
- append / partial read
- `getInfoAsync({ md5: true })`
- `downloadAsync`
- 清理生成产物

### `/image-picker`

`🟡 当前可用子集`：

- media permission
- camera permission
- 单选图库选择
- 多选图库选择
- mixed image+video library selection
- system photo capture
- system video capture
- pending result 恢复
- image / video asset metadata 展示
- `allowsEditing`／`aspect` 使用 Image Kit 裁切對話框，支援移動、縮放、確認／取消與實際像素輸出；`quality` 重新編碼
- SDK 57 模擬器已取得 4:3 裁切 PNG，亦驗證取消；相機成功產物仍需可用影像來源

### `/location`

`🟡 当前可用子集`：

- foreground permission
- background permission
- `getCurrentPositionAsync`
- `watchPositionAsync`
- `getHeadingAsync`
- `watchHeadingAsync`
- `geocodeAsync`
- `reverseGeocodeAsync`

说明：

- 背景权限按 Harmony 的独立后台权限契约暴露，不伪装成 Expo 的完全同构平台行为
- heading 使用 Harmony 传感器方向语义，属于最接近 Expo 的等价语义，不复用 GPS `direction`

### `/camera`

目前接線與證據邊界（2026-09-19）：

- camera／microphone permission bridge；`CameraView` 的 XComponent surface 接入 Camera Kit input、preview、photo／video session。
- `onCameraReady` 等待原生第一幀；pause／resume 操作 preview output；卸載及背景切換釋放原生資源。
- PhotoOutput 回呼寫入 JPEG；AVRecorder 提供 start／stop／pause／resume，完成後讀取實際影片 metadata，不以本機狀態或取消結果冒充拍攝成功。
- `2.0.0-next.4` 的 Expo 55／56／57 native sample 在 HarmonyOS 6.0.2（API 22）模擬器使用 Mac 攝影機，均取得可解碼的 `720×1280` JPEG；首張照片依序為 `315820`、`314404`、`315553` bytes。這是既有測試簽名 HAP 的本日重測，沒有重新構建或發包；HAP 雜湊與操作結果見 [Camera acceptance 的模擬器紀錄](../acceptance/v1.8.x-expo-camera-device.md#2026-09-19-模擬器重測)。
- 三個 SDK 均驗證背景後回到前景可再拍照，背景清理完成後 CameraService 的 active cameras／sessions 均為 `0`；SDK 56 另驗證返回 sample 首頁後釋放。SDK 57 暫停／恢復後取得新照片，但首次嘗試曾發生一次 `30s` 拍照逾時，後續相同操作未穩定重現，原因未定，不能宣稱生命週期驗收全部通過。
- 錄影及完整權限／重試矩陣仍未驗證。6.0.2 模擬器使用本機攝影機；虛擬圖片輸入自 26.0.0 才提供，見[華為模擬器攝影機說明](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/ide-emulator-more-features)。
- 範圍是面向／模式、預覽與基本拍攝控制；鏡頭列舉、尺寸列舉、條碼掃描等完整 Expo Camera API 未涵蓋，`device=false`／`release=false` 不變。

### `/secure-store`

`🟡 v1.9 app-foundation baseline`：

- `isAvailableAsync`
- Harmony Asset Store 加密儲存：`setItemAsync` / `getItemAsync`，重啟後可讀回
- 同步 `setItem` / `getItem`，`keychainService` 隔離
- `deleteItemAsync`
- 不支援的生物辨識、密碼保護及共享 access group 明確拒絕；真機及 release 驗收仍待補

### `/asset`

`🟡 v1.9 app-foundation baseline`：

- `Asset.fromURI`
- `Asset.loadAsync`
- Metro module metadata、打包 rawfile 資源解析與快取
- HTTP / base64 data URI 實際寫入本機快取；失敗不標為 downloaded
- `useAssets` 非同步完成；真機及 release 驗收仍待補

### `/device`

`🟡 v1.9 app-foundation baseline`：

- Harmony `deviceInfo` 與系統記憶體資料，識別 emulator
- `getDeviceTypeAsync`
- real device model/build/hardware metadata 仍待 device / release evidence

### `/clipboard`

`🟡 v1.9 app-foundation baseline`：

- 系統 pasteboard 文字 / HTML 寫入與權限感知讀取
- `hasStringAsync`
- URL helper roundtrip
- 圖片讀寫、尺寸與 change events；原生失敗不吞錯

### `/haptics`

`🟡 v1.9 app-foundation baseline`：

- `selectionAsync`
- `impactAsync`
- `notificationAsync`
- 呼叫 Harmony vibrator，以不同 touch duration 對應樣式並傳回原生錯誤；物理回饋品質待真機驗證

### `/foundation-check`

單一離線檢查頁驗證 SecureStore 同步 / 非同步 / service 隔離、內建 SVG 與 PNG data URI 的實際快取內容、`useAssets`、系統剪貼簿文字 / HTML / URL / 圖片，以及 Device metadata。頁面顯示 RNOH 原生安全區及 frame，供旋轉與邊距檢查。此頁不連接正式 API，也不代替逐項真機驗收。

## 推荐命令

```bash
cd examples/official-native-capabilities-sample
pnpm run harmony:doctor:preview
pnpm run harmony:sync-template
pnpm run harmony:bundle
pnpm run harmony:build:debug
```

如果要确认它为什么不能进入 `verified`：

```bash
pnpm run harmony:doctor:strict
```

预期结果：

- `doctor --target-tier preview`：通过
- `doctor --strict`：失败，因为 preview capability 仍然不在 verified allowlist
- `sync-template`：产出 preview shims、Harmony permissions、toolkit telemetry
- `bundle`：成功产出 `bundle.harmony.js`
- `build-hap --mode debug`：可进入 debug HAP 构建路径

## Release 路径

如果要继续验证 release 构建，先准备本地签名覆盖文件：

```bash
cp .expo-harmony/signing.local.example.json .expo-harmony/signing.local.json
$EDITOR .expo-harmony/signing.local.json
pnpm run harmony:env
pnpm run harmony:build:release
```

说明：

- `.expo-harmony/signing.local.example.json` 是可直接复制的本地 signing 範本
- `.expo-harmony/signing.local.json` 是本地 signing 入口
- toolkit 只会把非密钥 signing 引用写进 `harmony/build-profile.json5`；`storePassword` 与 `keyPassword` 会留在本地 signing 文件，并在 Hvigor build 期间临时注入后恢复
- 即使 release 构建可走通，在没有真机前，这四项能力也仍保持 `preview`

## 当前结论

- 这个 sample 属于 `preview` 主线，不等于已经进入 `verified`
- `doctor-report.json` 与 `toolkit-config.json` 中的 `runtimeMode` / `evidence.*` 会如实反映这些能力距离 verified 还缺哪些证据
- 当前重点是“bundle/debug baseline 可重复、核心流清楚、文档一致”
- 等未来补齐真机 gate 后，才讨论 capability promotion
