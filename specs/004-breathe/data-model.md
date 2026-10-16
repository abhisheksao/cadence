# Data Model: Guided Breathing (Breathe)

Entities for [spec.md](./spec.md); decisions in [research.md](./research.md). Spec 001's `SessionDefinition`, `Phase`, and `SessionRecord` are reused unchanged.

## BreatheSettings (stored)

Key `breathe:v1` in the spec 001 `KeyValueStore`, stored as a single JSON object.

| Field | Type | Range / step | Default | Description |
|---|---|---|---|---|
| `version` | `1` | constant | `1` | Schema version |
| `inhaleSec` | integer | 1–30, step 1 | 4 | Inhalation duration |
| `holdSec` | integer | 0–30, step 1 (0 = none) | 4 | Hold after inhalation |
| `exhaleSec` | integer | 1–30, step 1 | 4 | Exhalation duration |
| `postHoldSec` | integer | 0–30, step 1 (0 = none) | 4 | Hold after exhalation |
| `targetMinutes` | integer | 1–30, step 1 | 3 | Target exercise duration |
| `prepEnabled` | boolean | boolean | true | 5-second get-ready countdown |
| `cueStyle` | `'voice' \| 'count' \| 'tones'` | enum | `'voice'` | Audio cue style |
| `keepScreenOn` | boolean | boolean | false | Keep screen awake while live |

### Parsing and Field Repair (`parseBreathe`)

- If input is `null`, malformed JSON, a non-object, or `version !== 1`, `parseBreathe` returns `null` (the store then initialises and writes the default Box Breathing settings).
- Otherwise, each field is repaired independently:
  - Numeric fields are snapped to step 1 and clamped within their min/max bounds. Missing or non-numeric values take their respective defaults.
  - `cueStyle` must be `'voice'`, `'count'`, or `'tones'`; otherwise defaults to `'voice'`.
  - `prepEnabled` and `keepScreenOn` must be booleans; otherwise default to `true` and `false` respectively.

## Presets (hardcoded)

| ID | Name | Inhale | Hold | Exhale | Post-Hold | Target Min | Calculated Cycles | Actual Time |
|---|---|---|---|---|---|---|---|---|
| `box` | Box (4-4-4-4) | 4 | 4 | 4 | 4 | 3 min | 11 cycles | 181s (2:56 + 5s prep) |
| `4-7-8` | 4-7-8 Relax | 4 | 7 | 8 | 0 | 2 min | 6 cycles | 119s (1:54 + 5s prep) |
| `3-4-7` | 3-4-7 Calm | 3 | 4 | 7 | 0 | 2 min | 9 cycles | 131s (2:06 + 5s prep) |
| `coherent` | Coherent (5-5) | 5 | 0 | 5 | 0 | 5 min | 30 cycles | 305s (5:00 + 5s prep) |

A preset is marked selected if and only if all four breath phase durations (`inhaleSec`, `holdSec`, `exhaleSec`, `postHoldSec`) and `targetMinutes` match the preset definition.

## Settings → SessionDefinition (`breatheDefinition`)

```text
modeId:       'breathe'
title:        'Breathe'
keepScreenOn: settings.keepScreenOn
settings:     { cueStyle: settings.cueStyle }
phases:
  if prepEnabled:
    { kind: 'prep', title: 'Get ready', durationSec: 5 }

  cycleSec = inhaleSec + holdSec + exhaleSec + postHoldSec
  cycles = Math.max(1, Math.round((targetMinutes * 60) / cycleSec))

  for c in 1..cycles:
    { kind: 'inhale',    title: 'Inhale', subtitle: 'Cycle c of cycles', durationSec: inhaleSec }
    if holdSec > 0:
      { kind: 'hold',    title: 'Hold',   subtitle: 'Cycle c of cycles', durationSec: holdSec }
    { kind: 'exhale',    title: 'Exhale', subtitle: 'Cycle c of cycles', durationSec: exhaleSec }
    if postHoldSec > 0:
      { kind: 'post-hold', title: 'Hold', subtitle: 'Cycle c of cycles', durationSec: postHoldSec }
```

### Total Time Calculation

$$\text{totalSec} = (\text{prepEnabled} \ ? \ 5 : 0) + \text{cycles} \times \text{cycleSec}$$

- Default Box Breathing: $5 + 11 \times 16 = 181\text{ s}$ (3:01).
- 4-7-8 Relax: $5 + 6 \times 19 = 119\text{ s}$ (1:59).
- Coherent: $5 + 30 \times 10 = 305\text{ s}$ (5:05).
