# 官方 App Shell Sample 指南

这份指南适用于仓库内的 `examples/official-app-shell-sample`。

从 `v1.7.x` 开始，它的定位不再只是“回归基线”，而是最小可理解的 App Shell 开发者 sample。它专门展示：

- `expo-router`
- `expo-linking`
- `expo-constants`
- 当前 pathname / observed URL / generated URL
- router push、`Link` 组件、generated deep link 三条最核心入口

## 使用方式

```bash
cd examples/official-app-shell-sample
pnpm install --ignore-scripts
pnpm run harmony:doctor:strict
pnpm run harmony:init
pnpm run harmony:sync-template
pnpm run harmony:bundle
pnpm run harmony:build:debug
```

## 运行时成功标准

打开 App 后，至少确认：

- 首页能看到 `Constants.expoConfig?.name`
- 首页能看到当前 pathname、observed URL、generated details URL
- 点击 `Push /details with router` 后能进入 `/details`
- 点击 `Open details with Link component` 后能进入 `/details`
- 点击 `Open generated deep link` 后，也能把同一个 App 壳子解析到 `/details`
- 在 `/details` 点击返回后能回首页

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
- signing 缺失时，`harmony:env` 和 `harmony:build:release` 会明确提示，不会静默跳过

## 边界

这个 sample 只负责 App Shell 入门路径，不负责：

- `react-native-svg`
- `react-native-reanimated`
- preview native capability

如果你要看 verified UI-stack 主线，请改用 [官方 UI Stack sample 指南](./official-ui-stack-sample.md)。
