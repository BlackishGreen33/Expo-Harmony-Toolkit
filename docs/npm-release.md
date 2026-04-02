# npm 发布说明

`expo-harmony-toolkit` 继续公开发布到 npm，但从现在开始明确区分两条发布轨：

- `latest`
  - 只发布完整验收的 `verified` 能力
  - 面向正式公开承诺
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

- `latest` 解决“可以公开承诺什么”
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

- `latest` 不承接 preview capability 的公开承诺
- `next` 可以承接 preview fast track，但不得替代 capability promotion gate
- 任何声称 verified 的能力都必须具备：
  - `bundle`
  - debug `build-hap`
  - device acceptance
  - release acceptance
  - 文档与 acceptance 记录
