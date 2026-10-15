import {
  LIMITS,
  PRESETS,
  adjust,
  applyPreset,
  calculateCycles,
  canAdjust,
  defaultSettings,
  matchingPreset,
  totalSec,
} from './settings';
import type { BreatheField, BreatheSettings } from './types';

const settings = (over: Partial<BreatheSettings> = {}): BreatheSettings => ({ ...defaultSettings(), ...over });

describe('defaultSettings', () => {
  it('matches the default settings', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      inhaleSec: 4,
      holdSec: 4,
      exhaleSec: 4,
      postHoldSec: 4,
      targetMinutes: 3,
      prepEnabled: true,
      cueStyle: 'voice',
      keepScreenOn: false,
    });
  });

  it('returns a fresh value each time', () => {
    expect(defaultSettings()).not.toBe(defaultSettings());
  });
});

describe('LIMITS', () => {
  it.each([
    ['inhaleSec', 1, 30, 1],
    ['holdSec', 0, 30, 1],
    ['exhaleSec', 1, 30, 1],
    ['postHoldSec', 0, 30, 1],
    ['targetMinutes', 1, 30, 1],
  ] as const)('%s ranges %i–%i in steps of %i', (field, min, max, step) => {
    expect(LIMITS[field]).toEqual({ min, max, step });
  });
});

describe('PRESETS', () => {
  it('lists the four presets in order', () => {
    expect(PRESETS).toEqual([
      {
        id: 'box',
        name: 'Box (4-4-4-4)',
        inhaleSec: 4,
        holdSec: 4,
        exhaleSec: 4,
        postHoldSec: 4,
        targetMinutes: 3,
      },
      {
        id: '4-7-8',
        name: '4-7-8 Relax',
        inhaleSec: 4,
        holdSec: 7,
        exhaleSec: 8,
        postHoldSec: 0,
        targetMinutes: 2,
      },
      {
        id: '3-4-7',
        name: '3-4-7 Calm',
        inhaleSec: 3,
        holdSec: 4,
        exhaleSec: 7,
        postHoldSec: 0,
        targetMinutes: 2,
      },
      {
        id: 'coherent',
        name: 'Coherent (5-5)',
        inhaleSec: 5,
        holdSec: 0,
        exhaleSec: 5,
        postHoldSec: 0,
        targetMinutes: 5,
      },
    ]);
  });
});

describe('adjust and canAdjust (BS1)', () => {
  it.each([
    ['inhaleSec', 1, 2, false, true],
    ['inhaleSec', 10, 11, true, true],
    ['inhaleSec', 30, 30, true, false],
    ['holdSec', 0, 1, false, true],
    ['holdSec', 10, 11, true, true],
    ['holdSec', 30, 30, true, false],
    ['exhaleSec', 1, 2, false, true],
    ['exhaleSec', 30, 30, true, false],
    ['postHoldSec', 0, 1, false, true],
    ['postHoldSec', 30, 30, true, false],
    ['targetMinutes', 1, 2, false, true],
    ['targetMinutes', 30, 30, true, false],
  ] as const)('%s: at %i, adjust +1 gives %i; canAdjust is (-1: %s, +1: %s)', (field, start, afterPlus, canMinus, canPlus) => {
    const s = settings({ [field]: start });
    expect(canAdjust(s, field as BreatheField, -1)).toBe(canMinus);
    expect(canAdjust(s, field as BreatheField, 1)).toBe(canPlus);
    expect(adjust(s, field as BreatheField, 1)[field as BreatheField]).toBe(afterPlus);
  });

  it('adjust -1 clamps at min', () => {
    const s = settings({ inhaleSec: 1, holdSec: 0 });
    expect(adjust(s, 'inhaleSec', -1).inhaleSec).toBe(1);
    expect(adjust(s, 'holdSec', -1).holdSec).toBe(0);
  });
});

describe('applyPreset and matchingPreset (BS2)', () => {
  it.each(PRESETS)('applies preset %s and matchingPreset detects it', (preset) => {
    const applied = applyPreset(defaultSettings(), preset);
    expect(applied).toMatchObject({
      inhaleSec: preset.inhaleSec,
      holdSec: preset.holdSec,
      exhaleSec: preset.exhaleSec,
      postHoldSec: preset.postHoldSec,
      targetMinutes: preset.targetMinutes,
    });
    expect(matchingPreset(applied)).toEqual(preset);
  });

  it('matchingPreset returns null when any single value differs', () => {
    const box = defaultSettings();
    expect(matchingPreset(box)).toEqual(PRESETS[0]);
    expect(matchingPreset({ ...box, inhaleSec: 5 })).toBeNull();
    expect(matchingPreset({ ...box, holdSec: 3 })).toBeNull();
    expect(matchingPreset({ ...box, exhaleSec: 5 })).toBeNull();
    expect(matchingPreset({ ...box, postHoldSec: 0 })).toBeNull();
    expect(matchingPreset({ ...box, targetMinutes: 4 })).toBeNull();
  });
});

describe('calculateCycles and totalSec (BS3)', () => {
  it.each([
    ['box (4-4-4-4, 3m)', settings(), 11, 181],
    ['box prep off', settings({ prepEnabled: false }), 11, 176],
    ['4-7-8 (4-7-8-0, 2m)', applyPreset(defaultSettings(), PRESETS[1]), 6, 119],
    ['3-4-7 (3-4-7-0, 2m)', applyPreset(defaultSettings(), PRESETS[2]), 9, 131],
    ['coherent (5-0-5-0, 5m)', applyPreset(defaultSettings(), PRESETS[3]), 30, 305],
  ])('%s gives %i cycles and %i seconds total', (_name, s, expectedCycles, expectedTotal) => {
    expect(calculateCycles(s)).toBe(expectedCycles);
    expect(totalSec(s)).toBe(expectedTotal);
  });
});
