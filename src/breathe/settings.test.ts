import {
  LIMITS,
  PRESETS,
  defaultSettings,
} from './settings';

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
