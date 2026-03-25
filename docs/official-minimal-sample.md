# 官方最小 Sample 打包指南

这份指南只适用于仓库内的 `examples/official-minimal-sample`。

它的目标是在 `v1.0.0` 中继续作为 baseline smoke sample：

1. `doctor`
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
cd examples/official-minimal-sample
pnpm harmony:doctor:strict
pnpm harmony:init
pnpm bundle:harmony
```

成功后会产出：

- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/doctor-report.json`
- `harmony/entry/src/main/resources/rawfile/bundle.harmony.js`

## DevEco Studio

- 用 DevEco Studio 打开 `examples/official-minimal-sample/harmony`
- 等待索引与同步完成
- 完成 Signing Config
- 选择 `entry`
- Run 或 Build HAP

## 承诺边界

- 这份流程只对官方最小 sample 做 baseline 回归验证
- 它不代表任意 Expo 项目都能直接打包成 HarmonyOS 应用
- 其他 Expo modules 与第三方依赖仍需经过 `doctor --strict` 与后续人工适配
- 受限矩阵的完整条件见 [support-matrix.md](./support-matrix.md)
