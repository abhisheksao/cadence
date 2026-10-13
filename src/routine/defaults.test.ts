import { MAX_STEPS, MAX_STEP_SEC, MAX_TITLE, MIN_STEP_SEC, defaultRoutine } from './defaults';

describe('default routine (FR-002)', () => {
  it('has the six default steps with their durations', () => {
    let n = 0;
    const routine = defaultRoutine(() => `id${++n}`);
    expect(routine.version).toBe(1);
    expect(routine.steps.map((s) => [s.title, s.durationSec])).toEqual([
      ['Drink a glass of water', 60],
      ['Make the bed', null],
      ['Stretch', 300],
      ['Breathing', 180],
      ['Plan the day', 180],
      ['Shower', null],
    ]);
    expect(routine.steps.map((s) => s.id)).toEqual(['id1', 'id2', 'id3', 'id4', 'id5', 'id6']);
  });

  it('exports the limits from the data model', () => {
    expect([MIN_STEP_SEC, MAX_STEP_SEC, MAX_STEPS, MAX_TITLE]).toEqual([15, 3_600, 30, 60]);
  });
});
