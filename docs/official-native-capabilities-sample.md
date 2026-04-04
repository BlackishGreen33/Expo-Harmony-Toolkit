# 官方 Native Capabilities Sample

路径：`examples/official-native-capabilities-sample`

这个 sample 是 `v1.8.0` 的官方 preview native-capability walkthrough。它的目标不是把 preview 能力包装成 `verified`，而是把四项能力当前真实可承诺的 `🟡` 子集集中演示出来，并把 preview 边界收敛到真机 / release 证据，而不是接口缺口。

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

当前 route：

- `/file-system`
- `/image-picker`
- `/location`
- `/camera`

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

`🟡 当前可用子集`：

- embedded `CameraView` preview
- `pausePreview` / `resumePreview`
- still photo capture
- video recording start / stop / toggle
- microphone permission snapshot
- denied / canceled / successful result 展示

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
- toolkit 会把本地 signing 合并进 `harmony/build-profile.json5`
- 即使 release 构建可走通，在没有真机前，这四项能力也仍保持 `preview`

## 当前结论

- 这个 sample 属于 `preview` 主线，不等于已经进入 `verified`
- `doctor-report.json` 与 `toolkit-config.json` 中的 `runtimeMode` / `evidence.*` 会如实反映这些能力距离 verified 还缺哪些证据
- 当前重点是“模拟器下真正可用、核心流清楚、文档一致”
- 等未来补齐真机 gate 后，才讨论 capability promotion
