# Data Model: Tests & CI Entities

This document defines the configuration schemas, data structures, and entity representations for Spec 005 (Tests & CI).

## 1. CI Workflow Configuration (`CIWorkflowConfig`)

The GitHub Actions continuous integration workflow defined in `.github/workflows/ci.yml`.

| Field | Type | Description |
|---|---|---|
| `name` | string | `'CI'` |
| `on.push.branches` | string[] | `['develop', 'main']` |
| `on.pull_request.branches` | string[] | `['develop', 'main']` |
| `concurrency.group` | string | `ci-${{ github.workflow }}-${{ github.ref }}` |
| `concurrency.cancel-in-progress` | boolean | `true` |
| `jobs.quality` | Job | Steps: checkout, setup Node 22, cache npm, install deps, lint (`npm run lint`), typecheck (`npm run typecheck`), spec verification (`npm run check:specs`), tests with coverage (`npm test -- --coverage`) |
| `jobs.build_android` | Job | Steps: checkout, setup Node 22, setup Temurin JDK 17, setup Gradle cache, `npx expo prebuild -p android --no-install`, `./gradlew assembleRelease --no-daemon`, upload APK artifact |

## 2. Release Workflow Configuration (`ReleaseWorkflowConfig`)

The GitHub Actions release packaging workflow defined in `.github/workflows/release.yml`.

| Field | Type | Description |
|---|---|---|
| `name` | string | `'Release'` |
| `on.push.tags` | string[] | `['v*']` |
| `jobs.release` | Job | Steps: checkout, setup Node 22, setup JDK 17, prebuild, build release APK, optional sign via secrets, generate SHA-256 hash, create GitHub Release via `softprops/action-gh-release@v2` |
| `secrets.ANDROID_KEYSTORE_BASE64` | secret (optional) | Base64-encoded release `.keystore` file |
| `secrets.ANDROID_KEYSTORE_PASSWORD` | secret (optional) | Keystore access password |
| `secrets.ANDROID_KEY_ALIAS` | secret (optional) | Alias name for the signing key |
| `secrets.ANDROID_KEY_PASSWORD` | secret (optional) | Key password |

## 3. Maestro End-to-End Test Flow (`MaestroFlow`)

Declarative YAML specifications in `.maestro/` defining black-box user interactions and assertions against the Android package.

```yaml
appId: io.github.abhisheksao.cadence
---
# Flow actions:
# - launchApp
# - tapOn: <text or id>
# - assertVisible: <text or id>
# - lockDevice
# - unlockDevice
# - back
```

### Flow Definitions:
1. `smoke.yaml`:
   - Launches `io.github.abhisheksao.cadence`.
   - Asserts Home screen mode cards: "Morning routine", "Run / walk", "Breathe".
   - Taps each mode, asserts respective headers, navigates back.
   - Verifies BatteryLink footer is visible.
2. `session.yaml`:
   - Navigates to Breathe.
   - Taps "Start".
   - Asserts live pacer (`breath-pacer`), phase title, and controls (Pause, Resume, Stop).
   - Taps "Pause", asserts "Paused" badge; taps "Resume"; taps "Stop".
3. `background.yaml`:
   - Navigates to Morning Routine or Breathe.
   - Taps "Start".
   - Executes `lockDevice`.
   - Waits (`sleep: 6000`).
   - Executes `unlockDevice`.
   - Asserts session continues running without crash, state reset, or drift.

## 4. Code Coverage Configuration (`CoverageConfig`)

Jest coverage settings added to `package.json`:

```json
{
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/types.ts",
    "!src/app/_layout.tsx"
  ],
  "coverageReporters": [
    "text",
    "text-summary",
    "lcov"
  ],
  "coverageThreshold": {
    "./src/engine/": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 },
    "./src/session/": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 },
    "./src/modes/": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 },
    "./src/storage/": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 }
  }
}
```

## 5. Spec Traceability Report (`SpecVerificationReport`)

Structure of diagnostics produced by `scripts/check-spec-links.mjs`:

```ts
type SpecVerificationReport = {
  specsChecked: number;
  specsMissingFiles: { dir: string; missing: string[] }[];
  brokenMarkdownLinks: { file: string; target: string }[];
  sourceCodeMdViolations: { file: string; line: number; text: string }[];
  valid: boolean;
};
```
