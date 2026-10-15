# Implementation Plan: Guided Breathing (Breathe)

**Branch**: `004-breathe` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-breathe/spec.md`

## Summary

Add the third mode on top of the spec 001 cue engine: guided paced breathing. Settings are persisted as a versioned JSON value (`breathe:v1`) in the existing `KeyValueStore`, managed via a reactive `BreatheStore`. Starting an exercise converts settings into a plain `SessionDefinition` (mode `breathe`) with whole cycles calculated from the target duration (`Math.max(1, Math.round((targetMinutes * 60) / cycleSec))`). The pure cue handler supports three audio guidance styles (spoken phase names, counting seconds aloud, or gentle tones) with music ducking and screen-off reliability. UI features include an animated breathing circle pacer, steppers, preset selector, and session controls.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2, React Native 0.86 (New Architecture, Hermes)

**Primary Dependencies**: Expo SDK 57 and the spec 001 stack (`expo-router`, `expo-audio`, `expo-speech`, `expo-keep-awake`, `expo-sqlite` kv-store). **No new dependencies.**

**Storage**: `expo-sqlite/kv-store` via the spec 001 `KeyValueStore`; new key `breathe:v1`

**Testing**: Jest (`jest-expo`), React Native Testing Library 14, spec 001 fakes (`FakeClock`, `FakeScheduler`, `FakeCuePlayer`, `FakeBackgroundHost`, `MemoryStore`); on-device checklist in [quickstart.md](./quickstart.md)

**Target Platform**: Android primary (physical device); iOS builds and renders the screen (background audio handled in spec 008)

**Project Type**: Mobile app (Expo, Continuous Native Generation)

**Performance Goals**: Cue accuracy adhering to spec 001 SC-001 (sound tones ≤ 150 ms, speech ≤ 300 ms p95, screen off); 60 fps visual pacer animation

**Constraints**: Completely offline; no new permissions; pure cue handler reading only definition; no `Platform.OS` branches in shared logic (Principle IV); text rendered via `@/components/Text` (OnePlus font fix); no markdown file references in code or comments

**Scale/Scope**: One settings object; 1–30 min sessions (up to ~180 phases); 1 new screen (`BreatheScreen`), 1 new live view (`BreatheLiveView`), and live home tile integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Screen-off reliability**: Breathing exercises run through the spec 001 controller, engine, and foreground service; no ad-hoc timer ticks.
- [x] **II. Duck, never pause**: Cues use existing cue types (`say`, `beep`, `beepLast`, `chime`); audio ducks music and never pauses it.
- [x] **III. Offline & private**: Settings stay in local on-device SQLite storage; no network requests, analytics, or external telemetry.
- [x] **IV. Android-first, iOS-ready**: All platform-specific interactions use the existing platform abstraction ports; zero platform branching in breathe logic.
- [x] **V. CNG**: No native folder modifications; standard configuration via Expo config plugins.
- [x] **VI. Local builds**: Built locally via Gradle APK / `expo run:android`; no EAS or cloud build services.
- [x] **VII. Test-first**: All guarantees (BC1–BC14, BD1–BD4, BS1–BS6, BU1–BU7) have tests written and confirmed failing before implementation; on-device checklist (B1–B15) defined in [quickstart.md](./quickstart.md).
- [x] **VIII. Quality gates**: Strict TypeScript; clean lint (`expo lint`), clean typecheck (`tsc --noEmit`), and green test suite (`npm test`).
- [x] **IX. Traceability**: Spec, research, data model, contracts, and plan are synchronized; any divergence will be updated in place.

**Post-design re-check (after Phase 1)**: All gates pass. The design introduces pure domain logic in `src/breathe/`, a registered mode in `src/modes/breathe.ts`, a dedicated screen in `src/screens/BreatheScreen.tsx`, and a visual pacer component in `src/components/BreatheLiveView.tsx`.

## Project Structure

### Documentation (this feature)

```text
specs/004-breathe/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions R1–R5
├── data-model.md        # Phase 1: settings, presets, session definition mapping
├── contracts/
│   └── breathe.md       # Mode cues, settings, store, and UI contract guarantees
├── quickstart.md        # Phase 1: automated + on-device validation checklist (B1–B15)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files marked `+`, modified files `~`.

```text
src/
├── app/
│   ├── _layout.tsx                    ~ register screen title for breathe
│   └── breathe.tsx                    + re-export screens/BreatheScreen
├── breathe/                           + pure logic, settings, and store
│   ├── types.ts                         BreatheSettings, BreatheField, BreathePreset, BreatheCueStyle, BreatheVoice
│   ├── settings.ts (+ .test.ts)         defaults, limits, PRESETS, adjust, canAdjust, applyPreset, matchingPreset, calculateCycles, totalSec
│   ├── store.ts (+ .test.ts)            parseBreathe, BreatheStore, BREATHE_KEY
│   └── useBreathe.ts                    React hook over the app's BreatheStore
├── modes/
│   ├── breathe.ts (+ .test.ts)        + breatheDefinition, breatheMode, cue handler
│   └── index.ts                       ~ register breatheMode
├── screens/
│   ├── HomeScreen.tsx (+ test)        ~ live Breathe tile with "In progress" badge
│   └── BreatheScreen.tsx (+ test)     + settings / live / ended views
└── components/
    └── BreatheLiveView.tsx (+ test)   + animated expanding/contracting breath pacer, phase clock, cycle indicator
```

## Implementation Approach

Ordered for incremental, test-first delivery (red → green → refactor):

1. **Foundational (Settings & Store)**:
   - Define types in `src/breathe/types.ts`.
   - Implement `defaultSettings()`, `adjust`, `canAdjust`, `applyPreset`, `matchingPreset`, `calculateCycles`, `totalSec` in `src/breathe/settings.ts` to pass unit tests.
   - Implement `parseBreathe` with field-by-field repair and `BreatheStore` in `src/breathe/store.ts`.
   - Implement `useBreathe` hook.
2. **User Story 1 (P1 - Core Guided Breathing Session & Presets)**:
   - Implement `breatheDefinition` and cue handler in `src/modes/breathe.ts` to pass BC1–BC6, BC12, BC14, BD1–BD4.
   - Register `breatheMode` in `src/modes/index.ts`.
   - Build `BreatheScreen.tsx` settings view (presets and Start button) and route `src/app/breathe.tsx`.
   - Activate Breathe tile on `HomeScreen.tsx`.
3. **User Story 2 (P2 - Custom Breath Timing & Duration)**:
   - Connect `Stepper` components for Inhale, Hold, Exhale, Post-Hold, and Target Minutes in `BreatheScreen.tsx`.
   - Real-time recalculation of cycles and actual total duration.
   - Field clamping and local storage persistence.
4. **User Story 3 (P3 - Visual Pacer, Counting, and Audio Cue Styles)**:
   - Implement `BreatheLiveView.tsx` with smooth scale animation (`useNativeDriver: true`).
   - Add Counting (`BC7`, `BC8`) and Tones (`BC9`–`BC11`, `BC13`) to the cue handler.
   - Add audio cue style selector, prep countdown toggle, keep-screen-on switch, and ended view in `BreatheScreen.tsx`.
5. **Polish & Verification**:
   - Update README.md (Breathe status).
   - Run `npm test`, `npm run typecheck`, `expo lint`, and local Android release build (`./gradlew assembleRelease`).
   - Verify zero markdown file references in code or comments.

## Complexity Tracking

No constitution violations or exceptions required.
