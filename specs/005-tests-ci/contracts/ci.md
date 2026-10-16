# Contract: CI, Release, Maestro, and Spec Verification

Builds on the Cadence Constitution principles (local builds, test-first, spec traceability). Entities: [data-model.md](../data-model.md).

## CI Pipeline Guarantees (`ci.yml`)

| # | Trigger / Action | Guarantee | Spec |
|---|---|---|---|
| CI1 | Push or PR to `develop` or `main` | Triggers the `CI` workflow automatically; superseded runs on the same branch are cancelled | FR-001, FR-006 |
| CI2 | Quality gate execution | Runs `npm run lint`, `npm run typecheck`, `npm run check:specs`, and `npm test -- --coverage`; fails immediately if any step fails | FR-002 |
| CI3 | Android build verification | Runs `npx expo prebuild -p android --no-install` and `./gradlew assembleRelease --no-daemon` inside `android/` | FR-003 |
| CI4 | Build artifact retention | Uploads the assembled APK as workflow artifact `cadence-release-apk` on success | FR-004 |
| CI5 | Dependency caching | Caches npm (`~/.npm`) and Gradle (`~/.gradle/caches`, `~/.gradle/wrapper`) to optimize execution time under 5 min | FR-005 |

## Release Pipeline Guarantees (`release.yml`)

| # | Trigger / Action | Guarantee | Spec |
|---|---|---|---|
| CR1 | Push of tag matching `v*` | Triggers the `Release` workflow automatically | FR-007 |
| CR2 | Release build | Assembles the release APK using clean prebuild and Gradle `assembleRelease` | FR-008 |
| CR3 | Checksum generation | Computes SHA-256 hash of the generated APK and creates `SHA256SUMS.txt` | FR-008 |
| CR4 | GitHub Release publishing | Creates a GitHub Release matching the tag, attaching the APK and `SHA256SUMS.txt`; signs APK if secrets configured, or notes unsigned status | FR-008, FR-009 |

## Maestro End-to-End Guarantees (`.maestro/`)

| # | Flow | Guarantee | Spec |
|---|---|---|---|
| CM1 | Smoke test (`smoke.yaml`) | Launches `io.github.abhisheksao.cadence`, navigates to Morning Routine, Run / walk, and Breathe, asserting titles and controls | FR-010 |
| CM2 | Session control (`session.yaml`) | Starts a session, verifies live clock and visual indicator, executes pause, resume, and stop controls | FR-010 |
| CM3 | Background / lock (`background.yaml`) | Starts a session, locks device (`lockDevice`), sleeps, unlocks device (`unlockDevice`), and asserts session is still active and on time | FR-010 |
| CM4 | Local runner script | `npm run test:e2e` executes the Maestro suite with clean diagnostic output | FR-011 |

## Coverage & Traceability Guarantees

| # | Tool / Command | Guarantee | Spec |
|---|---|---|---|
| CT1 | `npm run test:coverage` | Collects coverage across `src/` and enforces 80% line/branch thresholds on core logic (`engine/`, `session/`, `modes/`, `storage/`) | FR-012 |
| CS1 | `npm run check:specs` | Verifies all `specs/NNN-*` directories contain `spec.md`, `plan.md`, `tasks.md` | FR-013 |
| CS2 | Link integrity | Verifies all relative markdown links in specs and docs resolve to existing files on disk | FR-013 |
| CS3 | Zero markdown references | Verifies `src/` contains zero occurrences of `.md` file references in source code or comments | FR-014 |
