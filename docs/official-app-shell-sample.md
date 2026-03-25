# 官方 App Shell Sample 打包指南

这份指南只适用于仓库内的 `examples/official-app-shell-sample`。

它是 `v1.0.0` 的正式手动 release gate，用于验证 App Shell matrix 下的最小链路：

1. `doctor --strict`
2. `init`
3. `bundle:harmony`
4. 用 DevEco Studio 打开 `harmony/`
5. 配置签名
6. Run / Build HAP

## 前提

- 已在仓库根目录执行 `pnpm install`
- 已能使用 DevEco Studio
- 已有可用的 HarmonyOS 签名环境

## 执行步骤

```bash
cd examples/official-app-shell-sample
pnpm harmony:doctor:strict
pnpm harmony:init
pnpm bundle:harmony
```

`bundle:harmony` 默认会带 `--reset-cache`。这是刻意设计的，因为 `harmony:init` 会重生成 `index.harmony.js` 与 `.expo-harmony/shims/*`；如果 Metro 沿用旧 cache，DevEco 可能仍然加载上一版入口，导致新的 runtime shim 没进入 bundle。

成功后会产出：

- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/doctor-report.json`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

## DevEco Studio

- 用 DevEco Studio 打开 `examples/official-app-shell-sample/harmony`
- 等待索引与同步完成
- 完成 Signing Config
- 选择 `entry`
- Run 或 Build HAP

## 常见问题

- 如果 DevEco Studio 报 `add_subdirectory given source .../oh_modules/@rnoh/react-native-openharmony/src/main/cpp which is not an existing directory`
- 先回到 sample 目录重新执行：

```bash
pnpm harmony:init
```

- 这会刷新生成的 `harmony/entry/src/main/cpp/CMakeLists.txt`，让它在公开 `oh_modules` 没有展开源码时，自动 fallback 到 `oh_modules/.ohpm/.../src/main/cpp`
- 然后回到 DevEco Studio 做一次 Sync Project 或重新 Run

- 如果 DevEco Studio 报大量 `use of undeclared identifier 'assert'`
- 这通常不是业务代码问题，而是 RNOH 公开 include path 内自带的 `RNOH/assert.h` 覆盖了 SDK 的标准 `assert.h`
- 先回到 sample 目录重新执行：

```bash
pnpm harmony:init
```

- 然后在 DevEco Studio 重新 Sync / Build
- 如果 IDE 仍然粘着旧的 native cache，再执行一次 `Build > Clean Project`，或关闭工程后删除 `harmony/entry/.cxx` 再重新打开

- 如果模拟器启动后出现红屏，内容类似：
  - `[runtime not ready]: TypeError: Cannot read property 'NativeModule' of undefined`
- 先回到 sample 目录重新执行：

```bash
pnpm harmony:init
pnpm bundle:harmony
```

- 这会刷新 `metro.harmony.config.js` 与 `.expo-harmony/shims/expo-modules-core/index.js`
- App Shell sample 依赖一个 Harmony 专用 `expo-modules-core` shim，否则 `expo-router` / `expo-linking` / `expo-constants` 会在启动时掉回 Expo 官方原生 runtime 路径，进而因为 `globalThis.expo.NativeModule` 不存在而崩溃
- 如果重新 bundle 后 DevEco 仍加载旧资产，再重新 Run 一次，必要时先 `Build > Clean Project`

- 如果模拟器启动后出现红屏，内容类似：
  - `[runtime not ready]: ReferenceError: Property 'FormData' doesn't exist`
- 这通常表示 DevEco 仍然在使用旧的 `bundle.harmony.js`，而不是最新带有 runtime prelude 的那版
- 先回到 sample 目录重新执行：

```bash
pnpm harmony:init
pnpm bundle:harmony
```

- 确认 `index.harmony.js` 第一行是：
  - `require('./.expo-harmony/shims/runtime-prelude.js');`
- 然后回 DevEco Studio：
  - `Build > Clean Project`
  - 卸载模拟器里已安装的旧 app
  - 重新 `Run 'entry'`

## 人工验收

- 首页正常显示 `Constants.expoConfig?.name`
- 首页正常显示 `Linking.createURL('/details')`
- 可从首页进入 `/details`
- 可从详情页返回首页
- `Build Debug Hap(s)` 成功

## 承诺边界

- 这份流程只对官方 App Shell sample 做 `v1.0.0` 正式受限矩阵验证
- 它不代表任意 Expo 项目都能直接打包成 HarmonyOS 应用
- App Shell 以外的 Expo modules 与第三方依赖仍需经过 `doctor --strict` 与后续人工适配
- 当前不把 `hvigor` 纯 CLI 打包链路纳入 v1.0 承诺范围
- 受限矩阵的完整条件见 [support-matrix.md](./support-matrix.md)
