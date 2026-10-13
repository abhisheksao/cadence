import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';

import { Engine } from './engine';
import type { Cue, CueHandler, CueOpportunity, Phase, SessionSnapshot } from './types';

const T0 = 1_000_000;

const timed = (title: string, durationSec: number): Phase => ({ kind: 'step', title, durationSec });

/** Builds an engine whose handler records every opportunity and returns a beep for each. */
function setup(phases: Phase[], options: { jitterMs?: number; seed?: number } = {}) {
  const clock = new FakeClock(T0);
  const scheduler = new FakeScheduler(clock, options);
  const ops: { op: CueOpportunity; calledAt: number }[] = [];
  const completions: { at: number; calledAt: number }[] = [];
  const cues: { cue: Cue; at: number; phase: number }[] = [];
  const handler: CueHandler = {
    cueFor(op) {
      ops.push({ op, calledAt: clock.now() });
      return { type: 'beep' };
    },
    completion(at) {
      completions.push({ at, calledAt: clock.now() });
      return [{ type: 'chime' }, { type: 'say', text: 'Done', offsetMs: 700 }];
    },
  };
  const statuses: string[] = [];
  const engine = new Engine(
    phases,
    handler,
    {
      onCue: (cue, at, phase) => cues.push({ cue, at, phase }),
      onStatusChange: (s) => statuses.push(s),
    },
    { clock, scheduler },
  );
  return { clock, scheduler, engine, ops, completions, cues, statuses };
}

describe('Engine: timing', () => {
  it('E1: does not start with no phases', () => {
    const { engine, scheduler, ops } = setup([]);
    engine.start();
    scheduler.advance(5_000);
    expect(engine.snapshot().status).toBe('idle');
    expect(ops).toHaveLength(0);
  });

  it('E2: gives one cue opportunity per whole second, due at phase start + sec', () => {
    const { engine, scheduler, ops } = setup([timed('A', 3), timed('B', 2), timed('C', 4)]);
    engine.start();
    scheduler.advance(10_000);

    expect(ops.map(({ op }) => [op.index, op.sec, op.at - T0])).toEqual([
      [0, 0, 0],
      [0, 1, 1_000],
      [0, 2, 2_000],
      [1, 0, 3_000],
      [1, 1, 4_000],
      [2, 0, 5_000],
      [2, 1, 6_000],
      [2, 2, 7_000],
      [2, 3, 8_000],
    ]);
    const first = ops[0].op;
    expect(first.remaining).toBe(3);
    expect(first.isPhaseStart).toBe(true);
    expect(first.next?.title).toBe('B');
    expect(ops[3].op.prev?.title).toBe('A');
    expect(ops[1].op.isPhaseStart).toBe(false);
  });

  it('E3: hands out cues no more than 1 s early, in order', () => {
    const { engine, scheduler, ops } = setup([timed('A', 5), timed('B', 5)]);
    engine.start();
    scheduler.advance(12_000);

    ops.forEach(({ op, calledAt }, i) => {
      expect(op.at - calledAt).toBeLessThanOrEqual(1_000);
      expect(op.at - calledAt).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(op.at).toBeGreaterThan(ops[i - 1].op.at);
    });
  });

  it('E3: passes the due time to onCue, plus any cue offset, with the phase index', () => {
    const { engine, scheduler, cues } = setup([timed('A', 2), timed('B', 1)]);
    engine.start();
    scheduler.advance(4_000);

    expect(cues.filter((c) => c.cue.type === 'beep').map((c) => [c.at - T0, c.phase])).toEqual([
      [0, 0],
      [1_000, 0],
      [2_000, 1],
    ]);
    expect(cues.filter((c) => c.cue.type !== 'beep').map((c) => [c.cue.type, c.at - T0])).toEqual([
      ['chime', 3_000],
      ['say', 3_700],
    ]);
  });

  it('E4: changes phase exactly on the boundary even when ticks run 300 ms late', () => {
    const { engine, scheduler, clock, ops } = setup([timed('A', 3), timed('B', 3)], { jitterMs: 300, seed: 3 });
    engine.start();
    scheduler.advance(2_900);
    expect(engine.snapshot().index).toBe(0);

    scheduler.advance(400); // now T0 + 3300
    const snap = engine.snapshot();
    expect(snap.index).toBe(1);
    expect(snap.phaseElapsedMs).toBe(clock.now() - (T0 + 3_000));
    expect(ops.filter(({ op }) => op.index === 1)[0].op.at).toBe(T0 + 3_000);
  });

  it('E5: keeps every cue on its planned second over 60 minutes of jittery ticks', () => {
    const phases = Array.from({ length: 60 }, (_, i) => timed(`Minute ${i + 1}`, 60));
    const { engine, scheduler, ops } = setup(phases, { jitterMs: 300, seed: 11 });
    engine.start();
    scheduler.advance(61 * 60_000);

    expect(ops).toHaveLength(3_600);
    ops.forEach(({ op }) => expect(op.at).toBe(T0 + (op.index * 60 + op.sec) * 1_000));
    expect(engine.snapshot().status).toBe('done');
  });

  it('E14: asks for the completion cue once, at the exact end time', () => {
    const { engine, scheduler, completions, statuses } = setup([timed('A', 2), timed('B', 3)], {
      jitterMs: 250,
      seed: 5,
    });
    engine.start();
    scheduler.advance(10_000);

    expect(completions).toHaveLength(1);
    expect(completions[0].at).toBe(T0 + 5_000);
    expect(completions[0].at - completions[0].calledAt).toBeLessThanOrEqual(1_000);
    expect(statuses).toEqual(['running', 'done']);
  });

  it('E15: emits snapshots at least every 250 ms while running', () => {
    const { engine, scheduler, clock } = setup([timed('A', 10)], { jitterMs: 100, seed: 2 });
    const emittedAt: number[] = [];
    const seen: SessionSnapshot[] = [];
    engine.subscribe((s) => {
      emittedAt.push(clock.now());
      seen.push(s);
    });
    engine.start();
    scheduler.advance(5_000);

    const running = emittedAt.slice(1); // the first is the idle snapshot on subscribe
    for (let i = 1; i < running.length; i++) expect(running[i] - running[i - 1]).toBeLessThanOrEqual(250);
    expect(seen[0].status).toBe('idle');
    const last = seen[seen.length - 1];
    expect(last.status).toBe('running');
    expect(last.phaseElapsedMs + (last.phaseRemainingMs ?? 0)).toBe(10_000);
  });

  it('reports elapsed and remaining time in the snapshot', () => {
    const { engine, scheduler } = setup([timed('A', 3), { kind: 'step', title: 'Untimed', durationSec: null }]);
    engine.start();
    scheduler.advance(1_500);
    expect(engine.snapshot()).toMatchObject({
      status: 'running',
      index: 0,
      phaseElapsedMs: 1_500,
      phaseRemainingMs: 1_500,
      totalElapsedMs: 1_500,
    });

    scheduler.advance(2_000); // into the untimed phase
    expect(engine.snapshot()).toMatchObject({
      index: 1,
      phaseElapsedMs: 500,
      phaseRemainingMs: null,
      totalElapsedMs: 3_500,
    });
  });
});

describe('Engine: catch-up', () => {
  it('E6: after a long gap, announces only the phase it lands in and drops stale cues', () => {
    const { engine, scheduler, clock, ops } = setup([timed('A', 10), timed('B', 10), timed('C', 10)]);
    engine.start();
    scheduler.advance(3_000);
    const before = ops.length;

    scheduler.suspend(25_000); // app frozen; now T0 + 28 s, 8 s into phase C
    scheduler.advance(100);
    const now = clock.now();
    const after = ops.slice(before).map(({ op }) => op);

    const starts = after.filter((op) => op.isPhaseStart);
    expect(starts).toHaveLength(1);
    expect(starts[0].index).toBe(2);
    expect(starts[0].at).toBe(now); // announced now, not in the past
    after
      .filter((op) => !op.isPhaseStart)
      .forEach((op) => expect(op.at).toBeGreaterThanOrEqual(now - 2_000));
    expect(after.some((op) => op.index === 1)).toBe(false);
    expect(engine.snapshot().index).toBe(2);
  });

  it('still plays slightly late cues (under 2 s) instead of dropping them', () => {
    const { engine, scheduler, ops } = setup([timed('A', 10)]);
    engine.start();
    scheduler.advance(1_000);
    scheduler.suspend(1_500);
    scheduler.advance(100);

    const secs = ops.map(({ op }) => op.sec);
    expect(secs).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });

  it('still asks for the completion cue once when a gap runs past the end', () => {
    const { engine, scheduler, completions } = setup([timed('A', 5)]);
    engine.start();
    scheduler.advance(1_000);
    scheduler.suspend(30_000);
    scheduler.advance(100);

    expect(completions).toHaveLength(1);
    expect(engine.snapshot().status).toBe('done');
  });
});
