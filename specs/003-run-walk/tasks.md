---

description: "Task list for spec 003: run / walk"
---

# Tasks: Run / Walk

**Input**: Design documents from `/specs/003-run-walk/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/run-walk.md](./contracts/run-walk.md),
[quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). In every phase, test tasks come
first. Run them and confirm they **fail** before starting the implementation tasks below them.
Guarantee IDs (WC1–WC14, WD1–WD4, WS1–WS6, WU1–WU8) refer to
[contracts/run-walk.md](./contracts/run-walk.md); on-device checks (W1–W15) to
[quickstart.md](./quickstart.md). Commit the failing tests (`test(003): …`), then the code that
passes them (`feat(003): …`).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US3)
- Paths are relative to the repository root. Tests sit next to the code as `*.test.ts(x)`. Nothing
  but routes lives in `src/app/`; screens live in `src/screens/` and route files re-export them.
- Reuse spec 001 test helpers: `FakeClock`/`FakeScheduler` (src/test-utils/fakeClock.ts),
  `FakeCuePlayer`/`FakeBackgroundHost`/`MemoryStore` (src/test-utils/fakes.ts). RNTL 14's
  `render`/`fireEvent` are async.
- Import `Text`/`TextInput` from `@/components/Text`, never from `react-native` (lint rule; OnePlus
  font fix).

---

## Phase 1: Setup

**Purpose**: Confirm the starting point. No new dependencies (plan).

- [X] T001 Confirm `003-run-walk` contains `develop` plus the `fix/oneplus-text-clipping` merge, and `npm run check` is green before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The settings data layer every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T002 [P] Write src/runWalk/settings.test.ts (defaults part): `defaultSettings()` equals the data-model.md defaults; exported limits and steps per field (run/walk 15–1800 step 15, rounds 1–30 step 1, warm-up/cool-down 0–1800 step 60); `PRESETS` lists the four presets with the labels and values in data-model.md
- [X] T003 [P] Write src/runWalk/store.test.ts for `parseRunWalk` (round-trip of valid settings; null for `null`, bad JSON, a non-object, version ≠ 1) and `RunWalkStore` with a `MemoryStore`: WS4 (nothing stored or unreadable → defaults returned and saved under `run-walk:v1`), WS6 (`update` notifies subscribers and saves the full value; a new store on the same data returns it)

### Implementation

- [X] T004 [P] Create src/runWalk/types.ts (`RunWalkSettings`, `RunWalkField`, `Preset`, `RunWalkVoice`) and the defaults, limits and `PRESETS` in src/runWalk/settings.ts to pass T002
- [X] T005 Implement `parseRunWalk`, `RUN_WALK_KEY` and `RunWalkStore` in src/runWalk/store.ts to pass T003 (sync load on first `get()`, fire-and-forget writes with `console.warn` on failure)
- [X] T006 [P] Create src/runWalk/useRunWalk.ts (app-wide `RunWalkStore` over `kvStore`, `useSyncExternalStore` hook returning `{ settings, store }`)

**Checkpoint**: Settings data layer tested. `npm run check` green.

---

## Phase 3: User Story 1 - Run a cued interval workout (Priority: P1) 🎯 MVP

**Goal**: The default workout runs from the home screen with every announcement, the "ends in"
countdown with beeps, and the sign-off, with spec 001's screen-off timing and ducking.

**Independent Test**: WC1–WC10, WC13, WC14, WD1–WD4, the engine-level run, WU1, WU3, WU4 basics,
WU7 and WU8 pass; on device, W1, W2, W4, W5 and W15 pass.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [X] T007 [P] [US1] Write src/modes/runWalk.test.ts: `runWalkDefinition` table tests for WD1–WD4 (defaults → 18 phases and 1,720 s; warm-up 0 and cool-down 0 left out; last walk kept without a cool-down and dropped with one; 1 round; subtitles "Round N of M"; `keepScreenOn` and voice flags copied; passes `validateDefinition`); the handler's table tests for WC1–WC10, WC13 and WC14 (each phase kind's start phrase; "Last round." on the last run only; round left out when `announceRound` is false; "ends in" at 5 s for every kind but ready; beeps at 3/2, beepLast at 1 with a next phase and beep on the last phase; nothing at 4 s, nor at 5 s in ready); `runWalkMode.id === 'run-walk'`, `route === '/run-walk'`
- [X] T008 [P] [US1] Add to src/modes/runWalk.test.ts block "engine run": start a short workout (warm-up 60 s, 2 rounds of 120 s / 30 s, cool-down 60 s, halfway and time left off) through `SessionController` with all spec 001 fakes, advance the `FakeScheduler`, and assert the `(cue type/text, at − T0)` sequence reaching `FakeCuePlayer` for get-ready and the warm-up (ready phrase at 0, beeps at 7/8 s, beepLast at 9 s, "Warm up. Walk for 1 minute." at 10 s, "Warm up ends in" at 65 s, beeps at 67/68, beepLast at 69, "Run for 2 minutes. Round 1 of 2." at 70 s), that the second run is followed by the cool-down (no last walk), and the completion chime + sign-off at the end (400 s)
- [X] T009 [P] [US1] Write src/screens/RunWalkScreen.test.tsx (mock `@/session/useSession`, `@/runWalk/useRunWalk`, `@/session/useKeepScreenOn`): the settings view shows "Total 28:40" for the defaults and Start calls `controller.start(runWalkDefinition(settings))` (WU3); with a run-walk session running it shows the live view with the phase title, "Round 1 of 8", the time left and Controls (WU4 basics); a running routine session shows the settings view (WU7)
- [X] T010 [P] [US1] Update src/screens/HomeScreen.test.tsx: Run / walk has no "Coming soon" and navigates to `/run-walk`; Breathe still shows "Coming soon" (1 label); add to src/components/LaunchCheck.test.tsx that Resume of a `run-walk` session pushes `/run-walk` (WU8; extend the `@/modes` mock)

### Implementation for User Story 1

- [X] T011 [US1] Implement `runWalkDefinition`, the cue handler (start phrases, "ends in", beeps, completion) and `runWalkMode` in src/modes/runWalk.ts using `spokenDuration` to pass T007; register it in src/modes/index.ts
- [X] T012 [US1] Make T008 pass (fix any handler or wiring issue it shows; no engine changes expected)
- [X] T013 [P] [US1] Create src/components/RunWalkLiveView.tsx (phase title, subtitle, time left with the spoken accessibility label, Paused badge); colours, elapsed/total and next phase come in US3
- [X] T014 [US1] Implement src/screens/RunWalkScreen.tsx (settings view with total and Start; live view with RunWalkLiveView and Controls; only for `run-walk` sessions) to pass T009; add src/app/run-walk.tsx re-exporting it and a `run-walk` screen titled "Run / walk" in src/app/_layout.tsx
- [X] T015 [US1] Make Run / walk a live tile in src/screens/HomeScreen.tsx (pressable, opens `/run-walk`, `modeId: RUN_WALK_MODE_ID`) to pass T010
- [ ] T016 [US1] On device: run quickstart W1, W2, W4, W5 and W15; capture the timing log for SC-002 and SC-003

**Checkpoint**: The default workout runs end to end. MVP.

---

## Phase 4: User Story 2 - Set up my own intervals (Priority: P1)

**Goal**: Presets and − / + steppers for every value, the total updating live, everything saved
immediately and repaired if out of range.

**Independent Test**: WS1–WS3, WS5 and WU2 pass; on device, W9–W11 pass.

### Tests for User Story 2 (write first, confirm they fail) ⚠️

- [X] T017 [P] [US2] Add to src/runWalk/settings.test.ts table tests: `adjust`/`canAdjust` per field at, below and above each limit, including warm-up 60 → 0 and 0 → 60 (WS1); `applyPreset` changes run, walk, rounds only, and `matchingPreset` returns the preset for an exact match and null when any one value differs (WS2); `totalSec` equals the sum of `runWalkDefinition(settings).phases` for several settings (WS3)
- [X] T018 [P] [US2] Add to src/runWalk/store.test.ts: WS5, a readable v1 value is repaired field by field (run 5 → 15, run 100 → 105 (snapped to 15), rounds 0 → 1, rounds 99 → 30, warm-up 2000 → 1800, missing cool-down → 300, `halfway: "yes"` → true) while the valid fields are kept
- [X] T019 [P] [US2] Write src/components/Stepper.test.tsx: shows the label and the formatted value; − and + call `onChange(-1)` / `onChange(1)`; each is disabled (and announced as disabled) when its `can…` prop is false; accessible labels "Decrease <label>" / "Increase <label>"
- [X] T020 [P] [US2] Add to src/screens/RunWalkScreen.test.tsx with a real `RunWalkStore` over `MemoryStore`: tapping a preset updates run, walk, rounds and marks it selected; + on run updates the store, unmarks the preset, and the total; − on rounds is disabled at 1; warm-up at 0 reads "Off"

### Implementation for User Story 2

- [X] T021 [US2] Implement `adjust`, `canAdjust`, `applyPreset`, `matchingPreset` and `totalSec` in src/runWalk/settings.ts to pass T017
- [X] T022 [US2] Add field-by-field repair to `parseRunWalk` in src/runWalk/store.ts to pass T018
- [X] T023 [P] [US2] Implement src/components/Stepper.tsx to pass T019 (Pressable − / + with `accessibilityState.disabled`, value text with tabular numbers)
- [X] T024 [US2] Add the presets row and the five steppers to the settings view in src/screens/RunWalkScreen.tsx to pass T020 (values as m:ss, rounds as a number, 0 warm-up/cool-down as "Off")
- [ ] T025 [US2] On device: run quickstart W9–W11

**Checkpoint**: Intervals are adjustable and survive restarts.

---

## Phase 5: User Story 3 - Keep track while I run (Priority: P2)

**Goal**: Time-left and halfway cues with their switches, the full live view (colours, elapsed /
total, next phase), keep screen on, and the ended view.

**Independent Test**: WC11, WC12, WU2 switches, WU4–WU6 pass; on device, W3, W6–W8 and W12–W14
pass.

### Tests for User Story 3 (write first, confirm they fail) ⚠️

- [X] T026 [P] [US3] Add to src/modes/runWalk.test.ts: WC11 (time left at every multiple of 30 s with `remaining > 5` and `sec ≥ 5`, in every kind but ready; none when `timeLeft` is off; none at sec 0–4 of a 30 s phase or a 31 s phase) and WC12 (halfway at `floor(d/2)` for runs of 120 s and 121 s, not 119 s, not on walks; merged "Halfway. 1 minute left." on a 120 s run; none when `halfway` is off)
- [X] T027 [P] [US3] Add to src/components/RunWalkLiveView.test.tsx: run and walk titles use different colours (run accent, walk green; ready the text colour); "elapsed / total" as m:ss; "Next: Walk 1:30" and none on the last phase
- [X] T028 [P] [US3] Add to src/screens/RunWalkScreen.test.tsx: switches for "Say the round", "Say halfway", "Say time left" and "Keep screen on" update the store; the ended view shows "Complete" (done) or "Stopped" (stopped) with the total elapsed above the settings, and Start reads "Start again" (WU5); `useKeepScreenOn` receives the run-walk definition and status while live, and `undefined` for another mode's session (WU6)
- [X] T029 [P] [US3] Add to src/screens/HomeScreen.test.tsx: the Run / walk tile shows "In progress" while a run-walk session is running or paused, and not for a routine session or when idle

### Implementation for User Story 3

- [X] T030 [US3] Add the time-left and halfway cues to the handler in src/modes/runWalk.ts to pass T026
- [X] T031 [P] [US3] Finish src/components/RunWalkLiveView.tsx (phase colours, elapsed / total, next phase) to pass T027
- [X] T032 [US3] Add the voice and keep-screen-on switches, the ended view and `useKeepScreenOn` to src/screens/RunWalkScreen.tsx to pass T028
- [X] T033 [US3] Make T029 pass in src/screens/HomeScreen.tsx (expected to pass already via `modeId`; fix if not)
- [ ] T034 [US3] On device: run quickstart W3, W6–W8 and W12–W14

**Checkpoint**: All three stories work on their own.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T035 [P] Update README.md: Run / walk moves from "coming later" to what works today, with a one-line description and a link to specs/003-run-walk/
- [ ] T036 Review the spec against what was built; update spec.md, plan.md, research.md, data-model.md or contracts where the implementation diverged (Principle IX)
- [ ] T037 Run `npm run check`, `npx expo-doctor`, and a local release build (`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`); confirm the merged manifest's permissions are unchanged (no new permissions)
- [ ] T038 Open the PR from `003-run-walk` to `develop` (after explicit go-ahead, and after PR #3 is merged), listing the on-device checks W1–W15 and their results or pending status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories.
- **US1 (Phase 3)**: depends on Foundational. The MVP.
- **US2 (Phase 4)**: depends on Foundational (settings, store) and US1's screen (T014) for T020/T024.
- **US3 (Phase 5)**: depends on US1's mode (T011), live view (T013), screen (T014) and home tile
  (T015). Independent of US2 apart from shared screen files.
- **Polish (Phase 6)**: after the stories.

### Within Each Phase

- Test tasks first, run, confirm red → implementation → green → refactor → commit.
- src/screens/RunWalkScreen.tsx is extended by T014, T024 and T032 in order; the same goes for its
  test file (T009, T020, T028), for src/modes/runWalk.ts (T011, T030), src/runWalk/settings.ts
  (T004, T021), src/runWalk/store.ts (T005, T022) and HomeScreen (T010/T015, T029/T033).

### Parallel Opportunities

- Foundational tests T002–T003 together; T004 and T006 together.
- US1 tests T007–T010 together; T013 alongside T011.
- US2 tests T017–T020 together; T023 alongside T021–T022.
- US3 tests T026–T029 together; T031 alongside T030.

---

## Parallel Example: User Story 1

```text
# Write all US1 tests together (different files):
T007 src/modes/runWalk.test.ts
T009 src/screens/RunWalkScreen.test.tsx
T010 src/screens/HomeScreen.test.tsx, src/components/LaunchCheck.test.tsx
# T008 extends T007's file: write it right after T007.
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phases 1–2 (settings data layer).
2. Phase 3: the default workout runs, cued, from the home screen.
3. **Stop and validate** on the device (T016) before adding settings.

### Incremental delivery

1. US1 → default workout end to end (MVP).
2. US2 → presets and steppers, persisted.
3. US3 → time-left/halfway cues, full live view, keep screen on, ended view.
4. Polish → README, spec review, release build, PR.
