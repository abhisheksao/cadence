# Feature Specification: Tests & CI

**Feature Branch**: `005-tests-ci`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Tests & CI (spec 005): Maestro end-to-end test (screen off), coverage reporting, GitHub Actions lint/typecheck/test/APK, release APKs on tag, spec-link check."

## Overview

Spec 005 establishes automated continuous integration, release automation, end-to-end black-box verification, and project quality assurance for Cadence. Up to this point, all builds, linting, typechecking, and tests have been executed locally. Spec 005 guarantees that every commit and pull request entering `develop` or `main` is validated automatically in a clean environment, release artifacts are automatically built and published on version tags, and screen-off mobile behaviors are verifiable end-to-end via Maestro flows.

Everything honors the core principles defined in the Cadence Constitution:
- **Local Builds Only & Reproducibility (Principle VI)**: CI builds use the exact same local tools (`expo prebuild -p android` and Gradle `assembleRelease`), without EAS Build or proprietary cloud build dependencies.
- **Strict Quality Gates (Principle VIII)**: Linting, strict TypeScript typechecking, and Jest tests must pass cleanly on every push and PR.
- **Spec Traceability (Principle IX)**: Automated scripts verify that every feature branch and PR links to its spec and that project documentation links remain unbroken.

## Clarifications

### Session 2026-10-16

- **Release Tag Signing**: How should GitHub Actions sign the release APK generated on `v*` tag pushes?
  - **Resolution**: Support optional signing via GitHub Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, etc.) if configured in repository settings; fall back to publishing the unsigned release APK with SHA-256 checksums if secrets are omitted.
- **Maestro E2E Execution Scope**: Where and when should Maestro end-to-end test flows execute?
  - **Resolution**: Local execution only via `npm run test:e2e` against a connected Android device or local emulator. No GitHub Actions emulator workflow, keeping CI fast, lightweight, and reliable without expensive headless emulator runners.
- **Code Coverage Thresholds**: What coverage thresholds should be enforced by CI?
  - **Resolution**: Generate code coverage reports (lcov + text summary) and enforce an 80% line/branch coverage threshold on core logic (`src/engine/`, `src/session/`, `src/modes/`, `src/storage/`), failing CI if regressions occur.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuous Integration Pipeline for PRs and Pushes (Priority: P1) 🎯 MVP

As a developer and contributor, when I push commits to a branch or open a pull request targeting `develop` or `main`, GitHub Actions automatically runs the full quality gate matrix: linting, strict TypeScript typechecking, test suite with coverage, spec traceability checks, and creates an Android release APK artifact using standard local commands (`expo prebuild` + `./gradlew assembleRelease`). If any step fails, the check reports failure, blocking integration of defective code.

**Why this priority**: Continuous Integration is the foundation of project reliability. It ensures broken builds, type errors, lint regressions, or broken tests can never be merged into integration or release branches.

**Independent Test**: Push a commit with a deliberate lint or test failure to a PR branch, verify GitHub Actions flags the failure and blocks the PR; fix the issue and verify CI turns green and attaches the assembled APK.

**Acceptance Scenarios**:

1. **Given** a pull request targeting `develop` or `main`, **When** commits are pushed, **Then** GitHub Actions triggers the CI workflow (`ci.yml`).
2. **Given** the CI environment, **When** executing quality checks, **Then** `npm run lint`, `npm run typecheck`, and `npm test` execute sequentially.
3. **Given** any lint, typecheck, or test failure, **When** CI runs, **Then** the workflow immediately halts and marks the check as failed with clear diagnostics.
4. **Given** all quality checks pass, **When** proceeding to build verification, **Then** CI runs `npx expo prebuild -p android` and `./gradlew assembleRelease` on the Ubuntu runner without EAS.
5. **Given** a successful release APK assembly, **When** the workflow finishes, **Then** the generated APK file is uploaded as a downloadable workflow artifact (`cadence-release-apk`).
6. **Given** Gradle and Node dependencies, **When** CI runs repeatedly, **Then** Gradle caches and npm dependencies are cached to optimize execution time.

---

### User Story 2 - Automated GitHub Releases on Version Tags (Priority: P2)

As a maintainer, when I create and push a git tag matching `v*` (e.g., `v1.0.0`) from `main`, GitHub Actions automatically executes the release pipeline (`release.yml`), builds the release APK, computes its SHA-256 checksum, and creates a GitHub Release containing the APK download, release notes, and verification checksums.

**Why this priority**: Packaging and distributing reliable release builds must be automated and repeatable, eliminating manual build errors and providing users with immediate access to release binaries.

**Independent Test**: Push a test tag `v0.0.1-test` (or dispatch release workflow), observe the release workflow triggering, building the release APK, computing the SHA-256 hash, and publishing a GitHub release entry with the APK asset attached.

**Acceptance Scenarios**:

1. **Given** a new version tag `v*.*.*` pushed to the repository, **When** GitHub Actions processes the tag, **Then** the release workflow (`release.yml`) triggers automatically.
2. **Given** the release workflow, **When** building the Android package, **Then** it produces the release APK using clean prebuild and Gradle assembleRelease.
3. **Given** the assembled APK, **When** preparing release assets, **Then** the workflow generates a `SHA256SUMS.txt` file containing the cryptographic digest of the APK.
4. **Given** the APK and checksum, **When** publishing the release, **Then** a GitHub Release is created matching the tag name with the APK and checksum file attached.
5. **Given** repository release secrets (`ANDROID_KEYSTORE_BASE64`, etc.) are configured, **When** building, **Then** the APK is signed with the production keystore; if secrets are omitted, the unsigned release APK is attached with an informative note.

---

### User Story 3 - Maestro End-to-End Test Suite (Priority: P3)

As a developer or QA tester, I can run automated black-box end-to-end tests using Maestro on a connected Android device or emulator to verify that Cadence operates smoothly across user flows and maintains timing and notifications through screen locking and app backgrounding.

**Why this priority**: Unit and component tests cannot verify real Android OS interactions (system notifications, screen locking, audio ducking, device sleep). Maestro flows automate the physical user journeys and catch device-level regressions.

**Independent Test**: Execute `npm run test:e2e` against a running Android emulator or connected device; verify Maestro opens Cadence, completes a smoke test through Morning Routine, Run/Walk, and Breathe screens, and executes a screen-off/background session flow.

**Acceptance Scenarios**:

1. **Given** a local machine with Maestro installed and an active Android emulator or device, **When** running `npm run test:e2e`, **Then** the Maestro flows in `.maestro/` execute.
2. **Given** the smoke flow (`.maestro/smoke.yaml`), **When** executed, **Then** it verifies that Home screen mode tiles (Morning routine, Run/walk, Breathe) open their respective screens and display interactive controls without crashing.
3. **Given** the session flow (`.maestro/session.yaml`), **When** executed, **Then** it starts a breathing or routine session, verifies active playback, pauses, resumes, and stops cleanly.
4. **Given** the background flow (`.maestro/background.yaml`), **When** executed, **Then** it starts a session, locks the device (`lockDevice`), waits a designated duration, unlocks, and verifies that the session remained active and on time.

---

### User Story 4 - Code Coverage Reporting and Spec Traceability (Priority: P2)

As a developer and reviewer, I want test coverage reported on every PR to prevent untested logic from accumulating, and I want an automated spec traceability check to ensure that all documentation links and spec requirements are valid and that source code maintains strict documentation integrity (no stray markdown references).

**Why this priority**: Test coverage guarantees our strict test-first development principle is maintained, while spec traceability scripts keep our documentation and code clean and aligned.

**Independent Test**: Run `npm run test:coverage` and observe summary report and lcov output; run `npm run check:specs` to verify spec link health and code integrity.

**Acceptance Scenarios**:

1. **Given** the test runner, **When** running `npm run test:coverage`, **Then** Jest collects coverage across `src/` (excluding tests and generated files) and produces terminal summary and `coverage/lcov.info`.
2. **Given** the traceability script (`scripts/check-spec-links.mjs`), **When** executed via `npm run check:specs`, **Then** it verifies:
   - All directories in `specs/` contain required documents (`spec.md`, `plan.md`, `tasks.md`).
   - Markdown links between specs and documentation are not broken.
   - Source code in `src/` contains zero references to `.md` files.
3. **Given** a PR in CI, **When** `npm run check:specs` or coverage fails, **Then** CI flags the failure.

---

### Edge Cases

- **CI Runner Disk Space**: Android SDK and Gradle builds consume significant disk space (~10GB). CI workflows MUST prune unnecessary toolchains and enable Gradle build-cache cleanup if disk space becomes constrained.
- **Concurrent CI Runs**: If multiple commits are pushed to the same PR in rapid succession, GitHub Actions concurrency groups MUST cancel superseded in-progress runs to save resources.
- **Missing Release Keystore**: If a release tag is pushed in a fork or repository without configured signing secrets, the release workflow MUST gracefully publish the unsigned APK rather than failing with an obscure encryption error.
- **Maestro Device Unavailability**: If Maestro is executed without a running Android emulator or device, `npm run test:e2e` MUST emit a clear error message describing prerequisites instead of an obscure stack trace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a GitHub Actions CI workflow (`.github/workflows/ci.yml`) triggering on pushes to `main` and `develop` and on pull requests targeting `main` and `develop`.
- **FR-002**: CI workflow MUST execute quality checks: linting (`npm run lint`), strict typechecking (`npm run typecheck`), and unit/component tests with coverage (`npm test -- --coverage`).
- **FR-003**: CI workflow MUST execute an Android build verification step using local commands (`npx expo prebuild -p android` and `./gradlew assembleRelease` in `android/`).
- **FR-004**: CI workflow MUST upload the assembled release APK as a downloadable GitHub Actions artifact for every successful build.
- **FR-005**: CI workflow MUST cache npm dependencies and Gradle caches (`~/.gradle/caches`, `~/.gradle/wrapper`) to optimize execution speed.
- **FR-006**: CI workflow MUST configure concurrency groups to cancel outdated in-progress runs when new commits are pushed to the same pull request branch.
- **FR-007**: System MUST provide a GitHub Actions release workflow (`.github/workflows/release.yml`) triggering on pushes of tags matching `v*`.
- **FR-008**: Release workflow MUST assemble the release APK, calculate cryptographic SHA-256 checksums, and publish a GitHub Release with the APK and checksum file attached.
- **FR-009**: Release workflow MUST support signing via repository secrets if available, and fall back to unsigned release packaging if secrets are absent.
- **FR-010**: System MUST provide Maestro end-to-end test flows in `.maestro/` covering app smoke testing (`smoke.yaml`), session control (`session.yaml`), and background/lock verification (`background.yaml`).
- **FR-011**: System MUST provide `npm run test:e2e` to trigger Maestro test suite locally.
- **FR-012**: System MUST provide `npm run test:coverage` to execute Jest tests with coverage reporting (lcov and text summary) and enforce threshold checks.
- **FR-013**: System MUST provide a spec traceability and link validation script (`scripts/check-spec-links.mjs`) accessible via `npm run check:specs`.
- **FR-014**: The traceability script MUST enforce that source code and comments in `src/` contain zero `.md` file references.

### Key Entities

- **CIWorkflow**: Configuration in `.github/workflows/ci.yml` defining runner environment (Ubuntu, Node 22, JDK 17, Android SDK), quality steps, and artifact packaging.
- **ReleaseWorkflow**: Configuration in `.github/workflows/release.yml` defining release packaging, checksum generation, and GitHub release publication.
- **MaestroFlow**: Declarative YAML flows in `.maestro/` defining black-box user interactions, element assertions, device locking, and timing checks.
- **CoverageReport**: Summary metrics (statements, branches, functions, lines) generated by Jest into `coverage/`.
- **SpecVerificationReport**: Results of documentation link checking and source code markdown reference auditing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests targeting `develop` or `main` automatically execute CI quality gates and APK assembly with zero manual steps.
- **SC-002**: CI workflow completes under 10 minutes on GitHub Actions standard Ubuntu runners with warm Gradle/npm cache.
- **SC-003**: Pushing a version tag `v*` produces a published GitHub Release with attached APK and SHA-256 checksum in under 12 minutes.
- **SC-004**: Automated traceability script verifies 100% of specs in `specs/` have valid structure and confirms zero `.md` references exist in `src/`.
- **SC-005**: Maestro flows execute cleanly on a standard Android emulator, confirming that core navigation and session flows work end-to-end.

## Assumptions

- **Local Build Consistency**: GitHub Actions Ubuntu runners will run standard Expo prebuild and Gradle commands identical to local development environments without requiring EAS.
- **Android Signing Keystore**: Default GitHub Releases will publish standard assembled APKs; maintainers who wish to sign release APKs with a custom key can add the base64 keystore and passwords as GitHub repository secrets.
- **Maestro Tooling**: Maestro CLI is installed locally by developers wanting to run `npm run test:e2e`; CI execution of Maestro will be configured for manual dispatch / optional runs to preserve fast PR feedback cycles.
