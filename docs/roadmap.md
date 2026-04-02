# 路线图

## 收官定义

这个项目的“完美落幕”不再定义为“一次性完美支持任意 Expo 项目”。

新的收官定义是：

- 在 `Managed/CNG Expo` 主线下，主流官方 Expo 能力可稳定分析、可 bundle、可 debug/release 验证、可交付
- `latest` 只承诺已经完成完整验收的 `verified` 能力
- 长尾第三方 native module 不再挤进同一条公开承诺，而是进入 `extension model`

因此，路线会分成两段：

- `Core Expo Coverage`：主线收官点
- `Long-tail Extension`：收官后的持续扩展模型

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

### v1.6 Support Tiers + Core Native Bridge

- 新增 `preview` 与 `experimental` 支持层级
- `doctor --target-tier <verified|preview|experimental>`
- `DoctorReport` 增加 `supportTier`、`supportSummary`、`capabilities`
- 首批 `preview` 能力：`expo-file-system`、`expo-image-picker`
- 共享 Harmony permission 生成链
- 新增 `official-native-capabilities-sample`

### v1.7 Device APIs Batch B + Capability Onboarding

- `expo-location`、`expo-camera` 进入 `preview`
- Batch A+B preview capability 进入统一 sample / fixture / 文档 / 验收模型
- 形成 `doctor -> sync-template -> bundle -> build-hap --mode debug` 的 preview onboarding baseline
- 公开结论保持保守：可接入，不等于已 verified

## 当前主线

### v1.8 Capability Graduation + Fast Track Release

目标日期：`2026-05-15`

目标：优先把“已经接入的 preview 能力”推进到可晋升状态，而不是只继续堆新模块数量。

- 建立 capability graduation 流水线：
  `doctor --strict`、`doctor --target-tier preview`、`sync-template`、`bundle`、`build-hap --mode debug`、device acceptance、release acceptance
- `DoctorReport`、`toolkit-config.json`、support matrix 全部引入 `runtimeMode` 与 `evidence`
- `expo-file-system`、`expo-image-picker` 优先冲刺 verified 所需的真 runtime 与 device 证据
- `expo-location`、`expo-camera` 从 throw-only shim 推进到可验证的 adapter-backed preview
- 发布节奏改成双轨：
  `latest` 只承接完整验收的 verified 能力，`next` 承接 preview fast track

### v1.9 App Foundation Modules

目标日期：`2026-07-31`

目标：优先补齐最能解锁真实 Managed/CNG Expo 项目的基础官方模块。

- 依序接入：`expo-secure-store`、`expo-device`、`expo-asset`、`expo-clipboard`、`expo-haptics`
- 每个能力都必须同时具备：
  fixture、sample route、doctor、sync-template、bundle、debug build、acceptance 记录
- 完成 `expo-location`、`expo-camera` verified 晋升
- 如果某项能力无法在同版晋升，则必须明确记录阻塞点与缺失证据，而不是模糊停留

### v2.0 Managed/CNG Core Expo Coverage

目标日期：`2026-10-31`

定义：在单一 `verified` runtime matrix 下，把主流 `Managed/CNG Expo` 生产项目推进到完整可用、可构建、可交付。

- 官方高频 Expo 能力覆盖达到可交付水平
- `latest` 只包含完整验收能力
- release readiness 路径完整闭环
- roadmap 对外叙事从“sample 可跑”升级为“核心 Managed/CNG Expo 项目可稳定交付”

这是最早可以对外宣告“主目标收官”的时间点。

### v2.x Long-tail Native Module Extension

目标日期：`2027-03-31` 前启动

目标：把“任何 Expo 项目都能打包成鸿蒙 APP”从内建承诺，转成有边界、可扩展、可持续维护的 extension model。

- 引入第三方 native module extension / onboarding 模型
- 建立 capability registry、adapter、fixture、acceptance 规范
- 把未知或未验证第三方包从“公开承诺”切换为“显式扩展”
- 不对未验证长尾模块提前给出正式可用声明

## 长期方向

- 先做到 `Managed/CNG Core Expo Coverage`
- 再通过 `Long-tail Native Module Extension` 逼近“任意 Expo 项目”
- 推进速度依赖 `next` 快速收敛反馈，但公开承诺继续由 `latest` 控制

## 路线约束

- `v2.0` 前继续坚持单一 verified runtime matrix
- `v2.0` 前不把 bare Expo 拉进主线，只保留 `Managed/CNG`
- `doctor --strict` 继续只代表 `verified`
- `latest` 只承诺完整验收的 `verified` 能力
- `next` 可以承接 preview fast track，但不得伪装成 verified
- roadmap、support matrix、README、acceptance 记录必须在同一 PR 同步更新
- 没有 sample、fixture、文档、构建证据、人工验收记录的能力，不得晋升到 `verified`

## 风险与顺延条件

- 收官前提是从 `2026-03-31` 起持续具备 Harmony 模拟器或真机验证条件，并保持周级别验收节奏
- 如果 Expo SDK / RNOH 在 `2026-05-15` 前发生大矩阵漂移，`v2.0` 收官点应顺延到 `2026-12-31` 左右
