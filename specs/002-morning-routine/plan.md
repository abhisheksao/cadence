# Implementation Plan: Morning Routine

**Branch**: `002-morning-routine` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-morning-routine/spec.md`

## Summary

Add the first real mode on the spec 001 cue engine. The user's routine is a small versioned JSON
value in the existing key-value store, edited through pure, table-tested operations and a
`RoutineStore`. Starting it turns a snapshot of the steps into a plain `SessionDefinition` (mode
`routine`), whose cue handler speaks each step, the warnings and the sign-off, and beeps the last
seconds. Recovery after an OS kill and every timing/audio guarantee come from spec 001 unchanged.
Two screens are added (routine with start/live views, and Edit), and the home tile becomes live.
Three small spec 001 amendments: notification text from the phase subtitle, mode routes for
recovery, and a port flag replacing the `Platform.OS` check in `BatteryLink`. Details:
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2, React Native 0.86 (New Architecture,
Hermes)

**Primary Dependencies**: Expo SDK 57 and the spec 001 stack (`expo-router`, `expo-audio`,
`expo-speech`, `expo-keep-awake`, `expo-sqlite` kv-store). **No new dependencies.**

**Storage**: `expo-sqlite/kv-store` via the spec 001 `KeyValueStore`; new key `routine:v1`

**Testing**: Jest (`jest-expo`), React Native Testing Library 14, `expo-router/testing-library`,
spec 001 fakes (`FakeClock`, `FakeScheduler`, `FakeCuePlayer`, `FakeBackgroundHost`,
`MemoryStore`); on-device checklist in [quickstart.md](./quickstart.md)

**Target Platform**: Android primary (physical device); iOS builds and shows the screens (background
in spec 008)

**Project Type**: Mobile app (Expo, Continuous Native Generation)

**Performance Goals**: cue accuracy as spec 001 SC-001 (beeps ≤ 150 ms, speech ≤ 300 ms p95,
screen off); edits saved and visible immediately

**Constraints**: offline; no new permissions; the mode's cue handler is pure and reads only the
definition; no `Platform.OS` branches for platform concerns (Principle IV)

**Scale/Scope**: one routine, 1–30 steps, steps 15 s–60 min; 2 new screens (routine, Edit) plus
the home tile

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Screen-off reliability**: routine sessions run through the spec 001 controller, engine
  and foreground service; no new timing code (R1)
- [x] **II. Duck, never pause**: only spec 001 cue types (`say`, `beep`, `beepLast`, `chime`) are
  used, so ducking is unchanged (R2)
- [x] **III. Offline & private**: the routine stays in on-device storage; no network code and no
  new permissions; the timing log still carries no spoken text
- [x] **IV. Android-first, iOS-ready**: no platform-specific code added. R9 removes spec 001's
  `Platform.OS` check in `BatteryLink` by moving it behind the `BackgroundHost` port
- [x] **V. CNG**: no native configuration changes
- [x] **VI. Local builds**: unchanged (quickstart §2)
- [x] **VII. Test-first**: every guarantee RC1–RC9, RS1–RS4 and UI1–UI9 gets a failing test
  first; on-device checks R1–R15 are tasks
- [x] **VIII. Quality gates**: strict TS; `npm run check`; no dependency changes
- [x] **IX. Traceability**: spec 001 contracts are amended in this branch (C3 notification text,
  `BackgroundHost` flag, LaunchCheck routing); FR-007 in this spec now says "routine session",
  matching clarification Q5

**Post-design re-check (after Phase 1)**: still passing. The new code is pure logic (mode, edits,
parse), a store over the existing port, and screens.

## Project Structure

### Documentation (this feature)

```text
specs/002-morning-routine/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: Step, Routine, edits, definition mapping
├── quickstart.md        # Phase 1: automated + on-device validation (R1–R15)
├── contracts/
│   └── routine.md       # Mode cues, store, screens, spec 001 amendments
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files are marked `+`, changed files `~`.

```text
src/
├── app/
│   ├── _layout.tsx                 ~ screen titles for routine/index and routine/edit
│   └── routine/
│       ├── index.tsx               + → screens/RoutineScreen
│       └── edit.tsx                + → screens/RoutineEditScreen
├── routine/                        + pure logic and store (no React Native imports except useRoutine)
│   ├── types.ts                      Step, Routine
│   ├── defaults.ts (+ .test.ts)      defaultRoutine(newId), limits
│   ├── edit.ts (+ .test.ts)          updateStep, addStep, moveStep, deleteStep, restoreStep, normaliseDuration
│   ├── store.ts (+ .test.ts)         parseRoutine, RoutineStore, ROUTINE_KEY
│   ├── ids.ts                        production id generator
│   └── useRoutine.ts                 hook over the app's RoutineStore
├── modes/
│   ├── types.ts                    ~ ModeDefinition.route
│   ├── sample.ts                   ~ route '/sample'
│   ├── routine.ts (+ .test.ts)     + routineDefinition, routineMode, cue handler
│   └── index.ts                    ~ register routineMode
├── screens/
│   ├── HomeScreen.tsx (+ test)     ~ live Morning routine tile with "In progress"
│   ├── RoutineScreen.tsx (+ test)  + start / live / ended views
│   └── RoutineEditScreen.tsx (+ test) + step rows, add, restore, undo
├── components/
│   ├── StepList.tsx (+ test)       + done / current / upcoming list
│   ├── DoneButton.tsx (+ test)     + large or compact Done
│   ├── StepEditor.tsx (+ test)     + one editable step row
│   ├── UndoBar.tsx (+ test)        + "Step deleted · Undo", 5 s
│   ├── BatteryLink.tsx (+ test)    ~ uses backgroundHost.canRequestBatteryExemption
│   └── LaunchCheck.tsx (+ test)    ~ routes by mode
├── session/controller.ts (+ test)  ~ notification text "<subtitle>: <title>"
├── platform/background*.ts         ~ canRequestBatteryExemption
└── test-utils/fakes.ts             ~ FakeBackgroundHost flag
```

**Structure Decision**: same single Expo app as spec 001. Routine logic lives in `src/routine/`
(pure, plus one hook), the mode in `src/modes/`, and screens in `src/screens/`. Routes in
`src/app/` only re-export.

## Implementation Approach

Ordered so each slice is test-first and leaves `npm run check` green:

1. **Spec 001 amendments**: notification subtitle text (C3), `ModeDefinition.route` and
   LaunchCheck routing, the `canRequestBatteryExemption` port flag and BatteryLink.
2. **US1 core**: routine types, defaults, `parseRoutine` and `RoutineStore` (load and default),
   the routine mode and cue handler, an engine-level run of the default routine, the routine
   screen start/live/ended views with Done, and the home tile.
3. **US2**: pure edit operations, the Edit screen (rows, add, move, delete with undo, restore
   with confirm), and persistence across a new store instance.
4. **US3**: step list states, compact Done on timed steps, "In progress", keep-awake wiring, and
   the notification check.
5. **Polish**: README section, spec review (Principle IX), `npm run check`, expo-doctor, local
   release build; on-device checks R1–R15 run when a device is available.

## Complexity Tracking

No constitution violations.
