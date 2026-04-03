# 官方最小 Sample 指南

这份指南适用于仓库内的 `examples/official-minimal-sample`。

它仍然是仓库里最小的官方 sample，但从 `v1.7.x` 开始不再把自己描述成“空白 smoke baseline”。它的定位是：

- 让新开发者一眼看懂最短 `doctor -> init -> bundle -> build-hap` 链路
- 验证受管 Harmony sidecar 的最小稳定产物
- 明确说明它不覆盖 router、UI-stack、native capability

## 使用方式

```bash
cd examples/official-minimal-sample
pnpm install --ignore-scripts
pnpm run harmony:doctor:strict
pnpm run harmony:init
pnpm run harmony:sync-template
pnpm run harmony:bundle
pnpm run harmony:build:debug
```

## 运行时成功标准

打开 App 后，至少确认：

- 页面能正常启动
- 页面清楚显示这条 sample 验证的是最短构建链路
- 页面清楚区分“验证什么”和“故意不包含什么”
- `bundle.harmony.js` 成功产出
- 生成的 Harmony sidecar 保持最小且稳定，不被 router 或 UI-stack 逻辑污染

## Release 路径

如果要继续验证 release 构建，先准备本地签名覆盖文件：

```bash
cp .expo-harmony/signing.local.example.json .expo-harmony/signing.local.json
$EDITOR .expo-harmony/signing.local.json
pnpm run harmony:env
pnpm run harmony:build:release
```

说明：

- `.expo-harmony/signing.local.example.json` 是可直接复制的本地 signing 範本
- `.expo-harmony/signing.local.json` 是本地 signing 入口
- toolkit 会把本地 signing 合并进 `harmony/build-profile.json5`
- 如果 signing 没配置，`harmony:env` 会明确报缺失；这属于预期阻断

## 不覆盖的内容

这个 sample 故意不包含：

- `expo-router`
- `expo-linking`
- `expo-constants`
- `react-native-svg`
- `react-native-reanimated`
- 任意 preview native capability

如果你要验证这些内容，请改用：

- [官方 App Shell sample 指南](./official-app-shell-sample.md)
- [官方 UI Stack sample 指南](./official-ui-stack-sample.md)
- [官方 Native Capabilities sample 指南](./official-native-capabilities-sample.md)
