# Research: Tests, CI, Release, and E2E Architecture

This document records the design decisions and technical rationale for Spec 005 (Tests & CI), covering GitHub Actions CI/CD pipelines, Maestro end-to-end testing, coverage reporting, and automated spec traceability.

## Decision 1: GitHub Actions CI Matrix & Caching Architecture (R1)

- **Decision**: Use `ubuntu-latest` with GitHub Actions, running Node 22 (`actions/setup-node@v4`), Temurin JDK 17 (`actions/setup-java@v4`), and Gradle setup action (`gradle/actions/setup-gradle@v4`).
- **Rationale**:
  - Matches the project's local toolchain requirements: Node 22+ and JDK 17+.
  - `ubuntu-latest` comes pre-configured with Android SDK and command-line tools.
  - `setup-gradle` provides robust caching for Gradle wrappers and dependency caches, drastically reducing clean build times from ~6–8 minutes to under 2 minutes.
  - Concurrency group `group: ci-${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` automatically stops redundant runs when developers push additional commits to open PRs.
- **Alternatives Considered**:
  - *macOS runners*: Significantly more expensive (10x minute cost on GitHub) and unnecessary since Android builds run identically on Linux.
  - *Custom Docker container*: Adds container maintenance overhead when GitHub's standard runner already has Android tools pre-installed.

## Decision 2: Local-Equivalent APK Assembly on CI without EAS (R2)

- **Decision**: Execute `npx expo prebuild -p android --no-install` followed by `./gradlew assembleRelease --no-daemon` inside the `android/` directory, uploading the assembled APK via `actions/upload-artifact@v4`.
- **Rationale**:
  - Strictly adheres to Constitution Principle VI (Local Builds Only).
  - Reproduces the exact local developer experience inside the CI runner without depending on EAS Build or third-party cloud services.
  - Uploading the APK artifact from PR runs allows reviewers and testers to download and verify the build on real hardware before approving PRs.
- **Alternatives Considered**:
  - *Building only JS bundle*: Insufficient, as native dependencies and config plugins (such as notification permissions, background service config) must be verified to build cleanly against Gradle.
  - *EAS Build*: Explicitly prohibited by Cadence Constitution (Principle VI).

## Decision 3: Automated Release Packaging & Optional Keystore Signing (R3)

- **Decision**: Trigger `.github/workflows/release.yml` on pushes of tags matching `v*`. If `ANDROID_KEYSTORE_BASE64` is configured in repository secrets, sign the APK with `apksigner`; otherwise, package and publish the release APK with a note that it is unsigned. Generate `SHA256SUMS.txt` and publish both via `softprops/action-gh-release@v2`.
- **Rationale**:
  - Aligns with user clarification Q1.
  - Allows public forks and fresh clones to create releases without failing due to missing secrets, while supporting production signing for the official release pipeline.
  - Cryptographic SHA-256 checksums provide verifiable integrity for distributed binaries.
- **Alternatives Considered**:
  - *Failing when secrets are missing*: Would break workflow on forks and development clones.
  - *Manual GitHub Release creation*: Prone to human error, forgotten asset attachments, and lack of checksum generation.

## Decision 4: Maestro End-to-End Test Suite Architecture (R4)

- **Decision**: Define black-box Maestro flows in `.maestro/` targeting `io.github.abhisheksao.cadence` and executed locally via `npm run test:e2e` (`maestro test .maestro/`).
- **Rationale**:
  - Maestro uses declarative YAML that is readable by non-developers, fast to maintain, and does not require writing brittle native test code.
  - Maestro commands like `lockDevice` and `unlockDevice` provide the exact capability needed to automate testing of screen-off sessions and foreground notifications.
  - Keeping Maestro execution local (per clarification Q2) avoids slow headless Android emulator boots (~15–20 min) on every PR in CI, ensuring PR checks finish in under 5 minutes.
- **Alternatives Considered**:
  - *Appium / Detox*: Detox requires complex native compilation hooks and often breaks across React Native New Architecture releases. Maestro is completely external and non-invasive.
  - *Running emulator on every PR*: Too slow, prone to emulator freeze flakiness on standard CI runners.

## Decision 5: Code Coverage Collection and Threshold Enforcement (R5)

- **Decision**: Configure Jest with `coverageReporters: ['text', 'text-summary', 'lcov']`, target `src/**/*.{ts,tsx}` excluding test files and type definitions, and enforce an 80% line/branch threshold on core business logic (`src/engine/`, `src/session/`, `src/modes/`, `src/storage/`).
- **Rationale**:
  - Aligns with user clarification Q3.
  - Core logic handles timing accuracy, session state machine, cue scheduling, and persistent storage—areas where high test coverage is critical.
  - UI components and screen layouts remain flexible for rapid iteration without fighting arbitrary coverage percentages.
- **Alternatives Considered**:
  - *Global 90% across entire repo*: Unnecessarily brittle for UI presentation code and platform adapter stubs.
  - *No coverage enforcement*: Risks coverage regressions over time.

## Decision 6: Automated Spec Traceability & Markdown Link Audit Script (R6)

- **Decision**: Implement `scripts/check-spec-links.mjs`, registered as `npm run check:specs` and included in `npm run check`.
- **Rationale**:
  - Enforces Cadence Constitution Principle IX (Spec Traceability) and Constitution Principle VIII (Quality Gates).
  - Automatically validates:
    1. Every spec folder in `specs/` contains `spec.md`, `plan.md`, `tasks.md`.
    2. Internal markdown links point to existing files (no 404 links).
    3. Source code and comments in `src/` contain ZERO references to `.md` files (enforcing the strict repository rule).
  - Eliminates manual review burden and guarantees repository hygiene on every CI run.
- **Alternatives Considered**:
  - *Generic markdown-lint tool*: Does not understand Spec Kit structure or the custom project rule forbidding `.md` references in `src/`.
