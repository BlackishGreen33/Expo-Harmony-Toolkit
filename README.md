# Expo Harmony Toolkit

> 面向 Managed/CNG Expo 项目的 HarmonyOS 迁移、准入检查与正式受限平台工具链。

[简体中文](./README.md) | [English](./README.en.md)

![CI](https://img.shields.io/github/actions/workflow/status/BlackishGreen33/Expo-Harmony-Plugin/ci.yml?branch=main&label=CI)
![License](https://img.shields.io/github/license/BlackishGreen33/Expo-Harmony-Plugin)
![Version](https://img.shields.io/badge/version-v1.0.0-111827)
![Matrix](https://img.shields.io/badge/matrix-expo55--rnoh082--app--shell-2563eb)
![Managed/CNG Only](https://img.shields.io/badge/input-Managed%2FCNG-059669)

## 简介

`expo-harmony-toolkit` 提供一套围绕 Expo 到 HarmonyOS 迁移的工具链：

- Expo config plugin 根入口 `app.plugin.js`
- CLI：`expo-harmony doctor`
- CLI：`expo-harmony init`
- CLI：`expo-harmony sync-template`
- vendored `harmony/` sidecar 模板
- 依赖分类与 `doctor --strict` 准入检查
- 官方最小 sample 与官方 App Shell sample

`v1.0.0` 的定位不是“任意 Expo 项目都能直接打包”，而是对单一 App Shell matrix 的正式受限平台承诺。

## 当前状态与边界

| 项目 | 说明 |
| --- | --- |
| 当前版本 | `v1.0.0` |
| 正式承诺矩阵 | `expo55-rnoh082-app-shell` |
| 输入范围 | Managed/CNG Expo 项目 |
| 已验证能力 | `expo-router`、`expo-linking`、`expo-constants` |
| 官方 release gate | DevEco Studio GUI build/run |
| 不在承诺内 | bare Expo、`reanimated`、`svg`、`gesture-handler`、`camera`、`notifications`、`file-system`、`hvigor` 纯 CLI 打包 |

## 核心特性

- `doctor --strict` 提供稳定的准入检查，输出 `matrixId`、`eligibility`、`blockingIssues`、`advisories`
- `init` 生成 Harmony sidecar、Metro 配置、受管 metadata 与 package scripts
- `sync-template` 以幂等方式刷新模板，并对 drift 给出清晰提示
- 官方 sample 覆盖 baseline smoke 与 App Shell 运行链路
- 当前矩阵的自动化验证已经固化到 CI

## 快速开始

```bash
pnpm install
pnpm build
pnpm test
```

针对任意 Expo 项目：

```bash
expo-harmony doctor --project-root /path/to/app
expo-harmony doctor --project-root /path/to/app --strict
expo-harmony init --project-root /path/to/app
expo-harmony sync-template --project-root /path/to/app
```

## 支持矩阵

`v1.0.0` 只公开承诺一条矩阵：`expo55-rnoh082-app-shell`。

- Expo SDK：`55`
- React：`19.2.x`
- React Native：`0.83.x`
- RNOH：`0.82.18`
- App Shell 依赖：`expo-router`、`expo-linking`、`expo-constants`
- 原生标识：至少配置 `android.package` 或 `ios.bundleIdentifier`

完整矩阵、白名单依赖、阻断条件与反例见 [docs/support-matrix.md](./docs/support-matrix.md)。

## 官方 Samples

- `examples/official-app-shell-sample`
  当前唯一对外承诺的 App Shell sample，用于验证 `doctor -> init -> bundle -> DevEco` 的正式手动 release gate。
- `examples/official-minimal-sample`
  baseline smoke sample，用于回归最小链路与模板稳定性。

App Shell sample 的完整手动流程见 [docs/official-app-shell-sample.md](./docs/official-app-shell-sample.md)。  
最小 sample 的 baseline 说明见 [docs/official-minimal-sample.md](./docs/official-minimal-sample.md)。

## CLI 命令

| 命令 | 作用 |
| --- | --- |
| `expo-harmony doctor` | 扫描 Expo 配置与依赖，输出迁移报告 |
| `expo-harmony doctor --strict` | 将当前矩阵准入检查作为正式 gate 执行 |
| `expo-harmony init` | 生成 Harmony sidecar、metadata 与 package scripts |
| `expo-harmony sync-template` | 再次应用 vendored 模板并检查 drift |

工具生成的关键文件包括：

- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/manifest.json`
- `.expo-harmony/doctor-report.json`
- `.expo-harmony/toolkit-config.json`

## 验证流程 / Release Gate

自动化要求：

- `pnpm build`
- `pnpm test`
- 官方 samples 的 `doctor --strict`
- `init` / `sync-template` 幂等
- `bundle:harmony`

手动 release gate：

- 在 DevEco Studio 中打开 `examples/official-app-shell-sample/harmony`
- `Build Debug Hap(s)` 成功
- App 正常启动
- 首页显示 `Constants.expoConfig?.name`
- 首页显示 `Linking.createURL('/details')`
- 可进入 `/details`
- 可从 `/details` 返回首页

## 文档索引

- [支持矩阵](./docs/support-matrix.md)
- [官方 App Shell sample 打包指南](./docs/official-app-shell-sample.md)
- [官方最小 sample 打包指南](./docs/official-minimal-sample.md)
- [路线图](./docs/roadmap.md)

## 路线图

- `v0.1`：迁移工具包
- `v0.2`：官方最小 sample 可按文档手动打包
- `v0.5`：单一受限矩阵可打包
- `v0.8`：App Shell 能力扩张
- `v1.0`：正式受限平台承诺

更完整的阶段说明见 [docs/roadmap.md](./docs/roadmap.md)。

## License

本项目基于 [MIT License](./LICENSE) 发布。
