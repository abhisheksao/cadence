# Research: Guided Breathing (Breathe)

Decisions for [plan.md](./plan.md). Spec 001's research (R1–R12), spec 002's (R1–R10), and spec 003's (R1–R9) still apply. Engine wall-clock timing, audio ducking, the Android foreground service, local storage, recovery, and home screen tile states are reused unchanged, except where noted below.

## R1. Breathe mode architecture & session definition

- **Decision**: A `breatheMode` (`id: 'breathe'`, `route: '/breathe'`) in `src/modes/breathe.ts`, registered in `src/modes/index.ts`. `breatheDefinition(settings)` translates settings into a plain `SessionDefinition<BreatheVoice>`:
  - If `prepEnabled` is true, begins with `{ kind: 'prep', title: 'Get ready', durationSec: 5 }`.
  - Loops `cycles` times where `cycles = Math.max(1, Math.round((targetMinutes * 60) / cycleSec))` with `cycleSec = inhaleSec + holdSec + exhaleSec + postHoldSec`:
    - `{ kind: 'inhale', title: 'Inhale', subtitle: 'Cycle c of cycles', durationSec: inhaleSec }`
    - If `holdSec > 0`: `{ kind: 'hold', title: 'Hold', subtitle: 'Cycle c of cycles', durationSec: holdSec }`
    - `{ kind: 'exhale', title: 'Exhale', subtitle: 'Cycle c of cycles', durationSec: exhaleSec }`
    - If `postHoldSec > 0`: `{ kind: 'post-hold', title: 'Hold', subtitle: 'Cycle c of cycles', durationSec: postHoldSec }`
  - `title: 'Breathe'`, `keepScreenOn: settings.keepScreenOn`.
  - `settings`: `{ cueStyle: settings.cueStyle }`.
- **Rationale**: Keeps the cue handler pure. Zero-duration holds are excluded directly from the phase list so the engine transitions immediately between Inhale and Exhale (required for Coherent and 4-7-8 breathing). Storing `cueStyle` inside the session definition guarantees that crash recovery plays the exact same cue style chosen by the user when the session began.
- **Alternatives considered**:
  - Scheduling 0-second phases: breaks cue engine assumptions and causes simultaneous cue collision.
  - Dynamically computing cycles at engine runtime: breaks wall-clock predictability and recovery.

## R2. Audio cue styles and dispatch rules

- **Decision**: The cue handler supports three distinct audio styles (`'voice'`, `'count'`, `'tones'`):
  1. **Preparation (all styles)**: At `sec === 0`, `say "Get ready to breathe."` (with `interrupt: true`). At remaining 3, 2: `beep`; at 1: `beepLast`.
  2. **Voice style (`'voice'`)**: At `isPhaseStart`, speaks the phase title: `"Inhale."`, `"Hold."`, `"Exhale."`, `"Hold."` with `interrupt: true`. No cues on intermediate seconds.
  3. **Count style (`'count'`)**: At `isPhaseStart`, speaks the phase title (`"Inhale."`, etc.). On each subsequent second (`sec >= 1` and `sec < durationSec`), speaks the current second count aloud (`"2"`, `"3"`, `"4"`, etc.).
  4. **Tones style (`'tones'`)**: At `isPhaseStart`, emits gentle tone cues with no speech: Inhale plays `beep`, Exhale plays `beepLast`, Hold / Post-Hold plays `beep`.
  5. **Completion (all styles)**: Plays `chime` at session completion, followed by `say "Breathing complete. Well done."` at `+700ms` (voice/count) or chime only (tones).
- **Rationale**: Breathwork is highly personal. Voice cues provide standard conversational guidance; count cues provide strict metronome pacing for structured breathing techniques (like 4-7-8); tones provide pure audio chimes suitable for eyes-closed, quiet meditation without verbal chatter.
- **Alternatives considered**:
  - Generating raw audio tone frequencies via WebAudio: React Native lacks built-in low-latency WebAudio; reusing spec 001's audio assets (`beep`, `beepLast`, `chime`) provides reliable, ducked playback without new native dependencies.

## R3. Settings storage and field repair

- **Decision**: Persist settings under key `breathe:v1` in the spec 001 `KeyValueStore`.
  Shape:
  ```ts
  {
    version: 1,
    inhaleSec: number,     // 1–30
    holdSec: number,       // 0–30
    exhaleSec: number,     // 1–30
    postHoldSec: number,   // 0–30
    targetMinutes: number, // 1–30
    prepEnabled: boolean,
    cueStyle: 'voice' | 'count' | 'tones',
    keepScreenOn: boolean
  }
  ```
  `parseBreathe` inspects stored JSON:
  - If null, unparseable, non-object, or `version !== 1`, returns `null` (falling back to Box Breathing defaults).
  - Otherwise repairs every field individually: numeric values are clamped and stepped to valid integer ranges, and missing/invalid enum or boolean flags receive their safe defaults.
- **Rationale**: Follows the robust pattern from Spec 003 (`parseRunWalk`). Individual corrupted keys don't reset the user's other personalized preferences.
- **Alternatives considered**: Strict schema validation rejecting any modified key (resets entire configuration unnecessarily).

## R4. Visual breathing pacer animation

- **Decision**: In `src/components/BreatheLiveView.tsx`, use React Native's standard `Animated` API with `useNativeDriver: true`.
  - Inhale: animates circle scale smoothly from `0.4` to `1.0` over `inhaleSec * 1000` ms.
  - Hold: maintains scale at `1.0`.
  - Exhale: animates circle scale smoothly from `1.0` to `0.4` over `exhaleSec * 1000` ms.
  - Post-hold: maintains scale at `0.4`.
  - When paused, calls `Animated.timing(...).stop()`; when resumed, recalculates remainder and resumes.
- **Rationale**: `Animated.timing` with `useNativeDriver: true` runs transformations on the native render thread at 60/120 fps without JavaScript bridge overhead or frame drops.
- **Alternatives considered**:
  - Reanimated library: introduces external native dependencies not bundled in the core project.
  - CSS SVG animations: higher overhead in React Native.

## R5. Session length calculation & display

- **Decision**:
  - `cycleSec = inhaleSec + holdSec + exhaleSec + postHoldSec`.
  - `cycles = Math.max(1, Math.round((targetMinutes * 60) / cycleSec))`.
  - `totalSec = (prepEnabled ? 5 : 0) + cycles * cycleSec`.
  - Formatted display: `"Target: M min • N cycles • Total M:SS"`.
- **Rationale**: Rounding to the nearest integer cycle ensures the user always completes a harmonious breathing cycle rather than getting abruptly cut off mid-exhale. Clamping to `Math.max(1, ...)` guarantees that even with a 1-minute target on a long cycle (like 4-7-8), at least one full cycle will execute.
