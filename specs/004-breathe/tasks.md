---

description: "Task list for spec 004: guided breathing (breathe)"
---

# Tasks: Guided Breathing (Breathe)

**Input**: Design documents from `/specs/004-breathe/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/breathe.md](./contracts/breathe.md),
[quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). In every phase, test tasks come
first. Run them and confirm they **fail** before starting the implementation tasks below them.
Guarantee IDs (BC1–BC14, BD1–BD4, BS1–BS6, BU1–BU7) refer to
[contracts/breathe.md](./contracts/breathe.md); on-device checks (B1–B15) to
[quickstart.md](./quickstart.md). Commit the failing tests (`test(004): …`), then the code that
passes them (`feat(004): …`).

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
- Ensure no `.md` or markdown document references are included in code or comments.

---

## Phase 1: Setup

**Purpose**: Confirm the starting point. No new dependencies.

- [ ] T001 Confirm `004-breathe` is up to date with `develop`, clean working tree, and `npm test` and `npm run typecheck` are green before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The settings data layer and calculation logic every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [ ] T002 [P] Write src/breathe/settings.test.ts (defaults and constants): `defaultSettings()` equals data-model defaults (inhale 4s, hold 4s, exhale 4s, post-hold 4s, targetMinutes 3, prepEnabled true, cueStyle 'voice', keepScreenOn false); exported limits per field (inhale/exhale 1–30, holds 0–30, targetMinutes 1–30); `PRESETS` lists the four presets (Box 4-4-4-4, 4-7-8, 3-4-7, Coherent) with values matching data-model
- [ ] T003 [P] Write src/breathe/store.test.ts for `parseBreathe` (round-trip of valid settings; null for null, bad JSON, non-object, version ≠ 1) and `BreatheStore` with a `MemoryStore`: BS4 (missing/invalid data returns defaults saved under `breathe:v1`), BS6 (`update` notifies subscribers and saves the full value; a new store on the same data returns it)

### Implementation

- [ ] T004 [P] Create src/breathe/types.ts (`BreatheSettings`, `BreatheField`, `BreathePreset`, `BreatheCueStyle`, `BreatheVoice`) and constants, limits, and `PRESETS` in src/breathe/settings.ts to pass T002
- [ ] T005 Implement `parseBreathe`, `BREATHE_KEY`, and `BreatheStore` in src/breathe/store.ts to pass T003 (sync load on first `get()`, fire-and-forget writes with error logging)
- [ ] T006 [P] Create src/breathe/useBreathe.ts (app-wide `BreatheStore` over `kvStore`, `useSyncExternalStore` hook returning `{ settings, store }`)

**Checkpoint**: Settings data layer tested. Tests green.

---

## Phase 3: User Story 1 - Breathe with a guided preset (Priority: P1) 🎯 MVP

**Goal**: Guided breathing with standard presets (Box 4-4-4-4 default) runs from the home screen
with voice cues, get-ready countdown, and sign-off, with screen-off timing and ducking.

**Independent Test**: BC1–BC6, BC12, BC14, BD1–BD4, engine-level run, BU1–BU3 pass; on device,
B1, B2, B6, and B15 pass.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [ ] T007 [P] [US1] Write src/modes/breathe.test.ts: `breatheDefinition` table tests for BD1–BD4 (defaults give 5s prep + 11 cycles of 4-4-4-4 = 45 phases, 181s; zero-duration holds omitted; passes `validateDefinition`); cue handler tests for BC1–BC6, BC12, BC14 (`isPhaseStart` voice cues for prep, inhale, hold, exhale, post-hold; prep beeps at remaining 3, 2, 1; completion chime + sign-off; nothing on other seconds); `breatheMode.id === 'breathe'`, `route === '/breathe'`
- [ ] T008 [P] [US1] Add to src/modes/breathe.test.ts block "engine run": start a short session (1 cycle of 4-4-4-4, 5s prep) through `SessionController` with all fakes, advance `FakeScheduler`, and assert the `(cue type/text, at − T0)` sequence reaching `FakeCuePlayer` from prep countdown through inhale, hold, exhale, post-hold, and completion chime + sign-off
- [ ] T009 [P] [US1] Write src/screens/BreatheScreen.test.tsx (mock session, breathe store, keep screen on): settings view displays preset selection, target duration, calculated cycles, total duration, and Start button (BU2, BU3); tapping Start invokes `controller.start(breatheDefinition(settings))`; running session displays live view with phase title and cycle count
- [ ] T010 [P] [US1] Update src/screens/HomeScreen.test.tsx: Breathe tile has no "Coming soon" and navigates to `/breathe`; add to src/components/LaunchCheck.test.tsx that Resume of a `breathe` session pushes `/breathe` (BU1; extend the `@/modes` mock)

### Implementation for User Story 1

- [ ] T011 [US1] Implement `breatheDefinition`, cue handler for Voice cues, and `breatheMode` in src/modes/breathe.ts to pass T007; register in src/modes/index.ts
- [ ] T012 [US1] Make T008 pass (ensure cue timing and session definition wiring match engine expectations)
- [ ] T013 [P] [US1] Implement src/screens/BreatheScreen.tsx (settings view with preset summary and Start button; live view container with Controls) to pass T009; add src/app/breathe.tsx re-exporting it and register "Breathe" screen title in src/app/_layout.tsx
- [ ] T014 [US1] Make Breathe tile interactive in src/screens/HomeScreen.tsx (navigates to `/breathe`, `modeId: BREATHE_MODE_ID`) to pass T010
- [ ] T015 [US1] On device: run quickstart B1, B2, B6, and B15; capture timing log for SC-001

**Checkpoint**: Default breathing session runs end to end. MVP.

---

## Phase 4: User Story 2 - Customize breath patterns and session duration (Priority: P2)

**Goal**: Presets and − / + steppers for breath phases (inhale, hold, exhale, post-hold) and target
minutes, cycles and actual total updating live, persisted and repaired if out of range.

**Independent Test**: BS1–BS3, BS5 pass; on device, B7–B10 pass.

### Tests for User Story 2 (write first, confirm they fail) ⚠️

- [ ] T016 [P] [US2] Add to src/breathe/settings.test.ts table tests: `adjust`/`canAdjust` per field at, below, and above each limit (BS1); `applyPreset` sets breath phases and target minutes, and `matchingPreset` returns the preset for an exact match and null when any value differs (BS2); `calculateCycles` and `totalSec` accuracy across various durations (BS3)
- [ ] T017 [P] [US2] Add to src/breathe/store.test.ts: BS5, readable v1 JSON is repaired field by field (inhale clamped 1–30, holds clamped 0–30, targetMinutes clamped 1–30, invalid cueStyle defaulted to 'voice', invalid booleans defaulted) while valid fields are kept
- [ ] T018 [P] [US2] Add to src/screens/BreatheScreen.test.tsx with real `BreatheStore` over `MemoryStore`: tapping presets updates fields and marks preset selected; + / − steppers update settings, unmark presets when custom, and update calculated cycles and total time live; 0s holds display as "Off"

### Implementation for User Story 2

- [ ] T019 [US2] Implement `adjust`, `canAdjust`, `applyPreset`, `matchingPreset`, `calculateCycles`, and `totalSec` in src/breathe/settings.ts to pass T016
- [ ] T020 [US2] Add field-by-field repair to `parseBreathe` in src/breathe/store.ts to pass T017
- [ ] T021 [US2] Add presets row and five steppers to settings view in src/screens/BreatheScreen.tsx to pass T018 (using reusable `@/components/Stepper`)
- [ ] T022 [US2] On device: run quickstart B7–B10

**Checkpoint**: Breath patterns and duration are customizable and survive app restarts.

---

## Phase 5: User Story 3 - Visual pacer and cue audio styles (Priority: P3)

**Goal**: Visual expanding/contracting breath pacer animation, Count and Tones audio styles,
prep countdown toggle, keep screen on, and ended summary view.

**Independent Test**: BC7–BC11, BC13, BU4–BU7 pass; on device, B3–B5, B11–B14 pass.

### Tests for User Story 3 (write first, confirm they fail) ⚠️

- [ ] T023 [P] [US3] Add to src/modes/breathe.test.ts: Count style tests (BC7, BC8: phase name spoken at start, seconds 2, 3, 4 counted aloud); Tones style tests (BC9–BC11, BC13: beeps for inhale, hold, exhale, chime only on completion with no speech)
- [ ] T024 [P] [US3] Write src/components/BreatheLiveView.test.tsx: renders current phase title, cycle counter ("Cycle X of Y"), phase seconds countdown, animated pacer container, and paused indicator (BU4, BU5)
- [ ] T025 [P] [US3] Add to src/screens/BreatheScreen.test.tsx: audio cue style selector updates store; prep countdown toggle enables/disables 5s prep phase; keep screen on toggle updates store and invokes `useKeepScreenOn`; ended view shows "Complete" or "Stopped" with total elapsed time and "Start again" action (BU6, BU7)
- [ ] T026 [P] [US3] Add to src/screens/HomeScreen.test.tsx: Breathe tile shows "In progress" while a breathe session is running or paused, and not for other sessions or when idle

### Implementation for User Story 3

- [ ] T027 [US3] Add Count and Tones cue generation to cue handler in src/modes/breathe.ts to pass T023
- [ ] T028 [P] [US3] Implement src/components/BreatheLiveView.tsx with smooth `Animated` circle scaling (`useNativeDriver: true`) to pass T024
- [ ] T029 [US3] Add audio cue style selector, prep countdown switch, keep-screen-on switch, ended view, and `useKeepScreenOn` to src/screens/BreatheScreen.tsx to pass T025
- [ ] T030 [US3] Verify Breathe tile "In progress" badge in src/screens/HomeScreen.tsx to pass T026
- [ ] T031 [US3] On device: run quickstart B3–B5, B11–B14

**Checkpoint**: All three stories work together. Visual pacer, counting, tones, and customization complete.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T032 [P] Update README.md: move Breathe from "coming soon" to working features, with brief description and link to specs/004-breathe/
- [ ] T033 Review spec against implementation; update spec.md, plan.md, research.md, data-model.md, contracts where implementation diverged (Principle IX)
- [ ] T034 Verify no `.md` or markdown document references were added in code, comments, or tests
- [ ] T035 Run `npm test`, `npm run typecheck`, `expo lint`, `npx expo-doctor`, and local Android release build (`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`); confirm permissions are unchanged
- [ ] T036 Open PR from `004-breathe` to `develop` (after explicit go-ahead), listing on-device checks B1–B15

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories.
- **US1 (Phase 3)**: depends on Foundational. Delivers MVP.
- **US2 (Phase 4)**: depends on Foundational (settings, store) and US1 screen (T013).
- **US3 (Phase 5)**: depends on US1 mode (T011), live view integration (T013), and US2 steppers (T021).
- **Polish (Phase 6)**: runs after all user stories are complete.

### Within Each Phase

- Write test tasks first, run to confirm failure (red), then implement (green), refactor, commit.
- `src/screens/BreatheScreen.tsx` is extended incrementally by T013 (US1), T021 (US2), and T029 (US3).
- `src/modes/breathe.ts` is extended by T011 (US1 voice) and T027 (US3 count & tones).

---

## Parallel Execution Opportunities

- **Foundational**: T002 and T003 tests together; T004 and T006 implementation together.
- **US1**: T007–T010 tests together in parallel.
- **US2**: T016–T018 tests together in parallel.
- **US3**: T023–T026 tests together in parallel.
