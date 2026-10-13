import type { Cue, CueOpportunity, Phase } from '@/engine/types';
import { validateDefinition } from '@/session/validate';

import { sampleDefinition, sampleMode, soakDefinition } from './sample';

const def = sampleDefinition();
const handler = sampleMode.cueFor(def);

/** The opportunity the engine would give for second `sec` of phase `index`. */
function op(index: number, sec: number): CueOpportunity {
  const phase: Phase = def.phases[index];
  return {
    phase,
    index,
    sec,
    remaining: phase.durationSec === null ? null : phase.durationSec - sec,
    prev: def.phases[index - 1],
    next: def.phases[index + 1],
    at: 0,
    isPhaseStart: sec === 0,
  };
}

const asList = (c: Cue | Cue[] | null): Cue[] => (c === null ? [] : Array.isArray(c) ? c : [c]);
const types = (index: number, sec: number) => asList(handler.cueFor(op(index, sec))).map((c) => c.type);

describe('sample session', () => {
  it('is a valid definition with the four phases from the quickstart', () => {
    expect(validateDefinition(def, (id) => id === 'sample')).toEqual([]);
    expect(def.modeId).toBe('sample');
    expect(def.keepScreenOn).toBe(true);
    expect(def.phases.map((p) => [p.title, p.durationSec])).toEqual([
      ['Get ready', 10],
      ['Tap Skip when ready', null],
      ['Interval', 20],
      ['Cool down', 15],
    ]);
  });

  it('says the phase title at each phase start', () => {
    def.phases.forEach((phase, i) => {
      expect(asList(handler.cueFor(op(i, 0)))).toEqual([{ type: 'say', text: phase.title, interrupt: true }]);
    });
  });

  it('beeps at 3 and 2 s left and gives the final beep at 1 s left before a phase change', () => {
    expect([types(0, 7), types(0, 8), types(0, 9)]).toEqual([['beep'], ['beep'], ['beepLast']]);
    expect([types(2, 17), types(2, 18), types(2, 19)]).toEqual([['beep'], ['beep'], ['beepLast']]);
  });

  it('beeps at 3, 2 and 1 s left in the last phase, where the chime follows', () => {
    expect([types(3, 12), types(3, 13), types(3, 14)]).toEqual([['beep'], ['beep'], ['beep']]);
  });

  it('says "Halfway" 10 s into the interval', () => {
    expect(asList(handler.cueFor(op(2, 10)))).toEqual([{ type: 'say', text: 'Halfway' }]);
  });

  it('is silent on other seconds, including the rest of the untimed phase', () => {
    expect(types(0, 3)).toEqual([]);
    expect(types(1, 5)).toEqual([]);
    expect(types(1, 120)).toEqual([]);
    expect(types(2, 5)).toEqual([]);
  });

  it('ends with the chime, then "Sample complete" 700 ms later', () => {
    expect(asList(handler.completion(0))).toEqual([
      { type: 'chime' },
      { type: 'say', text: 'Sample complete', offsetMs: 700 },
    ]);
  });
});

describe('60-minute soak (SC-003)', () => {
  const soak = soakDefinition();
  const total = soak.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);

  it('is a valid sample-mode session of exactly 60 minutes', () => {
    expect(validateDefinition(soak, (id) => id === 'sample')).toEqual([]);
    expect(soak.modeId).toBe('sample');
    expect(total).toBe(60 * 60);
  });

  it('repeats the timed sample phases in order, with no untimed phase', () => {
    const timed = def.phases.filter((p) => p.durationSec !== null);
    expect(soak.phases.every((p) => p.durationSec !== null)).toBe(true);
    soak.phases.forEach((p, i) => expect(p).toEqual(timed[i % timed.length]));
  });

  it('lets the screen turn off, since the soak is run with the screen off', () => {
    expect(soak.keepScreenOn).toBe(false);
  });
});
