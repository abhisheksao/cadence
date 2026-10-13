# Contract: Engine and Modes

The engine is pure TypeScript with no React Native imports, so it runs under Jest with a fake clock.
Modes in specs 002–004 build on this contract. Entities are defined in
[data-model.md](../data-model.md).

```ts
// src/engine/clock.ts
export interface Clock {
  /** Wall time in ms. Production: Date.now(). */
  now(): number;
}
export interface Scheduler {
  /** Calls fn every intervalMs until the returned cancel function is called. */
  every(intervalMs: number, fn: () => void): () => void;
}

// src/engine/types.ts
export type Phase = { kind: string; title: string; subtitle?: string; durationSec: number | null };

export type CueOpportunity = {
  phase: Phase; index: number; sec: number; remaining: number | null;
  prev?: Phase; next?: Phase; at: number; isPhaseStart: boolean;
};

export type Cue =
  | { type: 'beep' | 'beepLast' | 'chime'; offsetMs?: number }
  | { type: 'say'; text: string; interrupt?: boolean; offsetMs?: number };

export interface CueHandler {
  /** Which cue(s), if any, to play for this second. Must be pure and fast. */
  cueFor(op: CueOpportunity): Cue | Cue[] | null;
  /** Cue(s) for session completion; `at` is the exact end time. */
  completion(at: number): Cue | Cue[] | null;
}

export type EngineEvents = {
  /** A cue is due at `at` (possibly up to 1 s ahead). */
  onCue(cue: Cue, at: number): void;
  onPhaseChange?(phase: Phase, index: number): void;
  onStatusChange?(status: Status): void;
  /** Called when cues already handed out must be cancelled (pause/skip/back/stop). */
  onCancelPending?(): void;
};

// src/engine/engine.ts
export class Engine {
  constructor(phases: Phase[], handler: CueHandler, events: EngineEvents,
              deps: { clock: Clock; scheduler: Scheduler });
  start(): void;
  /** Start from a recovered position (FR-024). */
  startAt(position: { index: number; phaseElapsedMs: number; paused: boolean }): void;
  pause(): void;
  resume(): void;
  skip(): void;
  /** >3 s into the phase: restart it; otherwise previous phase (first phase: restart). */
  back(): void;
  stop(): void;
  snapshot(): SessionSnapshot;
  subscribe(fn: (s: SessionSnapshot) => void): () => void;
}
```

## Guarantees (each is a unit test, written first)

| # | Guarantee | Spec |
|---|---|---|
| E1 | `start()` on empty phases does nothing; status stays `idle` | FR-001 |
| E2 | One `cueFor` call per whole second of each phase, with `at = phaseStart + sec*1000` | FR-002 |
| E3 | Cues are handed out up to 1000 ms before `at`, never after a later second's cue | FR-005 |
| E4 | Timed phases end exactly `durationSec*1000` after they start, however late the tick | FR-006 |
| E5 | 60 simulated minutes with jittered ticks: every `at` equals the planned offset exactly | SC-002 |
| E6 | After a gap spanning phases, only the landing phase gets `isPhaseStart`; per-second cues > 2000 ms late are dropped | FR-007 |
| E7 | Pause freezes elapsed; resume after N ms shifts all later `at` by N; cues handed out early but due after the pause are handed out again on resume | US2 |
| E8 | Pause/skip/back/stop call `onCancelPending` before anything else | FR-010 |
| E9 | Skip starts the next phase at `sec 0`; skip in last phase → `done` + completion cue | US2 |
| E10 | Back at > 3 s restarts the phase; at ≤ 3 s goes to previous; first phase restarts | US2 |
| E11 | Untimed phases never end on their own; elapsed keeps counting | US2 |
| E12 | Stop → `stopped`, no completion cue | US2 |
| E13 | Clock going backwards does not move progress backwards | Edge cases |
| E14 | `completion(at)` is called once, with `at` = exact end time, also when reached by skipping | FR-003 |
| E15 | Snapshots are emitted at least every 250 ms while running | FR-012 |
| E16 | `startAt` resumes at the given index/elapsed and marks that phase's start cue | FR-024 |

## Modes

```ts
// src/modes/types.ts
export interface ModeDefinition<S = unknown> {
  id: string;
  /** Builds the cue logic for a stored definition. Must be deterministic. */
  cueFor(def: SessionDefinition<S>): CueHandler;
}
// src/modes/registry.ts
export function registerMode(mode: ModeDefinition): void;
export function getMode(id: string): ModeDefinition | undefined;
```

Spec 001 registers one mode, `sample` (see [quickstart.md](../quickstart.md)).
