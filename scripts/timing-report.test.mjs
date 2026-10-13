import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { analyse, parseLine, percentile } from './timing-report.mjs';

const fixture = (name) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8').split('\n');
const cue = (type, planned, err, phase = 0) =>
  `CADENCE_CUE v=1 type=${type} planned=${planned} actual=${planned + err} err=${err} phase=${phase}`;

describe('parseLine', () => {
  it('reads a cue line, with or without the logcat prefix', () => {
    const expected = { type: 'say', planned: 1000, actual: 1180, err: 180, phase: 2 };
    expect(parseLine(cue('say', 1000, 180, 2))).toEqual(expected);
    expect(parseLine(`10-13 07:00:00.000  4242  4300 I ReactNativeJS: ${cue('say', 1000, 180, 2)}`)).toEqual(expected);
  });

  it.each([
    ['another log line', '10-13 07:00:00.000 I ReactNativeJS: Running "main"'],
    ['another version', 'CADENCE_CUE v=2 type=beep planned=1 actual=2 err=1 phase=0'],
    ['an unknown cue type', 'CADENCE_CUE v=1 type=boop planned=1 actual=2 err=1 phase=0'],
    ['a missing field', 'CADENCE_CUE v=1 type=beep planned=1 actual=2 phase=0'],
    ['an empty line', ''],
  ])('ignores %s', (_name, text) => {
    expect(parseLine(text)).toBeNull();
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(10);
    expect(percentile(values, 95)).toBe(19);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('analyse', () => {
  it('reports p50/p95 of |err| per cue type', () => {
    const lines = [cue('beep', 0, -40), cue('beep', 1000, 10), cue('beep', 2000, 20), cue('say', 3000, 250)];
    const { types } = analyse(lines);
    expect(types.beep).toMatchObject({ count: 3, p50: 20, p95: 40 });
    expect(types.say).toMatchObject({ count: 1, p50: 250, p95: 250 });
    expect(types.chime).toBeUndefined();
  });

  it('compares the first and last 5 minutes of the session', () => {
    const MIN = 60_000;
    const lines = [cue('beep', 0, 10), cue('beep', 4 * MIN, 20), cue('beep', 30 * MIN, 999), cue('beep', 56 * MIN, 30), cue('beep', 60 * MIN, 40)];
    expect(analyse(lines).types.beep).toMatchObject({ firstP95: 20, lastP95: 40 });
  });

  it('passes a good 60-minute run', () => {
    const report = analyse(fixture('good.log'));
    expect(report.failures).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.types.beep.count).toBe(240);
    expect(report.types.say.count).toBe(80);
    expect(report.types.chime.count).toBe(1);
  });

  it('fails when speech p95 is over 300 ms (SC-001)', () => {
    const report = analyse(fixture('slow-speech.log'));
    expect(report.ok).toBe(false);
    expect(report.failures).toEqual([expect.stringMatching(/^say p95 \d+ ms > 300 ms/)]);
  });

  it('fails when beeps p95 is over 150 ms (SC-001)', () => {
    const report = analyse([cue('beep', 0, 151), cue('beepLast', 1000, 10)]);
    expect(report.failures).toEqual([expect.stringMatching(/^beep p95 151 ms > 150 ms/)]);
  });

  it('fails when the last 5 minutes are more than 50 ms worse than the first (SC-002)', () => {
    const report = analyse(fixture('drift.log'));
    expect(report.ok).toBe(false);
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.stringMatching(/^beep drift \d+ ms > 50 ms/)]),
    );
  });

  it('fails when there are no cue lines at all', () => {
    expect(analyse(['nothing here']).failures).toEqual(['no CADENCE_CUE lines found']);
  });
});
