import { formatClock } from './clock';

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
