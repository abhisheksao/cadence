# Contract: Run/Walk Mode, Settings, and Screen

Builds on the spec 001 contracts ([engine](../../001-cue-engine/contracts/engine.md),
[platform](../../001-cue-engine/contracts/platform.md)) and spec 002's
[routine contract](../../002-morning-routine/contracts/routine.md) (mode routes, notification
text). Entities: [data-model.md](../data-model.md).

## Mode

```ts
// src/modes/runWalk.ts
export const RUN_WALK_MODE_ID = 'run-walk';
export function runWalkDefinition(settings: RunWalkSettings): SessionDefinition<RunWalkVoice>;
export const runWalkMode: ModeDefinition;   // id 'run-walk', route '/run-walk'
```

Cue guarantees (unit tests on the handler; "say X" means `{ type: 'say', text: X }`; d =
`durationSec`; M = rounds):

| # | Opportunity | Cue(s) | Spec |
|---|---|---|---|
| WC1 | `isPhaseStart`, ready | say "Get ready. Starting in 10 seconds." with `interrupt` | FR-009 |
| WC2 | `isPhaseStart`, warmup | say "Warm up. Walk for <d>." with `interrupt` | FR-009 |
| WC3 | `isPhaseStart`, run, not last, `announceRound` | say "Run for <d>. Round N of M." with `interrupt` | FR-009 |
| WC4 | `isPhaseStart`, last run, `announceRound` | say "Run for <d>. Last round." with `interrupt` | FR-009 |
| WC5 | `isPhaseStart`, run, `announceRound` off | say "Run for <d>." with `interrupt` | FR-009 |
| WC6 | `isPhaseStart`, walk | say "Walk for <d>." with `interrupt` | FR-009 |
| WC7 | `isPhaseStart`, cooldown | say "Now cool down. Walk for <d>." with `interrupt` | FR-009 |
| WC8 | `remaining` 5, kind ≠ ready | say "<title> ends in" | FR-010 |
| WC9 | `remaining` 3, 2 | beep | FR-010 |
| WC10 | `remaining` 1 | beepLast if a next phase exists, else beep | FR-010 |
| WC11 | `timeLeft`, kind ≠ ready, `sec` ≥ 5, `remaining` > 5, `remaining % 30 === 0` | say "<remaining> left." | FR-011 |
| WC12 | `halfway`, run, d ≥ 120, `sec === floor(d / 2)` | say "Halfway." (or "Halfway. <remaining> left." when WC11 also holds) | FR-012 |
| WC13 | `completion(at)` | chime, then say "Workout complete. Great job." at +700 ms | FR-013 |
| WC14 | any other second; ready apart from WC1, WC9, WC10 | nothing | FR-010, FR-011 |

`<d>` and `<remaining>` are `spokenDuration(...)`, e.g. "1 minute 30 seconds". `RunWalkVoice` is
`{ announceRound: boolean; halfway: boolean; timeLeft: boolean }`.

Definition guarantees:

| # | Guarantee | Spec |
|---|---|---|
| WD1 | Phases follow data-model "Settings → SessionDefinition"; the last walk is left out only when `cooldownSec > 0` | FR-007 |
| WD2 | Warm-up and cool-down phases are absent when 0 | FR-007 |
| WD3 | `keepScreenOn` and the voice flags are copied from the settings | FR-014, FR-015 |
| WD4 | The definition passes spec 001 `validateDefinition` for every setting in range | FR-008 |

## Settings

```ts
// src/runWalk/settings.ts
export type RunWalkField = 'warmupSec' | 'runSec' | 'walkSec' | 'rounds' | 'cooldownSec';
export const PRESETS: readonly Preset[];
export function defaultSettings(): RunWalkSettings;
export function adjust(s: RunWalkSettings, field: RunWalkField, dir: 1 | -1): RunWalkSettings;
export function canAdjust(s: RunWalkSettings, field: RunWalkField, dir: 1 | -1): boolean;
export function applyPreset(s: RunWalkSettings, p: Preset): RunWalkSettings;
export function matchingPreset(s: RunWalkSettings): Preset | null;
export function totalSec(s: RunWalkSettings): number;

// src/runWalk/store.ts
export const RUN_WALK_KEY = 'run-walk:v1';
export function parseRunWalk(raw: string | null): RunWalkSettings | null;
export class RunWalkStore {
  constructor(deps: { store: KeyValueStore });
  get(): RunWalkSettings;                                   // loads synchronously on first call
  subscribe(fn: (s: RunWalkSettings) => void): () => void;
  update(fn: (s: RunWalkSettings) => RunWalkSettings): void; // saves the whole value
}
export function useRunWalk(): { settings: RunWalkSettings; store: RunWalkStore };
```

| # | Guarantee | Spec |
|---|---|---|
| WS1 | `adjust` moves by the field's step and stays in range; `canAdjust` is false at the limit | FR-004 |
| WS2 | `applyPreset` sets run, walk and rounds only; `matchingPreset` matches all three or nothing | FR-003 |
| WS3 | `totalSec` equals the sum of the definition's phases | FR-006 |
| WS4 | First `get()` with nothing stored, unreadable JSON, or another version returns the defaults and saves them | FR-002, FR-005 |
| WS5 | A readable v1 value with out-of-range, off-step, or missing fields is repaired field by field | FR-005 |
| WS6 | `update` notifies subscribers and writes the full value; a new store over the same data returns it | FR-005, SC-005 |

## Screen

| # | Screen | Guarantee | Spec |
|---|---|---|---|
| WU1 | Home | Run / walk tile has no "Coming soon", opens `/run-walk`, and shows "In progress" while a run-walk session runs or is paused | FR-020 |
| WU2 | Run/walk (settings) | Presets (selected one marked), steppers for run, walk, rounds, warm-up, cool-down (− / + disabled at limits, values as m:ss or "Off" for 0 warm-up/cool-down), switches for the three voice options and Keep screen on, total, Start | FR-001–FR-006, FR-016 |
| WU3 | Run/walk (settings) | Start calls `controller.start(runWalkDefinition(settings))` | FR-008 |
| WU4 | Run/walk (live) | Only for a run-walk session: phase title in the phase colour, "Round N of M", time left, "elapsed / total", Paused badge, "Next: <title> <m:ss>" (none on the last phase), Controls | FR-017 |
| WU5 | Run/walk (ended) | "Complete" or "Stopped" with total elapsed, above the settings view; Start reads "Start again" | FR-019 |
| WU6 | Run/walk | `useKeepScreenOn` receives the live run-walk definition and status | FR-014 |
| WU7 | Run/walk | Another mode's live session shows the settings view | FR-020 |
| WU8 | LaunchCheck | Resume of a run-walk session navigates to `/run-walk` (spec 002 routing, no change) | FR-020 |

## Spec amendments

| Document | Change | Research |
|---|---|---|
| spec.md FR-018, US3 scenario 5 | Notification text is "Round N of M: Run" (spec 002 rule `"<subtitle>: <title>"`), not "Run · Round N of M" | R5 |
