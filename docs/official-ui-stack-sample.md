# 官方 UI Stack Sample 指南

这份指南适用于仓库内的 `examples/official-ui-stack-sample`。

它是 `v1.5.0` 的主 sample，承担以下验证职责：

- `expo-router`、`expo-linking`、`expo-constants`
- `react-native-svg`
- `react-native-gesture-handler`
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
```

如果本机 DevEco / Harmony SDK 已就绪，还可以继续：

```bash
pnpm run harmony:env
pnpm run harmony:build:debug
```

## 运行时人工验收

打开 App 后，至少验证：

- 首页能正常启动
- 顶部信息区能看到 `Constants.expoConfig?.name`
- 页面能展示 SVG 圆环图形
- 拖动交互球体时有可见位移与旋转
- 松手后球体会回弹
- 点击 `Open details route` 后能跳到 `/details`
- 在 `/details` 点击返回后能回首页
- 动画和路由交互不会互相破坏

## Harmony sidecar 预期产物

执行 `harmony:init` 或 `harmony:bundle` 后，至少应生成：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

当前细节：

- `gesture-handler` 会出现在 autolinking 产物里
- `reanimated` 与 `svg` 会作为 `.har` 依赖出现在 `harmony/oh-package.json5`

## DevEco 手动验证

- 用 DevEco Studio 打开 `examples/official-ui-stack-sample/harmony`
- 选择 `entry` module
- 确认 App 可运行
- 确认 `Build Debug Hap(s)` 成功

如果需要看更完整的构建与发布说明，继续阅读：

- [CLI 构建指南](./cli-build.md)
- [支持矩阵](./support-matrix.md)
- [npm 发布说明](./npm-release.md)
