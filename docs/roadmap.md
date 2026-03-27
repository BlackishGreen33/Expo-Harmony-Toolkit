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
- `react-native-gesture-handler`
- `official-ui-stack-sample` 升级为主 sample
- npm 首次公开发布准备：`release:check`、tarball smoke、release workflow

## 下一阶段

### v2.0 Expo 原生能力核心栈

目标：补齐常见 Expo 一方设备能力。

- `expo-image-picker`
- `expo-file-system`
- `expo-location`
- `expo-camera`

### v2.5 交付服务栈

目标：补齐交付与服务链路。

- `expo-notifications`
- 完整 deep link 生命周期
- 更完整的 release signing / profile 检查

### v3.0 单矩阵下的实用全兼容

定义：单矩阵下的“实用全兼容”，而不是 Expo / React Native 全生态绝对 100% 覆盖。

公开目标：

- 单矩阵内的大多数常见 Expo 生产项目可迁移
- 可构建、可运行、可发布
- 常见 UI 栈、常见设备 API、常见交付链路都进入正式承诺

## 策略约束

- `v3.0` 前继续坚持单矩阵扩张，不提前开启多 Expo / RNOH 并行矩阵
- sample、fixture、测试、文档必须和 matrix 规则同步收口
- 不允许只改 dependency catalog 状态而不补齐 sidecar、文档与验收链
