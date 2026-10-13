import { formatCueLog } from './timingLog';

describe('formatCueLog', () => {
  it('formats one grep-able line per cue', () => {
    expect(formatCueLog({ type: 'beep', planned: 1_700_000_001_000, actual: 1_700_000_001_042, phase: 2 })).toBe(
      'CADENCE_CUE v=1 type=beep planned=1700000001000 actual=1700000001042 err=42 phase=2',
    );
  });

  it('reports early starts as a negative error', () => {
    expect(formatCueLog({ type: 'say', planned: 5_000, actual: 4_930, phase: 0 })).toContain('err=-70');
  });

  it('only contains the documented fields (no spoken text)', () => {
    const line = formatCueLog({ type: 'say', planned: 5_000, actual: 5_100, phase: 1 });
    expect(line.split(' ').map((part) => part.split('=')[0])).toEqual([
      'CADENCE_CUE',
      'v',
      'type',
      'planned',
      'actual',
      'err',
      'phase',
    ]);
  });
});
