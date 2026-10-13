# Data Model: Cue Engine and Background Session

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All times are milliseconds. "Wall time" is `Clock.now()` (`Date.now()` in production, see
[research R1](./research.md#r1-engine-clock-wall-clock-not-monotonic)). Types live in
`src/engine/types.ts` and `src/session/types.ts`; the TypeScript signatures are in
[contracts/](./contracts/).

## Phase

One step of a session (FR-001).

| Field | Type | Rules |
|---|---|---|
| `kind` | string | Free label the mode uses to pick cues (e.g. `warmup`, `step`, `inhale`) |
| `title` | string | Non-empty |
| `subtitle` | string? | Optional |
| `durationSec` | integer ≥ 1, or `null` | `null` = untimed: waits for skip |

## SessionDefinition

Plain, JSON-serialisable description of a session (FR-026). Everything needed to rebuild the
session and its cues after a relaunch.

| Field | Type | Rules |
|---|---|---|
| `modeId` | string | Must match a registered `ModeDefinition` (`sample` in this spec) |
| `title` | string | Shown in the notification |
| `phases` | `Phase[]` | Non-empty (start is refused otherwise) |
| `settings` | JSON object | Mode-specific (e.g. voice on/off); opaque to the engine |
| `keepScreenOn` | boolean | FR-021a |

Validation: `validateDefinition(def)` returns a list of errors (empty phases, blank title,
duration < 1 or non-integer, unknown mode). The controller refuses to start an invalid definition.

## ModeDefinition (code, not data)

Registered per mode in `src/modes/registry.ts`.

| Member | Purpose |
|---|---|
| `id` | Matches `SessionDefinition.modeId` |
| `cueFor(def)` | Returns the `CueHandler` (per-second cue choice + completion cue) for a definition |

## CueOpportunity

Given to the mode once per whole second of each phase (FR-002).

| Field | Type | Meaning |
|---|---|---|
| `phase`, `index` | `Phase`, number | Current phase and its position |
| `sec` | integer ≥ 0 | Whole seconds elapsed in the phase |
| `remaining` | integer or `null` | `durationSec - sec`; `null` for untimed phases |
| `prev`, `next` | `Phase?` | Neighbouring phases |
| `at` | wall time | When this second is due (may be up to 1 s in the future) |
| `isPhaseStart` | boolean | `sec === 0`; also true for the catch-up announcement (FR-007) |

## Cue

What the mode returns for an opportunity (FR-003): `null`, or one of
`{ type: 'beep' }`, `{ type: 'beepLast' }`, `{ type: 'chime' }`,
`{ type: 'say', text, interrupt? }`, or a list of these with optional `offsetMs`.

## Engine state

```text
           start()                 pause()
  idle ───────────────► running ◄──────────► paused
                          │   resume()          │
              last phase  │                     │ stop()
              ends / skip │        stop()       │
                          ▼          │          ▼
                         done     stopped ◄─────┘
```

- `idle → running` only with a valid, non-empty definition.
- `running ⇄ paused`: pause freezes `phaseElapsed`; resume shifts anchors by the paused duration.
- `skip` in the last phase → `done` (completion cue plays). `stop` → `stopped` (no completion cue).
- `done` and `stopped` are terminal; a new session needs a new engine.

Internal anchors: `phaseStartAt` (wall), `pausedAt` (wall, while paused), `completedMs` (sum of
finished phases), `lastSeenNow` (for the backwards-clock guard), last cue fired (`cueIndex`,
`cueSec`).

## SessionSnapshot

Live state for screens (FR-012), emitted at least every 250 ms while running.

| Field | Type |
|---|---|
| `status` | `idle \| running \| paused \| done \| stopped` |
| `index`, `phase` | current phase |
| `phaseElapsedMs` | elapsed in current phase |
| `phaseRemainingMs` | `null` for untimed |
| `totalElapsedMs` | completed phases + current |

## SessionRecord

Saved copy of a running/paused session (FR-023). Stored as JSON under `session-record:v1` in
`expo-sqlite/kv-store`.

| Field | Type | Rules |
|---|---|---|
| `version` | `1` | Records with another version are discarded |
| `definition` | `SessionDefinition` | |
| `status` | `running \| paused` | Never saved for terminal states (record is cleared) |
| `index` | integer | Phase index at the last write |
| `phaseStartAt` | wall time | Anchor of the current phase at the last write |
| `pausedAt` | wall time or `null` | Set while paused |
| `writtenAt` | wall time | Updated on every write; refreshed ≥ once a minute while running |

### Recovery assessment (FR-024/025)

`assessRecord(record, now)` is pure:

1. No record or bad version → `none`.
2. `now < record.writtenAt` → `interrupted('clock')`.
3. `now - record.writtenAt > 60 min` → `interrupted('stale')`.
4. If `paused` → `resume` at `index`, elapsed `pausedAt - phaseStartAt`, status paused.
5. Else walk forward from `index`/`phaseStartAt` through timed phases until `now`; stopping at an
   untimed phase (it waits). Passing the end of the last phase → `interrupted('finished')`.
   Otherwise → `resume` at the computed index and elapsed.

## Flags

| Key | Type | Purpose |
|---|---|---|
| `battery-exemption-asked:v1` | `"1"` | FR-017: ask once |
