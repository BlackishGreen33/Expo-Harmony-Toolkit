# 官方最小 Sample 指南

这份指南适用于仓库内的 `examples/official-minimal-sample`。

它在 `v1.5.0` 中继续作为最小 smoke baseline，用于回归：

- 最短 `doctor -> init -> bundle` 链路
- sidecar 模板稳定性
- 非 router、非 UI adapter 的最小输入

## 使用方式

```bash
cd examples/official-minimal-sample
pnpm install --ignore-scripts
pnpm run harmony:doctor:strict
pnpm run harmony:init
pnpm run harmony:sync-template
pnpm run harmony:bundle
```

## 预期

- `doctor --strict` 通过
- `harmony:init` 与 `harmony:sync-template` 冪等
- `bundle.harmony.js` 产出成功
- 生成的 `RNOHPackagesFactory.*` 与 `autolinking.cmake` 保持空 baseline，不被 UI-stack 逻辑污染

如果你要验证 router 或 UI 能力，请改用：

- [官方 App Shell sample 指南](./official-app-shell-sample.md)
- [官方 UI Stack sample 指南](./official-ui-stack-sample.md)
