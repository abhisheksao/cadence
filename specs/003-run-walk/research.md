# Research: Run / Walk

Decisions for [plan.md](./plan.md). Spec 001's research (R1–R12) and spec 002's (R1–R10) still
apply. Engine timing, audio, the background service, storage, recovery, mode routes, and the home
tile's "In progress" are reused unchanged, except where noted below.

## R1. Run/walk as a mode on the spec 001 registry

- **Decision**: A `runWalkMode` (`id: 'run-walk'`, `route: '/run-walk'`) in
  `src/modes/runWalk.ts`, registered in `src/modes/index.ts`. `runWalkDefinition(settings)` turns
  a snapshot of the settings into a `SessionDefinition`:
  - phases, in order: `ready` (10 s), `warmup` (if > 0), then per round `run` and `walk` (the last
    walk left out when there is a cool-down), then `cooldown` (if > 0);
  - titles "Get ready", "Warm up", "Run", "Walk", "Cool down"; runs and walks get
    `subtitle: "Round N of M"`;
  - `title: 'Run / walk'`, `keepScreenOn: settings.keepScreenOn`;
  - `settings`: `{ announceRound, halfway, timeLeft }` (the voice options the cues need).
- **Rationale**: Spec 001 recovery rebuilds cues from the stored definition (FR-015). Round
  numbers and "last round" are derived from the phases (count of `run` phases), so the handler
  needs only the three voice flags from `settings`. A recovered workout gets the same cues even if
  the stored settings changed since.
- **Alternatives considered**: storing the full settings object in `settings` and rebuilding phases
  in the handler (duplicates the phases; two sources of truth); a round number field on `Phase`
  (engine type change for one mode).

## R2. Cue rules

- **Decision**: In `cueFor`, first match wins:
  1. `isPhaseStart` → one `say` with `interrupt: true` (wording in FR-009; "Last round." when the
     run is the last `run` phase, round part left out when `announceRound` is off).
  2. `remaining === null` → nothing (no untimed phases in this mode; defensive).
  3. `remaining === 5` and kind ≠ `ready` → `say "<title> ends in"`.
  4. `remaining` 3, 2 → `beep`; `remaining` 1 → `beepLast` if a next phase exists, else `beep`.
  5. Otherwise, if kind ≠ `ready` and `sec >= 5`: build `halfway` (`halfway` on, kind `run`,
     `durationSec >= 120`, `sec === floor(durationSec / 2)`) and `left` (`timeLeft` on,
     `remaining > 5`, `remaining % 30 === 0`). If either holds, one `say` of
     `"Halfway."`, `"<spokenDuration(remaining)> left."`, or both joined by a space.
  - `completion` → `chime`, then `say "Workout complete. Great job."` at `offsetMs: 700`.
- **Rationale**: Matches FR-009–FR-013 and the clarified countdown (Q2): "ends in" at 5 s leaves
  about 2 s for the phrase before the first beep at 3 s. The beeps are the routine's, so ducking
  and latency are already measured. With phases ≥ 15 s, the start phrase (≤ about 3 s) always ends
  before "ends in" at `sec ≥ 10`. Time-left never collides with the countdown (`remaining > 5`)
  or the start phrase (`sec ≥ 5`). Halfway on runs ≥ 120 s is at `sec ≥ 60`, far from both.
- **Alternatives considered**: interrupting with "ends in" (nothing can still be speaking at that
  point, so it buys nothing); a separate "halfway" phrase a second later than time-left (two
  phrases back to back are harder to follow than one).

## R3. Settings storage and range handling

- **Decision**: One JSON value under `run-walk:v1` in the spec 001 `KeyValueStore`. Shape:
  `{ version: 1, warmupSec, runSec, walkSec, rounds, cooldownSec, announceRound, halfway, timeLeft,
  keepScreenOn }`. A `RunWalkStore` (in `src/runWalk/store.ts`) mirrors `RoutineStore`: loads
  synchronously on first use, keeps the value in memory, notifies subscribers, and writes the
  whole value on every change. `parseRunWalk` returns null for unreadable JSON or another version
  (then the defaults are used and saved). Unlike the routine, a readable v1 value with an
  out-of-range or missing field is repaired, not rejected: each number is snapped to its step and
  clamped into range, and each missing or non-boolean flag takes its default (FR-005).
- **Rationale**: The settings are a handful of numbers, so repairing one bad field keeps the rest
  of the user's choices. The routine rejects because a broken step list has no safe repair.
- **Alternatives considered**: a generic settings store shared with spec 004 (premature: 004's
  shape is not known; extract then if the two match).

## R4. Values and steps

- **Decision**: Pure `adjust(settings, field, direction)` in `src/runWalk/settings.ts` adds or
  subtracts the field's step (run/walk 15 s, rounds 1, warm-up/cool-down 60 s) and clamps to the
  range. `canAdjust(settings, field, direction)` tells the Stepper whether − or + is enabled.
  `applyPreset(settings, preset)` sets run, walk and rounds only. `matchingPreset(settings)`
  returns the preset whose run, walk and rounds all match, or null. `totalSec(settings)` sums the
  phases of `runWalkDefinition(settings)`, so the shown total always equals the session's length.
- **Rationale**: Table-testable, and the screen holds no arithmetic (clarification Q5: step
  buttons only).

## R5. Notification text

- **Decision**: Keep the spec 002 controller rule, `"<subtitle>: <title>"`. Run/walk
  notifications therefore read "Round 3 of 8: Run", "Warm up", "Cool down", with `Paused · ` in
  front while paused. The spec's FR-018 and User Story 3 scenario 5 are amended to this format in
  this branch (Principle IX).
- **Rationale**: The same rule gives the routine "Step 2 of 6: Stretch", so both modes read the
  same way, and no per-mode notification hook is needed.
- **Alternatives considered**: an optional `notificationText(phase)` on `ModeDefinition` to get
  "Run · Round 3 of 8" (new API for one string, and the two modes would differ).

## R6. Phase colours and the live view

- **Decision**: A `RunWalkLiveView` component shows the phase title (in the phase colour), the
  round subtitle, the time left, `elapsed / total`, the paused badge, and "Next: <title> <m:ss>".
  Colours: run `#FF7A45` (the app accent), walk, warm-up and cool-down `#2EA043` (green), get-ready
  in the normal text colour. Both colours keep at least 3:1 contrast on the light and dark
  backgrounds for the large title. The existing `SessionView` is not changed.
- **Rationale**: Run vs walk must be told apart at a glance while moving (FR-017). The colour is
  never the only signal: the title says "Run" or "Walk".
- **Alternatives considered**: extending `SessionView` with colour and next-phase props (it is
  shared with the sample and routine, which need neither).

## R7. Keep screen on

- **Decision**: `keepScreenOn` is a stored setting (default false) copied into
  `SessionDefinition.keepScreenOn` when Start is tapped. The run/walk screen calls the existing
  `useKeepScreenOn(definition, status)` with the live run/walk session.
- **Rationale**: Clarification Q3. The snapshot makes a recovered workout behave as started.

## R8. Screen states

- **Decision**: `RunWalkScreen` has three states, like the routine screen:
  - live (a `run-walk` session is running or paused): `RunWalkLiveView` and `Controls`;
  - ended (the last `run-walk` session is done or stopped): a "Complete" or "Stopped" banner with
    total elapsed, above the settings view, and the Start button reads "Start again";
  - settings: presets, steppers, voice switches, keep-screen-on switch, total, Start.
  Another mode's session never takes over the screen (FR-020).
- **Rationale**: Same pattern as spec 002, and the ended state returns to the settings in place
  (FR-019).

## R9. No new dependencies or permissions

- **Decision**: Uses React Native `Switch`, `Pressable`, and the spec 001/002 components. No new
  packages, native config, or permissions.
