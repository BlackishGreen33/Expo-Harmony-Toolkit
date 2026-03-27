# 官方 App Shell Sample 指南

这份指南适用于仓库内的 `examples/official-app-shell-sample`。

从 `v1.5.0` 开始，它不再是对外主 sample，而是 App Shell 回归基线，主要用于确认：

- `expo-router`
- `expo-linking`
- `expo-constants`
- router sidecar 入口和 bundle 行为
- UI-stack 收口没有破坏原有 App Shell 路径

## 使用方式

```bash
cd examples/official-app-shell-sample
pnpm install --ignore-scripts
pnpm run harmony:doctor:strict
pnpm run harmony:init
pnpm run harmony:sync-template
pnpm run harmony:bundle
```

如果本机 DevEco 环境已就绪，也可以继续：

```bash
pnpm run harmony:build:debug
```

## 回归关注点

这个 sample 不引入 UI adapters。它的价值在于：

- `doctor` 仍然判定在 `expo55-rnoh082-ui-stack` 公开矩阵内
- `index.harmony.js` 与 router sidecar 入口仍然正确
- `autolinking.cmake` 在无 UI adapters 时保持空 stub，不被 UI-stack 逻辑污染
- `bundle.harmony.js` 仍能正确产出 router 页面

如果需要对外展示 UI-stack 能力，请改用 [官方 UI Stack sample 指南](./official-ui-stack-sample.md)。
