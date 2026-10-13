# Implementation Plan: Run / Walk

**Branch**: `003-run-walk` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-run-walk/spec.md`

## Summary

Add the second mode on the spec 001 cue engine. The workout settings are a small versioned JSON
value in the existing key-value store, changed only through pure, table-tested step and preset
operations and a `RunWalkStore`. Starting a workout turns a snapshot of the settings into a plain
`SessionDefinition` (mode `run-walk`): get-ready, warm-up, run/walk rounds, cool-down. Its pure cue
handler speaks each phase with its round, says "<Phase> ends in" and beeps the last 3 seconds,
and adds the optional time-left and halfway cues. Recovery after an OS kill, the notification,
"In progress" on the home tile, and every timing/audio guarantee come from specs 001 and 002
unchanged. One screen is added (settings / live / ended), with a Stepper and a run/walk live view.
One spec amendment: the notification text follows the spec 002 rule ("Round 3 of 8: Run").
Details: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2, React Native 0.86 (New Architecture,
Hermes)

**Primary Dependencies**: Expo SDK 57 and the spec 001 stack (`expo-router`, `expo-audio`,
`expo-speech`, `expo-keep-awake`, `expo-sqlite` kv-store). **No new dependencies.**

**Storage**: `expo-sqlite/kv-store` via the spec 001 `KeyValueStore`; new key `run-walk:v1`

**Testing**: Jest (`jest-expo`), React Native Testing Library 14, spec 001 fakes (`FakeClock`,
`FakeScheduler`, `FakeCuePlayer`, `FakeBackgroundHost`, `MemoryStore`); on-device checklist in
[quickstart.md](./quickstart.md)

**Target Platform**: Android primary (OnePlus 3, Android 9); iOS builds and shows the screen
(background in spec 008)

**Project Type**: Mobile app (Expo, Continuous Native Generation)

**Performance Goals**: cue accuracy as spec 001 SC-001 (beeps ≤ 150 ms, speech ≤ 300 ms p95,
screen off); setting changes saved and visible immediately

**Constraints**: offline; no new permissions; the cue handler is pure and reads only the
definition; no `Platform.OS` branches (Principle IV); text through `@/components/Text` (OnePlus
font fix)

**Scale/Scope**: one settings value; 1–30 rounds, up to 63 phases; 1 new screen plus the home tile

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Screen-off reliability**: workouts run through the spec 001 controller, engine and
  foreground service; no new timing code (R1)
- [x] **II. Duck, never pause**: only the existing cue types (`say`, `beep`, `beepLast`, `chime`)
  are used, so ducking is unchanged (R2)
- [x] **III. Offline & private**: settings stay in on-device storage; no network code and no new
  permissions; the timing log carries no spoken text
- [x] **IV. Android-first, iOS-ready**: no platform-specific code added
- [x] **V. CNG**: no native configuration changes
- [x] **VI. Local builds**: unchanged (quickstart §2)
- [x] **VII. Test-first**: every guarantee WC1–WC14, WD1–WD4, WS1–WS6 and WU1–WU8 gets a failing
  test first; on-device checks W1–W15 are tasks
- [x] **VIII. Quality gates**: strict TS; `npm run check`; no dependency changes
- [x] **IX. Traceability**: FR-018 and User Story 3 scenario 5 are amended in this branch to the
  notification text the design produces (R5)

**Post-design re-check (after Phase 1)**: still passing. The new code is pure logic (mode,
settings, parse), a store over the existing port, and one screen with two components.

## Project Structure

### Documentation (this feature)

```text
specs/003-run-walk/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R9
├── data-model.md        # Phase 1: settings, presets, definition mapping
├── quickstart.md        # Phase 1: automated + on-device validation (W1–W15)
├── contracts/
│   └── run-walk.md      # Mode cues, settings, store, screen
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files are marked `+`, changed files `~`.

```text
src/
├── app/
│   ├── _layout.tsx                    ~ screen title for run-walk
│   └── run-walk.tsx                   + → screens/RunWalkScreen
├── runWalk/                           + pure logic and store (no React Native imports except useRunWalk)
│   ├── types.ts                         RunWalkSettings, RunWalkField, Preset
│   ├── settings.ts (+ .test.ts)         defaults, limits, PRESETS, adjust, canAdjust, applyPreset, matchingPreset, totalSec
│   ├── store.ts (+ .test.ts)            parseRunWalk, RunWalkStore, RUN_WALK_KEY
│   └── useRunWalk.ts                    hook over the app's RunWalkStore
├── modes/
│   ├── runWalk.ts (+ .test.ts)        + runWalkDefinition, runWalkMode, cue handler
│   └── index.ts                       ~ register runWalkMode
├── screens/
│   ├── HomeScreen.tsx (+ test)        ~ live Run / walk tile with "In progress"
│   └── RunWalkScreen.tsx (+ test)     + settings / live / ended views
└── components/
    ├── Stepper.tsx (+ test)           + label, value, − / + with disabled limits
    └── RunWalkLiveView.tsx (+ test)   + coloured phase, round, time left, elapsed / total, next
```

**Structure Decision**: same single Expo app as specs 001–002. Run/walk logic lives in
`src/runWalk/` (pure, plus one hook), the mode in `src/modes/`, and the screen in `src/screens/`.
The route in `src/app/` only re-exports.

## Implementation Approach

Ordered so each slice is test-first and leaves `npm run check` green:

1. **US1 core**: settings types, defaults and limits, `parseRunWalk` and `RunWalkStore` (load and
   default), `runWalkDefinition`, the mode and cue handler (WC1–WC10, WC13), an engine-level run
   of a short workout, the screen's settings view with Start (defaults only) and live view, and
   the home tile.
2. **US2**: `adjust`, `canAdjust`, presets and `matchingPreset`, `totalSec`, field-by-field
   repair in `parseRunWalk`, the Stepper, presets and steppers on the screen, persistence across a
   new store instance.
3. **US3**: time-left and halfway cues (WC11, WC12) and the voice switches, the live view's
   colours, next phase and elapsed/total, keep screen on, the ended view, the notification
   amendment in the spec.
4. **Polish**: README section, spec review (Principle IX), `npm run check`, expo-doctor, local
   release build; on-device checks W1–W15 on the OnePlus 3.

## Complexity Tracking

No constitution violations.
