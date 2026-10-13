import { LIMITS, PRESETS, defaultSettings } from './settings';

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
