# Contract: Breathe Mode, Settings, and Screen

Builds on the spec 001 contracts (engine, platform) and spec 002/003 contracts (mode routes, notification text). Entities: [data-model.md](../data-model.md).

## Mode

```ts
// src/modes/breathe.ts
export const BREATHE_MODE_ID = 'breathe';
export function breatheDefinition(settings: BreatheSettings): SessionDefinition<BreatheVoice>;
export const breatheMode: ModeDefinition;   // id 'breathe', route '/breathe'
```

### Cue Guarantees (Unit Tests on Handler)

"say X" means `{ type: 'say', text: X }`. `d` = `durationSec`.

| # | Condition / Opportunity | Cue(s) | Spec |
|---|---|---|---|
| BC1 | `isPhaseStart`, kind = `prep` | say "Get ready to breathe." with `interrupt` | FR-008 |
| BC2 | kind = `prep`, `remaining` = 3, 2, 1 | `remaining` 3, 2: `beep`; `remaining` 1: `beepLast` | FR-008 |
| BC3 | `isPhaseStart`, `cueStyle` = `'voice'`, kind = `inhale` | say "Inhale." with `interrupt` | FR-007 |
| BC4 | `isPhaseStart`, `cueStyle` = `'voice'`, kind = `hold` | say "Hold." with `interrupt` | FR-007 |
| BC5 | `isPhaseStart`, `cueStyle` = `'voice'`, kind = `exhale` | say "Exhale." with `interrupt` | FR-007 |
| BC6 | `isPhaseStart`, `cueStyle` = `'voice'`, kind = `post-hold` | say "Hold." with `interrupt` | FR-007 |
| BC7 | `isPhaseStart`, `cueStyle` = `'count'`, any breath kind | say phase title ("Inhale.", "Hold.", "Exhale.") with `interrupt` | FR-007 |
| BC8 | `cueStyle` = `'count'`, breath phase, `sec` ≥ 1 and `sec < d` | say String(sec + 1) (e.g. "2", "3", "4"...) | FR-007 |
| BC9 | `isPhaseStart`, `cueStyle` = `'tones'`, kind = `inhale` | `beep` | FR-007 |
| BC10 | `isPhaseStart`, `cueStyle` = `'tones'`, kind = `exhale` | `beepLast` | FR-007 |
| BC11 | `isPhaseStart`, `cueStyle` = `'tones'`, kind in `hold`, `post-hold` | `beep` | FR-007 |
| BC12 | `completion(at)`, `cueStyle` in `'voice'`, `'count'` | chime, then say "Breathing complete. Well done." at +700 ms | FR-014 |
| BC13 | `completion(at)`, `cueStyle` = `'tones'` | chime | FR-014 |
| BC14 | Any other second | nothing (`null` / empty array) | FR-006 |

### Definition Guarantees

| # | Guarantee | Spec |
|---|---|---|
| BD1 | Phases generated match data model; `prep` phase present if and only if `prepEnabled` is true | FR-005, FR-008 |
| BD2 | Phases with duration 0 seconds are completely omitted from the session definition | FR-005 |
| BD3 | `keepScreenOn` and `cueStyle` are copied directly from the settings into the definition | FR-006, FR-012 |
| BD4 | The generated definition passes `validateDefinition` for every setting within valid ranges | FR-006 |

## Settings & Store

```ts
// src/breathe/types.ts
export type BreatheCueStyle = 'voice' | 'count' | 'tones';
export type BreatheVoice = { cueStyle: BreatheCueStyle };
export type BreatheField = 'inhaleSec' | 'holdSec' | 'exhaleSec' | 'postHoldSec' | 'targetMinutes';
export type BreathePreset = {
  id: string;
  name: string;
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  postHoldSec: number;
  targetMinutes: number;
};
```

```ts
// src/breathe/settings.ts
export const PRESETS: readonly BreathePreset[];
export function defaultSettings(): BreatheSettings;
export function adjust(s: BreatheSettings, field: BreatheField, dir: 1 | -1): BreatheSettings;
export function canAdjust(s: BreatheSettings, field: BreatheField, dir: 1 | -1): boolean;
export function applyPreset(s: BreatheSettings, p: BreathePreset): BreatheSettings;
export function matchingPreset(s: BreatheSettings): BreathePreset | null;
export function calculateCycles(s: BreatheSettings): number;
export function totalSec(s: BreatheSettings): number;
```

```ts
// src/breathe/store.ts
export const BREATHE_KEY = 'breathe:v1';
export function parseBreathe(raw: string | null): BreatheSettings | null;
export class BreatheStore { ... }
```

### Settings Guarantees

| # | Guarantee | Spec |
|---|---|---|
| BS1 | `adjust` respects bounds (inhale/exhale: 1–30, holds: 0–30, targetMinutes: 1–30); `canAdjust` is false at bounds | FR-002 |
| BS2 | `applyPreset` sets breath phases and target minutes; `matchingPreset` detects exact match or returns null | FR-001 |
| BS3 | `totalSec` equals the sum of `breatheDefinition(s).phases` durations | FR-004 |
| BS4 | Unreadable or foreign version JSON returns null (falling back to default Box Breathing) | FR-009 |
| BS5 | Readable v1 JSON with out-of-bounds or missing fields is repaired field-by-field, preserving valid values | FR-009 |
| BS6 | Updates persist to `KeyValueStore` under `breathe:v1` and notify subscribers | FR-009 |

## UI & Screen

```ts
// src/screens/BreatheScreen.tsx
export default function BreatheScreen(): React.JSX.Element;
```

### UI Guarantees

| # | Guarantee | Spec |
|---|---|---|
| BU1 | Home screen Breathe tile is pressable, routes to `/breathe`, has no "Coming soon", and shows "In progress" when active | FR-013 |
| BU2 | Settings view displays preset selector, steppers for all fields, cue style segmented controls, prep switch, and live total | FR-002, FR-004 |
| BU3 | Tapping Start initiates the session via `SessionController.start` | FR-005 |
| BU4 | Live view displays visual expanding/contracting circle pacer, current phase name, cycle count ("Cycle X of Y"), phase countdown, and controls | FR-010, FR-011 |
| BU5 | Pausing freezes the visual pacer and shows Paused indicator; resuming restarts pacer smoothly | FR-010 |
| BU6 | Ended view displays "Complete" or "Stopped" with total elapsed breathing time and "Start again" action | FR-014 |
| BU7 | Breathe screen displays its own settings/live session and is isolated from routine or run-walk sessions | FR-006 |
