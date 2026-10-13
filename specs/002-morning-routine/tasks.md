---

description: "Task list for spec 002: morning routine"
---

# Tasks: Morning Routine

**Input**: Design documents from `/specs/002-morning-routine/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/routine.md](./contracts/routine.md),
[quickstart.md](./quickstart.md)

**Tests**: Development is test-first (constitution Principle VII). In every phase, test tasks come
first. Run them and confirm they **fail** before starting the implementation tasks below them.
Guarantee IDs (RC1–RC9, RS1–RS4, UI1–UI9) refer to [contracts/routine.md](./contracts/routine.md);
spec 001 IDs (C3, E16) to [../001-cue-engine/contracts/](../001-cue-engine/contracts/); on-device
checks (R1–R15) to [quickstart.md](./quickstart.md). Commit the failing tests (`test(002): …`),
then the code that passes them (`feat(002): …`).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US3)
- Paths are relative to the repository root. Tests sit next to the code as `*.test.ts(x)`. Nothing
  but routes lives in `src/app/`; screens live in `src/screens/` and route files re-export them.
- Reuse spec 001 test helpers: `FakeClock`/`FakeScheduler` (src/test-utils/fakeClock.ts),
  `FakeCuePlayer`/`FakeBackgroundHost`/`MemoryStore` (src/test-utils/fakes.ts). RNTL 14's
  `render`/`fireEvent` are async; `renderRouter` returns a promise that also has `getPathname()`.

---

## Phase 1: Setup

**Purpose**: Confirm the starting point. No new dependencies (plan).

- [x] T001 Confirm the branch `002-morning-routine` is based on `develop` with spec 001 merged, and `npm run check` is green before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Spec 001 amendments (research R3, R8, R9) and the routine data layer every story
needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [x] T002 [P] Add to src/session/controller.test.ts block "notification": C3 amendment: phases with a `subtitle` produce `"<subtitle>: <title>"` in `background.start()` text and in phase-change updates, and `"Paused · <subtitle>: <title>"` when paused; phases without a subtitle keep the existing text (existing tests stay green)
- [x] T003 [P] Add to src/components/BatteryLink.test.tsx: renders the link when `backgroundHost.canRequestBatteryExemption` is true and nothing when false (mock `@/platform/background`; remove the `Platform.OS` overrides); add to src/platform/background.android.test.ts that the Android host reports `canRequestBatteryExemption: true`
- [x] T004 [P] Add to src/components/LaunchCheck.test.tsx: Resume pushes the recovered mode's `route` (mock `@/modes` with modes `sample` → `/sample` and `routine` → `/routine`), and `/` for an unknown mode; update src/modes/registry.test.ts and src/modes/sample.test.ts for the `route` field (`sampleMode.route === '/sample'`)
- [x] T005 [P] Write src/routine/defaults.test.ts: `defaultRoutine(newId)` has the six steps and durations from data-model.md, unique ids from `newId`, version 1; exported limits `MIN_STEP_SEC = 15`, `MAX_STEP_SEC = 3600`, `MAX_STEPS = 30`, `MAX_TITLE = 60`
- [x] T006 [P] Write src/routine/store.test.ts for `parseRoutine` (round-trip of a valid routine; rejects null, bad JSON, version ≠ 1, empty steps, > 30 steps, duplicate ids, a non-string title, a duration that is not null or an integer in 15–3600) and `RoutineStore` with a `MemoryStore`: RS1 (nothing stored or an invalid value → default returned and saved under `routine:v1`), RS2 (`update` notifies subscribers and saves the full routine), RS3 (a new `RoutineStore` on the same data returns the last saved routine), RS4 (`restoreDefault` saves a default with fresh ids)

### Implementation

- [x] T007 Update `SessionController` notification text in src/session/controller.ts to pass T002 (a private `phaseText(phase)` used by `background.start()` and `updateNotification`); amend C3 in specs/001-cue-engine/contracts/platform.md
- [x] T008 Add `canRequestBatteryExemption: boolean` to `BackgroundHost` in src/platform/background.ts, set it in src/platform/background.android.ts (true), src/platform/background.ios.ts (false) and `FakeBackgroundHost` in src/test-utils/fakes.ts; make src/components/BatteryLink.tsx use it instead of `Platform.OS` to pass T003; update the spec 001 research implementation note and contracts/platform.md
- [x] T009 Add `route: string` to `ModeDefinition` in src/modes/types.ts, `route: '/sample'` in src/modes/sample.ts, and route by `modes.get(definition.modeId)?.route ?? '/'` in src/components/LaunchCheck.tsx to pass T004 (use `Href` typing from expo-router for `router.push`)
- [x] T010 [P] Create src/routine/types.ts (`Step`, `Routine` per data-model.md) and src/routine/defaults.ts (`defaultRoutine`, limits) to pass T005
- [x] T011 Implement `parseRoutine`, `ROUTINE_KEY` and `RoutineStore` in src/routine/store.ts to pass T006 (sync load on first `get()`, fire-and-forget writes with `console.warn` on failure)
- [x] T012 [P] Create src/routine/ids.ts (production id generator: `Date.now()` and a counter in base 36) and src/routine/useRoutine.ts (app-wide `RoutineStore` over `kvStore`, `useSyncExternalStore` hook returning `{ routine, store }`)

**Checkpoint**: Spec 001 amendments in, routine data layer tested. `npm run check` green.

---

## Phase 3: User Story 1 - Run my morning routine with spoken guidance (Priority: P1) 🎯 MVP

**Goal**: The default routine runs from the home screen with every announcement, warning, beep,
and the sign-off, with spec 001's screen-off timing and ducking.

**Independent Test**: RC1–RC9, the engine-level run, UI1–UI3 basics and UI9 pass; on device, R1–R5
and R10 pass.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [x] T013 [P] [US1] Write src/modes/routine.test.ts: `routineDefinition` maps steps to phases (title or "Step N" for blank titles, subtitle "Step N of M", `durationSec`, kind `step`), title "Morning routine", `keepScreenOn: true`, mode `routine`, and passes `validateDefinition`; the handler's table tests for RC1–RC9 with boundaries (15, 29, 30, 179, 180 s steps; last step vs. not; untimed step at sec 0 and sec 500); `routineMode.id === 'routine'`, `route === '/routine'`
- [x] T014 [P] [US1] Add to src/modes/routine.test.ts block "engine run": start the default routine through `SessionController` with all spec 001 fakes, advance the `FakeScheduler`, skip the untimed steps, and assert the sequence of `(cue type/text, at − T0)` reaching `FakeCuePlayer` for step 1 (greeting at 0, "10 seconds." at 50 s, beeps at 57/58 s, beepLast at 59 s, step 2 announcement at 60 s), that step 2 never advances in 10 minutes without skip, and the completion chime + sign-off at the end
- [x] T015 [P] [US1] Write src/screens/RoutineScreen.test.tsx (mock `@/session/useSession`, `@/routine/useRoutine`, `@/session/useKeepScreenOn`): start view lists each step's title and "1:00"/"untimed", shows "Total 12:00" for the default, and Start calls `controller.start(routineDefinition(routine))`; live view (routine session running) shows the SessionView with "Step 2 of 6", a Done button that calls `controller.skip()`, Controls, and no Edit; a running sample session shows the start view
- [x] T016 [P] [US1] Update src/screens/HomeScreen.test.tsx: Morning routine has no "Coming soon" and navigates to `/routine`; Run / walk and Breathe still show "Coming soon" (so 2 "Coming soon" labels)

### Implementation for User Story 1

- [x] T017 [US1] Implement `routineDefinition`, the cue handler and `routineMode` in src/modes/routine.ts using `spokenDuration` from src/format/clock.ts to pass T013; register it in src/modes/index.ts
- [x] T018 [US1] Make T014 pass (fix any handler or wiring issue it shows; no engine changes expected)
- [x] T019 [P] [US1] Create src/components/DoneButton.tsx (`size: 'large' | 'compact'`, accessible label "Done", calls `onPress`)
- [x] T020 [US1] Implement src/screens/RoutineScreen.tsx (start view and live view using SessionView, DoneButton, Controls) to pass T015; add src/app/routine/index.tsx re-exporting it, and a `routine/index` screen titled "Morning routine" in src/app/_layout.tsx
- [x] T021 [US1] Make Morning routine a live tile in src/screens/HomeScreen.tsx (pressable, opens `/routine`, keeps its description) to pass T016
- [ ] T022 [US1] On device: run quickstart R1–R5 and R10, and R15 (recovery opens the routine screen); capture the timing log for SC-002

**Checkpoint**: The default routine runs end to end. MVP.

---

## Phase 4: User Story 2 - Make the routine my own (Priority: P1)

**Goal**: A separate Edit screen with rename, duration, untimed, add, move, delete with undo, and
restore default; every change saved immediately.

**Independent Test**: The edit-operation table tests, UI6–UI8 and RS3 pass; on device, R11–R13
pass.

### Tests for User Story 2 (write first, confirm they fail) ⚠️

- [ ] T023 [P] [US2] Write src/routine/edit.test.ts (table tests per data-model.md "Edit operations"): `normaliseDuration` (rounds; 0, 5, 14 → 15; 3601 → 3600; NaN → 15), `updateStep` (title clamped to 60, duration normalised, `null` for untimed, unknown id is a no-op), `addStep` (appends `{ title: '', durationSec: 120 }`, no-op at 30), `moveStep` (up/down, no-op at the ends), `deleteStep` (returns `removed` with its index; no-op on the only step), `restoreStep` (back at its index, at the end if the list shrank, no-op if the id exists or at 30)
- [ ] T024 [P] [US2] Write src/components/StepEditor.test.tsx: title input (maxLength 60) calls `onChange({ title })`; Untimed switch toggles between `null` and the last timed duration (or 120 s); minutes/seconds inputs call `onChange({ durationSec })` with the normalised value on blur ("0" and "5" → 0:15); move up/down disabled at the ends; Delete disabled when `canDelete` is false
- [ ] T025 [P] [US2] Write src/components/UndoBar.test.tsx with Jest fake timers: shows "Step deleted" and an Undo button; Undo calls `onUndo`; `onExpire` is called after 5 s; a new `key` restarts the 5 s
- [ ] T026 [P] [US2] Write src/screens/RoutineEditScreen.test.tsx with a real `RoutineStore` over `MemoryStore` (mock `@/routine/useRoutine` to return it): editing a title updates the store; Add step adds a row (disabled at 30); move and delete change the order; delete shows the undo bar and Undo restores the step in place; "Restore default routine" shows Confirm/Cancel, where Cancel keeps the edits and Confirm restores the default
- [ ] T027 [P] [US2] Add to src/screens/RoutineScreen.test.tsx: Edit navigates to `/routine/edit` (use `renderRouter` or a mocked `router.push`); Edit is hidden while a routine session is running or paused, and shown when idle or after it ends

### Implementation for User Story 2

- [ ] T028 [US2] Implement src/routine/edit.ts to pass T023
- [ ] T029 [P] [US2] Implement src/components/StepEditor.tsx to pass T024 (minutes and seconds `TextInput`s with `keyboardType="number-pad"`, normalise on blur, accessible labels per field)
- [ ] T030 [P] [US2] Implement src/components/UndoBar.tsx to pass T025
- [ ] T031 [US2] Implement src/screens/RoutineEditScreen.tsx (StepEditor rows in a ScrollView, Add step, in-place restore confirmation, UndoBar) to pass T026; add src/app/routine/edit.tsx re-exporting it and a `routine/edit` screen titled "Edit routine" in src/app/_layout.tsx
- [ ] T032 [US2] Add the Edit button and its visibility rule to src/screens/RoutineScreen.tsx to pass T027
- [ ] T033 [US2] On device: run quickstart R11–R13

**Checkpoint**: The routine is editable and survives restarts.

---

## Phase 5: User Story 3 - See where I am at a glance (Priority: P2)

**Goal**: The step list with done/current/upcoming, a compact Done on timed steps, "All done" and
"Stopped" views, "In progress" on home, the screen kept on, and the notification text.

**Independent Test**: UI1 ("In progress"), UI3–UI5 pass; on device, R6–R9 and R14 pass.

### Tests for User Story 3 (write first, confirm they fail) ⚠️

- [ ] T034 [P] [US3] Write src/components/StepList.test.tsx: for a current index, earlier steps are marked done (accessible state or label "done"), the current one "current", later ones "upcoming"; when the session is done all are done; durations show as m:ss or "untimed"
- [ ] T035 [P] [US3] Add to src/screens/RoutineScreen.test.tsx: the live view renders StepList with the current index and updates after a state change; Done is large on an untimed step and compact on a timed step; the ended view shows "All done" (done) or "Stopped" (stopped) with Start again; `useKeepScreenOn` receives the routine definition and status while live, and `undefined` when another mode's session is running
- [ ] T036 [P] [US3] Add to src/screens/HomeScreen.test.tsx: the Morning routine tile shows "In progress" while a routine session is running or paused (mock `@/session/useSession`), and not for a sample session or when idle

### Implementation for User Story 3

- [ ] T037 [P] [US3] Implement src/components/StepList.tsx to pass T034
- [ ] T038 [US3] Finish src/screens/RoutineScreen.tsx (StepList, Done size by step type, ended view, `useKeepScreenOn` with the live routine only) to pass T035
- [ ] T039 [US3] Show "In progress" on the Morning routine tile in src/screens/HomeScreen.tsx to pass T036
- [ ] T040 [US3] On device: run quickstart R6–R9 and R14

**Checkpoint**: All three stories work on their own.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T041 [P] Update README.md: Morning routine moves from "coming later" to what works today, with a one-line description and a link to specs/002-morning-routine/
- [ ] T042 Review the spec against what was built; update spec.md, plan.md, research.md, data-model.md or contracts where the implementation diverged, including the spec 001 amendments (Principle IX)
- [ ] T043 Run `npm run check`, `npx expo-doctor`, and a local release build (`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`); confirm the merged manifest's permissions are unchanged from spec 001 (no new permissions)
- [ ] T044 Open the PR from `002-morning-routine` to `develop` (after explicit go-ahead), listing the on-device checks R1–R15 and their results or pending status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories. T007–T009 touch spec 001
  files; T010–T012 are new files.
- **US1 (Phase 3)**: depends on Foundational. The MVP.
- **US2 (Phase 4)**: depends on Foundational (store); T027/T032 extend the routine screen from
  T020.
- **US3 (Phase 5)**: depends on US1's routine screen (T020) and home tile (T021). Independent of
  US2 apart from shared screen files.
- **Polish (Phase 6)**: after the stories.

### Within Each Phase

- Test tasks first, run, confirm red → implementation → green → refactor → commit.
- src/screens/RoutineScreen.tsx is extended by T020, T032 and T038 in order; the same goes for its
  test file (T015, T027, T035) and for HomeScreen (T016/T021, T036/T039).

### Parallel Opportunities

- Foundational tests T002–T006 together; T010 and T012 alongside T007–T009.
- US1 tests T013–T016 together; T019 alongside T017.
- US2 tests T023–T027 together; T029 and T030 together after T028.
- US3 tests T034–T036 together; T037 alongside the others.
- After US1, US2 and US3 can proceed in parallel except for the shared RoutineScreen and
  HomeScreen files.

---

## Parallel Example: User Story 2

```text
# Write all US2 tests together (different files):
T023 src/routine/edit.test.ts
T024 src/components/StepEditor.test.tsx
T025 src/components/UndoBar.test.tsx
T026 src/screens/RoutineEditScreen.test.tsx
T027 src/screens/RoutineScreen.test.tsx (Edit button)

# Then the independent components together:
T029 src/components/StepEditor.tsx
T030 src/components/UndoBar.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (amendments and data layer).
2. Phase 3 (US1) → **stop and validate** with R1–R5 on the device: the default routine already
   gives a guided morning.

### Incremental Delivery (suggested slices)

1. Slice A: Setup + Foundational (T001–T012).
2. Slice B: US1 (T013–T022), the MVP.
3. Slice C: US2 (T023–T033).
4. Slice D: US3 (T034–T040).
5. Slice E: Polish and PR (T041–T044).

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Each story phase ends with an on-device task; the steps are already written in quickstart.md.
- The cue handler and edit operations stay pure (no React Native imports); `npm run check` must
  stay green after every implementation task.
