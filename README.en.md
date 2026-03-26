<div align="center">
  <h1>Expo Harmony Toolkit</h1>
  <p><strong>A validated Expo-to-Harmony toolkit for managed Expo app-shell projects.</strong></p>
  <p>Built around one public App Shell matrix, with clear admission checks, vendored Harmony scaffolding, and a documented DevEco release gate.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Plugin/actions/workflows/ci.yml"><img alt="Checks" src="https://img.shields.io/badge/checks-passing-16a34a?style=flat-square&logo=githubactions&logoColor=white"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square"></a>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Plugin/releases"><img alt="Version" src="https://img.shields.io/badge/version-v1.0.0-111827?style=flat-square"></a>
    <a href="./docs/support-matrix.md"><img alt="Matrix" src="https://img.shields.io/badge/matrix-expo55--rnoh082--app--shell-2563eb?style=flat-square"></a>
    <img alt="Input" src="https://img.shields.io/badge/input-Managed%2FCNG-059669?style=flat-square">
  </p>
  <p>
    <a href="./docs/support-matrix.md">Support Matrix</a> ·
    <a href="./docs/official-app-shell-sample.md">Official App Shell Sample</a> ·
    <a href="./docs/roadmap.md">Roadmap</a>
  </p>
</div>

> [!IMPORTANT]
> `v1.0.0` is a formal restricted-platform promise for `expo55-rnoh082-app-shell`. It is not a promise that arbitrary Expo apps can ship to HarmonyOS unchanged.

> [!TIP]
> If you only need a fast admission check, start with `expo-harmony doctor --strict --project-root /path/to/app`.

## Overview

`expo-harmony-toolkit` provides a focused toolchain around Expo-to-Harmony migration:

- Expo config plugin entrypoint `app.plugin.js`
- CLI: `expo-harmony doctor`
- CLI: `expo-harmony init`
- CLI: `expo-harmony sync-template`
- Vendored `harmony/` sidecar template
- Dependency classification and `doctor --strict` admission checks
- Official minimal sample and official app-shell sample

## Project Status

| Item | Status |
| --- | --- |
| Current version | `v1.0.0` |
| Formal release matrix | `expo55-rnoh082-app-shell` |
| Supported input | Managed/CNG Expo projects |
| Validated capabilities | `expo-router`, `expo-linking`, `expo-constants` |
| Official sample | `examples/official-app-shell-sample` |
| Official release gate | DevEco Studio GUI `Build Debug Hap(s)` / `Run` |

<details>
<summary><strong>Currently out of scope</strong></summary>

- bare Expo
- `react-native-reanimated`
- `react-native-svg`
- `react-native-gesture-handler`
- `expo-camera`
- `expo-notifications`
- `expo-file-system`
- pure `hvigor` CLI packaging

</details>

## Key Features

- `doctor --strict` exposes stable admission fields: `matrixId`, `eligibility`, `blockingIssues`, `advisories`
- `init` scaffolds the Harmony sidecar, Metro config, managed metadata, and package scripts
- `sync-template` reapplies the vendored template idempotently and reports drift clearly
- Official samples cover both the baseline smoke path and the validated app-shell runtime path
- The current matrix is continuously validated in CI

## Quick Start

```bash
pnpm install
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

## Support Matrix

`v1.0.0` formally commits to one matrix only: `expo55-rnoh082-app-shell`.

- Expo SDK: `55`
- React: `19.2.x`
- React Native: `0.83.x`
- RNOH: `0.82.18`
- App-shell dependencies: `expo-router`, `expo-linking`, `expo-constants`
- Native identifier: at least `android.package` or `ios.bundleIdentifier`

See [docs/support-matrix.md](./docs/support-matrix.md) for the full matrix, dependency allowlist, blocking rules, and negative fixtures.

## Official Samples

- `examples/official-app-shell-sample`
  The public app-shell sample used for the formal `doctor -> init -> bundle -> DevEco` manual release gate.
- `examples/official-minimal-sample`
  A baseline smoke sample for minimal path regressions and template stability.

The full manual flow for the app-shell sample is documented in [docs/official-app-shell-sample.md](./docs/official-app-shell-sample.md).  
The baseline minimal sample is documented in [docs/official-minimal-sample.md](./docs/official-minimal-sample.md).

## CLI Commands

| Command | Purpose |
| --- | --- |
| `expo-harmony doctor` | Inspect Expo config and dependencies |
| `expo-harmony doctor --strict` | Run the formal matrix admission gate |
| `expo-harmony init` | Generate Harmony sidecar files, metadata, and package scripts |
| `expo-harmony sync-template` | Reapply the vendored template and report drift |

Generated files include:

- `harmony/`
- `metro.harmony.config.js`
- `.expo-harmony/manifest.json`
- `.expo-harmony/doctor-report.json`
- `.expo-harmony/toolkit-config.json`

## Validation Flow / Release Gate

Automated requirements:

- `pnpm build`
- `pnpm test`
- Official samples pass `doctor --strict`
- `init` / `sync-template` remain idempotent
- `bundle:harmony` succeeds

Manual release gate:

- Open `examples/official-app-shell-sample/harmony` in DevEco Studio
- `Build Debug Hap(s)` succeeds
- The app launches successfully
- The home screen shows `Constants.expoConfig?.name`
- The home screen shows `Linking.createURL('/details')`
- Navigation to `/details` works
- Navigation back to home works

## Documentation

- [Support Matrix](./docs/support-matrix.md)
- [Official App Shell Sample Guide](./docs/official-app-shell-sample.md)
- [Official Minimal Sample Guide](./docs/official-minimal-sample.md)
- [Roadmap](./docs/roadmap.md)

## Roadmap

- `v0.1`: migration toolkit foundation
- `v0.2`: documented manual packaging path for the official minimal sample
- `v0.5`: single restricted matrix with packaging promise
- `v0.8`: app-shell capability expansion
- `v1.0`: formal restricted-platform commitment

See [docs/roadmap.md](./docs/roadmap.md) for the expanded milestone history.

## License

Released under the [MIT License](./LICENSE).
