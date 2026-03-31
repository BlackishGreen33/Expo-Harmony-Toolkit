# 路线图

## 已完成里程碑

### v0.1 迁移工具包

- plugin + CLI + vendored 模板
- 依赖兼容性扫描
- 幂等模板同步

### v0.5 受限平台承诺

- 单一验证矩阵
- 明确白名单依赖与阻断规则
- `doctor --strict` fail-fast 准入检查

### v1.1 CLI 打包闭环

- 新增 `env`
- 新增 `bundle`
- 新增 `build-hap --mode debug|release`
- 新增 `.expo-harmony/env-report.json`
- 新增 `.expo-harmony/build-report.json`

### v1.5 UI Stack 正式公开版本

- 公开矩阵升级为 `expo55-rnoh082-ui-stack`
- `react-native-reanimated`
- `react-native-svg`
- `official-ui-stack-sample` 升级为主 sample
- npm 首次公开发布准备：`release:check`、tarball smoke、release workflow

## 当前主线

### v1.6 Support Tiers + Core Native Bridge

目标：在不放弃单一 verified 矩阵的前提下，把能力扩张路径产品化。

- 保留 `expo55-rnoh082-ui-stack` 作为唯一 `verified` 公开矩阵
- 新增 `preview` 与 `experimental` 支持层级
- `doctor --target-tier <verified|preview|experimental>`
- `DoctorReport` 增加 `supportTier`、`supportSummary`、`capabilities`
- 建立 Expo 原生能力桥接骨架，沿用受管 Metro alias 与 `expo-modules-core` shim
- 首批 `preview` 能力：`expo-file-system`、`expo-image-picker`
- 共享 Harmony permission 生成链
- 新增 `official-native-capabilities-sample`

### v1.7 Device APIs Batch B

目标：在同一套桥接与权限模型上补齐第二批高频设备能力。

- `expo-location`
- `expo-camera`
- 前台定位权限、当前定位、watchPosition
- 相机权限、预览、拍照验收
- 将已完成端到端验收的 `preview` 能力提升为 `verified`

### v1.8 Delivery Hardening

目标：把“能 bundle / 能 debug build”推进到“交付路径可依赖”。

- 完整 deep link lifecycle 验收
- 更强的 signing / profile / release lint
- 快速 smoke 与 capability acceptance 双层验证
- 具备 Harmony 工具链的 runner 上增加 debug HAP 真构建 gate
- release gate 只放在有签名环境的专用流程

### v2.0 Practical Full Coverage

定义：不是 Expo / React Native 全生态的绝对 100% 覆盖，而是 Managed/CNG Expo 项目的“实用全兼容”。

- 大多数 Expo 生产项目可通过 `doctor -> init -> bundle -> build-hap`
- 常见 UI stack、常见设备 API、常见交付链至少达到 `preview`
- 高频能力达到 `verified`
- 明确 release readiness 路径
- `expo-notifications` 在端到端服务故事未打通前继续停留在 `preview` 或更低层级

## 路线约束

- `v2.0` 前继续坚持单一 verified runtime matrix，不提前开启多 Expo / RNOH 并行正式承诺
- `doctor --strict` 继续只代表 `verified`
- roadmap、support matrix、README、acceptance 记录必须在同一 PR 同步更新
- 没有 sample、fixture、文档、构建证据、人工验收记录的能力，不得晋升到 `verified`
