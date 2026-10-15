# Quickstart: Validating Spec 005 (Tests & CI)

How to validate that CI, releases, Maestro E2E, code coverage, and spec traceability work as guaranteed. Entities: [data-model.md](./data-model.md). Contract guarantees: [contracts/ci.md](./contracts/ci.md).

## 1. Automated Checks

```sh
npm run check             # lint + tsc --noEmit + check:specs + jest
npm run test:coverage     # jest with coverage collection & 80% core thresholds
npm run check:specs       # spec document completeness, link health, and src/ md reference audit
```

Expected: All commands exit with code 0.

## 2. Local Maestro End-to-End Tests

Prerequisites:
- Android emulator or physical device running and visible in `adb devices`.
- Maestro CLI installed (`curl -FsSL "https://get.maestro.mobile.dev" | bash`).

Run:
```sh
npm run test:e2e          # runs maestro test .maestro/
```

Or individual flows:
```sh
maestro test .maestro/smoke.yaml
maestro test .maestro/session.yaml
maestro test .maestro/background.yaml
```

Expected: All flows complete green with all element assertions and device lock/unlock passing.

## 3. GitHub Actions Validation

1. **Pull Request Validation**:
   - Push branch `005-tests-ci` and open PR to `develop`.
   - Observe `CI` workflow executing quality checks, building release APK, and attaching `cadence-release-apk` artifact.
2. **Release Workflow Validation**:
   - Test release flow syntax and steps via `act` or pushing a test tag `v0.0.1-test`.
   - Observe `Release` workflow executing, generating `SHA256SUMS.txt`, and publishing release with attached APK.

## 4. Validation Checklist

| # | Story | Check | Expected Outcome |
|---|---|---|---|
| T1 | US1 | Trigger `CI` on PR to `develop` | Workflow runs lint, typecheck, check:specs, and jest tests cleanly |
| T2 | US1 | Check CI build step | Executes `expo prebuild -p android` and `./gradlew assembleRelease` on Ubuntu runner |
| T3 | US1 | Check CI artifacts | `cadence-release-apk` artifact is attached and downloadable |
| T4 | US1 | Push new commit while CI is running | Superseded in-progress workflow run is cancelled immediately |
| T5 | US2 | Push tag `v*` | Triggers `Release` workflow; produces APK and `SHA256SUMS.txt` |
| T6 | US3 | Run `npm run test:e2e` against device | Maestro executes smoke, session, and background flows cleanly |
| T7 | US3 | Background flow locks screen | Device locks, waits 6s, unlocks; Cadence session remains active |
| T8 | US4 | Run `npm run test:coverage` | Produces terminal summary + `coverage/lcov.info`; passes 80% core threshold |
| T9 | US4 | Run `npm run check:specs` | Confirms all specs complete, links valid, and zero `.md` in `src/` |
| T10 | US4 | Introduce intentional `.md` comment in `src/` | `npm run check:specs` catches violation and exits with non-zero error |
