# 路线图

## 收官定义

这个项目的终局重新定义为：

- 所有 Expo project types 与 package categories，最终都进入同一条 `mainline capability catalog`
- `v2.0.0` 本身就要接近最完美、最最终的交付形态，而不是“还差最后一段 extension”
- 公开承诺仍然按 evidence gate 逐步放开，而不是因为目标扩大就提前放宽 `latest`
- `latest` 继续只承接完整验收的 `verified`
- `next` 继续承接 fast track，用来加速收敛，但不伪装成 `verified`

这意味着：

- `Managed/CNG` 仍是当前最成熟的已验证输入
- bare workflow、高频第三方 native packages、长尾第三方依赖，不再被定义成“收官后才考虑的另一条扩展路线”
- 它们会被逐步拉回同一条公开主线，只是进入主线的时间点和 evidence gate 不同

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
- `doctor` 增加 `buildabilityRisk`
- 文档生成链收口到 marker block + renderer source data

## 当前主线

### v1.8.0 Intake Hardening + Parallel Promotion

目标日期：`2026-05-15`

目标：先把“任何 Expo 项目都能被正确分类并拿到下一步”做硬，再把现有 preview 能力和主线阻塞项并行推进。

- `doctor` 增加：
  - `coverageProfile`
  - `gapCategory`
  - `nextActions`
- 先把任意项目分进四类：
  - `managed-core`
  - `managed-native-heavy`
  - `bare`
  - `third-party-native-heavy`
- 四项 preview capability 进入同一个 graduation board：
  - `expo-file-system`
  - `expo-image-picker`
  - `expo-location`
  - `expo-camera`
- `react-native-gesture-handler` 从“矩阵外模糊探索”拉回主线：
  - 必须可被 `doctor` 明确识别
  - 必须有独立 fixture
  - 必须有独立 sample / build / test coverage
  - 来不及 verified 也不能继续停留在灰区
- sample 策略升级成双层：
  - combined smoke
  - per-capability acceptance

### v1.8.x Capability Board Closeout

目标日期：`2026-06-15`

目标：把 v1.8.0 建好的 intake + promotion 架子收口到可持续执行的证据节奏。

- 每个 preview capability 必须单独维护：
  - bundle evidence
  - debug build evidence
  - device acceptance record
  - release acceptance record
- combined sample 只负责回归烟测，不再替代单 capability 证据
- `toolkit-config.json`、`doctor-report.json`、roadmap、support matrix、acceptance board 保持同源同步
- `latest` 仍不承接任何证据未闭环的 capability

### v1.9.0 Bare Workflow Baseline + App Foundation Modules

目标日期：`2026-08-31`

目标：先把 bare workflow 拉进主线，并补齐最容易卡死真实项目的官方基础模块。

- bare workflow 正式进入主线里程碑
- 优先补齐：
  - `expo-secure-store`
  - `expo-asset`
  - `expo-device`
  - `expo-clipboard`
  - `expo-haptics`
- 高频第三方 native dependencies 开始进入同一 capability catalog
- 对每个新能力继续坚持：
  - fixture
  - sample route
  - doctor
  - sync-template
  - bundle
  - debug build
  - acceptance 记录

### v1.9.1 Third-party Native Wave A

目标日期：`2026-09-30`

目标：优先清掉最容易挡住“任何 Expo 项目”的高频第三方 native blocker。

- 第一批高频第三方 native blocker 进入正式 onboarding：
  - `react-native-gesture-handler`
  - `react-native-safe-area-context`
  - `react-native-screens`
  - `@react-native-async-storage/async-storage`
- 建立第三方 native capability onboarding checklist：
  - catalog entry
  - shim / adapter strategy
  - doctor diagnostics
  - sample / fixture
  - debug + release evidence
- 任何进入 Wave A 的 blocker，都不允许继续停留在“矩阵外模糊探索”

### v1.9.2 Third-party Native Wave B + Regression Farm

目标日期：`2026-10-31`

目标：扩大第三方 native 覆盖，并建立“任何 Expo 项目”目标需要的持续回归面。

- 第二批高频第三方 native 依赖进入主线
- 引入 project-shape regression farm：
  - managed core
  - managed native heavy
  - bare
  - third-party native heavy
- 至少维护一组“未知项目导入 -> doctor 分类 -> nextActions -> sample/build gate”的持续回归案例
- 继续收口 preview capability 的 release evidence，尽量减少 `v2.0.0` 前的残留灰区

### v1.10.0 Any-project Intake Freeze

目标日期：`2026-11-15`

目标：先冻结“任何 Expo 项目”入口面的产品故事，确保不存在无法分类、无法给下一步、无法明确阻断原因的项目。

- `doctor` 对任意 Expo 项目必须满足：
  - 能分类
  - 能指出 blocker 属于官方模块、bare workflow、还是第三方 native gap
  - 能输出有顺序的 remediation actions
- roadmap / support matrix / acceptance board 与实际 catalog 保持零漂移
- 对外叙事从“更多项目开始进入主线”升级成“任何项目都有明确处理路径”

### v1.11.0 Final Blocker Burn-down

目标日期：`2026-11-30`

目标：把还会阻止“任何 Expo 项目可靠打包”的剩余高频 blocker 清到只剩极少数明确已知例外。

- 逐项清掉剩余高频 blocker：
  - adapter 不稳定
  - bare workflow release gap
  - 高频第三方 native 缺失 release evidence
  - 自动生成 sidecar 与真实项目 drift
- 对仍无法在 `v2.0.0` 前关闭的项，必须提前明确降级策略与替代路径
- `v2.0.0` 不接受“先宣布完成，再慢慢补长尾”

### v2.0.0 Any Expo Project Reliable Packaging

目标日期：`2026-12-31`

定义：任何 Expo 项目，只要依赖已经存在于主线 capability catalog 内，就能可靠打包成鸿蒙 App；`v2.0.0` 本身就是基本接近最完美、最最终的形态。

- 不再只覆盖“主流项目”，而是把“任何 Expo 项目都能可靠打包成鸿蒙 App”作为正式版本定义
- `Managed/CNG` 与 bare workflow 都必须进入稳定交付路径
- 高频官方 Expo 模块与高频第三方 native blockers 必须已经进入同一公开 capability catalog
- `doctor -> sync-template -> bundle -> build-hap --mode debug|release` 必须对主线 catalog 内项目形成稳定闭环
- 只允许极少数、明确列名、已有替代策略的已知例外存在；不允许存在大类空白地带

## 长期方向

- 所有输入最终都进入同一个 `mainline capability catalog`
- `v2.0.0` 就是“任何 Expo 项目可靠打包成鸿蒙 App”的正式目标版本
- `latest` 只由完整验收能力驱动
- `next` 用来加速收敛主线 backlog，而不是制造伪 verified 叙事
- roadmap 的关键问题不再是“要不要把某类项目算进主线”，而是“它何时进入主线、当前缺哪格 evidence、下一步怎么 unblock”

## 路线约束

- 当前公开 `verified` runtime matrix 仍然只有 `expo55-rnoh082-ui-stack`
- `doctor --strict` 继续只代表 `verified`
- `latest` 只承诺完整验收的 `verified`
- `next` 可以承接 preview fast track，但不得伪装成 verified
- 没有 fixture、sample、文档、构建证据、人工验收记录的能力，不得晋升到 `verified`
- roadmap、support matrix、README、acceptance 记录必须在同一 PR 同步更新
- 目标扩大不等于当前对外承诺扩大；任何公开边界放宽都必须先有证据闭环

## 风险与顺延条件

- 继续依赖 Harmony 模拟器或真机的稳定验证条件
- 继续依赖周级别的 acceptance 节奏，而不是只做 sample 展示
- 如果 Expo SDK / RNOH 在 `2026-05-15` 前发生较大矩阵漂移，`v1.8.x` 收口和 `v2.0.0` 时间点都需要相应顺延
