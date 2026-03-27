# npm 发布说明

`v1.5.0` 是 `expo-harmony-toolkit` 首个面向外部用户的 npm 正式公开版本。

固定策略：

- 包名：`expo-harmony-toolkit`
- dist-tag：`latest`
- provenance：GitHub 自动发布开启；本地手动发布不要求
- 自动发布：hosted CI only

## 发布前检查

统一执行：

```bash
pnpm build
pnpm test
npm pack --dry-run
pnpm release:check
```

`release:check` 固定覆盖：

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball 文件清单检查，不允许包含 `examples/`、`fixtures/`、`tests/`
- tarball 安装 smoke：
  - `expo-harmony doctor --strict`
  - `expo-harmony init --force`
  - `expo-harmony bundle`

说明：

- hosted CI 默认不阻塞 `build-hap --mode debug`
- `build-hap` 继续作为本地或有 DevEco 工具链环境时的附加验证

## 手动发布

本地执行：

```bash
pnpm release:check
npm publish --tag latest --access public
```

前提：

- 已登录 npm
- 包名 `expo-harmony-toolkit` 仍可用

## GitHub 自动发布

默认触发：

- push version tag，例如 `v1.5.0`

工作流行为：

- 安装依赖
- 执行 `pnpm release:check`
- 使用 `NPM_TOKEN` 发布到 npm

要求：

- GitHub Actions secret 中存在 `NPM_TOKEN`
- 使用 npm 官方认证流程
- GitHub 自动发布命令包含 `--provenance`
- 本地手动发布只要求 `latest` dist-tag，不强制 provenance

`workflow_dispatch` 仅用于 rehearsal / dry-run，不会直接 publish。

## tarball smoke 的安装注意事项

当前官方 UI-stack sample 依赖三项 Git adapter：

- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`
- `@react-native-oh-tpl/react-native-gesture-handler`

为了避免 Git adapter prepare 阶段拉取私有上游资源，tarball smoke 固定使用：

```bash
pnpm install --ignore-scripts
pnpm add --ignore-scripts <tarball>
```

这不会影响 toolkit 的公开发布验证，因为 tarball smoke 只要求 `doctor`、`init`、`bundle`。
