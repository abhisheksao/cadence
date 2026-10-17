---

description: "Task list for spec 006: native foreground service"
---

# Tasks: Native Foreground Service

**Input**: Design documents from `/specs/006-native-foreground-service/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/native-service.md](./contracts/native-service.md),
[quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). In every phase, test tasks come
first. Run them and confirm they **fail** before starting the implementation tasks below them.
Guarantee IDs (NS*, NC*, CL*, CP*, ND*, CD*) refer to
[contracts/native-service.md](./contracts/native-service.md); on-device checks (N1–N21) to
[quickstart.md](./quickstart.md). Commit the failing tests (`test(006): …`), then the code that
passes them (`feat(006): …`). Kotlin is a thin adapter covered by the on-device checks; every
decision lives in TypeScript with Jest tests.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US4)
- Paths are relative to the repository root. Tests sit next to the code as `*.test.ts(x)`.
- Reuse helpers: `FakeClock`/`FakeScheduler` (src/test-utils/fakeClock.ts),
  `FakeCuePlayer`/`FakeBackgroundHost`/`MemoryStore` (src/test-utils/fakes.ts). RNTL 14's
  `render`/`fireEvent` are async.
- Only `src/platform/*.android.ts` may import `modules/cadence-session`. Shared code never
  branches on `Platform.OS` (Principle IV).
- Never hand-edit `android/` (generated). Native config lives in the module's own
  `AndroidManifest.xml` and `app.json`.
- Ensure no `.md` or markdown document references are included in code or comments.

---

## Phase 1: Setup

**Purpose**: Starting point and the empty module.

- [x] T001 Confirm `006-native-foreground-service` is up to date with `develop`, the working tree is clean, and `npm run check` is green apart from the spec-doc check for this folder
- [x] T002 Create the local module with `npx create-expo-module@latest --local` named `cadence-session` in modules/cadence-session/; delete the generated iOS, web and view files; set modules/cadence-session/expo-module.config.json to `platforms: ["android"]` and module class `io.github.abhisheksao.cadence.session.CadenceSessionModule`; leave an empty module definition `Name("CadenceSession")`
- [x] T003 Write modules/cadence-session/index.ts exporting the typed module from `requireOptionalNativeModule('CadenceSession')` (null off Android) with the full surface and event payload types from the contract's "Local module JS surface" (no implementation yet on the native side beyond stubs)
- [x] T004 Run `npx expo prebuild -p android --clean` and `(cd android && ./gradlew assembleDebug)` to prove the empty module links; `npm run check` green

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New interfaces, fakes, and the engine's phase-start hand-off. No user-visible change.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [x] T005 [P] Add to src/engine/engine.test.ts: `onCue` receives `phaseStart = true` for cues from a phase's second 0 and for the catch-up announcement, `false` for all other seconds and for completion cues
- [x] T006 [P] Write src/platform/notification.test.ts for `notificationState(definition, snapshot)` and `formatClock(ms)`: NS1–NS5 (countdown for running timed phase; elapsed for running untimed; paused text with frozen `m:ss left` / `m:ss`, timer null; null for idle/done/stopped; clamp at 0; `h:mm:ss` from 1 h; subtitle forms "<subtitle>: <title>")

### Implementation

- [x] T007 Add `phaseStart: boolean` as the 4th argument of `EngineEvents.onCue` in src/engine/types.ts and pass it in src/engine/engine.ts to pass T005; extend `CuePlayer.play(cue, at, phase?, phaseStart?)` in src/audio/types.ts, `FakeCuePlayer` in src/test-utils/fakes.ts (record it), and the controller's `onCue` wiring in src/session/controller.ts; existing tests stay green
- [x] T008 [P] Implement `NotificationState`, `notificationState`, and `formatClock` in src/platform/notification.ts to pass T006
- [x] T009 Change the `BackgroundHost` interface in src/platform/background.ts to the contract shape (`start({ sessionId, route, notification, keepAliveUntil })`, `update(notification)`, `heartbeat()`, `onAction(fn)`, `onTaskRemoved(fn)`, `SessionAction` type); update `FakeBackgroundHost` in src/test-utils/fakes.ts (records start/update/heartbeat/stop with full payloads; `emitAction(action)` and `emitTaskRemoved()` helpers; `listenerCount()`); update src/platform/background.ios.ts no-ops; adapt the controller and existing tests to the new call shapes with today's behavior (text only via `notificationState(...).text`), all tests green

**Checkpoint**: Interfaces in place, tests green, app behaves as before on the old library.

---

## Phase 3: User Story 1 - Same screen-off reliability, own service (Priority: P1) 🎯 MVP

**Goal**: The session runs in Cadence's own foreground service with a basic notification
(title, phase, tap opens the mode's screen), a wake lock, a heartbeat watchdog, and stop on
swipe-away. The third-party library and its plugin are removed.

**Independent Test**: NC1, NC5, NC7, NC8 and the new background.android tests pass; on device,
N1–N4, N9, N10, N19, N20 and ND5 pass.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [x] T010 [P] [US1] Add to src/session/controller.test.ts: NC1 (start passes a fresh `sessionId` per launch, the mode's `route`, and `notificationState` of the first phase; a resumed paused session starts with the paused state), NC5 (heartbeat at least every 2 s of `FakeScheduler` time while running and while paused; none after stop or after wind-down), NC7 (stop, end after wind-down, and replacement each call `stop` once; action and task-removed listeners unsubscribed), NC8 (`emitTaskRemoved` with a live session: engine stopped, player silenced, record removed from `MemoryStore`, `stop` called; with no session: nothing)
- [x] T011 [P] [US1] Rewrite src/platform/background.android.test.ts with a `jest.mock` of `modules/cadence-session`: `start` calls `startService` with `{ sessionId, route, ...notification }` and resolves its boolean (false and a warning when it rejects); `update` calls `updateNotification`; `heartbeat` calls `heartbeat`; `stop` calls `stopService`; `onAction`/`onTaskRemoved` subscribe to the module events and the returned function removes them; the headless task `CadenceSession` is registered once with `AppRegistry` and resolves when `keepAliveUntil` resolves; notification permission and once-only battery exemption tests from 001 kept as they are
- [x] T012 [US1] Write device steps for this story into the "Device checks" section at the end of this file before any Kotlin (already listed: N1–N4, N9, N10, N19, N20, ND5); confirm they are runnable on the test phone

### Implementation for User Story 1

- [x] T013 [US1] Wire sessionId, route, heartbeat, and task-removed handling into src/session/controller.ts to pass T010 (id like src/routine/ids.ts from the injected clock; route from `modes.get(modeId).route`; `scheduler.every(2_000, () => background.heartbeat())` while active; `onTaskRemoved` → `stop()`)
- [x] T014 [P] [US1] Kotlin: modules/cadence-session/android/src/main/java/io/github/abhisheksao/cadence/session/SessionNotification.kt — channel `cadence-session` (importance LOW, no sound/vibration, lock-screen PUBLIC), delete `RN_BACKGROUND_ACTIONS_CHANNEL` once, build a notification from title/text with the app's `ic_launcher` mipmap, colour `#FF7A45`, ongoing, content intent `ACTION_VIEW cadence://<route>` limited to the app package (`FLAG_IMMUTABLE`)
- [x] T015 [US1] Kotlin: SessionService.kt in the same package — `HeadlessJsTaskService` subclass; `startForeground` with type `mediaPlayback` (`ServiceCompat`), returns failure on `ForegroundServiceStartNotAllowedException`; starts headless task `CadenceSession` (`allowedInForeground = true`, no timeout); `PARTIAL_WAKE_LOCK` acquired for 10 min and renewed on each heartbeat, released in `onDestroy`; watchdog every 5 s stops the service when the last heartbeat is older than 10 s; `onTaskRemoved` emits `onTaskRemoved` and stops itself 1 s later if still running; `onTimeout` stops
- [x] T016 [US1] Kotlin: CadenceSessionModule.kt — `Events(...)`; `AsyncFunction startService/stopService`, `Function updateNotification/heartbeat`; a companion bridge so the service can reach the module to `sendEvent`; `OnDestroy` stops the service; android/src/main/AndroidManifest.xml declares the service (`foregroundServiceType="mediaPlayback"`, `exported="false"`) and **no** `<uses-permission>`
- [x] T017 [US1] Rewrite src/platform/background.android.ts on the module to pass T011 (register the headless task at module load; keep `prepare`, `requestBatteryExemption`, `BATTERY_ASKED_KEY` unchanged)
- [x] T018 [US1] Remove the old library: `npm uninstall react-native-background-actions`; delete plugins/withBackgroundActions.js and its `app.json` plugin entry; remove it from `transformIgnorePatterns` in package.json; `grep -r "background-actions\|withBackgroundActions"` outside specs/ returns nothing; `npm run check` green
- [ ] T019 [US1] Release build per quickstart §2, install, run N1–N4, N9, N10, N19, N20 and the ND5 permission diff; record results under "Device checks" below; fix and repeat until they pass

**Checkpoint**: MVP. Own service in place, library gone, no regression.

---

## Phase 4: User Story 2 - Control the session from the notification (Priority: P2)

**Goal**: Live countdown/count-up in the notification, paused frozen value, Pause/Resume and Skip
buttons that act exactly like the in-app controls.

**Independent Test**: NC2–NC4, NC6 pass; on device N5–N8 pass.

### Tests for User Story 2 (write first, confirm they fail) ⚠️

- [ ] T020 [P] [US2] Add to src/session/controller.test.ts: NC2 (phase change, pause, resume, skip and back each call `update` once with the right `NotificationState`: countdown `remainingMs` equals the snapshot's at that moment, elapsed for untimed, paused text with frozen value), NC3 (`emitAction('pause'|'resume'|'skip')` gives the same cues, record writes and state as `pause()`/`resume()`/`skip()`), NC4 (pause while paused / resume while running ignored; `pause, resume, pause` ends paused), NC6 (actions with no live session do nothing, no throw)

### Implementation for User Story 2

- [ ] T021 [US2] Subscribe to `background.onAction` in src/session/controller.ts per session and map actions to pause/resume/skip with the guards of NC4; send `notificationState` on every phase/status change to pass T020
- [ ] T022 [US2] Kotlin: chronometer in SessionNotification.kt — countdown `setUsesChronometer(true)` + `setChronometerCountDown(true)` + `setWhen(now + remainingMs)`; elapsed `setWhen(now - elapsedMs)` counting up; paused: no chronometer; Pause/Resume (label by `paused`) and Skip actions as `PendingIntent.getBroadcast` (`FLAG_IMMUTABLE`) carrying `sessionId`
- [ ] T023 [US2] Kotlin: ActionReceiver.kt (non-exported, declared in the module manifest) forwarding to the module, which emits `onAction` only when `sessionId` matches the running service's id (FR-016)
- [ ] T024 [US2] Release build; run N5–N8 and N2 again (tap-to-open; add `src/app/+native-intent.tsx` with navigate semantics only if a duplicate screen appears); record results below

**Checkpoint**: Notification controls work from the shade and lock screen.

---

## Phase 5: User Story 3 - Correct timing when the clock changes (Priority: P3)

**Goal**: Session timing and same-boot recovery follow real elapsed time.

**Independent Test**: CL1–CL7 pass; on device N11–N14 pass.

### Tests for User Story 3 (write first, confirm they fail) ⚠️

- [ ] T025 [P] [US3] Write src/platform/clock.android.test.ts (mocked module): CL1 (`now()` = anchor wall + elapsed delta; moving the mocked `Date.now` does not change it after load) and src/platform/clock.ios.test.ts: CL2
- [ ] T026 [P] [US3] Add to src/session/record.test.ts: CL3 (`toRecord` stores `elapsedAt`/`bootCount` when given), CL4 (old records without the fields parse; wrong types rejected), CL5/CL6 table tests for `recoveryNow`
- [ ] T027 [P] [US3] Add to src/session/controller.test.ts: CL7 (`checkForInterrupted` resumes by elapsed time on the same boot even when the fake wall clock jumped; falls back to wall time when `bootCount` differs)

### Implementation for User Story 3

- [ ] T028 [US3] Kotlin: `Function elapsedRealtime` and `Function bootCount` (`Settings.Global.BOOT_COUNT`, null on failure) in CadenceSessionModule.kt
- [ ] T029 [P] [US3] Implement `SessionClock` in src/platform/clock.ts, clock.android.ts, clock.ios.ts to pass T025
- [ ] T030 [US3] Add optional `elapsedAt`/`bootCount` to `SessionRecord` in src/session/types.ts; extend `toRecord`/`parseRecord` and add `recoveryNow` in src/session/record.ts; give the controller a `SessionClock` dependency and use `recoveryNow` in `checkForInterrupted`; wire `sessionClock` in src/session/index.ts to pass T026–T027
- [ ] T031 [US3] Make the cue player take the clock: inject `clock` into `createCuePlayer` in src/audio/cuePlayer.ts and replace every `Date.now()` there; add a cuePlayer test for CP1; wire in src/session/index.ts
- [ ] T032 [US3] Update specs/001-cue-engine/spec.md "Device clock changed mid-session" edge case to point to this spec's FR-019 (Principle IX)
- [ ] T033 [US3] Release build; run N11–N14; record results below

**Checkpoint**: Clock changes no longer move the session.

---

## Phase 6: User Story 4 - Cues never talk over a phone call (Priority: P4)

**Goal**: One native focus owner; refused cues skipped and logged, phase starts vibrate; silent
clip gone.

**Independent Test**: CP2–CP9 pass; on device N15–N18 and N21 (001 D11 strict) pass.

### Tests for User Story 4 (write first, confirm they fail) ⚠️

- [ ] T034 [P] [US4] Add to src/audio/timingLog.test.ts: `formatSkipLog` gives exactly `CADENCE_SKIP v=1 type=<t> planned=<ms> reason=focus phase=<n>`; `formatCueLog` unchanged (CP9)
- [ ] T035 [P] [US4] Rewrite the focus parts of src/audio/cuePlayer.test.ts with a `FakeAudioFocus` (scripted grant/refuse, `emitLoss()`) and a vibrate spy: CP2 (request before a cue unless held), CP3 (refused → not played, skip line logged), CP4 (refused + phaseStart → `vibrate(200)` once; refused otherwise → none), CP5 (abandon 1 s after the last cue ends; a cue inside the window reuses the hold), CP6 (loss → speech and sounds stopped; next cue requests again), CP7 (granted after an earlier loss plays at once; no 15 s wait), CP8 (no silent clip created; Android `init` sets `mixWithOthers`)

### Implementation for User Story 4

- [ ] T036 [US4] Kotlin: Focus.kt — `AudioFocusRequest` `GAIN_TRANSIENT_MAY_DUCK` with `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`/`CONTENT_TYPE_SPEECH` (pre-26 fallback with the legacy API), loss listener → module `onFocusLost`; `vibrate(ms)` with `VibrationEffect` (26+) or `vibrate(ms)`; expose `Function requestFocus/abandonFocus/vibrate` in CadenceSessionModule.kt
- [ ] T037 [P] [US4] Add `AudioFocus` interface, `vibrate`, and the interruption mode to src/platform/audio.ts, audio.android.ts (module), audio.ios.ts (always granted, no-op vibrate, `duckOthers`); `FakeAudioFocus` in src/test-utils/fakes.ts
- [ ] T038 [US4] Rework src/audio/cuePlayer.ts to pass T034–T035: inject focus and vibrate; remove the silent clip, `FOCUS_LOST_GIVE_UP_MS`, and the hold-status logic; add `formatSkipLog` to src/audio/timingLog.ts; delete assets/sounds/silence.wav and its reference; wire in src/session/index.ts
- [ ] T039 [US4] Update specs/001-cue-engine/spec.md phone-call edge case and specs/001-cue-engine/quickstart.md D11 to say the limitation is fixed by this spec (Principle IX)
- [ ] T040 [US4] Release build; run N15–N18 and N21 (001 D1–D11); record results below

**Checkpoint**: All stories done.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Update README.md (how background running works now; notification controls) and docs/roadmap.md (006 done)
- [ ] T042 Spec-vs-build review (Principle IX): every FR and SC in spec.md maps to a test or a device check; update spec/plan where the build diverged
- [ ] T043 `npm run check`, `npx expo-doctor`, clean release build, ND5 permission diff once more; full device pass N1–N21 on the final build
- [ ] T044 Open the PR to `develop` referencing specs/006-native-foreground-service (only after the user says go; push as the personal account)

---

## Device checks

Results of on-device runs (filled in during T019, T024, T033, T040, T043). Steps and expected
results: [quickstart.md](./quickstart.md) §3.

| # | Result | Notes |
|---|---|---|
| N1–N4, N9, N10, N19, N20, ND5 (US1) | not run | |
| N5–N8 (US2) | not run | |
| N11–N14 (US3) | not run | |
| N15–N18, N21 (US4) | not run | |

---

## Dependencies & Execution Order

- **Setup (T001–T004)** → **Foundational (T005–T009)** → user stories.
- **US1 (T010–T019)** must come first: every other story needs the native service.
- **US2** depends on US1 (notification and service). **US3** depends only on Foundational for
  its TS parts (T025–T027, T029–T032) and on T002 for T028; it can run in parallel with US2.
  **US4** depends on US1's module (T016) and touches the cue player, which US3's T031 also
  touches: do T031 before T038.
- Within each story: tests → confirm red → commit `test(006)` → implementation → green → commit
  `feat(006)` → device steps.

## Parallel Opportunities

- Foundational: T005 and T006 together; T008 alongside T007.
- US1: T010 and T011 together; T014 alongside T013.
- US3: T025, T026, T027 together; T029 alongside T028.
- US4: T034 and T035 together; T037 alongside T036.
- US2 and US3 can proceed in parallel after US1.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1, then stop and run the US1 device checks. This alone
   removes the library with no user-visible regression.
2. Add US2 (the visible win: notification controls), device check.
3. Add US3 and US4, each with its device check.
4. Polish, full device pass, PR on the user's go-ahead.
