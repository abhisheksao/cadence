# Implementation Plan: Cue Engine and Background Session

**Branch**: `001-cue-engine` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cue-engine/spec.md`

## Summary

Build the foundation all Cadence modes share: a pure TypeScript cue engine that works out each
phase and second from the wall clock and hands latency-compensated cues to an audio layer; a
session controller that runs the engine inside an Android foreground service, ducks other audio,
saves a recovery record, and offers to resume after an OS kill; and the app shell (Expo Router
home screen + a sample session) with Jest and React Native Testing Library set up from the first
commit so every behaviour is written test-first. The approach follows a prior implementation
proven on the reference device, with the changes the spec asks for (catch-up announces one phase,
the 3-second Back rule, real ducking, recovery, timing log). Details: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2, React Native 0.86 (New Architecture,
Hermes)

**Primary Dependencies**: Expo SDK 57; `expo-router`, `expo-audio`, `expo-speech`,
`expo-keep-awake`, `expo-intent-launcher`, `expo-sqlite` (kv-store), `expo-constants`;
`react-native-background-actions` 4.1 (foreground service); all added with `npx expo install`

**Storage**: `expo-sqlite/kv-store` (session record, "asked" flag)

**Testing**: Jest with `jest-expo` preset, `@testing-library/react-native`; hand-written
`FakeClock`/`FakeScheduler`; on-device checklist in [quickstart.md](./quickstart.md)

**Target Platform**: Android (Expo SDK 57 minimum API level) primary, verified on a physical device; iOS builds and
shows screens (background in spec 008)

**Project Type**: Mobile app (Expo, Continuous Native Generation)

**Performance Goals**: beeps ≤ 150 ms and speech ≤ 300 ms from due second (p95, screen off);
zero cumulative drift over 60 min; controls take effect ≤ 300 ms

**Constraints**: offline; no analytics; notification updated only on phase/pause changes; engine
has no React Native imports; no hand-edited `android/`/`ios/`

**Scale/Scope**: one user, one session at a time; sessions up to ~2 h; 3 screens in this spec
(home, sample session, resume prompt)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Screen-off reliability**: foreground service (R5); engine timing from the wall clock
  via an injected `Clock` (R1, R2)
- [x] **II. Duck, never pause**: `duckOthers` requests transient ducking focus per sound and
  releases it; speech ducked via a silent-clip focus hold (R3)
- [x] **III. Offline & private**: no network code; timing log stays on-device with no user text;
  each permission justified in R5
- [x] **IV. Android-first, iOS-ready**: `BackgroundHost` port with `.android.ts`/`.ios.ts`; no
  `Platform.OS` branches in shared code. iOS blocker noted: background execution needs spec 008
- [x] **V. CNG**: foreground service type via `plugins/withBackgroundActions.js`; permissions in
  `app.json`; `android/` and `ios/` stay git-ignored
- [x] **VI. Local builds**: `expo run:android` and Gradle only (quickstart §2)
- [x] **VII. Test-first**: every guarantee E1–E16 / C1–C8 and the pure helpers get a failing test
  first; on-device checks D1–D11 are written as tasks before the code they verify
- [x] **VIII. Quality gates**: strict TS; `npm run check` = lint + typecheck + tests; deps via
  `npx expo install`; ESLint config added in setup
- [x] **IX. Traceability**: research R1 changed the clock decision (monotonic → wall clock with a
  backwards guard), so spec FR-004 and the clock-change edge case were updated in this branch

**Post-design re-check (after Phase 1)**: still passing. The only new runtime code that touches
native APIs is behind the three ports in [contracts/platform.md](./contracts/platform.md).

## Project Structure

### Documentation (this feature)

```text
specs/001-cue-engine/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R12
├── data-model.md        # Phase 1: entities, state machine, recovery rules
├── quickstart.md        # Phase 1: automated + on-device validation
├── contracts/
│   ├── engine.md        # Engine, CueHandler, ModeDefinition + guarantees E1–E16
│   ├── platform.md      # CuePlayer, BackgroundHost, KeyValueStore, SessionController (C1–C8)
│   └── timing-log.md    # Log line format and report script
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/                         # Expo Router routes only (thin re-exports; no tests here)
│   ├── _layout.tsx              # Stack; renders LaunchCheck (recovery prompt)
│   ├── index.tsx                # → screens/HomeScreen
│   └── sample.tsx               # → screens/SampleScreen
├── screens/                     # HomeScreen, SampleScreen (+ RNTL tests)
├── engine/                      # Pure TS, no React Native imports
│   ├── clock.ts                 # Clock, Scheduler, system implementations
│   ├── types.ts
│   ├── engine.ts
│   └── engine.test.ts
├── session/
│   ├── types.ts                 # SessionDefinition, SessionRecord, snapshots
│   ├── validate.ts (+ .test.ts)
│   ├── record.ts (+ .test.ts)   # serialise + assessRecord (pure)
│   ├── controller.ts (+ .test.ts)
│   ├── useKeepScreenOn.ts (+ .test.ts)
│   └── useSession.ts
├── audio/
│   ├── types.ts                 # CuePlayer
│   ├── latency.ts (+ .test.ts)  # TTS latency average, schedule offsets (pure)
│   ├── timingLog.ts (+ .test.ts)
│   └── cuePlayer.ts             # expo-audio + expo-speech adapter
├── platform/
│   ├── background.ts            # BackgroundHost interface
│   ├── background.android.ts    # background library, permissions, battery exemption
│   └── background.ios.ts        # placeholder until spec 008
├── storage/
│   └── kv.ts                    # KeyValueStore over expo-sqlite/kv-store
├── modes/
│   ├── types.ts, registry.ts
│   └── sample.ts (+ .test.ts)   # sample mode: definition + cues, 60-minute soak
├── format/
│   └── clock.ts (+ .test.ts)    # m:ss, spoken durations, time of day
├── components/                  # SessionView, Controls, BatteryLink, ResumePrompt, LaunchCheck (+ RNTL tests)
└── test-utils/                  # FakeClock, FakeScheduler, fake ports
plugins/withBackgroundActions.js # foreground service type (config plugin)
scripts/
├── gen-sounds.mjs               # generates assets/sounds/*.wav
├── timing-report.mjs            # FR-022b
└── __fixtures__/                # sample logs for the report tests
assets/sounds/                   # beep.wav, beep-last.wav, chime.wav, silence.wav
```

**Structure Decision**: single Expo app. `src/app/` holds routes only (AGENTS.md). Pure logic
(`engine/`, `session/record.ts`, `audio/latency.ts`, `modes/`) is separated from adapters
(`audio/cuePlayer.ts`, `platform/`, `storage/`) so it can be tested without native mocks.
Tests sit next to the code they cover.

## Implementation Approach

Ordered so each slice is test-first and leaves `npm run check` green:

1. **Setup**: Expo Router install and entry change, remove `App.tsx`/`index.ts`, Jest +
   RNTL + ESLint, `@/*` alias, scripts (`test`, `lint`, `typecheck`, `check`), app.json
   plugins and permissions, config plugin, sound generator and assets.
2. **Engine** (US1, US2): fake clock/scheduler first, then E1–E16 one test at a time.
3. **Audio** (US1, US3): latency maths and timing-log formatting (pure, tested); then the
   `expo-audio`/`expo-speech` adapter with `duckOthers` and the silent-clip hold.
4. **Session controller** (US1, US2, US4): C1–C8 against fakes; background host for Android;
   record writing; `useSession`.
5. **Recovery** (clarification 1): `assessRecord` table tests, launch check, resume prompt.
6. **Shell** (US5): home screen, sample mode, sample screen (short + 60-min soak), keep-awake,
   RNTL tests for what the user sees and taps.
7. **Device validation**: quickstart D1–D11 and the timing report on the reference device.

## Risks

| Risk | Mitigation |
|---|---|
| Silent-clip ducking feels choppy between close cues | Keep the hold across cues < 1.5 s apart; tune on device; native focus in 006 |
| Background library breaks on RN 0.86 New Architecture | Prior implementation ran on the same SDK; if it fails, pull spec 006's native service forward |
| Forward clock change jumps the session | Documented in spec; real fix (sleep-proof clock) in 006 |
| OEM kills despite exemption | Recovery (FR-023–026) limits the damage; D10 checks `am_kill` |

## Complexity Tracking

No constitution violations to justify.
