# Feature Specification: Guided Breathing (Breathe)

**Feature Branch**: `004-breathe`

**Created**: 2026-10-15

**Status**: Ready for Planning

**Input**: User description: "Guided paced breathing mode (spec 004, builds on the spec 001 cue engine). Presets (4-7-8, 3-4-7, 4-4-4 box, coherent), custom cycle configuration (inhale, hold, exhale, hold), target minutes duration with auto-calculated cycles, and audio cue options (Voice, Counted, and Tones). Spoken-cue timers that keep working with the screen off: paced breathing with gentle cues for each breath."

## Overview

Breathe is the third mode built on top of the spec 001 cue engine. It guides the user through paced breathing exercises for relaxation, focus, stress relief, and sleep. Users often practice breathing with their eyes closed or phone in a pocket, so the app provides clear, rhythmic audio guidance that cues each phase (inhale, hold, exhale, hold) without requiring the user to look at the screen.

When the screen is visible, a clean visual pacer (expanding and contracting animation) shows the current breath phase, remaining phase time, cycle count, and session progress.

Everything that makes timing and audio reliable comes from spec 001 and is reused unchanged: wall-clock timing with the screen off, audio ducking over background music/podcasts, session controls (pause, resume, skip, back, stop), ongoing notification, and recovery after an unexpected process restart.

## Clarifications

### Session 2026-10-15

- Q: What cueing styles should be supported? → A: Support all three styles:
  1. **Voice**: announces phase changes ("Inhale", "Hold", "Exhale", "Hold").
  2. **Count**: announces phase start and counts remaining seconds aloud ("Inhale", "2", "3", "4"...).
  3. **Tones**: plays gentle, distinct tone/chime frequencies per phase without spoken words (ideal for meditation / eyes-closed practice).
- Q: How is session length configured? → A: Target minutes only (e.g. 1 to 30 minutes, 1-minute steps). The system calculates the number of full breath cycles required (`Math.max(1, Math.round((targetMinutes * 60) / cycleSec))`) and displays the actual total time and cycle count.
- Q: How long should the preparation / get-ready phase be? → A: Fixed 5 seconds ("Get ready to breathe" with 3, 2, 1 beeps) with a toggle to disable preparation and start immediately.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Breathe with a guided preset (Priority: P1) 🎯 MVP

The user opens Breathe from the home screen, selects a breathing preset (e.g., Box Breathing 4-4-4-4 or 4-7-8) with a target duration (e.g. 3 minutes), and taps Start. If preparation is enabled, a gentle 5-second get-ready cue plays, and the app cues each breath phase in rhythm. The user can close their eyes or turn off the screen; the cues continue precisely on time, ducking other audio, and the session concludes with a soft completion chime and sign-off after completing the calculated number of cycles.

**Why this priority**: This is the core value proposition of the mode. With standard presets and rhythmic audio guidance, users can immediately complete an effective breathing exercise hands-free and eyes-closed.

**Independent Test**: On a fresh install, open Breathe, select Box Breathing, target 1 minute (calculated to 4 cycles = 64s + 5s prep), tap Start, lock the phone, and verify that inhale, hold, exhale, and hold cues play in exact 4-second intervals, finishing with the completion chime at the end of cycle 4.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user taps Breathe, **Then** the Breathe screen opens with the default preset selected, target duration, calculated cycles, actual duration, and Start button. Breathe is no longer marked "Coming soon".
2. **Given** the Breathe screen with preparation enabled, **When** the user taps Start, **Then** a gentle get-ready cue plays ("Get ready to breathe" with 3-2-1 countdown beeps), followed by the first inhale.
3. **Given** preparation is toggled off, **When** the user taps Start, **Then** the session begins immediately on the first inhale.
4. **Given** Box Breathing (4-4-4-4), **When** cycling through a round, **Then** each phase transition is cued on time: Inhale (4s), Hold (4s), Exhale (4s), Hold (4s), repeating for all calculated cycles.
5. **Given** a preset with zero hold (such as 4-7-8 which has 0s post-exhale hold, or Coherent breathing with 0s holds), **When** reaching that zero-duration phase, **Then** that phase is omitted seamlessly without pauses or silence gaps.
6. **Given** the final cycle completes, **Then** the session plays the completion chime followed by a calm closing announcement ("Breathing complete. Well done.").
7. **Given** the session is active with screen off or music playing, **Then** cues fire strictly according to wall-clock time and duck background music without pausing it (spec 001 guarantees).

---

### User Story 2 - Customize breath patterns and session duration (Priority: P2)

The user can choose between standard breathing presets (Box 4-4-4-4, 4-7-8, 3-4-7, Coherent 5-5) or customize each phase duration (Inhale, Hold after inhale, Exhale, Hold after exhale) and target minutes using steppers. Adjustments update the calculated cycle count and actual duration live, persist across app restarts, and are validated against safe boundaries.

**Why this priority**: Different breathing practices require different ratios (calming sleep practices use prolonged exhalations; focus practices use equal box ratios; coherent practices use resonant smooth cycles). Customization allows users to tailor the exercise to their physiology and practice level.

**Independent Test**: Select the 4-7-8 preset (19s cycle), set target duration to 2 minutes (calculated to 6 cycles = 114s), customize Inhale to 5s (20s cycle, 6 cycles = 120s), observe live recalculations, restart the app, and verify all values persist.

**Acceptance Scenarios**:

1. **Given** the Breathe screen, **When** tapping a preset button (Box, 4-7-8, 3-4-7, Coherent), **Then** Inhale, Hold, Exhale, Post-Hold, and default target minutes update immediately to match the preset, and the matching preset is highlighted.
2. **Given** any phase duration (Inhale, Hold after inhale, Exhale, Hold after exhale), **When** adjusted via − / + steppers, **Then** values change in 1-second steps within allowed bounds (Inhale: 1–30s, Holds: 0–30s, Exhale: 1–30s).
3. **Given** target duration is adjusted via − / + steppers, **Then** it changes in 1-minute steps within 1 to 30 minutes.
4. **Given** any duration change, **Then** the calculated cycle count and actual total time update immediately.
5. **Given** a customized setting that deviates from all presets, **Then** no preset chip is highlighted.
6. **Given** any customized values, **When** closing and reopening the app, **Then** the customized values are restored exactly as left.

---

### User Story 3 - Visual pacer and cue audio styles (Priority: P3)

When looking at the screen, the user sees an animated visual pacer (expanding circle on inhale, holding steady on hold, contracting on exhale) with the phase name, time remaining in the phase, cycle progress ("Cycle 2 of 8"), and standard playback controls. The user can also toggle between audio cue styles (Voice cues, Counting aloud, or Gentle tones).

**Why this priority**: Visual feedback is helpful for users who keep their phone on a desk or stand, and cue style preferences vary widely (some prefer spoken words, others find voice distracting and prefer soft tones, while beginners benefit from counted seconds).

**Independent Test**: Start a session with visual pacer active; verify the animation expands smoothly on inhale and contracts on exhale. Switch cue style to "Tones" and verify distinct pitch tones play instead of voice prompts. Switch to "Count" and verify seconds are counted aloud.

**Acceptance Scenarios**:

1. **Given** an active session, **When** viewing the live screen, **Then** an animated breathing pacer expands during Inhale, remains expanded during Hold, contracts during Exhale, and remains contracted during empty Hold.
2. **Given** an active session, **When** viewing the live screen, **Then** the current phase label, current cycle ("Cycle X of Y"), phase countdown timer, and session controls (Pause, Resume, Skip, Back, Stop) are displayed.
3. **Given** audio cue style is set to "Voice", **Then** the app announces each phase transition ("Inhale", "Hold", "Exhale", "Hold").
4. **Given** audio cue style is set to "Count", **Then** the app speaks the phase name at second 0 and counts each remaining second aloud ("Inhale", "2", "3", "4"...).
5. **Given** audio cue style is set to "Tones", **Then** the app plays a soft higher pitch tone for Inhale, steady chime for Hold, and lower pitch tone for Exhale with no spoken speech.
6. **Given** the "Keep screen on" toggle is enabled, **Then** the screen remains awake throughout the breathing session.

---

### Edge Cases

- **Zero-duration hold phases**: When a hold is set to 0 seconds (e.g. Coherent breathing: 5s Inhale, 0s Hold, 5s Exhale, 0s Hold), the engine MUST NOT schedule a 0-second phase or emit a hold cue; it must immediately transition between Inhale and Exhale.
- **Short sessions (1 minute target)**: Even for short target durations with long cycle times (e.g. 1 minute target with 4-7-8 19s cycles), at least 1 full cycle is always scheduled (`Math.max(1, ...)`).
- **Rapid skipping / controls**: If the user taps Next or Previous rapidly while cues are playing, active audio MUST stop immediately without overlapping or hanging duck state (handled by spec 001 cue player).
- **Session interruption & recovery**: If the app is killed mid-session by the operating system, relaunching the app MUST offer to resume the breathing session at the appropriate cycle and phase based on the elapsed wall clock (spec 001 recovery).
- **Corrupted stored settings**: If stored JSON settings in persistent storage are missing or corrupted, the system MUST fallback safely to default Box Breathing (4-4-4-4, 3 minutes) without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide four standard breathing presets:
  - **Box Breathing**: Inhale 4s, Hold 4s, Exhale 4s, Hold 4s, default target 3 min (11 cycles).
  - **4-7-8 Breathing**: Inhale 4s, Hold 7s, Exhale 8s, Hold 0s, default target 2 min (6 cycles).
  - **3-4-7 Breathing**: Inhale 3s, Hold 4s, Exhale 7s, Hold 0s, default target 2 min (9 cycles).
  - **Coherent Breathing**: Inhale 5s, Hold 0s, Exhale 5s, Hold 0s, default target 5 min (30 cycles).
- **FR-002**: System MUST allow configuring Inhale (1–30s), Hold after Inhale (0–30s), Exhale (1–30s), Hold after Exhale (0–30s), and Target Minutes (1–30 min).
- **FR-003**: System MUST calculate the number of whole breath cycles as `Math.max(1, Math.round((targetMinutes * 60) / cycleDurationSec))` where `cycleDurationSec = inhaleSec + holdSec + exhaleSec + postHoldSec`.
- **FR-004**: System MUST calculate and display the actual session total time (including 5s preparation if enabled) dynamically as settings change.
- **FR-005**: System MUST omit any phase whose duration is 0 seconds from the generated session phases.
- **FR-006**: System MUST generate a valid `SessionDefinition` with `modeId: 'breathe'` and compatible phase kinds so it executes via the existing cue engine (`SessionController`).
- **FR-007**: System MUST support configurable audio cue styles:
  - `'voice'`: Speaks phase transitions ("Inhale", "Hold", "Exhale", "Hold").
  - `'count'`: Speaks phase name at start and counts remaining seconds aloud ("2", "3", ...).
  - `'tones'`: Plays distinct audio tone cues for each phase (inhale, hold, exhale, hold) with no speech.
- **FR-008**: System MUST support an optional 5-second get-ready preparation countdown ("Get ready to breathe" with 3-2-1 countdown beeps), which can be toggled on/off.
- **FR-009**: System MUST persist the user's latest settings across application restarts in local storage.
- **FR-010**: System MUST provide a live visual breathing guide that expands on inhale and contracts on exhale.
- **FR-011**: System MUST display the active phase name, current cycle counter ("Cycle X of Y"), phase time remaining, and standard playback controls on the live session screen.
- **FR-012**: System MUST support an optional "Keep screen on" toggle during active breathing sessions.
- **FR-013**: System MUST update the Home Screen "Breathe" tile to remove the "Coming soon" badge, make it interactive, route to `/breathe`, and show "In progress" during an active breathe session.
- **FR-014**: System MUST provide an ended summary view upon session completion or stop, displaying total elapsed breathing time and a button to start again.

### Key Entities

- **BreatheSettings**: The persistent configuration representing the user's preferences:
  - `inhaleSec`: number (1–30, step 1)
  - `holdSec`: number (0–30, step 1)
  - `exhaleSec`: number (1–30, step 1)
  - `postHoldSec`: number (0–30, step 1)
  - `targetMinutes`: number (1–30, step 1)
  - `prepEnabled`: boolean
  - `cueStyle`: `'voice' | 'count' | 'tones'`
  - `keepScreenOn`: boolean
- **BreathePreset**: Predefined configuration template with `id`, `name`, `description`, `inhaleSec`, `holdSec`, `exhaleSec`, `postHoldSec`, and `targetMinutes`.
- **BreathePhaseKind**: Phase discriminator within a cycle: `'prep' | 'inhale' | 'hold' | 'exhale' | 'post-hold'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of breath phase cues fire within ±50ms of scheduled wall-clock time under screen-off conditions, verified via timing log analysis.
- **SC-002**: Users can select any preset and start a guided session in under 3 taps from the home screen.
- **SC-003**: Zero audio overlap or music interruption during cues; all audio cue events transiently duck music and release focus cleanly.
- **SC-004**: 100% test coverage of breathe cycle generation, boundary clamping, store persistence, and phase scheduling logic.

## Assumptions

- **Default Preset**: Box Breathing (4-4-4-4, 3 minutes target, 5s preparation enabled) is the default configuration on initial launch.
- **Cue Player Audio**: Spec 001's audio cue engine (`CuePlayer`) supports speech synthesis and beep/sound playback; tone frequencies can be mapped cleanly to breath events.
- **Zero-duration Phases**: Phases with 0s are dropped completely, ensuring seamless transition between Inhale and Exhale for hold-less exercises (such as Coherent breathing).
- **Steppers**: Settings will use the reusable `Stepper` component introduced in Spec 003.
