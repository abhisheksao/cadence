import { runWalkDefinition } from '@/modes/runWalk';

import {
  LIMITS,
  PRESETS,
  adjust,
  applyPreset,
  canAdjust,
  defaultSettings,
  matchingPreset,
  totalSec,
} from './settings';
import type { RunWalkSettings } from './types';

describe('defaultSettings (FR-002)', () => {
  it('is the data-model default', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      warmupSec: 300,
      runSec: 60,
      walkSec: 90,
      rounds: 8,
      cooldownSec: 300,
      announceRound: true,
      halfway: true,
      timeLeft: true,
      keepScreenOn: false,
    });
  });

  it('returns a fresh value each time', () => {
    expect(defaultSettings()).not.toBe(defaultSettings());
  });
});

describe('LIMITS (FR-001, FR-004)', () => {
  it.each([
    ['runSec', 15, 1_800, 15],
    ['walkSec', 15, 1_800, 15],
    ['rounds', 1, 30, 1],
    ['warmupSec', 0, 1_800, 60],
    ['cooldownSec', 0, 1_800, 60],
  ] as const)('%s ranges %i–%i in steps of %i', (field, min, max, step) => {
    expect(LIMITS[field]).toEqual({ min, max, step });
  });
});

describe('PRESETS (FR-003)', () => {
  it('lists the four presets in order', () => {
    expect(PRESETS).toEqual([
      { label: '1:00 / 1:30 ×8', runSec: 60, walkSec: 90, rounds: 8 },
      { label: '1:30 / 2:00 ×6', runSec: 90, walkSec: 120, rounds: 6 },
      { label: '2:00 / 1:00 ×6', runSec: 120, walkSec: 60, rounds: 6 },
      { label: '5:00 / 1:00 ×4', runSec: 300, walkSec: 60, rounds: 4 },
    ]);
  });
});

describe('adjust and canAdjust (WS1)', () => {
  it.each([
    ['warmupSec', 60, -1, 0, true],
    ['warmupSec', 0, 1, 60, true],
    ['warmupSec', 0, -1, 0, false],
    ['warmupSec', 1_800, 1, 1_800, false],
    ['warmupSec', 1_800, -1, 1_740, true],
    ['runSec', 15, -1, 15, false],
    ['runSec', 15, 1, 30, true],
    ['runSec', 1_800, 1, 1_800, false],
    ['runSec', 1_800, -1, 1_785, true],
    ['walkSec', 15, -1, 15, false],
    ['walkSec', 15, 1, 30, true],
    ['walkSec', 1_800, 1, 1_800, false],
    ['walkSec', 1_800, -1, 1_785, true],
    ['rounds', 1, -1, 1, false],
    ['rounds', 1, 1, 2, true],
    ['rounds', 30, 1, 30, false],
    ['rounds', 30, -1, 29, true],
    ['cooldownSec', 0, -1, 0, false],
    ['cooldownSec', 0, 1, 60, true],
    ['cooldownSec', 1_800, 1, 1_800, false],
    ['cooldownSec', 1_800, -1, 1_740, true],
  ] as const)('%s at %i dir %i -> %i (canAdjust=%s)', (field, current, dir, expected, can) => {
    const s = { ...defaultSettings(), [field]: current };
    expect(canAdjust(s, field, dir)).toBe(can);
    const adjusted = adjust(s, field, dir);
    expect(adjusted[field]).toBe(expected);
    expect(s[field]).toBe(current);
  });

  it('canAdjust is false above max or below min', () => {
    expect(canAdjust({ ...defaultSettings(), rounds: 0 }, 'rounds', -1)).toBe(false);
    expect(canAdjust({ ...defaultSettings(), rounds: 31 }, 'rounds', 1)).toBe(false);
  });
});

describe('applyPreset and matchingPreset (WS2)', () => {
  it('applyPreset changes run, walk, and rounds only', () => {
    const base: RunWalkSettings = {
      ...defaultSettings(),
      warmupSec: 0,
      cooldownSec: 600,
      announceRound: false,
      halfway: false,
      timeLeft: false,
      keepScreenOn: true,
    };
    const preset = PRESETS[2];
    const result = applyPreset(base, preset);
    expect(result).toEqual({
      ...base,
      runSec: preset.runSec,
      walkSec: preset.walkSec,
      rounds: preset.rounds,
    });
  });

  it('matchingPreset returns the preset for an exact match', () => {
    for (const p of PRESETS) {
      const s = applyPreset(defaultSettings(), p);
      expect(matchingPreset(s)).toEqual(p);
    }
  });

  it.each([
    ['runSec differs', { runSec: 75 }],
    ['walkSec differs', { walkSec: 105 }],
    ['rounds differs', { rounds: 7 }],
  ])('matchingPreset returns null when %s', (_name, patch) => {
    const s = { ...defaultSettings(), ...patch };
    expect(matchingPreset(s)).toBeNull();
  });
});

describe('totalSec (WS3)', () => {
  it.each([
    ['defaults', defaultSettings()],
    ['no warmup', { ...defaultSettings(), warmupSec: 0 }],
    ['no cooldown', { ...defaultSettings(), cooldownSec: 0 }],
    ['no warmup and no cooldown', { ...defaultSettings(), warmupSec: 0, cooldownSec: 0 }],
    ['1 round with cooldown', { ...defaultSettings(), rounds: 1, cooldownSec: 300 }],
    ['1 round without cooldown', { ...defaultSettings(), rounds: 1, cooldownSec: 0 }],
    ['preset 1', applyPreset(defaultSettings(), PRESETS[0])],
    ['preset 2', applyPreset(defaultSettings(), PRESETS[1])],
    ['preset 3', applyPreset(defaultSettings(), PRESETS[2])],
    ['preset 4', applyPreset(defaultSettings(), PRESETS[3])],
  ])('equals sum of definition phases for %s', (_name, s) => {
    const expected = runWalkDefinition(s).phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);
    expect(totalSec(s)).toBe(expected);
  });
});
