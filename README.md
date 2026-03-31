<div align="center">
  <h1>Expo Harmony Toolkit</h1>
  <p><strong>面向 Managed/CNG Expo 项目的 HarmonyOS 迁移、准入检查与 UI-stack 构建工具链。</strong></p>
  <p>One verified UI-stack matrix, additive preview/experimental capability tiers, managed Harmony sidecar scaffolding, and a toolkit-driven <code>doctor → init → bundle → build-hap</code> path.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/actions/workflows/ci.yml"><img alt="Checks" src="https://img.shields.io/badge/checks-passing-16a34a?style=flat-square&logo=githubactions&logoColor=white"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square"></a>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/releases"><img alt="Version" src="https://img.shields.io/badge/version-v1.6.0-111827?style=flat-square"></a>
    <a href="./docs/support-matrix.md"><img alt="Matrix" src="https://img.shields.io/badge/matrix-expo55--rnoh082--ui--stack-2563eb?style=flat-square"></a>
    <img alt="Input" src="https://img.shields.io/badge/input-Managed%2FCNG-059669?style=flat-square">
  </p>
  <p>
    <a href="./docs/support-matrix.md">支持矩阵</a> ·
    <a href="./docs/cli-build.md">CLI 构建指南</a> ·
    <a href="./docs/official-native-capabilities-sample.md">官方 Native Capabilities Sample</a> ·
    <a href="./docs/official-ui-stack-sample.md">官方 UI Stack Sample</a> ·
    <a href="./docs/npm-release.md">npm 发布说明</a> ·
    <a href="./docs/roadmap.md">路线图</a>
  </p>
</div>

> [!IMPORTANT]
> `v1.6` 开始，toolkit 采用 `verified + preview + experimental` 三层支持模型。`expo55-rnoh082-ui-stack` 仍是唯一 `verified` 公开矩阵；`expo-file-system` 与 `expo-image-picker` 进入 `preview`，但这仍然不是“任意 Expo 项目都能原样发布到 HarmonyOS”的声明。

> [!TIP]
> 由于当前公开矩阵内的两套 `@react-native-oh-tpl/*` adapter 依赖以 Git URL + exact commit 形式接入，仓库开发和官方 UI-stack sample 推荐使用 `pnpm install --ignore-scripts`，避免 Git adapter 在 prepare 阶段拉取私有资源而中断安装。

## 概览

`expo-harmony-toolkit` 提供一条围绕 Expo 到 HarmonyOS 迁移的受限、可验证工具链，并开始公开 preview 层的原生能力桥接骨架：

- Expo config plugin 根入口 `app.plugin.js`
- `expo-harmony doctor`
- `expo-harmony init`
- `expo-harmony sync-template`
- `expo-harmony env`
- `expo-harmony bundle`
- `expo-harmony build-hap --mode debug|release`
- 受管 `harmony/` sidecar 模板与 autolinking 产物
- `.expo-harmony/*.json` 形式的稳定报告与元数据

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 当前版本 | `v1.6.0` |
| 支持模型 | `verified + preview + experimental` |
| 唯一 `verified` 公开矩阵 | `expo55-rnoh082-ui-stack` |
| 输入范围 | Managed/CNG Expo 项目 |
| `verified` JS/UI 能力 | `expo-router`、`expo-linking`、`expo-constants`、`react-native-reanimated`、`react-native-svg` |
| `preview` 原生能力 | `expo-file-system`、`expo-image-picker` |
| `experimental` 能力 | `expo-location`、`expo-camera`、`expo-notifications`、`react-native-gesture-handler` |
| 构建链 | `doctor -> init -> bundle -> build-hap` |
| 主 sample | `examples/official-ui-stack-sample` |
| preview sample | `examples/official-native-capabilities-sample` |
| 回归基线 | `examples/official-app-shell-sample`、`examples/official-minimal-sample` |

<details>
<summary><strong>当前仍不在 verified 正式承诺范围</strong></summary>

- bare Expo
- `expo-file-system`、`expo-image-picker` 仍只属于 `preview`
- `expo-location`
- `expo-camera`
- `expo-notifications`
- 多矩阵并行支持

</details>

## 安装方式

已发布 npm 包：

```bash
pnpm add -D expo-harmony-toolkit
# 或
npm install -D expo-harmony-toolkit
```

安装完成后，推荐通过本地项目依赖调用 CLI：

```bash
pnpm exec expo-harmony doctor --project-root .
# 或
npx expo-harmony doctor --project-root .
```

如果你是在这个仓库里开发，或直接运行官方 UI-stack sample，仍推荐：

```bash
pnpm install --ignore-scripts
```

因为当前公开矩阵内的两套 `@react-native-oh-tpl/*` adapter 在 prepare 阶段可能访问私有上游资源。

## 推荐接入方式

建议把 config plugin 写进 Expo 配置，这样 `prebuild` 元数据和 CLI 读取的 Harmony 标识会保持一致：

```json
{
  "expo": {
    "android": {
      "package": "com.example.app"
    },
    "plugins": [
      "expo-router",
      [
        "expo-harmony-toolkit",
        {
          "entryModuleName": "entry"
        }
      ]
    ]
  }
}
```

说明：

- 如果已经配置了 `android.package` 或 `ios.bundleIdentifier`，通常不需要额外传 `bundleName`
- `entryModuleName` 默认就是 `entry`，只有你需要显式固定时才需要写出来
- toolkit 不会替你自动补齐 UI-stack 依赖；依赖是否落入公开矩阵，以 `doctor --strict` 结果为准

## 使用方法

1. 先做准入检查：

```bash
cd /path/to/app
pnpm exec expo-harmony doctor --project-root .
pnpm exec expo-harmony doctor --project-root . --strict
pnpm exec expo-harmony doctor --project-root . --target-tier preview
```

2. 生成或刷新受管 Harmony sidecar：

```bash
pnpm exec expo-harmony init --project-root .
pnpm exec expo-harmony sync-template --project-root .
```

3. 生成 JS bundle，或继续发起 Harmony 构建：

```bash
pnpm exec expo-harmony bundle --project-root .
pnpm exec expo-harmony env --strict
pnpm exec expo-harmony build-hap --mode debug
```

4. 如果需要 release 构建，先确认签名环境已就绪，再执行：

```bash
pnpm exec expo-harmony env
pnpm exec expo-harmony build-hap --mode release
```

常见使用判断：

- 想知道当前项目是否还在公开矩阵里：跑 `doctor --strict`
- 想知道项目是否只落在 preview / experimental：跑 `doctor --target-tier preview` 或 `doctor --target-tier experimental`
- 刚改过依赖、Expo 配置或插件：先跑 `sync-template`
- 只想验证 JS/UI 侧是否能打包：跑 `bundle`
- 准备进 DevEco Studio 或本机构建 HAP：先跑 `env`

## 支持矩阵

`v1.6` 开始改成支持分层：

- `verified`：唯一公开矩阵仍是 `expo55-rnoh082-ui-stack`
- `preview`：`expo-file-system`、`expo-image-picker`
- `experimental`：`expo-location`、`expo-camera`、`expo-notifications`、`react-native-gesture-handler`

`doctor --strict` 继续只代表 `verified`。`doctor --target-tier preview` 会在同一 runtime matrix 下额外放行 preview 能力，但这不等于它们已经进入正式承诺。

完整白名单、配对规则、exact specifier、issue code 与 release gate 见 [docs/support-matrix.md](./docs/support-matrix.md)。

## 官方 Samples

- `examples/official-ui-stack-sample`
  当前唯一对外主 sample，同时覆盖 router、linking、constants、SVG、reanimated 和 Harmony sidecar 构建链。
- `examples/official-native-capabilities-sample`
  v1.6 新增的 preview sample，用来承接 `expo-file-system` 与 `expo-image-picker` 的 bridge、permission 与 bundle 骨架验收。
- `examples/official-app-shell-sample`
  `v1.1` App Shell 回归基线，用来防止 UI-stack 收口引入 router 退化。
- `examples/official-minimal-sample`
  最小 smoke baseline，用来回归 sidecar 模板与最短 bundle 路径。

详见：

- [官方 UI Stack sample 指南](./docs/official-ui-stack-sample.md)
- [官方 Native Capabilities sample 指南](./docs/official-native-capabilities-sample.md)
- [官方 App Shell sample 指南](./docs/official-app-shell-sample.md)
- [官方最小 sample 指南](./docs/official-minimal-sample.md)

## CLI 命令

| 命令 | 作用 |
| --- | --- |
| `expo-harmony doctor` | 扫描 Expo 配置与依赖，输出迁移报告 |
| `expo-harmony doctor --strict` | 将当前矩阵准入检查作为正式 gate 执行 |
| `expo-harmony doctor --target-tier preview` | 在同一 runtime matrix 下评估项目是否至少落在 `preview` 能力层 |
| `expo-harmony init` | 生成 Harmony sidecar、autolinking 产物、metadata 与 package scripts |
| `expo-harmony sync-template` | 再次应用受管模板并检查 drift |
| `expo-harmony env` | 检查 DevEco / hvigor / hdc / signing 本地环境 |
| `expo-harmony bundle` | 生成标准 `bundle.harmony.js` |
| `expo-harmony build-hap --mode debug` | 触发 debug HAP 构建 |
| `expo-harmony build-hap --mode release` | 触发 release HAP 构建，需要 signing 就绪 |

关键受管产物包括：

- `harmony/oh-package.json5`
- `harmony/entry/src/main/ets/RNOHPackagesFactory.ets`
- `harmony/entry/src/main/cpp/RNOHPackagesFactory.h`
- `harmony/entry/src/main/cpp/autolinking.cmake`
- `metro.harmony.config.js`
- `.expo-harmony/manifest.json`
- `.expo-harmony/doctor-report.json`
- `.expo-harmony/env-report.json`
- `.expo-harmony/build-report.json`
- `.expo-harmony/toolkit-config.json`

## 发布与验收

发布前统一检查：

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball 安装 smoke：`doctor --strict`、`init --force`、`bundle`

自动发布默认走 hosted CI only：

- GitHub workflow 跑 `build/test/pack/tarball smoke`
- `build-hap --mode debug` 不阻塞 npm publish
- GitHub 自动发布使用 `latest` dist-tag 和 provenance
- 本地手动发布使用 `latest` dist-tag

手动 Harmony 验收继续要求：

- `official-ui-stack-sample` 成功启动
- SVG 正常渲染
- 点击首页 motion rail 后能触发可见动画
- 动画完成后路由跳转仍正常
- `Build Debug Hap(s)` 成功
- `official-native-capabilities-sample` 至少完成 preview route 的 bundle 与 permission 产物检查

详见 [docs/npm-release.md](./docs/npm-release.md) 与 [docs/signing-and-release.md](./docs/signing-and-release.md)。

## 文档索引

- [支持矩阵](./docs/support-matrix.md)
- [CLI 构建指南](./docs/cli-build.md)
- [官方 Native Capabilities sample 指南](./docs/official-native-capabilities-sample.md)
- [官方 UI Stack sample 指南](./docs/official-ui-stack-sample.md)
- [官方 App Shell sample 指南](./docs/official-app-shell-sample.md)
- [官方最小 sample 指南](./docs/official-minimal-sample.md)
- [npm 发布说明](./docs/npm-release.md)
- [签名与 Release 说明](./docs/signing-and-release.md)
- [路线图](./docs/roadmap.md)

## License

本项目基于 [MIT License](./LICENSE) 发布。
