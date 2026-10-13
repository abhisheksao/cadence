---

description: "Task list for spec 001: cue engine and background session"
---

# Tasks: Cue Engine and Background Session

**Input**: Design documents from `/specs/001-cue-engine/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). In every phase, test tasks come
first. Run them and confirm they **fail** before starting the implementation tasks below them.
Guarantee IDs (E1–E16, C1–C8) refer to [contracts/engine.md](./contracts/engine.md) and
[contracts/platform.md](./contracts/platform.md); on-device checks (D1–D11) refer to
[quickstart.md](./quickstart.md). Commit after each red → green → refactor cycle. Tests should
show up in the history before the code they cover.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US5)
- Paths are relative to the repository root. Tests sit next to the code as `*.test.ts(x)`, except
  that nothing but routes may live in `src/app/` (Expo Router would treat a test file as a route):
  screens live in `src/screens/` and route files re-export them.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Router, test tooling, lint, native config, and sound assets. No behaviour yet.

- [X] T001 Install Expo Router and its peers with `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`; set `"main": "expo-router/entry"` in package.json; delete App.tsx and index.ts
- [X] T002 Install runtime modules with `npx expo install expo-audio expo-speech expo-keep-awake expo-intent-launcher expo-sqlite react-native-background-actions` (package.json)
- [X] T003 Install test tooling with `npx expo install jest-expo jest @types/jest @testing-library/react-native -- --dev`; add `"jest": { "preset": "jest-expo" }` to package.json, plus the transformIgnorePatterns entry from the Expo unit-testing guide extended with `react-native-background-actions`
- [X] T004 Run `npx expo lint` once to generate the ESLint config (eslint.config.js); keep the Expo defaults
- [X] T005 Update tsconfig.json: keep `strict: true`, add `"types": ["jest"]` and `"paths": { "@/*": ["./src/*"] }`
- [X] T006 Add npm scripts to package.json: `test` (`jest`), `test:watch` (`jest --watch`), `lint` (`expo lint`), `typecheck` (`tsc --noEmit`), `check` (`npm run lint && npm run typecheck && npm test`), `sounds` (`node scripts/gen-sounds.mjs`), `timing-report` (`node scripts/timing-report.mjs`)
- [X] T007 Write a smoke test src/test-utils/smoke.test.ts (`expect(1 + 1).toBe(2)`) and confirm `npm run check` passes; delete the smoke test once the first real test lands (T014)
- [X] T008 [P] Create the config plugin plugins/withBackgroundActions.js that declares `com.asterinet.react.bgactions.RNBackgroundActionsTask` as a service with `android:foregroundServiceType="mediaPlayback"` and `android:exported="false"` via `withAndroidManifest` (research R5)
- [X] T009 Update app.json: `name` "Cadence", `slug` "cadence", `userInterfaceStyle` "automatic", `experiments.typedRoutes: true`; plugins `expo-router`, `["expo-audio", { "enableBackgroundPlayback": true }]`, `./plugins/withBackgroundActions`, `expo-sqlite`; `android.permissions` POST_NOTIFICATIONS, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (research R5)
- [X] T010 [P] Write scripts/gen-sounds.mjs: 44.1 kHz 16-bit mono WAV writer plus sine tones with a short attack and exponential decay; output assets/sounds/beep.wav (short mid tone), beep-last.wav (longer, higher tone), chime.wav (two-note rising chime), silence.wav (1 s of zeros) (research R11)
- [X] T011 Run `npm run sounds` and commit the four files in assets/sounds/
- [X] T012 Run `npx expo prebuild -p android --clean` into a throwaway check: confirm the merged AndroidManifest has the service type and permissions, then delete android/ (it stays git-ignored, Principle V)

**Checkpoint**: `npm run check` is green, and the app config generates a valid manifest.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, test doubles, ports, and validation used by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T013 [P] Write src/test-utils/fakeClock.test.ts: `FakeClock.now()` returns the set time; `advance(ms)` moves it; `FakeScheduler.every(100, fn)` + `scheduler.advance(clock, 1000)` calls `fn` 10 times in order with the clock advanced before each call; `jitter` option delays individual calls by a seeded random 0–300 ms; cancel stops calls; `suspend(clock, ms)` moves the clock without running callbacks (simulates the OS suspending the app)
- [X] T014 [P] Write src/session/validate.test.ts: `validateDefinition` returns no errors for a valid definition; returns an error each for empty `phases`, blank `title`, `durationSec` 0, negative, or non-integer, and an unknown `modeId` (data-model "SessionDefinition")
- [X] T015 [P] Write src/modes/registry.test.ts: `registerMode` then `getMode(id)` returns it; unknown id returns undefined; registering the same id twice throws (`createModeRegistry()` so tests stay isolated)
- [X] T016 [P] Write src/storage/kv.test.ts with a jest mock of `expo-sqlite/kv-store`: `getSync` returns the stored value or null; `set` and `remove` call `setItem` and `removeItem`

### Implementation

- [X] T017 Create src/engine/clock.ts with the `Clock` and `Scheduler` interfaces and `systemClock` (`Date.now()`) and `systemScheduler` (`setInterval`) per contracts/engine.md
- [X] T018 Create src/engine/types.ts with `Phase`, `CueOpportunity`, `Cue`, `CueHandler`, `EngineEvents`, `Status`, `SessionSnapshot` per contracts/engine.md and data-model.md
- [X] T019 Implement src/test-utils/fakeClock.ts (`FakeClock`, `FakeScheduler`) to pass T013
- [X] T020 Create src/session/types.ts with `SessionDefinition<S>`, `SessionRecord`, `ResumeAssessment`, `RecoveryResult` per data-model.md
- [X] T021 Create src/modes/types.ts (`ModeDefinition`) and implement src/modes/registry.ts to pass T015
- [X] T022 Implement src/session/validate.ts to pass T014
- [X] T023 [P] Create the port interfaces: src/audio/types.ts (`CuePlayer`), src/platform/background.ts (`BackgroundHost`), src/storage/types.ts (`KeyValueStore`) per contracts/platform.md
- [X] T024 [P] Create test doubles in src/test-utils/fakes.ts: `FakeCuePlayer` (records `play(cue, at)` and `silence()` calls), `FakeBackgroundHost` (records calls; `start` result configurable), `MemoryStore` (in-memory `KeyValueStore`)
- [X] T025 Implement src/storage/kv.ts: `KeyValueStore` over `expo-sqlite/kv-store` (`getItemSync`, `setItem`, `removeItem`) to pass T016 (research R7)
- [X] T026 Create a minimal src/app/_layout.tsx (Expo Router `Stack`, dark/light background from the system scheme) and a placeholder src/app/index.tsx so the app launches

**Checkpoint**: foundation ready. `npm run check` is green; `npx expo start` shows a placeholder home.

---

## Phase 3: User Story 1 - Hear cues on time with the screen off (Priority: P1) 🎯 MVP

**Goal**: Start the sample session, lock the phone, and hear every cue on its second through to
the completion chime.

**Independent Test**: Engine tests E1–E6, E14, E15 pass on a fake clock; on device, D3 passes.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [X] T027 [P] [US1] Write src/engine/engine.test.ts, block "timing": E1 (empty phases → stays idle), E2 (one `cueFor` per whole second with `at = phaseStart + sec*1000` across 3 timed phases), E3 (cues handed out ≤ 1000 ms before `at`, in order), E4 (phase boundaries exact even when ticks arrive 300 ms late), E5 (60 simulated minutes with `FakeScheduler` jitter: every `at` equals its planned offset exactly), E14 (`completion(at)` once with exact end time), E15 (snapshots emitted at least every 250 ms while running)
- [X] T028 [P] [US1] Add block "catch-up" to src/engine/engine.test.ts: E6, where a 25 s gap with no ticks across 2 phase boundaries yields exactly one `isPhaseStart` (for the landing phase) and no per-second cues more than 2000 ms late
- [X] T029 [P] [US1] Write src/audio/latency.test.ts: `startDelay(at, now, latency)` returns `at - latency - now` (0 if negative); `TtsLatency` starts at 400, updates as an EMA (0.7 old / 0.3 sample) of `onStart - sent + 80`, clamps to 100–900, and ignores samples flagged as queued
- [X] T030 [P] [US1] Write src/audio/timingLog.test.ts: `formatCueLog({type, planned, actual, phase})` returns exactly `CADENCE_CUE v=1 type=beep planned=… actual=… err=… phase=…` per contracts/timing-log.md, with `err = actual - planned`, and contains no spoken text
- [X] T031 [P] [US1] Write src/modes/sample.test.ts: `sampleDefinition()` passes `validateDefinition`, has the 4 phases from quickstart.md with `keepScreenOn: true`; `cueFor` returns `say(title)` at each phase start, beeps at 3 and 2 remaining and `beepLast` at 1 remaining in phases 1 and 3, beeps at 3/2/1 remaining in phase 4, "Halfway" at 10 s of phase 3, nothing for an untimed phase after its start; `completion` returns chime then `say('Sample complete')` 700 ms later
- [X] T032 [P] [US1] Write src/session/controller.test.ts, block "start": C1 (invalid definition rejected; valid one calls `background.prepare()` then `background.start()` then starts the engine), C2 (engine cues reach `player.play(cue, at)`), C5 (after `done`, `background.stop()` is called no sooner than 4 s later), C6 (starting a second session stops the first and silences the player); use `FakeClock`, `FakeScheduler`, and fakes from T024
- [X] T033 [P] [US1] Write src/audio/cuePlayer.test.ts block "scheduling" with jest mocks for `expo-audio` and `expo-speech` and fake timers: a beep due at `at` plays 120 ms early; a `say` is spoken `TtsLatency` ms early; `interrupt: true` calls `Speech.stop()` before speaking; `silence()` cancels pending timers and calls `Speech.stop()`; one CADENCE_CUE line is logged per cue on playback start / `onStart`
- [X] T034 [P] [US1] Write src/platform/background.android.test.ts block "service" with a mock of the background library: `start` calls `BackgroundService.start` with the title, text, and `foregroundServiceType: ['mediaPlayback']` and resolves true; resolves false if it throws; `update` calls `updateNotification`; `stop` calls `stop`
- [X] T035 [P] [US1] Write src/screens/SampleScreen.test.tsx (React Native Testing Library, session module mocked): pressing Start calls `controller.start` with the sample definition; the current phase title and status from the snapshot are shown

### Implementation for User Story 1

- [X] T036 [US1] Implement `Engine` construction, `start`, the 100 ms tick, phase advancement by exact duration, look-ahead cue firing, stale-cue dropping, single catch-up phase start, completion, `snapshot`, and `subscribe` in src/engine/engine.ts to pass T027–T028 (research R2)
- [X] T037 [P] [US1] Implement src/audio/latency.ts to pass T029
- [X] T038 [P] [US1] Implement src/audio/timingLog.ts to pass T030 (logs via `console.info`)
- [X] T039 [US1] Implement src/audio/cuePlayer.ts to pass T033: `init()` (create players for beep, beep-last, chime; warm up TTS with `Speech.getAvailableVoicesAsync()`; for now `setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true })`), `play(cue, at)` scheduling with latency.ts (beeps 120 ms early, speech by `TtsLatency`; `interrupt` stops queued speech), timing log on playback start / `onStart`, and `silence()` cancelling timers and `Speech.stop()`
- [X] T040 [US1] Implement src/platform/background.android.ts `start`/`update`/`stop` to pass T034, with the background library (task title and text, `foregroundServiceType: ['mediaPlayback']`, the task promise resolving on `keepAliveUntil`; `start` returns false on error) and a placeholder `prepare()` that resolves; create src/platform/background.ios.ts with no-op methods (`start` resolves true)
- [X] T041 [US1] Implement src/modes/sample.ts (definition + `ModeDefinition` with id `sample`) to pass T031 and register it in src/modes/index.ts
- [X] T042 [US1] Implement `SessionController` `start`, cue forwarding, completion wind-down (4 s), and single-session rule in src/session/controller.ts to pass T032; add the `useSession` hook in src/session/useSession.ts and a module-level controller wired to the real adapters in src/session/index.ts
- [X] T043 [US1] Create a minimal src/screens/SampleScreen.tsx to pass T035 (a Start button, the current phase title, and the status), route src/app/sample.tsx re-exporting it, and link to it from src/app/index.tsx
- [ ] T044 [US1] On device: build with `npx expo run:android` and run quickstart D3 (screen off, every cue on time, chime, notification gone after the session). Record the result in the PR description

**Checkpoint**: MVP. The sample session runs to completion with the screen off.

---

## Phase 4: User Story 2 - Control a running session (Priority: P1)

**Goal**: Pause, resume, skip, back (3-second rule), and stop, plus untimed phases.

**Independent Test**: E7–E13 and C6 pass on a fake clock; on device, D5 passes.

### Tests for User Story 2 (write first, confirm they fail) ⚠️

- [X] T045 [P] [US2] Add block "controls" to src/engine/engine.test.ts: E7 (pause freezes elapsed; resume after 7 s shifts every later `at` by 7000; a cue handed out early but due after the pause is handed out again on resume), E8 (pause/skip/back/stop call `onCancelPending` first), E9 (skip starts the next phase at sec 0; skip in the last phase → `done` + completion), E10 (back at 3.5 s restarts the phase; back at 2 s goes to the previous phase; back in the first phase at 1 s restarts it; works while paused), E11 (untimed phase never ends by itself; elapsed keeps counting), E12 (stop → `stopped`, no completion), E13 (clock moved back 30 s mid-phase: elapsed does not decrease and later `at` values stay on schedule)
- [X] T046 [P] [US2] Add block "controls" to src/session/controller.test.ts: pause/skip/back/stop call `player.silence()` within the same call (FR-010); stop calls `background.stop()` immediately
- [X] T047 [P] [US2] Write src/components/Controls.test.tsx (React Native Testing Library): renders Pause while running and Resume while paused, Skip, Back, Stop; each button calls the matching controller method; buttons have accessibility labels

### Implementation for User Story 2

- [X] T048 [US2] Implement `pause`, `resume`, `skip`, `back` (3 s rule), `stop`, untimed phases, and the backwards-clock guard (shift anchors when `now < lastSeenNow`) in src/engine/engine.ts to pass T045
- [X] T049 [US2] Wire controller control methods to the engine and `player.silence()` in src/session/controller.ts to pass T046
- [X] T050 [US2] Implement src/components/Controls.tsx to pass T047 and add it to src/screens/SampleScreen.tsx
- [ ] T051 [US2] On device: run quickstart D5 and confirm audio stops within 300 ms of each tap (SC-005)

**Checkpoint**: US1 and US2 both work on their own.

---

## Phase 5: User Story 3 - Keep listening to music (Priority: P2)

**Goal**: Cues duck other audio and never pause it, including during speech.

**Independent Test**: The cue player's ducking test passes with mocked modules; on device, D4 and
D9 pass.

### Tests for User Story 3 (write first, confirm they fail) ⚠️

- [X] T052 [US3] Add block "ducking" to src/audio/cuePlayer.test.ts (mocks from the US1 cue-player test): `init()` calls `setAudioModeAsync` with `interruptionMode: 'duckOthers'`, `shouldPlayInBackground: true`, `playsInSilentMode: true`; a `say` cue starts the looping silence player before `Speech.speak` and pauses it on `onDone`, `onStopped`, and `onError`; the silence player keeps running for 1 s after a phrase, so phrases less than 1 s apart share one hold; `silence()` pauses it; if the silence player stops without being asked mid-phrase (another app took focus, e.g. a call), `Speech.stop()` is called and later phrases are skipped until the player resumes on its own (focus regained), at which point it is paused again (spec edge case "phone call"; research R3)

### Implementation for User Story 3

- [ ] T053 [US3] Update src/audio/cuePlayer.ts to pass T052: set `interruptionMode: 'duckOthers'`, create a looping `silence.wav` player, and hold it during speech, and skip/stop speech when the hold player cannot play (research R3)
- [ ] T054 [US3] On device: run quickstart D4 (music dips for beeps and speech, returns, never pauses), D9 (silent/vibrate mode), and D11 (phone call). If the music pumps badly between close cues, tune the hold window in src/audio/cuePlayer.ts and note it in research.md R3

**Checkpoint**: Cues and the user's music coexist.

---

## Phase 6: User Story 4 - Know a session is running and keep it alive (Priority: P2)

**Goal**: An ongoing notification with title, phase, and a paused label; notification permission;
a battery exemption asked once and offered again from home.

**Independent Test**: C3, C7, and the background-host tests pass; on device, D2 and D6 pass.

### Tests for User Story 4 (write first, confirm they fail) ⚠️

- [ ] T055 [P] [US4] Add block "notification" to src/session/controller.test.ts: C3 (phase change → `background.update('<phase title>')`; pause → `update('Paused · <phase title>')`; resume restores it; no other calls to `update`, including across 60 s of ticks; after a dismissal the next phase change still calls `update`, which re-posts), C7 (`background.start` returns false → session still runs and `snapshot`/controller exposes `backgroundWarning: true`)
- [ ] T056 [P] [US4] Write src/platform/background.android.test.ts with mocks for `react-native` `PermissionsAndroid`/`Platform`, `expo-intent-launcher`, and a `MemoryStore`: `prepare()` requests POST_NOTIFICATIONS on API 33+ only and continues if denied; asks for the battery exemption only when `battery-exemption-asked:v1` is unset, then sets it; `requestBatteryExemption()` falls back to the settings screen when the request intent throws
- [ ] T057 [P] [US4] Write src/components/BatteryLink.test.tsx: renders "App stopping mid-session? Allow it to run in the background" and calls `background.requestBatteryExemption()` on press
- [ ] T058 [P] [US4] Add to src/screens/SampleScreen.test.tsx: "Cues may stop when the screen is off" is shown only when the snapshot has `backgroundWarning: true`

### Implementation for User Story 4

- [ ] T059 [US4] Update src/session/controller.ts to pass T055 (notification text on phase change/pause/resume only; `backgroundWarning`)
- [ ] T060 [US4] Implement `prepare()` and `requestBatteryExemption()` in src/platform/background.android.ts to pass T056 (package name from `expo-constants`)
- [ ] T061 [US4] Implement src/components/BatteryLink.tsx to pass T057 (rendered on Android only via a `BatteryLink.ios.tsx` that returns null)
- [ ] T062 [US4] To pass T058, show the background warning on src/screens/SampleScreen.tsx when `backgroundWarning` is true ("Cues may stop when the screen is off")
- [ ] T063 [US4] On device: fresh install (`adb uninstall io.github.abhisheksao.cadence`), then run quickstart D2 and D6

**Checkpoint**: Notification and permission flow verified.

---

## Phase 7: User Story 5 - Find the modes and try a sample session (Priority: P3)

**Goal**: Home screen with the three modes (coming soon) and the sample; a full sample session
screen; screen-on per definition; a 60-minute soak variant for SC-003.

**Independent Test**: React Native Testing Library tests for home and sample screens pass; on
device, D1 passes.

### Tests for User Story 5 (write first, confirm they fail) ⚠️

- [ ] T064 [P] [US5] Write src/screens/HomeScreen.test.tsx (React Native Testing Library + expo-router testing utilities): shows "Morning routine", "Run / walk", "Breathe" each with a description and "Coming soon", a "Sample session" entry that navigates to /sample, and the battery link (from T061)
- [ ] T065 [P] [US5] Write src/components/SessionView.test.tsx: shows phase title, subtitle, remaining time as m:ss for timed phases and elapsed time for untimed ones, and "Paused" while paused
- [ ] T066 [P] [US5] Write src/session/useKeepScreenOn.test.ts with a mocked `expo-keep-awake`: activates when the definition has `keepScreenOn: true` and status is running/paused; deactivates on done/stopped/unmount; never activates when `keepScreenOn` is false (FR-021a)
- [ ] T067 [P] [US5] Add to src/modes/sample.test.ts: `soakDefinition()` repeats the timed sample phases (no untimed phase) to a total of 60 minutes and passes validation
- [ ] T068 [P] [US5] Add to src/screens/SampleScreen.test.tsx: "Start sample" and "Start 60-minute soak" start the matching definitions; SessionView and Controls render while a session runs; `useKeepScreenOn` receives the running definition

### Implementation for User Story 5

- [ ] T069 [US5] Implement src/screens/HomeScreen.tsx (mode tiles + sample entry + BatteryLink) to pass T064; src/app/index.tsx re-exports it
- [ ] T070 [US5] Implement src/components/SessionView.tsx and a `formatClock` helper in src/format/clock.ts (with a small src/format/clock.test.ts written first) to pass T065
- [ ] T071 [US5] Implement src/session/useKeepScreenOn.ts to pass T066
- [ ] T072 [US5] Implement `soakDefinition()` in src/modes/sample.ts to pass T067
- [ ] T073 [US5] Finish src/screens/SampleScreen.tsx to pass T068: SessionView, Controls, useKeepScreenOn, "Start sample" and "Start 60-minute soak" buttons, and a header title; configure screen titles in src/app/_layout.tsx
- [ ] T074 [US5] On device: run quickstart D1

**Checkpoint**: All five user stories work on their own.

---

## Phase 8: Recovery After an OS Kill (FR-023 to FR-026, SC-008; supports US1)

**Purpose**: Save the session, and on relaunch offer Resume/Discard or show an interrupted note.

### Tests first (write first, confirm they fail) ⚠️

- [ ] T075 [P] Write src/session/record.test.ts: `toRecord`/`parseRecord` round-trip; `parseRecord` rejects bad JSON or another `version`; table tests for `assessRecord(record, now)` covering: none; `now < writtenAt` → interrupted('clock'); `writtenAt` > 60 min ago → interrupted('stale'); paused record → resume paused at the same elapsed; running in a timed phase → resume at the clock position; running past several timed phases → correct later phase; stops at an untimed phase; past the end → interrupted('finished') (data-model "Recovery assessment")
- [ ] T076 [P] Add block "recovery" to src/engine/engine.test.ts: E16 (`startAt({index, phaseElapsedMs, paused})` resumes there; the phase start cue fires once; later `at` values line up with the recovered anchor)
- [ ] T077 [P] Add block "recovery" to src/session/controller.test.ts: C4 (record written on start, pause, resume, skip, back, and phase change; refreshed every 60 s while running; cleared on done and stop) and C8 (`checkForInterrupted()` returns the `assessRecord` result; `resumeInterrupted()` rebuilds cues through the mode registry, restarts background and notification, and plays the landing phase start; Discard clears the record)
- [ ] T078 [P] Write src/components/ResumePrompt.test.tsx: for a resume offer shows the session title, phase, and Resume/Discard buttons wired to callbacks; for an interrupted result shows "Your session '<title>' was interrupted at <time>" with an OK button
- [ ] T079 [P] Write src/components/LaunchCheck.test.tsx (session module mocked): with a resume offer from `checkForInterrupted`, ResumePrompt shows; Resume calls `controller.resumeInterrupted` and navigates to /sample; Discard clears the record; for an interrupted result, OK clears it; with `none`, the stack renders directly

### Implementation

- [ ] T080 Implement src/session/record.ts to pass T075
- [ ] T081 Implement `Engine.startAt` in src/engine/engine.ts to pass T076
- [ ] T082 Implement record writing, the 60 s refresh, `checkForInterrupted`, `resumeInterrupted`, and discard in src/session/controller.ts to pass T077
- [ ] T083 Implement src/components/ResumePrompt.tsx to pass T078
- [ ] T084 Implement src/components/LaunchCheck.tsx to pass T079 and render it from src/app/_layout.tsx (read the record synchronously before first render; show ResumePrompt; on Resume call `controller.resumeInterrupted` and navigate to the session's screen, /sample in this spec)
- [ ] T085 On device: run quickstart D7 and D8 (force-stop mid-session; reopen within a minute, and after the session would have ended)

**Checkpoint**: A killed session can be resumed in 2 taps at the clock position.

---

## Phase 9: Polish and Cross-Cutting Concerns

**Purpose**: Timing measurement, long-run validation, docs, and final gates.

- [ ] T086 [P] Write scripts/timing-report.test.mjs (run by Jest via `testMatch` including `scripts/**/*.test.mjs`) with fixtures in scripts/__fixtures__/: parses CADENCE_CUE lines and ignores other lines; computes p50/p95 of |err| per type; computes first-5 vs last-5-minute p95; returns failure when beeps p95 > 150, speech p95 > 300, or drift > 50 ms
- [ ] T087 Implement scripts/timing-report.mjs (pure `analyse(lines)` + CLI with `--no-fail`) to pass T086
- [ ] T088 On device: run quickstart D10 three times (60-minute soak, screen off) and capture the timing log; run `npm run timing-report cues.log`; check `adb logcat -b events` for `am_kill` of the app. Record the SC-001/SC-002/SC-003 results in the PR description
- [ ] T089 [P] Update README.md: what spec 001 delivers, how to run tests (`npm run check`), how to build locally, and a link to specs/001-cue-engine/quickstart.md
- [ ] T090 [P] Add docs/adr/0001-wall-clock-timing.md (research R1) and docs/adr/0002-speech-ducking-silent-clip.md (research R3)
- [ ] T091 Review the spec against what was built; update spec.md, plan.md, or research.md where the implementation diverged (Principle IX)
- [ ] T092 Run `npm run check`, `npx expo-doctor`, and a release build (`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`); check the merged release manifest's permissions match research R5 (plus Expo's defaults, each noted) and that `npm ls` shows no analytics or crash-reporting packages (FR-022); all must pass before opening the PR to `develop`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories.
- **US1 (Phase 3)**: depends on Foundational. The MVP.
- **US2 (Phase 4)**: depends on US1's engine core (T036) and controller (T042); it extends the same files.
- **US3 (Phase 5)**: depends on T039 (cue player). Independent of US2.
- **US4 (Phase 6)**: depends on T040 and T042. Independent of US2 and US3.
- **US5 (Phase 7)**: depends on T043; uses Controls (T050) and BatteryLink (T061) if present.
- **Recovery (Phase 8)**: depends on US1 and US2 (it records control events).
- **Polish (Phase 9)**: T086–T087 can start any time after Setup; T088–T092 come last.

### Within Each Phase

- Test tasks first, run, confirm red → implementation → green → refactor → commit.
- Engine tasks touch one file (src/engine/engine.ts), so engine work across phases is sequential.

### Parallel Opportunities

- Setup: T008 and T010 alongside T001–T007.
- Foundational: T013–T016 together; T023–T024 together.
- US1: T027–T035 (tests in different files) together; T037 and T038 together.
- After US1: US3 (Phase 5) and US4 (Phase 6) can run alongside US2, since they touch different files apart from the controller.
- Polish: T086/T087 any time; T089/T090 together.

---

## Parallel Example: User Story 1

```text
# Write all US1 tests together (different files):
T027 src/engine/engine.test.ts (timing)
T029 src/audio/latency.test.ts
T030 src/audio/timingLog.test.ts
T031 src/modes/sample.test.ts
T032 src/session/controller.test.ts (start)
T033 src/audio/cuePlayer.test.ts (scheduling)
T034 src/platform/background.android.test.ts (service)
T035 src/screens/SampleScreen.test.tsx

# Then the independent pure modules together:
T037 src/audio/latency.ts
T038 src/audio/timingLog.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1) → **stop and validate** with D3 on the reference device.

### Incremental Delivery (suggested daily slices)

1. Day A: Setup + Foundational (T001–T026).
2. Day B: US1 (T027–T044), the MVP on the device.
3. Day C: US2 + US3 (T045–T054).
4. Day D: US4 + US5 (T055–T074).
5. Day E: Recovery (T075–T085).
6. Day F: Polish, soak runs, PR (T086–T092).

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Each story phase ends with an on-device task; the steps are already written in quickstart.md,
  which satisfies "on-device steps written before implementation" (Principle VII).
- Keep the engine free of React Native imports; `npm run check` must stay green after every task.
