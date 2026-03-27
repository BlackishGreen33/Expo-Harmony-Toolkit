# 签名与 Release 说明

`expo-harmony build-hap --mode release` 可以由 toolkit 触发，但 release 成功与否仍取决于 Harmony 签名配置是否完整。

这个文档只讨论 HAP release 签名，不讨论 npm 包发布；npm 发布流程见 [npm 发布说明](./npm-release.md)。

## 最低要求

- DevEco Studio / Harmony SDK 已正确安装
- 项目已生成 `harmony/`
- `harmony/build-profile.json5` 中存在可用的 `signingConfigs`
- AppGallery Connect / 本地签名材料与工程配置一致

## 如何检查

在项目根目录执行：

```bash
expo-harmony env
```

如果 report 中出现：

- `env.signing.missing`

说明当前 sidecar 还没有完整的签名配置。此时：

- `debug` 构建仍可继续做本地验证
- `release` 构建不应视为 ready

## 推荐流程

### Debug 验证

```bash
expo-harmony env --strict
expo-harmony build-hap --mode debug
```

### Release 验证

```bash
expo-harmony env
expo-harmony build-hap --mode release
```

前提是：

- `env-report.json` 不再提示 `env.signing.missing`
- DevEco / AppGallery Connect 的 release profile 已准备完成

## 关系说明

- `doctor --strict` 负责项目是否落入公开矩阵
- `env` 负责本机构建环境是否 ready
- `build-hap --mode release` 负责真正发起 release HAP 构建
- npm 包发布流程独立于 HAP signing，见 [npm 发布说明](./npm-release.md)
