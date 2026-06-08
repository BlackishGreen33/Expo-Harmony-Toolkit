# 签名与 Release 说明

`expo-harmony build-hap --mode release` 可以由 toolkit 触发，但 release 成功与否仍取决于 Harmony 签名配置是否完整。

这个文档只讨论 HAP release 签名，不讨论 npm 包发布；npm 发布流程见 [npm 发布说明](./npm-release.md)。

## 最低要求

- DevEco Studio / Harmony SDK 已正确安装
- 项目已生成 `harmony/`
- `.expo-harmony/signing.local.json` 中存在可用的 `signingConfigs`
- AppGallery Connect / 本地签名材料与工程配置一致

`.expo-harmony/signing.local.json` 的最小结构与 `.expo-harmony/signing.local.example.json` 一致：

```json
{
  "signingConfigs": [
    {
      "name": "default",
      "type": "HarmonyOS",
      "material": {
        "storeFile": "./signing/release.p12",
        "storePassword": "<replace-with-store-password>",
        "keyAlias": "<replace-with-key-alias>",
        "keyPassword": "<replace-with-key-password>",
        "signAlg": "SHA256withECDSA",
        "profile": "./signing/release.p7b",
        "certpath": "./signing/release.cer"
      }
    }
  ],
  "products": [
    {
      "name": "default",
      "signingConfig": "default"
    }
  ]
}
```

真实发布时，这些材料应来自 DevEco / AppGallery Connect。OpenHarmony 本地自签材料只适合模拟器或内部验证，不能当作生产发布凭据。

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
- 可以直接从 `.expo-harmony/signing.local.example.json` 复制出 `.expo-harmony/signing.local.json` 再填入真实材料

`expo-harmony init` / `sync-template` 只会把非密钥 signing 引用写入可版本化的 `harmony/build-profile.json5`。`storePassword` 与 `keyPassword` 只应保留在 `.expo-harmony/signing.local.json`；`build-hap` 会在本地 Hvigor 构建期间临时注入这些 secret，并在 Hvigor 结束后恢复 `build-profile.json5`。没有本地 signing config 的 debug 构建仍不需要 release signing。

## 推荐流程

### Debug 验证

```bash
expo-harmony env --strict
expo-harmony build-hap --mode debug
```

### Release 验证

```bash
cp .expo-harmony/signing.local.example.json .expo-harmony/signing.local.json
$EDITOR .expo-harmony/signing.local.json
expo-harmony env
expo-harmony build-hap --mode release
```

前提是：

- `env-report.json` 不再提示 `env.signing.missing`
- DevEco / AppGallery Connect 的 release profile 已准备完成
- release profile 覆盖了 HAP 中申请的 restricted permission；否则模拟器或设备可能在安装阶段报 `grant request permissions failed`

## v1.8.2 本地模拟器证据

`v1.8.2` 已在 ccnubox 本地验证目标上记录：

- `expo-harmony env`：`Signing: configured`
- `expo-harmony build-hap --mode release`：release signed HAP 构建成功
- `hdc install -r <release-hap>`：模拟器安装成功
- `aa start -a EntryAbility -b com.muxixyz.ccnubox`：启动成功

这条记录只说明 release HAP 的本地签名、安装、启动链路可走通。它不代表 AppGallery 生产签名、不代表真机通过，也不关闭 preview capability 的 release runtime acceptance。

## v1.8.3 矩阵 patch 说明

`v1.8.3` 将 RNOH runtime 与 CLI 从 `0.82.18` 刷新到 `0.82.29`。npm 上当前仍没有可用的 RNOH `0.83.x` 包，因此公开矩阵继续要求 `react-native@0.82.1`；下游项目如需 Harmony build-chain，应按该矩阵锁定 React Native，而不是把模拟器构建证据扩写成 RN `0.83.x` verified。

## 关系说明

- `doctor --strict` 负责项目是否落入公开矩阵
- `env` 负责本机构建环境是否 ready
- `build-hap --mode release` 负责真正发起 release HAP 构建
- npm 包发布流程独立于 HAP signing，见 [npm 发布说明](./npm-release.md)
