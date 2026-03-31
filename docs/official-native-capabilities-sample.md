# 官方 Native Capabilities Sample

路径：`examples/official-native-capabilities-sample`

这个 sample 从 `v1.7` 开始承担 Batch A+B preview 能力的统一官方入口。它不是新的 `verified` 主 sample，而是专门用来验证：

- `doctor --target-tier preview`
- managed Harmony permission 生成
- preview capability Metro alias / shim
- `bundle` 与 `build-hap --mode debug` 阶段对原生能力 import path 的稳定接管

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

- 这些 route 的目标是承接 preview bridge，而不是宣称运行时已经完全可用
- 当前 sample 强调“可分析、可生成 sidecar、可 bundle、可 debug build、可观察 permission/shim 产物”
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

## 晋升条件

当以下条件都具备时，相关能力才可以从这个 sample 迁移到 verified 主叙事：

- 真机或模拟器运行时功能通过
- debug `build-hap` 成功
- 权限拒绝、取消流程、异常路径完成记录
- support matrix、README、roadmap、acceptance 记录同 PR 更新
