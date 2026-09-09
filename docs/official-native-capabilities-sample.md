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

当前实现与缺口（2026-09-08 复验）：

- camera / microphone permission bridge，以及系统 CameraPicker 拍照 / 录像入口。
- 模拟器已验证相机授权及取消返回；没有取得成功拍摄的产物。
- embedded `CameraView` 没有相机输入与预览输出连接；mount / pause / resume 明确返回 unsupported，不再用本地状态表伪装成功。
- stop / toggle 没有连接正在录制的原生会话，明确返回 unsupported；系统 Picker 内的完成按钮不等于 App 可控制录制会话。
- 上述是实现缺口，不是仅缺真机验证；`device=false`，不得提升支持层级。

### `/secure-store`

`🟡 v1.9 app-foundation baseline`：

- `isAvailableAsync`
- session-scoped `setItemAsync`
- session-scoped `getItemAsync`
- `deleteItemAsync`
- encrypted persistence、keychain / keystore 等真实 native 后端仍待 device / release evidence

### `/asset`

`🟡 v1.9 app-foundation baseline`：

- `Asset.fromURI`
- `Asset.loadAsync`
- deterministic metadata display
- native resource resolution、asset cache parity 仍待 device / release evidence

### `/device`

`🟡 v1.9 app-foundation baseline`：

- stable Harmony placeholder metadata
- `getDeviceTypeAsync`
- real device model/build/hardware metadata 仍待 device / release evidence

### `/clipboard`

`🟡 v1.9 app-foundation baseline`：

- session-scoped string write/read
- `hasStringAsync`
- URL helper roundtrip
- real system pasteboard behavior 仍待 Harmony adapter evidence

### `/haptics`

`🟡 v1.9 app-foundation baseline`：

- `selectionAsync`
- `impactAsync`
- `notificationAsync`
- 当前为 no-op-safe shim；真实物理反馈仍待 device evidence

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
