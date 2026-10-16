# Data Model: Run / Walk

Entities for [spec.md](./spec.md); decisions in [research.md](./research.md). Spec 001's
`SessionDefinition`, `Phase`, and `SessionRecord` are reused unchanged.

## RunWalkSettings (stored)

Key `run-walk:v1` in the spec 001 `KeyValueStore`, one JSON value.

| Field | Type | Range / step | Default |
|---|---|---|---|
| `version` | `1` | | `1` |
| `warmupSec` | integer | 0–1800, step 60 (0 = none) | 300 |
| `runSec` | integer | 15–1800, step 15 | 60 |
| `walkSec` | integer | 15–1800, step 15 | 90 |
| `rounds` | integer | 1–30, step 1 | 8 |
| `cooldownSec` | integer | 0–1800, step 60 (0 = none) | 300 |
| `announceRound` | boolean | | true |
| `halfway` | boolean | | true |
| `timeLeft` | boolean | | true |
| `keepScreenOn` | boolean | | false |

**Parsing** (`parseRunWalk`): unreadable JSON, a non-object, or `version !== 1` → `null` (the
store then uses and saves the defaults). Otherwise each number is rounded to its step and
clamped into range (a missing or non-numeric value takes its default), and each flag that is not
a boolean takes its default.

## Preset (fixed in the app)

| Label | `runSec` | `walkSec` | `rounds` |
|---|---|---|---|
| 1:00 / 1:30 ×8 | 60 | 90 | 8 |
| 1:30 / 2:00 ×6 | 90 | 120 | 6 |
| 2:00 / 1:00 ×6 | 120 | 60 | 6 |
| 5:00 / 1:00 ×4 | 300 | 60 | 4 |

A preset is selected exactly when all three values match the settings.

## Settings → SessionDefinition (`runWalkDefinition`)

```text
modeId:       'run-walk'
title:        'Run / walk'
keepScreenOn: settings.keepScreenOn
settings:     { announceRound, halfway, timeLeft }
phases:
  { kind: 'ready',    title: 'Get ready', durationSec: 10 }
  { kind: 'warmup',   title: 'Warm up',   durationSec: warmupSec }              if warmupSec > 0
  for r in 1..rounds:
    { kind: 'run',  title: 'Run',  subtitle: 'Round r of rounds', durationSec: runSec }
    { kind: 'walk', title: 'Walk', subtitle: 'Round r of rounds', durationSec: walkSec }
                                             unless r = rounds and cooldownSec > 0
  { kind: 'cooldown', title: 'Cool down', durationSec: cooldownSec }            if cooldownSec > 0
```

Total time = sum of `durationSec` over the phases. Default settings: 10 + 300 + 8 × 60 + 7 × 90 +
300 = 1,720 s (28:40). Largest: 63 phases.

## Workout session

A spec 001 session from the definition above. Lifecycle, pause, skip, back, the record, and
recovery are spec 001's. The cue handler reads only the phases and the three voice flags
(research R1, R2).
