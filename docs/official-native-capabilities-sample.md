# 官方 Native Capabilities Sample

路径：`examples/official-native-capabilities-sample`

这个 sample 从 `v1.7` 开始承担 Batch A+B preview 能力的统一官方入口。它不是新的 `verified` 主 sample，而是专门用来验证：

- `doctor --target-tier preview`
- managed Harmony permission 生成
- preview capability Metro alias / shim
- `bundle` 与 `build-hap --mode debug` 阶段对原生能力 import path 的稳定接管
- `next` 发布轨的 preview smoke 基线

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

说明：

- 这个 sample 仍然属于 `preview` 主线，不等于已经进入 `verified`
- `/file-system` 已经承接真实 Harmony sandbox I/O adapter 验收；当前可完成 UTF-8 写入、读回、删除闭环
- `/file-system` 页面提供单独按钮用于 `write`、`read`、`inspect`、`listDirectory`、`delete` 与一键完整流；另外有一个 `Open sandbox URI` 的 exploratory 按钮，用于尝试把 `documentDirectory` 交给系统 handler
- `/image-picker` 页面提供单独按钮用于 `request/check media permission`、`request/check camera permission`、`launch image library`、`launch camera capture`、`inspect latest result`、`clear latest result`，以及两条完整 flow；拒权与取消都应被视为可记录的验收状态
- `/location`、`/camera` 已进入 adapter-backed preview；当前重点是把权限、定位、拍照、预览生命周期这些主路径变成可重复验收的样例
- 当前 sample 强调“可分析、可生成 sidecar、可 bundle、可 debug build、可观察 permission/shim 或 adapter 产物”
- `doctor-report.json` 与 `toolkit-config.json` 中的 `runtimeMode` / `evidence.*` 会直接反映这些 preview route 距离 verified 还缺哪些证据
- 只有当设备侧 runtime、debug HAP、人工验收都完成后，对应能力才可以从 `preview` 晋升到 `verified`

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
- `doctor --strict`：失败，因为 preview 能力仍然不在 verified allowlist
- `sync-template`：产出 Batch A+B 对应 preview shims 与 Harmony permissions
- `bundle`：成功产出 `bundle.harmony.js`
- `build-hap --mode debug`：可进入 debug HAP 构建路径

## 关键受管产物

- `harmony/entry/src/main/module.json5`
- `.expo-harmony/shims/expo-file-system/index.js`
- `.expo-harmony/shims/expo-image-picker/index.js`
- `.expo-harmony/shims/expo-location/index.js`
- `.expo-harmony/shims/expo-camera/index.js`
- `metro.harmony.config.js`
- `harmony/entry/src/main/ets/expoHarmony/ExpoHarmonyFileSystemTurboModule.ts`
- `harmony/entry/src/main/ets/expoHarmony/ExpoHarmonyImagePickerTurboModule.ts`
- `harmony/entry/src/main/cpp/expoHarmony/ExpoHarmonyPackage.h`

## 晋升条件

当以下条件都具备时，相关能力才可以从这个 sample 迁移到 verified 主叙事：

- 真机或模拟器运行时功能通过
- debug `build-hap` 成功
- 权限拒绝、取消流程、返回 asset、异常路径完成记录
- support matrix、README、roadmap、acceptance 记录同 PR 更新
