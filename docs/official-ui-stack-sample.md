# 官方 UI Stack Sample 指南

这份指南适用于仓库内的 `examples/official-ui-stack-sample`。

它仍然是当前唯一的 verified UI-stack 主 sample，承担以下验证职责：

- `expo-router`
- `expo-linking`
- `expo-constants`
- `react-native-svg`
- `react-native-reanimated`
- `doctor -> init -> bundle -> build-hap` 的完整工具链

## 安装

```bash
cd examples/official-ui-stack-sample
pnpm install --ignore-scripts
```

这里明确使用 `--ignore-scripts`，因为当前 adapter Git 依赖在 prepare 阶段可能拉取私有上游资源。

## CLI 验证

```bash
pnpm run harmony:doctor:strict
pnpm run harmony:init
pnpm run harmony:sync-template
pnpm run harmony:bundle
pnpm run harmony:build:debug
```

## 运行时人工验收

打开 App 后，至少验证：

- 首页能看到 `Constants.expoConfig?.name`
- 首页能看到当前 pathname、observed URL 和 generated details URL
- 页面能展示 SVG 圆环图形
- 点击 motion rail 时有可见位移、旋转与回弹
- 点击 `Open details route` 后能跳到 `/details`
- 在 `/details` 点击返回后能回首页
- 动画、路由、SVG 不会互相破坏

## Release 路径

如果要继续验证 release 构建，先准备本地签名覆盖文件：

```bash
mkdir -p .expo-harmony
$EDITOR .expo-harmony/signing.local.json
pnpm run harmony:env
pnpm run harmony:build:release
```

说明：

- `.expo-harmony/signing.local.json` 是本地 signing 入口
- signing 缺失时，release 构建应明确失败，而不是假成功

## Harmony sidecar 预期产物

执行 `harmony:init` 或 `harmony:bundle` 后，至少应生成：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

当前细节：

- `reanimated` 与 `svg` 会进入 `RNOHPackagesFactory.*` 与 `autolinking.cmake`
- `reanimated` 与 `svg` 会作为 `.har` 依赖出现在 `harmony/oh-package.json5`

如果需要看更完整的构建与发布说明，继续阅读：

- [CLI 构建指南](./cli-build.md)
- [支持矩阵](./support-matrix.md)
- [npm 发布说明](./npm-release.md)
