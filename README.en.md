<div align="center">
  <h1>Expo Harmony Toolkit</h1>
  <p><strong>A HarmonyOS migration, admission, and UI-stack build toolkit for Managed/CNG Expo projects.</strong></p>
  <p>One verified UI-stack matrix, additive preview/experimental capability tiers, managed Harmony sidecar scaffolding, and a toolkit-driven <code>doctor → init → bundle → build-hap</code> path.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/actions/workflows/ci.yml"><img alt="Checks" src="https://img.shields.io/badge/checks-passing-16a34a?style=flat-square&logo=githubactions&logoColor=white"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square"></a>
    <a href="https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/releases"><img alt="Version" src="https://img.shields.io/badge/version-v1.8.0-111827?style=flat-square"></a>
    <a href="./docs/support-matrix.md"><img alt="Matrix" src="https://img.shields.io/badge/matrix-expo55--rnoh082--ui--stack-2563eb?style=flat-square"></a>
    <img alt="Input" src="https://img.shields.io/badge/input-Managed%2FCNG-059669?style=flat-square">
  </p>
  <p>
    <a href="./docs/support-matrix.md">Support Matrix</a> ·
    <a href="./docs/cli-build.md">CLI Build Guide</a> ·
    <a href="./docs/official-native-capabilities-sample.md">Official Native Capabilities Sample</a> ·
    <a href="./docs/official-ui-stack-sample.md">Official UI Stack Sample</a> ·
    <a href="./docs/npm-release.md">npm Release Notes</a> ·
    <a href="./docs/roadmap.md">Roadmap</a>
  </p>
</div>

> [!IMPORTANT]
> `v1.8` keeps the `verified + preview + experimental` model and continues to keep `expo-location` and `expo-camera` in `preview`. The public promise remains tighter: `latest` only carries fully accepted `verified` capabilities, while `next` is reserved for preview fast-track work. The roadmap now defines `v2.0.0` itself as “reliable Harmony packaging for any Expo project”, so the intermediate versions will keep getting split smaller, but that still does not widen the current `verified` boundary yet.

> [!TIP]
> The two validated `@react-native-oh-tpl/*` adapters in the public matrix are currently consumed via exact Git URLs and commits. For repository development and the official UI-stack sample, prefer `pnpm install --ignore-scripts` so adapter prepare hooks do not fail on private upstream resources.

## Overview

`expo-harmony-toolkit` provides a constrained, verifiable Expo-to-Harmony toolchain and now starts exposing preview-tier native capability bridges:

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

<!-- GENERATED:readme-current-status:start -->
| Item | Status |
| --- | --- |
| Current version | `v1.8.0` |
| Support model | `verified + preview + experimental` |
| Public `verified` matrix | `expo55-rnoh082-ui-stack` |
| Supported input | Managed/CNG Expo projects |
| `verified` JS/UI capabilities | `expo-router`, `expo-linking`, `expo-constants`, `react-native-reanimated`, `react-native-svg` |
| `preview` native capabilities | `expo-file-system`, `expo-image-picker`, `expo-location`, `expo-camera` |
| `experimental` capabilities | `expo-notifications`, `react-native-gesture-handler` |
| Release tracks | `latest` = fully accepted `verified` only; `next` = preview fast track |
| Capability telemetry | `runtimeMode` + `evidence(...)` + `evidenceSource(...)` + `coverageProfile` + `nextActions` |
| Build path | `doctor -> init -> bundle -> build-hap` |
| Primary sample | `examples/official-ui-stack-sample` |
| Preview sample | `examples/official-native-capabilities-sample` |
| Supporting onboarding samples | `examples/official-app-shell-sample`, `examples/official-minimal-sample` |
<!-- GENERATED:readme-current-status:end -->

<details>
<summary><strong>Still outside the verified public promise</strong></summary>

- bare Expo
- `expo-file-system`, `expo-image-picker`, `expo-location`, and `expo-camera` remain `preview`
- `expo-notifications`
- `react-native-gesture-handler`
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
pnpm exec expo-harmony doctor --project-root . --target-tier preview
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
- Want to know whether the project at least falls into preview / experimental tiers: run `doctor --target-tier preview` or `doctor --target-tier experimental`
- Changed dependencies, Expo config, or plugin wiring: run `sync-template`
- Only want to verify JavaScript/UI portability: run `bundle`
- About to open DevEco Studio or build a HAP locally: run `env` first

## Support Matrix

<!-- GENERATED:readme-support-matrix:start -->
- `verified`: the only public matrix remains `expo55-rnoh082-ui-stack`
- `preview`: `expo-file-system`, `expo-image-picker`, `expo-location`, `expo-camera`
- `experimental`: `expo-notifications`, `react-native-gesture-handler`

`doctor --strict` still means `verified` only. `doctor --target-tier preview` allows the same runtime matrix plus preview-tier capabilities, but that does not promote them into the formal public promise.

- `doctor-report.json` exposes `capabilities[].runtimeMode`
- `doctor-report.json` and `toolkit-config.json` expose `evidence.bundle`, `evidence.debugBuild`, `evidence.device`, and `evidence.release`
- `doctor-report.json` and `toolkit-config.json` expose `evidenceSource.bundle`, `evidenceSource.debugBuild`, `evidenceSource.device`, and `evidenceSource.release`
- `doctor-report.json` and `toolkit-config.json` also expose `coverageProfile` plus ordered `nextActions`
- `runtimeMode=shim` means the capability still has not reached a verified runtime path even if bundling and debug-build scaffolding already exist
- `evidenceSource.device=manual-doc` means the current device signal comes from manual acceptance records, not automated verification
<!-- GENERATED:readme-support-matrix:end -->

Starting in this refresh, `doctor` also emits `buildabilityRisk`, `coverageProfile`, `gapCategory`, and ordered `nextActions` so matrix drift, official-module gaps, third-party native blockers, and bare-workflow tracks no longer get described the same way. This does not relax any gate; it only improves diagnosis.

See [docs/support-matrix.md](./docs/support-matrix.md) for the full allowlist, pairing rules, exact specifiers, issue codes, and release gates.

If you want the `v1.8.x` promotion board directly, use [acceptance/v1.8.x-capability-board.md](./acceptance/v1.8.x-capability-board.md).

## Official Samples

- `examples/official-ui-stack-sample`
  The current public main sample, covering router, linking, constants, SVG, reanimated, and the Harmony sidecar build flow.
- `examples/official-native-capabilities-sample`
  The `v1.8.x` preview walkthrough sample, covering the supported core subsets for `expo-file-system`, `expo-image-picker`, `expo-location`, and `expo-camera` plus permission, bundle, debug-build validation, and per-capability acceptance tracking.
- `examples/official-app-shell-sample`
  The minimal App Shell onboarding sample that demonstrates router, linking, constants, pathname, observed URL, and a generated deep-link flow.
- `examples/official-minimal-sample`
  The smallest onboarding sample, explaining the shortest `doctor -> init -> bundle -> build-hap` chain and what it intentionally does not cover.

See:

- [Official Native Capabilities Sample Guide](./docs/official-native-capabilities-sample.md)
- [Official UI Stack Sample Guide](./docs/official-ui-stack-sample.md)
- [Official App Shell Sample Guide](./docs/official-app-shell-sample.md)
- [Official Minimal Sample Guide](./docs/official-minimal-sample.md)

## CLI Commands

| Command | Purpose |
| --- | --- |
| `expo-harmony doctor` | Inspect Expo config and dependencies and produce a migration report |
| `expo-harmony doctor --strict` | Run the formal matrix admission gate |
| `expo-harmony doctor --target-tier preview` | Evaluate whether the project fits at least the preview support tier |
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
- `.expo-harmony/toolkit-config.json`
- `.expo-harmony/doctor-report.json`
- `.expo-harmony/env-report.json`
- `.expo-harmony/build-report.json`

## Release And Validation

Pre-publish checks:

- `pnpm build`
- `pnpm test`
- `npm pack --dry-run`
- tarball smoke:
  `latest` runs `doctor --strict`, `init --force`, `bundle`
  `next` runs `doctor --target-tier preview`, `init --force`, `bundle`

Automatic publishing still defaults to hosted CI only, but now splits into two tracks:

- `stable/latest`: only verified samples and fully accepted capabilities
- `fast-track/next`: preview sample smoke and preview capability validation
- GitHub auto-publish selects `latest` or `next` based on the tag and keeps provenance enabled
- `build-hap --mode debug` still does not block hosted npm publishing

Additional preview evidence semantics:

- `bundle/debugBuild` are marked as `automated`
- `device` is marked as `manual-doc`, which means a human acceptance record exists rather than CI automation
- `release` is marked as `none`, which means no release evidence exists yet

Manual Harmony acceptance still requires:

- `official-ui-stack-sample` launches successfully
- SVG renders correctly
- pressing the home-screen motion rail triggers visible animation
- routing still works after the animation completes
- `Build Debug Hap(s)` succeeds
- `official-native-capabilities-sample` at least proves Batch A+B preview route bundling, generated Harmony permissions, and the debug build path

Verified promotion still additionally requires:

- device-side acceptance
- release signing plus `build-hap --mode release`
- roadmap, support matrix, README, and acceptance records updated in the same PR

See [docs/npm-release.md](./docs/npm-release.md) and [docs/signing-and-release.md](./docs/signing-and-release.md).

## Documentation

- [Support Matrix](./docs/support-matrix.md)
- [CLI Build Guide](./docs/cli-build.md)
- [Official Native Capabilities Sample Guide](./docs/official-native-capabilities-sample.md)
- [Official UI Stack Sample Guide](./docs/official-ui-stack-sample.md)
- [Official App Shell Sample Guide](./docs/official-app-shell-sample.md)
- [Official Minimal Sample Guide](./docs/official-minimal-sample.md)
- [npm Release Notes](./docs/npm-release.md)
- [Signing and Release Notes](./docs/signing-and-release.md)
- [Roadmap](./docs/roadmap.md)

Acceptance logs stay in the repo-only [`acceptance/`](./acceptance/) directory and are not shipped inside the npm tarball.

## License

Released under the [MIT License](./LICENSE).
