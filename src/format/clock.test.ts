import { formatClock, formatTimeOfDay, spokenDuration } from './clock';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59, '0:59'],
    [60, '1:00'],
    [754, '12:34'],
    [3_599, '59:59'],
    [3_600, '1:00:00'],
    [3_725, '1:02:05'],
  ])('formats %i s as %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });

  it('drops fractions and clamps negatives to zero', () => {
    expect(formatClock(9.9)).toBe('0:09');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('formatTimeOfDay', () => {
  it('gives hours and minutes of the local time', () => {
    const text = formatTimeOfDay(new Date(2026, 9, 13, 7, 5).getTime());
    expect(text).toMatch(/7:05/);
    expect(text).not.toMatch(/:00$/); // no seconds
  });
});

describe('spokenDuration', () => {
  it.each([
    [0, '0 seconds'],
    [1, '1 second'],
    [75, '1 minute 15 seconds'],
    [120, '2 minutes'],
    [3_661, '1 hour 1 minute 1 second'],
  ])('reads %i s as "%s"', (seconds, text) => {
    expect(spokenDuration(seconds)).toBe(text);
  });
});
