# Data Model: Morning Routine

Spec 001's entities (`Phase`, `SessionDefinition`, `SessionRecord`, …) are unchanged. See
[../001-cue-engine/data-model.md](../001-cue-engine/data-model.md).

## Step

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique within the routine; stable across edits and reordering |
| `title` | string | 0–60 characters as stored. Blank is allowed and shown/spoken as "Step N" (FR-006) |
| `durationSec` | integer or `null` | 15–3600 (FR-001, clarification Q1), or `null` for untimed |

## Routine

Stored as JSON under `routine:v1` in the key-value store (research R4).

| Field | Type | Rules |
|---|---|---|
| `version` | `1` | Another version or invalid content → default routine is used and saved |
| `steps` | `Step[]` | 1–30 steps, unique ids |

**Default routine** (FR-002):

| # | Title | Duration |
|---|---|---|
| 1 | Drink a glass of water | 60 s |
| 2 | Make the bed | untimed |
| 3 | Stretch | 300 s |
| 4 | Breathing | 180 s |
| 5 | Plan the day | 180 s |
| 6 | Shower | untimed |

### Edit operations (pure, research R5)

| Operation | Result | Rules |
|---|---|---|
| `updateStep(id, { title?, durationSec? })` | routine | title trimmed to 60 chars; duration normalised (round, clamp 15–3600) or `null` |
| `addStep(id)` | routine | appends `{ id, title: '', durationSec: 120 }`; no-op at 30 steps |
| `moveStep(id, dir)` | routine | swaps with the neighbour; no-op at either end |
| `deleteStep(id)` | `{ routine, removed: { step, index } \| null }` | no-op (`removed: null`) if it is the only step |
| `restoreStep(removed)` | routine | re-inserts at `min(index, length)`; no-op if the id already exists or at 30 steps |
| `defaultRoutine(newId)` | routine | the table above, with fresh ids |

## Routine → SessionDefinition (research R1)

`routineDefinition(routine)`:

| SessionDefinition field | Value |
|---|---|
| `modeId` | `'routine'` |
| `title` | `'Morning routine'` |
| `phases[i]` | `{ kind: 'step', title: title.trim() \|\| 'Step i+1', subtitle: 'Step i+1 of M', durationSec }` |
| `settings` | `{}` |
| `keepScreenOn` | `true` |

The definition is a snapshot. Later edits do not affect a running or recovered session (spec edge
cases).

## Derived UI state

| Name | Definition |
|---|---|
| Total timed duration | sum of `durationSec` over timed steps (untimed count as 0) |
| Step state in the live list | `done` if index < current index (or the session is done); `current` if index = current; else `upcoming` |
| Routine live | `state.definition.modeId === 'routine'` and status is `running` or `paused` |
| Home tile "In progress" | routine live |
| Edit allowed | not routine live (FR-007) |
