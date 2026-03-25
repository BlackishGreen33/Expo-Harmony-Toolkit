# 路线图

## 已完成里程碑

### v0.1 迁移工具包
- plugin + CLI + vendored 模板
- 依赖兼容性扫描
- 幂等模板同步

### v0.2 可打包 Sample
- 仓库内官方最小 sample
- 文档化的 `doctor -> init -> bundle -> DevEco/HAP` 链路
- 最小 Harmony skeleton 与 bundle 路径验证

### v0.5 受限平台承诺
- 单一验证矩阵 `expo55-rnoh082-minimal`
- 明确的白名单依赖与阻断规则
- `doctor --strict` fail-fast 准入检查
- 官方 sample 的 CI 验证与手动 DevEco release gate

### v0.8 App Shell 能力扩张
- 单一验证矩阵 `expo55-rnoh082-app-shell`
- `expo-router`、`expo-linking`、`expo-constants` 进入承诺范围
- 官方 App Shell sample 与 router 边界 fixtures
- App Shell 级别的手动验收，不包含完整原生 deep link 生命周期

### v1.0 正式受限平台承诺
- 将 `expo55-rnoh082-app-shell` 升级为公开、稳定、可验证的正式承诺
- `doctor --strict` 输出字段与 issue code 作为公开契约
- README、支持矩阵、sample 指南与 License 完成公开发布形态整理
- DevEco Studio GUI build/run 作为当前官方 release gate

## 下一阶段候选

- 打通 `hvigor` 纯 CLI 构建链路
- 扩展更多 Expo modules 与第三方依赖覆盖面
- 增加更多真实项目 fixture 与升级回归场景
