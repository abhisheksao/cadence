# Tasks: Tests & CI (Spec 005)

**Input**: Design documents from `/specs/005-tests-ci/`
- Spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Research: [research.md](./research.md)
- Data Model: [data-model.md](./data-model.md)
- Contracts: [contracts/ci.md](./contracts/ci.md)
- Quickstart: [quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). Traceability script and coverage configuration are developed with failing unit tests first. Workflows and Maestro flows are verified via automated runners and local checks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Phase 1: Setup

**Purpose**: Confirm clean branch baseline and project prerequisites.

- [x] T001 Confirm `005-tests-ci` is up to date with `develop`, clean working tree, and `npm test` and `npm run typecheck` are green before any changes

---

## Phase 2: Foundational (Coverage & Spec Traceability)

**Purpose**: Shared verification tooling required by all CI pipelines and quality gates.

### Tests first ⚠️

- [x] T002 [P] Write scripts/check-spec-links.test.mjs to test spec completeness checking (requires spec.md, plan.md, tasks.md per spec dir), relative markdown link resolution, and detection of illicit `.md` references in src/
- [x] T003 [P] Add unit test in scripts/timing-report.test.mjs or dedicated test asserting coverage threshold configuration in package.json

### Implementation

- [x] T004 Implement spec verification and link audit in scripts/check-spec-links.mjs to pass T002
- [x] T005 [P] Configure Jest coverage thresholds (80% lines and branches on core logic: engine, session, modes, storage) and add `test:coverage` and `check:specs` scripts to package.json to pass T003
- [x] T006 Integrate `npm run check:specs` into `npm run check` pipeline in package.json and verify all checks pass

**Checkpoint**: Coverage reporting and spec verification tools operational. Tests green.

---

## Phase 3: User Story 1 - Continuous Integration Pipeline for PRs and Pushes (Priority: P1) 🎯 MVP

**Goal**: GitHub Actions CI workflow triggered on pushes and PRs to `develop` and `main`, executing quality checks (lint, typecheck, specs, tests with coverage), assembling the release APK via local commands without EAS, and uploading the APK artifact.

**Independent Test**: Push or open a PR, verify GitHub Actions triggers `ci.yml`, executes quality checks, builds release APK, attaches `cadence-release-apk` artifact, and cancels superseded runs on new pushes (CI1–CI5).

### Tasks for User Story 1

- [x] T007 [P] [US1] Create GitHub Actions workflow .github/workflows/ci.yml with triggers on push and pull_request for `main` and `develop`, and concurrency group cancellation
- [x] T008 [US1] Add `quality` job in .github/workflows/ci.yml: Node 22 setup, npm dependency caching, `npm run lint`, `npm run typecheck`, `npm run check:specs`, and `npm run test:coverage`
- [x] T009 [US1] Add `build_android` job in .github/workflows/ci.yml: Temurin JDK 17 setup, Gradle caching via `gradle/actions/setup-gradle@v4`, `npx expo prebuild -p android --no-install`, and `./gradlew assembleRelease --no-daemon` inside `android/`
- [x] T010 [US1] Configure release APK artifact upload (`actions/upload-artifact@v4`) in .github/workflows/ci.yml under artifact name `cadence-release-apk`
- [x] T011 [US1] Validate .github/workflows/ci.yml syntax and verify local prebuild and assembleRelease commands succeed

**Checkpoint**: Pull request and push CI pipeline active. Automated quality gates and APK assembly operational. MVP.

---

## Phase 4: User Story 2 - Automated GitHub Releases on Version Tags (Priority: P2)

**Goal**: Automated GitHub Actions release pipeline triggered on `v*` tag pushes that builds the release APK, calculates SHA-256 checksums, and publishes a GitHub Release with assets attached.

**Independent Test**: Push a version tag or simulate release step, verify APK is assembled, `SHA256SUMS.txt` is generated, and GitHub Release is created with assets attached (CR1–CR4).

### Tasks for User Story 2

- [x] T012 [P] [US2] Create GitHub Actions release workflow .github/workflows/release.yml triggered on tag pushes matching `v*`
- [x] T013 [US2] Add release assembly and optional signing step in .github/workflows/release.yml supporting `ANDROID_KEYSTORE_BASE64` secret with clean fallback to unsigned APK
- [x] T014 [US2] Add SHA-256 checksum generation step (`sha256sum`) in .github/workflows/release.yml outputting `SHA256SUMS.txt`
- [x] T015 [US2] Configure GitHub Release publication step (`softprops/action-gh-release@v2`) in .github/workflows/release.yml attaching the APK and `SHA256SUMS.txt`
- [x] T016 [US2] Validate .github/workflows/release.yml syntax and verify checksum generation logic

**Checkpoint**: Tagged releases automatically generate and publish APK binaries with checksums.

---

## Phase 5: User Story 3 - Maestro End-to-End Test Suite (Priority: P3)

**Goal**: Black-box Maestro E2E test suite in `.maestro/` covering mode navigation smoke tests, session controls, and background/lock-screen timing verification, executable locally via `npm run test:e2e`.

**Independent Test**: Run `npm run test:e2e` against a connected Android device or emulator; verify smoke, session, and background flows pass (CM1–CM4).

### Tasks for User Story 3

- [x] T017 [P] [US3] Create .maestro/smoke.yaml verifying app launch, navigation to Morning Routine, Run / walk, and Breathe screens, and Home screen footer
- [x] T018 [P] [US3] Create .maestro/session.yaml verifying session start, live clock, visual indicator, pause, resume, and stop controls
- [x] T019 [P] [US3] Create .maestro/background.yaml verifying session start, device locking (`lockDevice`), wait duration, unlocking (`unlockDevice`), and session persistence
- [x] T020 [US3] Add `test:e2e` script in package.json invoking `maestro test .maestro/` with prerequisite error handling
- [x] T021 [US3] Verify Maestro flow syntax and element identifiers match current screen components

**Checkpoint**: Local E2E testing enabled with declarative flows for device locking and user journeys.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [x] T022 [P] Update README.md: add CI workflow badge, release information, and Maestro E2E test instructions
- [x] T023 Review spec and plan against implementation; ensure no divergence (Principle IX)
- [x] T024 Run `npm run check` (`npm run lint`, `npm run typecheck`, `npm run check:specs`, `npm test`) and `npm run test:coverage`
- [x] T025 Run local Android release build (`./gradlew assembleRelease` in android/) to verify zero regressions
- [x] T026 Open PR from `005-tests-ci` to `develop`, listing validation checks T1–T10

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; provides `check:specs` and coverage reporting needed by CI.
- **US1 (Phase 3)**: depends on Foundational; delivers CI workflow for PRs and pushes (MVP).
- **US2 (Phase 4)**: depends on US1 build patterns; delivers release automation.
- **US3 (Phase 5)**: depends on US1/US2 setup; delivers Maestro E2E flows.
- **Polish (Phase 6)**: runs after all user stories are complete.

---

## Parallel Execution Opportunities

- **Foundational**: T002 and T003 tests can be written in parallel.
- **US1 & US2**: Workflow definitions T007 and T012 can be authored in parallel.
- **US3**: Maestro flows T017, T018, and T019 can be created in parallel.
