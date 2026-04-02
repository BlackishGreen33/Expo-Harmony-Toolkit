# 官方 Native Capabilities Sample

路径：`examples/official-native-capabilities-sample`

这个 sample 是 `v1.7.x` 的官方 preview native-capability walkthrough。它的目标不是把 preview 能力包装成 `verified`，而是把“当前真实支持的核心路径”和“当前明确不支持的边界”都讲清楚。

标记说明：

- `🟡` 当前可用子集：这部分已经有可信实现，样例和模拟器路径可用；下一步主要缺真机 / release 证据
- `🟠` 当前未纳入子集：包本身已进入 `preview`，但这个具体子 API 还没有到可信对外承诺；这不是“只差真机”

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

## 每条 route 的真实范围

### `/file-system`

`🟡 当前可用子集`：

- 创建 sandbox 目录
- UTF-8 写入
- 读回内容
- `getInfoAsync`
- `readDirectoryAsync`
- `copyAsync`
- `moveAsync`
- 删除生成产物

`🟠 当前未纳入子集`：

- `base64`
- `downloadAsync`
- 更广的 Expo parity

### `/image-picker`

`🟡 当前可用子集`：

- media permission
- camera permission
- 单图图库选择
- 单次系统相机拍照
- denied / canceled / successful asset 三类结果展示

`🟠 当前未纳入子集`：

- `getPendingResultAsync` 的完整 Expo parity
- 多选、多媒体、更深一层的系统恢复语义

### `/location`

`🟡 当前可用子集`：

- foreground permission
- `getCurrentPositionAsync`
- `getLastKnownPositionAsync`
- `geocodeAsync`
- `reverseGeocodeAsync`

`🟠 当前未纳入子集`：

- `watchPositionAsync`
- background permission parity
- `watchHeadingAsync`
- `getHeadingAsync`

这些 `🟠` 项不是“已经实现，只差真机验证”，而是当前还没补齐到可信实现，所以暂时不纳入对外可承诺子集。

### `/camera`

`🟡 当前可用子集`：

- camera permission
- 通过 Harmony system camera UI 完成 still-photo capture
- 把返回 asset metadata 回传给 JS
- denied / canceled / successful capture 三类结果展示

`🟠 当前未纳入子集`：

- embedded live preview
- `pausePreview` / `resumePreview`
- microphone permission parity
- video recording
- scanning APIs 之外的更深 Expo parity

这些 `🟠` 项不是“已经实现，只差真机验证”，而是当前还没补齐到可信实现，所以暂时不纳入对外可承诺子集。

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
mkdir -p .expo-harmony
$EDITOR .expo-harmony/signing.local.json
pnpm run harmony:env
pnpm run harmony:build:release
```

说明：

- `.expo-harmony/signing.local.json` 是本地 signing 入口
- toolkit 会把本地 signing 合并进 `harmony/build-profile.json5`
- 即使 release 构建可走通，在没有真机前，这四项能力也仍保持 `preview`

## 当前结论

- 这个 sample 属于 `preview` 主线，不等于已经进入 `verified`
- `doctor-report.json` 与 `toolkit-config.json` 中的 `runtimeMode` / `evidence.*` 会如实反映这些能力距离 verified 还缺哪些证据
- `🟡` 项可以理解为“只差真机 / release 证据的下一步”
- `🟠` 项不能理解成“只差真机”，因为当前实现边界本身还没有补齐
- 当前重点是“模拟器下真正可用、核心流清楚、文档一致”
- 等未来补齐真机 gate 后，才讨论 capability promotion
