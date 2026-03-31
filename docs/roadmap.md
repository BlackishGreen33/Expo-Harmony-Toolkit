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

### v1.6 Support Tiers + Core Native Bridge

- 新增 `preview` 与 `experimental` 支持层级
- `doctor --target-tier <verified|preview|experimental>`
- `DoctorReport` 增加 `supportTier`、`supportSummary`、`capabilities`
- 首批 `preview` 能力：`expo-file-system`、`expo-image-picker`
- 共享 Harmony permission 生成链
- 新增 `official-native-capabilities-sample`

## 当前主线

### v1.7 Device APIs Batch B + Capability Onboarding

目标：把第二批高频设备能力推进到 `preview`，并把 capability 接入、验证、晋升流程产品化。

- `expo-location`、`expo-camera` 进入 `preview`
- 共用 managed capability bridge 行为：
  可 `doctor`、可 `sync-template`、可 `bundle`、可 `build-hap --mode debug`
- `expo-location` 至少覆盖：
  前台权限、当前定位、`watchPosition`
- `expo-camera` 至少覆盖：
  相机权限、预览 surface、单次拍照入口
- `official-native-capabilities-sample` 扩成 Batch A+B 统一验证入口
- 为 Batch A+B 维护 fixture、sample、文档、验收记录同步更新
- `expo-file-system`、`expo-image-picker` 只有在同版补齐完整证据时才晋升 `verified`

### v1.8 Verification and Release Hardening

目标：把 capability coverage 与 release reliability 合并成可重复执行的 gate。

- 完整 deep link lifecycle 验收
- 更强的 signing / profile / release lint
- 快速 smoke 与 capability acceptance 双层验证
- 具备 Harmony 工具链的 runner 上增加 debug HAP 真构建 gate
- capability promotion gate 固化到 sample、fixture、build、device acceptance 流程
- release gate 只放在有签名环境的专用流程

### v1.9 Core Expo Production Modules

目标：优先补齐能解锁最多真实项目的 Expo 官方生产能力，而不是先追长尾第三方 native package。

- 存储、安全、设备信息、资产、多媒体、剪贴板、触感等高频官方模块
- 每个能力都必须沿用 v1.7 建立的 onboarding / acceptance 模型
- 继续保持单一 `verified` runtime matrix，对外承诺不膨胀

### v2.0 Core Expo Full Coverage

定义：在单一 `verified` runtime matrix 下，把“核心 Expo 生产项目”推进到完整可用、可构建、可交付。

- 官方 Expo 常用能力达到明确公开支持
- 主流 UI stack、常见设备 API、常见交付链形成完整故事
- 高频能力达到 `verified`
- 具备明确 release readiness 路径
- roadmap 对外叙事从“能跑 sample”升级为“核心 Expo 项目可稳定交付”

### v2.x Long-tail Native Module Extension

目标：在完成核心 Expo 全覆盖后，再去逼近“任何 Expo 项目都能打包成鸿蒙 APP”的长期目标。

- 引入长尾第三方 native module 的 extension / onboarding 模型
- 为第三方适配建立 capability registry、adapter、fixture、acceptance 规范
- 不对未知或未验证 native package 提前给出正式可用承诺

## 长期方向

- 先做到 `Core Expo Full Coverage`
- 再做到 `Long-tail Native Module Coverage`
- “推进速度”与“完全可用”并行，而不是先扩承诺再补证据

## 路线约束

- `v2.0` 前继续坚持单一 verified runtime matrix，不提前开启多 Expo / RNOH 并行正式承诺
- `doctor --strict` 继续只代表 `verified`
- roadmap、support matrix、README、acceptance 记录必须在同一 PR 同步更新
- 没有 sample、fixture、文档、构建证据、人工验收记录的能力，不得晋升到 `verified`
