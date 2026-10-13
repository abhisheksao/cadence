# Contract: Routine Mode, Store, and Screens

Builds on the spec 001 contracts ([engine](../../001-cue-engine/contracts/engine.md),
[platform](../../001-cue-engine/contracts/platform.md)). Entities: [data-model.md](../data-model.md).

## Mode

```ts
// src/modes/routine.ts
export const ROUTINE_MODE_ID = 'routine';
export function routineDefinition(routine: Routine): SessionDefinition;
export const routineMode: ModeDefinition;   // id 'routine', route '/routine'
```

Cue guarantees (unit tests on the handler; M = step count; "say X" means `{ type: 'say', text: X }`):

| # | Opportunity | Cue(s) | Spec |
|---|---|---|---|
| RC1 | `isPhaseStart`, index 0 | say "Good morning. Step 1 of M. <title>. <duration>." with `interrupt` | FR-009 |
| RC2 | `isPhaseStart`, index > 0 | say "Step N of M. <title>. <duration>." with `interrupt` | FR-009 |
| RC3 | Untimed step start | the duration part is "Tap Done when finished." | FR-009 |
| RC4 | `remaining` 60, `durationSec` ≥ 180 | say "One minute left." | FR-010 |
| RC5 | `remaining` 10, `durationSec` ≥ 30 | say "10 seconds." | FR-011 |
| RC6 | `remaining` 3, 2 | beep | FR-012 |
| RC7 | `remaining` 1 | beepLast if a next step exists, else beep | FR-012 |
| RC8 | `completion(at)` | chime, then say "Routine complete. Have a great day." at +700 ms | FR-013 |
| RC9 | any other second, and every second of an untimed step after its start | nothing | FR-014 |

`<duration>` is `spokenDuration(durationSec)`, e.g. "1 minute", "2 minutes 30 seconds".
`ModeDefinition` gains `route: string` (research R8). The sample's route is `'/sample'`.

## Store

```ts
// src/routine/store.ts
export const ROUTINE_KEY = 'routine:v1';
export function parseRoutine(raw: string | null): Routine | null;
export class RoutineStore {
  constructor(deps: { store: KeyValueStore; newId: () => string });
  get(): Routine;                                  // loads synchronously on first call
  subscribe(fn: (r: Routine) => void): () => void;
  update(fn: (r: Routine) => Routine): void;       // saves the whole routine (FR-004)
  restoreDefault(): void;                          // FR-005
}
export function useRoutine(): { routine: Routine; store: RoutineStore };
```

| # | Guarantee | Spec |
|---|---|---|
| RS1 | First `get()` with nothing stored, or an unreadable/other-version value, returns the default routine and saves it | FR-002 |
| RS2 | `update` notifies subscribers and writes the full routine under `routine:v1` | FR-004 |
| RS3 | A new `RoutineStore` over the same key-value data returns the last saved routine | FR-004, SC-004 |
| RS4 | `restoreDefault` replaces the routine with the default (fresh ids) and saves it | FR-005 |

## Screens

| # | Screen | Guarantee | Spec |
|---|---|---|---|
| UI1 | Home | Morning routine tile has no "Coming soon", opens `/routine`, and shows "In progress" while a routine session is running or paused | FR-021 |
| UI2 | Routine (start view) | Shows each step's title (or "Step N") and duration (or "untimed"), the total timed duration, Start and Edit. Start calls `controller.start(routineDefinition(routine))` | FR-017 |
| UI3 | Routine (live view) | Only for a routine session: SessionView (subtitle "Step N of M"), step list with done/current/upcoming, Done (large when untimed, compact when timed) → `controller.skip()`, Controls; no Edit | FR-007, FR-014, FR-018 |
| UI4 | Routine (ended) | "All done" or "Stopped" with Start again and Edit | FR-020 |
| UI5 | Routine | `useKeepScreenOn` receives the live routine definition and status | FR-015 |
| UI6 | Edit | Title input (≤ 60), Untimed switch, minutes/seconds inputs normalised on blur, move up/down (disabled at the ends), Delete (disabled for the only step), Add step (disabled at 30) | FR-001, FR-003 |
| UI7 | Edit | Delete shows "Step deleted · Undo" for 5 s; Undo restores the step in place; a second delete replaces the bar | FR-003 |
| UI8 | Edit | "Restore default routine" asks for confirmation in place; Confirm restores, Cancel does nothing | FR-005 |
| UI9 | LaunchCheck | Resume navigates to the recovered mode's `route` (`/routine` for a routine session) | FR-021 |

## Spec 001 amendments

| Contract | Change | Research |
|---|---|---|
| platform.md C3 | Notification text is `"<subtitle>: <title>"` when the phase has a subtitle, else the title; `Paused · ` prefix unchanged; also used for `background.start()` | R3 |
| platform.md `BackgroundHost` | New `canRequestBatteryExemption: boolean` (Android true, iOS false); `BatteryLink` uses it instead of `Platform.OS` | R9 |
| platform.md LaunchCheck | Resume routes by `modes.get(modeId)?.route ?? '/'` | R8 |
