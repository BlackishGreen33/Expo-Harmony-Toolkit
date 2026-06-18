# npm 发布说明

`expo-harmony-toolkit` 继续公开发布到 npm，但从现在开始明确区分两条发布轨：

- `latest`
  - 发布完整验收的 `verified` 能力，或不放宽公开承诺的稳定工具链 patch
  - 面向正式公开承诺与稳定工具链修复
- `next`
  - 承接 preview fast track
  - 面向更快的集成反馈，不等于 verified 或 release-ready

## 发布轨策略

固定策略：

- 包名：`expo-harmony-toolkit`
- 稳定轨 dist-tag：`latest`
- 快速轨 dist-tag：`next`
- provenance：GitHub 自动发布开启；本地手动发布不强制
- 自动发布：hosted CI only

推荐理解：

- `latest` 解决“可以公开承诺什么”，也承接不扩大承诺边界的稳定工具链 patch
- `next` 解决“怎样更快收敛 preview 能力”

## 发布前检查

统一执行：

```bash
pnpm build
pnpm test
npm pack --dry-run
pnpm release:check
```

`release:check` 会根据发布轨选择 smoke sample 与 doctor gate：

- `latest`
  - smoke sample：`examples/official-ui-stack-sample`
  - doctor gate：`expo-harmony doctor --strict`
- `next`
  - smoke sample：`examples/official-native-capabilities-sample`
  - doctor gate：`expo-harmony doctor --target-tier preview`

固定覆盖：

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball 文件清单检查，不允许包含 `examples/`、`fixtures/`、`tests/`
- tarball 安装 smoke：
  - `doctor`
  - `init --force`
  - `bundle`
- `next` 轨额外要求 preview sample 作为 smoke 根目录

说明：

- hosted CI 默认仍可通过 `EXPO_HARMONY_RELEASE_SKIP_HAP=1` 跳过真实 DevEco HAP 构建
- debug / release HAP gate 继续由 capability acceptance、带工具链环境的 CI 或本地验收补齐
- `v1.11.0` 是未发布的 burn-down ledger checkpoint；`v1.11.1` 是第一个公开 `v1.11.x`，发布到 `latest` 只代表 sidecar drift 工具链行为收口，不代表 verified/capability 边界放宽
- `v1.11.2` 已完成非实机 closeout 与 ccnubox signed simulator app-shell gate，并已通过 tag/npm/GitHub Release 发布到 `latest`
- `v1.11.2` 远端状态：npm `latest -> 1.11.2`，npm `next -> 1.9.0`，GitHub Release `v1.11.2` 已建立
- `v1.11.2` 的 ccnubox signed simulator install/start 记录不替代真机 device acceptance，也不把 preview capability 标为 release-ready
- `v1.11.3` 当前只更新仓库代码与 v2 readiness 非实机台账；未创建 tag，未发布 npm，未创建 GitHub Release
- `v1.8.3` 只刷新 RNOH runtime / CLI 到 `0.82.29`，仍不宣称 RN `0.83.x` 已进入公开 Harmony 矩阵
- preview capability 若在报告里显示 `device=yes`，必须同时以 `evidenceSource.device=manual-doc` 对外说明其来源，不得表述成 CI 自动设备验证

## 手动发布

发布 `latest`：

```bash
pnpm release:check
npm publish --tag latest --access public
```

发布 `next`：

```bash
EXPO_HARMONY_RELEASE_CHANNEL=next pnpm release:check
npm publish --tag next --access public
```

前提：

- 已登录 npm
- 当前包版本与预期发布轨一致
- `next` 版本建议使用 prerelease version，例如 `1.8.0-next.1`

## GitHub 自动发布

默认触发：

- push version tag，例如 `v1.8.0`
- push prerelease tag，例如 `v1.8.0-next.1`

工作流行为：

- 安装依赖
- 判断发布轨
- 执行对应轨道的 `release:check`
- 使用 npm Trusted Publisher 发布到对应 dist-tag

约定：

- 普通版本 tag 发布到 `latest`
- 包含 `-next.`、`-beta.` 或 `-alpha.` 的 tag 发布到 `next`

要求：

- npm 包页面已配置 GitHub Trusted Publisher
- workflow 文件名与 Trusted Publisher 配置一致
- workflow 具备 `id-token: write`
- 使用 GitHub-hosted runner
- GitHub 自动发布命令包含 `--provenance`

## tarball smoke 的安装注意事项

当前公开矩阵内的两套 Git adapter 依赖仍是：

- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`

为了避免 adapter prepare 阶段拉取私有上游资源，tarball smoke 固定使用：

```bash
pnpm install --ignore-scripts
pnpm add --ignore-scripts <tarball>
```

这不会影响公开发布验证，因为 smoke 只要求：

- `doctor`
- `init`
- `bundle`

## 发布边界

- `latest` 不承接 preview capability 的公开承诺，但可以发布不扩大 verified 边界的稳定工具链 patch
- `next` 可以承接 preview fast track，但不得替代 capability promotion gate
- 任何声称 verified 的能力都必须具备：
  - `bundle`
  - debug `build-hap`
  - device acceptance
  - release acceptance
  - 文档与 acceptance 记录
