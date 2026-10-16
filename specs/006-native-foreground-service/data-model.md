# Data Model: Native Foreground Service (006)

Only in-memory shapes and one stored-record extension. No new storage keys.

## NotificationState (new, `src/platform/notification.ts`)

What the ongoing notification shows. Derived from the session by a pure function; never the
source of truth.

| Field | Type | Rule |
|---|---|---|
| `title` | string | Session title (`SessionDefinition.title`) |
| `text` | string | Phase text as today: `"<subtitle>: <title>"` or `"<title>"`; prefixed `"Paused · "` while paused, and suffixed `" · m:ss left"` (timed) or `" · m:ss"` (untimed) while paused (FR-011) |
| `timer` | `{ kind: 'countdown'; remainingMs: number } \| { kind: 'elapsed'; elapsedMs: number } \| null` | `countdown` for a running timed phase (FR-009), `elapsed` for a running untimed phase (FR-010), `null` while paused |
| `paused` | boolean | Selects the Pause or Resume action (FR-012) |

`notificationState(definition, snapshot)` returns `null` unless status is `running` or `paused`.
`remainingMs`/`elapsedMs` are clamped to ≥ 0.

## SessionAction (new)

`'pause' | 'resume' | 'skip'`, delivered with the `sessionId` it was issued for. Native drops
actions whose id is not the live session's (FR-016). In JS the controller maps them to
`pause()`, `resume()`, `skip()`; a `pause` while already paused (or `resume` while running) is a
no-op, so rapid taps converge on the last one.

## SessionClock (new, `src/platform/clock.*.ts`)

| Member | Android | iOS / web |
|---|---|---|
| `now()` | `anchorWall + (elapsedRealtime() - anchorElapsed)` | `Date.now()` |
| `elapsed()` | `elapsedRealtime()` | `null` |
| `bootCount()` | `Settings.Global.BOOT_COUNT` or `null` | `null` |

Implements the engine's existing `Clock` interface. Anchors are read once per JS runtime.

## SessionRecord (extended, `src/session/types.ts`)

Stays `version: 1`; two **optional** fields, so records written by the current release still
parse (they fall back to wall-clock recovery).

| Field | Type | Rule |
|---|---|---|
| `elapsedAt` | number, optional | Raw `elapsedRealtime` at the write |
| `bootCount` | integer, optional | Boot count at the write |

Validation (`parseRecord`): if present, `elapsedAt` must be a finite number ≥ 0 and `bootCount`
a non-negative integer; otherwise the record is rejected (null).

`recoveryNow(record, { elapsed, bootCount, wallNow })` (pure):
- same non-null `bootCount` and both `elapsedAt` and `elapsed` present →
  `record.writtenAt + (elapsed - record.elapsedAt)`;
- otherwise → `wallNow` (001 behavior).

The result is the `now` given to the unchanged `assessRecord`.

## Cue hand-off (changed)

`EngineEvents.onCue(cue, at, phase)` gains a 4th argument `phaseStart: boolean`, true when the
cue comes from an opportunity with `isPhaseStart` (or the catch-up announcement).
`CuePlayer.play(cue, at, phase, phaseStart)` uses it only to decide the vibration fallback
(FR-021).

## Service lifecycle (native, for reference)

```text
idle ──start(sessionId,…)──▶ foreground ──update(state)──▶ foreground
  ▲                              │
  └── stop() │ keepAlive resolved │ no heartbeat 10 s │ JS runtime destroyed
```

Swipe-away does not leave `foreground` (clarification Q2).
