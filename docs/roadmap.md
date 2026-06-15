# 路线图

## 收官定义

这个项目的终局重新定义为：

- 所有 Expo project types 与 package categories，最终都进入同一条 `mainline capability catalog`
- `v2.0.0` 本身就要接近最完美、最最终的交付形态，而不是“还差最后一段 extension”
- `v2.0.0` 的可靠打包承诺收敛为 catalog-covered Expo projects：只要依赖已经进入主线 capability catalog，就必须稳定闭环
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

`v1.8.x` 已完成 repo 内可收口项，当前主线切到 `v1.9.x`。`v1.9.0` 先落 bare workflow baseline、app foundation modules 与 `react-native-gesture-handler` formal slice；`v1.9.1` 作为 build-hap patch release，补上 HAR normalize opt-out；`v1.9.2` 推进 Third-party Native Wave A，把 async-storage、screens 与 safe-area 拉进 formal experimental onboarding；`v1.9.3` 推进 ccnubox-first Third-party Native Wave B 与 regression farm。剩余需要真机或 release HAP 的证据继续保留在 v1.8.x capability board，不阻塞 v1.9.x 的 bare / foundation / third-party onboarding 工作。

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

状态：repo-only closeout complete；device / release evidence carryover。

目标：把 v1.8.0 建好的 intake + promotion 架子收口到可持续执行的证据节奏，并把外部验收项从 repo 内可完成项中拆开。

- 每个 preview capability 必须单独维护：
  - bundle evidence
  - debug build evidence
  - device acceptance record
  - release acceptance record
- combined sample 只负责回归烟测，不再替代单 capability 证据
- `toolkit-config.json`、`doctor-report.json`、roadmap、support matrix、acceptance board 保持同源同步
- `latest` 仍不承接任何证据未闭环的 capability
- 不需要真机或 release HAP 的收尾项已经完成，可以进入 `v1.9.x`
- 仍然顺延的外部证据：
  - 单 capability 真机 device acceptance record
  - 单 capability release HAP runtime acceptance

### v1.9.0 Bare Workflow Baseline + App Foundation Modules

目标日期：`2026-08-31`

状态：implementation baseline complete；device / release evidence carryover。

目标：把 bare workflow 拉进主线，补齐最容易卡死真实项目的官方基础模块，并先建立第三方 blocker 的正式接入切片。

- bare workflow 正式进入主线里程碑
- 优先补齐：
  - `expo-secure-store`
  - `expo-asset`
  - `expo-device`
  - `expo-clipboard`
  - `expo-haptics`
- 高频第三方 native dependencies 开始进入同一 capability catalog
- `react-native-gesture-handler` 进入 formal acceptance slice：
  - 保留 experimental / non-verified 边界
  - 补齐 sample / fixture / doctor / debug build evidence
  - device / release evidence 仍按 promotion gate 单独关闭
- project-shape regression farm 建立最小版本：
  - managed core
  - managed native heavy
  - bare
  - third-party native heavy
- 对每个新能力继续坚持：
  - fixture
  - sample route
  - doctor
  - sync-template
  - bundle
  - debug build
  - acceptance 记录
- 本阶段不改变 `verified` 边界；foundation modules 以 `preview` + `runtimeMode=shim` 记录，`react-native-gesture-handler` 以 `experimental` + formal adapter slice 记录

### v1.9.1 Build HAP HAR Normalize Opt-out

目标日期：`2026-06-02`

目标：把 issue #1 中的本地 HAR 解压 opt-out 做成正式 patch release，同时不改变默认 verified build path。

- `build-hap` 新增显式 opt-out：
  - `EXPO_HARMONY_SKIP_HAR_NORMALIZE=1`
  - `expo-harmony build-hap --no-har-normalize`
- 默认继续执行现有 `normalizeLocalHarDependencies` 路径：
  - 解压 `file:*.har` 到 `expo-harmony-local-deps`
  - 临时改写 root / entry `oh-package.json5`
  - 注册 normalized local HAR modules
  - 执行依赖 normalized local package 的 RNOH codegen / path 兜底
- opt-out 开启后：
  - 保留 `file:../node_modules/.../*.har`
  - 让 `ohpm install --all` 直接消费纯 HAR
  - 在 build report / CLI 文档里明确提示跳过的自动兜底
- 本阶段只改变 build-hap escape hatch，不扩大 `verified` 能力边界
- `v1.9.0` 已经存在于 npm `next`，本阶段发布为 `v1.9.1` 并进入 `latest`

### v1.9.2 Third-party Native Wave A

目标日期：`2026-09-30`

状态：implementation baseline complete；device / release evidence carryover。

目标：优先清掉最容易挡住“任何 Expo 项目”的高频第三方 native blocker。

- 第一批高频第三方 native blocker 进入正式 onboarding：
  - `react-native-safe-area-context`
  - `react-native-screens`
  - `@react-native-async-storage/async-storage`
- `react-native-gesture-handler` 如果在 `v1.9.0` 已完成 formal acceptance slice，则本阶段只继续补 device / release evidence 与 promotion 决策
- 建立第三方 native capability onboarding checklist：
  - catalog entry
  - shim / adapter strategy
  - doctor diagnostics
  - sample / fixture
  - debug + release evidence
- 任何进入 Wave A 的 blocker，都不允许继续停留在“矩阵外模糊探索”
- 本阶段发布为 `v1.9.2` 并进入 `latest`，但不改变 `verified` 边界：
  - `@react-native-async-storage/async-storage` 以 `experimental` + `runtimeMode=adapter` 记录
  - `react-native-screens` 以 `experimental` + `runtimeMode=adapter` 记录
  - `react-native-safe-area-context` 以 `experimental` + `runtimeMode=shim` 记录
  - `doctor --strict` 与 `doctor --target-tier preview` 仍阻断 Wave A

### v1.9.3 Third-party Native Wave B + Regression Farm

目标日期：`2026-10-31`

状态：implementation baseline complete；simulator delivery gate complete on ccnubox_rn；device / release evidence carryover。

目标：扩大第三方 native 覆盖，并把 `v1.9.0` 建好的最小 regression farm 扩容成持续回归面。

- 第二批高频第三方 native 依赖进入主线：
  - `react-native-webview`
  - JPush runtime：`jpush-react-native`、`jcore-react-native`、`mx-jpush-expo`
  - `expo-notifications`
  - `expo-media-library`
  - `lottie-react-native`
  - `@shopify/react-native-skia`
- 扩容 project-shape regression farm：
  - managed core
  - managed native heavy
  - bare
  - third-party native heavy
- 至少维护一组“未知项目导入 -> doctor 分类 -> nextActions -> sample/build gate”的持续回归案例
- ccnubox-first Wave B 以 `experimental` + formal adapter/shim slice 记录，不改变 `verified` 边界
- debug / release HAP simulator delivery gate 必须单独记录；没有 `hdc` target 时不得把 build evidence 表述为 simulator pass
- 继续收口 preview capability 的 release evidence，尽量减少 `v2.0.0` 前的残留灰区

### v1.10.0 Any-project Intake Freeze

目标日期：`2026-11-15`

状态：released / complete；`1.10.0` / `v1.10.0` 已发布到 `latest`。

目标：先冻结“任何 Expo 项目”入口面的产品故事，确保不存在无法分类、无法给下一步、无法明确阻断原因的项目。

- `doctor` 对任意 Expo 项目必须满足：
  - 能分类
  - 能指出 blocker 属于官方模块、bare workflow、还是第三方 native gap
  - 能输出有顺序的 remediation actions
- roadmap / support matrix / acceptance board 与实际 catalog 保持零漂移
- 对外叙事从“更多项目开始进入主线”升级成“任何项目都有明确处理路径”

Acceptance checklist：

- 新增 `fixtures/v110-*` 覆盖 catalog managed、bare、unknown JS-only、unknown native-looking、mixed intake
- `nextActions[]` 固定按版本矩阵问题 -> 项目形态问题 -> native blocker -> unknown JS/native 依赖 -> build gate 排序
- `acceptance/v1.10.0-acceptance.md` 记录 repo-only gate 与边界
- 不提升任何 capability 到 `verified`
- 不要求真机 device evidence

### v1.11.x Final Blocker Burn-down

目标日期：`2026-11-30`

状态：`v1.11.0` 是未发布的 burn-down ledger checkpoint；`v1.11.1` 是第一个公开 `v1.11.x`，发布到 `latest`，只收口 sidecar drift 工具链行为，不提升任何 capability 到 `verified`。

目标：把还会阻止“任何 Expo 项目可靠打包”的剩余高频 blocker 清到只剩极少数明确已知例外。

- 逐项清掉剩余高频 blocker：
  - adapter 不稳定
  - bare workflow release gap
  - 高频第三方 native 缺失 release evidence
  - 自动生成 sidecar 与真实项目 drift
- 对仍无法在 `v2.0.0` 前关闭的项，必须提前明确降级策略与替代路径
- `v2.0.0` 不接受“先宣布完成，再慢慢补长尾”

Burn-down ledger：

- `release-evidence`：preview adapter capability 必须逐项补 per-capability release HAP runtime evidence；combined sample smoke 不能替代单项 release 验收
- `bare-release-gap`：bare workflow 继续保留 intake / debug baseline，只有 release HAP 与 runtime evidence 补齐后才允许宣称 release-ready
- `third-party-native`：Wave A / Wave B 继续停留在 `experimental`，先关闭 device / release evidence 或写明降级策略
- `sidecar-drift`：所有 catalog-covered managed 项目都必须能重复执行 `sync-template -> bundle -> build-hap --mode debug`，drift 必须被明确报出或被可验证修复

Sidecar drift audit：

- `detected`：非 build-required managed sidecar drift 必须输出稳定 warning code：`sidecar.drift.requires-force`
- `auto-refreshed build-required files`：bundle/build gate 必需的 autolinking 与 RNOH shim drift 可以自动刷新，不能误报 unresolved drift
- `requires --force`：其他 managed sidecar drift 默认保留用户改动，并提示 `expo-harmony sync-template --force` 或 `expo-harmony init --force`
- `accepted exception`：无法在 v1.11.x 关闭的真实项目 drift 必须写入 acceptance，不得扩写成 build/device/runtime pass

Acceptance checklist：

- 新增 `acceptance/v1.11.0-burn-down-ledger.md` 记录 v1.11.x 起始台账
- 新增 `acceptance/v1.11.1-acceptance.md` 记录第一个公开 v1.11.x release、`v1.11.0` 不发布决策与 sidecar drift 收口结果
- 明确本阶段不改变 `latest` / `verified` 边界
- 不把 debug/release HAP build pass 表述为真机 device 或 runtime pass
- 对每个无法在 v1.11.x 关闭的 blocker 写出降级或替代路径

### v2.0.0 Catalog-covered Expo Project Reliable Packaging

原 `Any Expo Project Reliable Packaging` 叙事保留为 intake 目标，但可靠打包承诺明确收敛到 catalog-covered 项目。

目标日期：`2026-12-31`

定义：任何 Expo 项目，只要依赖已经存在于主线 capability catalog 内，就能可靠打包成鸿蒙 App；未进入 catalog 的依赖必须至少被 `doctor` 明确分类、指出 blocker，并给出下一步。`v2.0.0` 本身就是基本接近最完美、最最终的形态。

- 不再只覆盖“主流项目”，而是把 catalog-covered Expo projects 的可靠打包作为正式版本定义
- “任何 Expo 项目都能可靠打包成鸿蒙 App”不得被简化成无边界长尾承诺；真实承诺边界是 mainline capability catalog
- `Managed/CNG` 与 bare workflow 都必须进入稳定交付路径
- 高频官方 Expo 模块与高频第三方 native blockers 必须已经进入同一公开 capability catalog
- `doctor -> sync-template -> bundle -> build-hap --mode debug|release` 必须对主线 catalog 内项目形成稳定闭环
- 只允许极少数、明确列名、已有替代策略的已知例外存在；不允许存在大类空白地带

## 长期方向

- 所有输入最终都进入同一个 `mainline capability catalog`
- `v2.0.0` 就是 catalog-covered Expo projects 可靠打包成鸿蒙 App 的正式目标版本
- 对 catalog 外项目，正式目标是完整 intake：能分类、能说明 blocker、能给下一步，而不是伪装成已经可靠打包
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
