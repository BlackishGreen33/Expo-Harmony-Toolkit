<div align="center">
  <h1>Expo Harmony Toolkit</h1>
  <p><strong>A HarmonyOS migration, admission, and UI-stack build toolkit for Managed/CNG Expo projects.</strong></p>
  <p>One validated UI-stack matrix, explicit dependency admission rules, managed Harmony sidecar scaffolding, and a toolkit-driven <code>doctor → init → bundle → build-hap</code> path.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Plugin/actions/workflows/ci.yml"><img alt="Checks" src="https://img.shields.io/badge/checks-passing-16a34a?style=flat-square&logo=githubactions&logoColor=white"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square"></a>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Plugin/releases"><img alt="Version" src="https://img.shields.io/badge/version-v1.5.0-111827?style=flat-square"></a>
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
> `v1.5.0` makes one formal public promise only: `expo55-rnoh082-ui-stack`. This is not a claim that arbitrary Expo applications can be published to HarmonyOS unchanged.

> [!TIP]
> The three validated `@react-native-oh-tpl/*` adapters are currently consumed via exact Git URLs and commits. For repository development and the official UI-stack sample, prefer `pnpm install --ignore-scripts` so adapter prepare hooks do not fail on private upstream resources.

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
| Current version | `v1.5.0` |
| Public matrix | `expo55-rnoh082-ui-stack` |
| Supported input | Managed/CNG Expo projects |
| Validated JS/UI capabilities | `expo-router`, `expo-linking`, `expo-constants`, `react-native-reanimated`, `react-native-svg`, `react-native-gesture-handler` |
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

## Quick Start

For this repository:

```bash
pnpm install --ignore-scripts
pnpm build
pnpm test
```

For any Expo project:

```bash
expo-harmony doctor --project-root /path/to/app
expo-harmony doctor --project-root /path/to/app --strict
expo-harmony init --project-root /path/to/app
expo-harmony sync-template --project-root /path/to/app
```

Inside the project root:

```bash
cd /path/to/app
expo-harmony env --strict
expo-harmony build-hap --mode debug
```

If you only need the JavaScript artifact:

```bash
expo-harmony bundle
```

## Support Matrix

`v1.5.0` stays on one public matrix: `expo55-rnoh082-ui-stack`.

- Expo SDK: `55`
- React: `19.2.x`
- React Native: `0.83.x`
- RNOH and `@react-native-oh/react-native-harmony-cli`: `0.82.18`
- App Shell packages: `expo-router`, `expo-linking`, `expo-constants`
- UI stack packages: `react-native-reanimated`, `react-native-svg`, `react-native-gesture-handler`
- Harmony adapters: the matching `@react-native-oh-tpl/*` exact Git specifiers
- Native identifier: at least `android.package` or `ios.bundleIdentifier`

See [docs/support-matrix.md](./docs/support-matrix.md) for the full allowlist, pairing rules, exact specifiers, issue codes, and release gates.

## Official Samples

- `examples/official-ui-stack-sample`
  The primary public sample for `v1.5.0`, covering router, linking, constants, SVG, gesture, reanimated, and Harmony sidecar build flow.
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
- npm publish uses the `latest` dist-tag and provenance

Manual Harmony acceptance still requires:

- `official-ui-stack-sample` launches successfully
- SVG renders correctly
- the gesture triggers visible animation
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
