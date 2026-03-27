# CLI 构建指南

`v1.5.0` 开始，toolkit 的公开叙事不再只是 App Shell，而是 `expo55-rnoh082-ui-stack` 这条完整 UI-stack 矩阵。

CLI 命令集合不变：

- `doctor`
- `init`
- `sync-template`
- `env`
- `bundle`
- `build-hap`

## 推荐顺序

在项目根目录执行：

```bash
expo-harmony doctor --strict
expo-harmony init --force
expo-harmony env --strict
expo-harmony bundle
expo-harmony build-hap --mode debug
```

职责划分：

- `doctor --strict` 负责项目是否落入公开矩阵
- `init` / `sync-template` 负责受管 sidecar 与 autolinking 产物
- `env --strict` 负责构建机是否 ready
- `bundle` 负责 `bundle.harmony.js`
- `build-hap` 负责串起 bundle、`ohpm`、`hvigor`

## UI stack 依赖安装注意事项

当前三项 Harmony adapter 依赖都固定为 Git URL + exact commit：

- `@react-native-oh-tpl/react-native-reanimated`
- `@react-native-oh-tpl/react-native-svg`
- `@react-native-oh-tpl/react-native-gesture-handler`

这些 Git 包在某些环境下会在 prepare 阶段尝试拉取上游私有资源。对于仓库开发和官方 sample，推荐：

```bash
pnpm install --ignore-scripts
```

这不会影响：

- `doctor`
- `init`
- `sync-template`
- `bundle`
- `build-hap` 前的 sidecar 生成

因为 toolkit 只需要这些 adapter 的 package metadata、`harmony/*.har` 和已提交文件，不依赖其 prepare 阶段产物。

## sidecar 生成行为

`init` / `sync-template` / `bundle` / `build-hap` 会统一生成：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`

当前规则：

- toolkit 会调用项目安装的 `react-native-harmony-cli` 中的 `link-harmony` command
- 只对白名单三项 `@react-native-oh-tpl/*` adapter 传入 include allowlist
- `gesture-handler` 会进入 `autolinking.cmake` 与 `RNOHPackagesFactory.*`
- `reanimated` 和 `svg` 目前通过 `harmony/oh-package.json5` 中的 `.har` 依赖接入

toolkit 不会改动用户业务路由、动画逻辑或页面源码；它只负责受管 sidecar、构建链和 metadata。

## Debug 与 Release

### Debug

```bash
expo-harmony env --strict
expo-harmony build-hap --mode debug
```

### Release

```bash
expo-harmony env
expo-harmony build-hap --mode release
```

release 依赖：

- DevEco Studio / Harmony SDK
- `hvigor`
- `ohpm`
- 有效的 signing 配置

更多发布细节见 [npm 发布说明](./npm-release.md) 与 [签名与 Release 说明](./signing-and-release.md)。
