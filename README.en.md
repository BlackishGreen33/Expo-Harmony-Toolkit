<div align="center">
  <h1>Expo Harmony Toolkit</h1>
  <p><strong>A HarmonyOS migration, admission, and UI-stack build toolkit for Managed/CNG Expo projects.</strong></p>
  <p>One validated UI-stack matrix, explicit dependency admission rules, managed Harmony sidecar scaffolding, and a toolkit-driven <code>doctor → init → bundle → build-hap</code> path.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/actions/workflows/ci.yml"><img alt="Checks" src="https://img.shields.io/badge/checks-passing-16a34a?style=flat-square&logo=githubactions&logoColor=white"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square"></a>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/releases"><img alt="Version" src="https://img.shields.io/badge/version-v1.5.1-111827?style=flat-square"></a>
    <a href="./docs/support-matrix.md"><img alt="Matrix" src="https://img.shields.io/badge/matrix-expo55--rnoh082--ui--stack-2563eb?style=flat-square"></a>
    <img alt="Input" src="https://img.shields.io/badge/input-Managed%2FCNG-059669?style=flat-square">
  </p>
  <p>
    <a href="./docs/support-matrix.md">Support Matrix</a> ·
    <a href="./docs/cli-build.md">CLI Build Guide</a> ·
    <a href="./docs/official-ui-stack-sample.md">Official UI Stack Sample</a> ·
    <a href="./docs/npm-release.md">npm Release Notes</a> ·
    <a href="./docs/roadmap.md">Roadmap</a>
  </p>
</div>

> [!IMPORTANT]
> `v1.5.1` continues to make one formal public promise only: `expo55-rnoh082-ui-stack`. This is not a claim that arbitrary Expo applications can be published to HarmonyOS unchanged.

> [!TIP]
> The two validated `@react-native-oh-tpl/*` adapters in the public matrix are currently consumed via exact Git URLs and commits. For repository development and the official UI-stack sample, prefer `pnpm install --ignore-scripts` so adapter prepare hooks do not fail on private upstream resources.

## Overview

`expo-harmony-toolkit` provides a constrained, verifiable Expo-to-Harmony toolchain:

- Expo config plugin entrypoint `app.plugin.js`
- `expo-harmony doctor`
- `expo-harmony init`
- `expo-harmony sync-template`
- `expo-harmony env`
- `expo-harmony bundle`
- `expo-harmony build-hap --mode debug|release`
- Managed `harmony/` sidecar templates and autolinking artifacts
- Stable `.expo-harmony/*.json` reports and metadata

## Current Status

| Item | Status |
| --- | --- |
| Current version | `v1.5.1` |
| Public matrix | `expo55-rnoh082-ui-stack` |
| Supported input | Managed/CNG Expo projects |
| Validated JS/UI capabilities | `expo-router`, `expo-linking`, `expo-constants`, `react-native-reanimated`, `react-native-svg` |
| Build path | `doctor -> init -> bundle -> build-hap` |
| Primary sample | `examples/official-ui-stack-sample` |
| Regression baselines | `examples/official-app-shell-sample`, `examples/official-minimal-sample` |

<details>
<summary><strong>Currently out of scope</strong></summary>

- bare Expo
- `expo-image-picker`
- `expo-file-system`
- `expo-location`
- `expo-camera`
- `expo-notifications`
- multiple public matrices

</details>

## Installation

Published npm package:

```bash
pnpm add -D expo-harmony-toolkit
# or
npm install -D expo-harmony-toolkit
```

After installation, prefer invoking the CLI through the local project dependency:

```bash
pnpm exec expo-harmony doctor --project-root .
# or
npx expo-harmony doctor --project-root .
```

If you are developing inside this repository or running the official UI-stack sample directly, still prefer:

```bash
pnpm install --ignore-scripts
```

This avoids adapter prepare hooks failing on private upstream resources.

## Recommended Plugin Wiring

Add the config plugin to your Expo config so prebuild metadata and CLI-derived Harmony identifiers stay aligned:

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

Notes:

- If `android.package` or `ios.bundleIdentifier` is already set, you usually do not need to pass `bundleName`
- `entryModuleName` defaults to `entry`; only pin it explicitly when you want to make that choice obvious
- the toolkit does not auto-install validated UI-stack dependencies; use `doctor --strict` as the real admission gate

## Usage

1. Run the admission check first:

```bash
cd /path/to/app
pnpm exec expo-harmony doctor --project-root .
pnpm exec expo-harmony doctor --project-root . --strict
```

2. Generate or refresh the managed Harmony sidecar:

```bash
pnpm exec expo-harmony init --project-root .
pnpm exec expo-harmony sync-template --project-root .
```

3. Generate the JavaScript bundle, or continue into Harmony build steps:

```bash
pnpm exec expo-harmony bundle --project-root .
pnpm exec expo-harmony env --strict
pnpm exec expo-harmony build-hap --mode debug
```

4. For a release build, verify signing first and then run:

```bash
pnpm exec expo-harmony env
pnpm exec expo-harmony build-hap --mode release
```

Common decision points:

- Want to know whether the current project still matches the public matrix: run `doctor --strict`
- Changed dependencies, Expo config, or plugin wiring: run `sync-template`
- Only want to verify JavaScript/UI portability: run `bundle`
- About to open DevEco Studio or build a HAP locally: run `env` first

## Support Matrix

`v1.5.1` stays on one public matrix: `expo55-rnoh082-ui-stack`.

- Expo SDK: `55`
- React: `19.1.1`
- React Native: `0.82.1`
- RNOH and `@react-native-oh/react-native-harmony-cli`: `0.82.18`
- App Shell packages: `expo-router`, `expo-linking`, `expo-constants`
- UI stack packages: `react-native-reanimated`, `react-native-svg`
- Harmony adapters: the matching `@react-native-oh-tpl/*` exact Git specifiers
- Native identifier: at least `android.package` or `ios.bundleIdentifier`

`react-native-gesture-handler` is no longer part of the public matrix. It remains a manual exploration path until the current `@react-native-oh-tpl/react-native-gesture-handler` and `@react-native-oh/react-native-harmony@0.82.18` runtime pairing passes on-device validation.

See [docs/support-matrix.md](./docs/support-matrix.md) for the full allowlist, pairing rules, exact specifiers, issue codes, and release gates.

## Official Samples

- `examples/official-ui-stack-sample`
  The primary public sample for `v1.5.0`, covering router, linking, constants, SVG, reanimated, and Harmony sidecar build flow.
- `examples/official-app-shell-sample`
  The `v1.1` App Shell regression baseline that protects router behavior while UI-stack support is finalized.
- `examples/official-minimal-sample`
  The smallest smoke baseline for sidecar templates and the shortest bundle path.

See:

- [Official UI Stack Sample Guide](./docs/official-ui-stack-sample.md)
- [Official App Shell Sample Guide](./docs/official-app-shell-sample.md)
- [Official Minimal Sample Guide](./docs/official-minimal-sample.md)

## CLI Commands

| Command | Purpose |
| --- | --- |
| `expo-harmony doctor` | Inspect Expo config and dependencies and produce a migration report |
| `expo-harmony doctor --strict` | Run the formal matrix admission gate |
| `expo-harmony init` | Generate Harmony sidecar files, autolinking artifacts, metadata, and package scripts |
| `expo-harmony sync-template` | Reapply managed templates and report drift |
| `expo-harmony env` | Check the local DevEco / hvigor / hdc / signing environment |
| `expo-harmony bundle` | Generate a standard `bundle.harmony.js` |
| `expo-harmony build-hap --mode debug` | Trigger a debug HAP build |
| `expo-harmony build-hap --mode release` | Trigger a release HAP build; signing must be ready |

Key managed outputs include:

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

## Release And Validation

Pre-publish checks:

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball smoke: `doctor --strict`, `init --force`, `bundle`

Automatic publishing defaults to hosted CI only:

- GitHub workflow runs `build/test/pack/tarball smoke`
- `build-hap --mode debug` does not block npm publish
- GitHub auto-publish uses the `latest` dist-tag and provenance
- local manual publishing uses the `latest` dist-tag

Manual Harmony acceptance still requires:

- `official-ui-stack-sample` launches successfully
- SVG renders correctly
- pressing the home-screen motion rail triggers visible animation
- routing still works after the animation completes
- `Build Debug Hap(s)` succeeds

See [docs/npm-release.md](./docs/npm-release.md) and [docs/signing-and-release.md](./docs/signing-and-release.md).

## Documentation

- [Support Matrix](./docs/support-matrix.md)
- [CLI Build Guide](./docs/cli-build.md)
- [Official UI Stack Sample Guide](./docs/official-ui-stack-sample.md)
- [Official App Shell Sample Guide](./docs/official-app-shell-sample.md)
- [Official Minimal Sample Guide](./docs/official-minimal-sample.md)
- [npm Release Notes](./docs/npm-release.md)
- [Signing and Release Notes](./docs/signing-and-release.md)
- [Roadmap](./docs/roadmap.md)

## License

Released under the [MIT License](./LICENSE).
