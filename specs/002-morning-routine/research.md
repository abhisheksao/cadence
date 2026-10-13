# Research: Morning Routine

Decisions for [plan.md](./plan.md). Spec 001's research (R1–R12) still applies. Engine timing,
audio, the background service, storage, and recovery are reused unchanged, except where noted
below.

## R1. Routine as a mode on the spec 001 registry

- **Decision**: A `routineMode` (`id: 'routine'`) in `src/modes/routine.ts`, registered in
  `src/modes/index.ts` next to the sample. `routineDefinition(routine)` turns the stored routine
  into a `SessionDefinition`: one phase per step (`kind: 'step'`, `title` = the step title or
  "Step N", `subtitle` = "Step N of M", `durationSec` = the duration or `null`), title "Morning
  routine", `settings: {}`, `keepScreenOn: true`. `routineMode.cueFor(definition)` returns a pure
  `CueHandler` that reads everything it needs from the phases.
- **Rationale**: Spec 001 recovery rebuilds cues from the stored definition through the registry
  (FR-016). Because the phases carry the titles and the step count is `phases.length`, the handler
  needs no settings, and a recovered session gets the same cues even if the user edited the
  routine since.
- **Alternatives considered**: storing the step list in `settings` (duplicates the phases);
  building cues from the live stored routine (breaks recovery after an edit).

## R2. Cue wording and thresholds

- **Decision**: In `cueFor`:
  - Phase start (`isPhaseStart`): one `say` with `interrupt: true`:
    `"[Good morning. ]Step N of M. <title>. <duration|Tap Done when finished>."`. The greeting is
    only for index 0. The duration uses the existing `spokenDuration` ("1 minute", "2 minutes 30
    seconds").
  - `remaining === 60` and `durationSec >= 180` → `say "One minute left."`.
  - `remaining === 10` and `durationSec >= 30` → `say "10 seconds."`.
  - `remaining` 3 and 2 → `beep`. `remaining` 1 → `beepLast` if there is a next phase, else
    `beep`.
  - `completion` → `chime`, then `say "Routine complete. Have a great day."` with `offsetMs: 700`
    (same pattern as the sample).
- **Rationale**: Matches spec FR-009–FR-013. A recovered session announces "Step N of M…" for the
  landing step (spec 001 E16 sets `isPhaseStart`). It says "Good morning." only if it lands on step
  1, which is acceptable.
- **Note**: with the 15 s minimum (clarification Q1), the 10 s warning never applies to steps
  under 30 s, and the beeps start at 3 s left. That leaves at least 12 s for the announcement.

## R3. Notification text "Step N of M: title"

- **Decision**: Change the spec 001 controller's notification text to
  `phase.subtitle ? `${phase.subtitle}: ${phase.title}` : phase.title`, both for
  `background.start()` and for updates (`Paused · ` prefix unchanged). Routine phases carry
  `subtitle: "Step N of M"`. Sample phases have no subtitle and are unchanged.
- **Rationale**: Generic and needs no new mode hook. Spec 001 contract C3 gets a one-line
  amendment (Principle IX).
- **Alternatives considered**: an optional `notificationText(phase)` on `ModeDefinition` (more
  API for a single string format); putting "Step N of M: " into the phase title (then the screen
  and the speech would show it too).

## R4. Routine storage

- **Decision**: One JSON value under `routine:v1` in the spec 001 `KeyValueStore`
  (`expo-sqlite/kv-store`). Shape: `{ version: 1, steps: [{ id, title, durationSec }] }`. A
  `RoutineStore` (in `src/routine/store.ts`) wraps the key-value store. It loads synchronously on
  first use with `getSync` (so the screen never flashes the default), keeps the routine in memory,
  notifies subscribers, and writes the whole value on every change (fire-and-forget, with errors
  logged). `parseRoutine` rejects anything invalid; the caller then uses and saves the default
  (spec edge case).
- **Rationale**: The value is tiny (≤ 30 steps). Writing the whole value keeps it consistent. Sync
  reads already proved fine for the session record. The version field allows a later migration.
- **Alternatives considered**: one key per step (needs ordering bookkeeping and partial-write
  handling); SQLite tables (overkill for one list).

## R5. Pure editing operations and step identity

- **Decision**: `src/routine/edit.ts` holds pure functions on `Routine`: `updateStep(id, patch)`,
  `addStep(id)`, `moveStep(id, -1|1)`, `deleteStep(id)` (returns the routine and the removed step
  with its index, or the routine unchanged when it is the last step), `restoreStep(removed)`,
  `normaliseDuration(sec)` (rounds and clamps to 15–3600), and `clampTitle` (60 chars). Step IDs
  come from an injected generator. In production, a counter is combined with `Date.now()` in
  base 36, which is unique within the device and needs no dependency.
- **Rationale**: All editing rules (limits, last-step protection, undo) are table-tested without
  React. Stable IDs keep the list keys and undo unambiguous after reordering.
- **Alternatives considered**: `expo-crypto` `randomUUID` (adds a native dependency for no gain);
  array indexes as identity (break on reorder and undo).

## R6. Screens and routes

- **Decision**: Expo Router routes `src/app/routine/index.tsx` (routine screen, `/routine`) and
  `src/app/routine/edit.tsx` (Edit screen, `/routine/edit`), each re-exporting a screen from
  `src/screens/`. The routine screen renders one of two views:
  - **Start view** (no routine session, or one that has finished): a read-only step list with
    durations, the total timed duration, Start, and Edit (hidden while a routine session runs or is
    paused).
  - **Live view** (`state.definition.modeId === 'routine'` and the session is running or paused,
    or has just finished): the spec 001 `SessionView` for the current step (its subtitle gives
    "Step N of M"), a `StepList` marking done/current/upcoming, a `DoneButton` (large on untimed
    steps, compact on timed), the spec 001 `Controls`, and "All done"/"Stopped" with Start again
    after the end.

  The screen calls the spec 001 `useKeepScreenOn` with the live definition. Done calls
  `controller.skip()`.
- **Rationale**: Reuses the spec 001 components. The live view keys on `modeId`, so a running
  sample session never takes over the routine screen (clarification Q5).

## R7. Edit screen interactions

- **Decision**: Each step is a row with a title `TextInput` (`maxLength` 60), an "Untimed" `Switch`,
  minutes and seconds numeric `TextInput`s (hidden when untimed, normalised on blur), move up/down
  buttons, and Delete. "Add step" and "Restore default routine" sit at the bottom. Restore asks
  for confirmation in an in-app confirm row, not `Alert.alert`: native alerts are hard to test,
  and `Alert` is awkward on web. After a delete, an `UndoBar` shows "Step deleted · Undo" for 5 s
  and is replaced by the next delete. Every change goes straight to the `RoutineStore`.
- **Rationale**: Move buttons and simple inputs are accessible and easy to test with React Native
  Testing Library. Normalising on blur lets the user type freely.
- **Alternatives considered**: drag-and-drop (needs gesture libraries, harder to test, deferred);
  wheel pickers for duration (need a dependency).

## R8. Home tile and recovery routing

- **Decision**:
  - Morning routine becomes a pressable tile. It shows "In progress" when `useSession().state`
    is a routine session that is running or paused, and opens `/routine`.
  - `ModeDefinition` gets a `route` field (`'/routine'`, `'/sample'`). `LaunchCheck` resumes
    and pushes `modes.get(modeId)?.route ?? '/'`, instead of the hard-coded `/sample`.
- **Rationale**: Spec FR-021 and clarification Q5. A route on the mode keeps routing data next to
  the mode, so specs 003 and 004 only register theirs.

## R9. Cleanup carried over from spec 001: battery link platform check

- **Decision**: Add `canRequestBatteryExemption: boolean` to the `BackgroundHost` port (`true` on
  Android, `false` in the iOS placeholder). `BatteryLink` renders nothing when it is false,
  instead of checking `Platform.OS`.
- **Rationale**: Constitution IV forbids shared code from branching on `Platform.OS` for
  background-execution concerns. Spec 001's `BatteryLink` did, to work around jest-expo
  resolving `.ios` files. The port flag fixes the violation and stays testable. Spec 001's research
  implementation note gets updated (Principle IX).

## R10. Testing approach

- **Decision**: Test-first, as in spec 001.
  - Table tests for `routineDefinition`, the cue handler (every threshold boundary: 15/29/30 s and
    179/180 s steps, last step vs. not), `parseRoutine`, and the edit functions.
  - `RoutineStore` tests on the `MemoryStore` fake.
  - An end-to-end engine test: the default routine on the `FakeScheduler`, asserting the cue
    sequence and the times it reaches the player.
  - React Native Testing Library tests for the routine screen (start/live views, Done, Edit
    hidden while live), the Edit screen (each edit, undo, restore confirm), the home tile, and
    `LaunchCheck` routing by mode.
- **Rationale**: Covers SC-002, SC-004, and SC-005 without a device. On-device checks are listed
  in [quickstart.md](./quickstart.md).

## Implementation notes (spec review, T042)

- **Duration fields**: minutes and seconds accept up to two digits each. On blur the value is
  normalised (15 s–60 min), and both fields then show the corrected value, so the user sees right
  away that 0:05 became 0:15.
- **Keeping fields in sync**: `StepEditor` follows changes to the saved duration (undo, restore)
  by adjusting its state during render, not in an effect. The React Compiler lint rule forbids
  `setState` inside effects.
- **Ended view**: after a routine ends, the routine screen shows "All done" or "Stopped" over the
  step list from the session that just ran, not the stored routine. Edits made since then show
  once Start again is tapped.
- **Done size**: `DoneButton` has the test IDs `done-large` and `done-compact`. The live view picks
  the size from the current phase (`durationSec === null` → large).
- **Store first read**: the default routine saved on first read does not notify subscribers. It
  is the initial value, not a change.

