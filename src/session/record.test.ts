import type { SessionSnapshot } from '@/engine/types';

import { assessRecord, parseRecord, toRecord } from './record';
import type { SessionDefinition, SessionRecord } from './types';

const T = 1_700_000_000_000;
const MIN = 60_000;

const definition: SessionDefinition = {
  modeId: 'sample',
  title: 'Run',
  phases: [
    { kind: 'a', title: 'A', durationSec: 60 },
    { kind: 'b', title: 'B', durationSec: 120 },
    { kind: 'wait', title: 'Wait', durationSec: null },
    { kind: 'c', title: 'C', durationSec: 60 },
  ],
  settings: { pace: 5 },
  keepScreenOn: false,
};

const snapshot = (over: Partial<SessionSnapshot>): SessionSnapshot => ({
  status: 'running',
  index: 0,
  phase: definition.phases[0],
  phaseElapsedMs: 0,
  phaseRemainingMs: 60_000,
  totalElapsedMs: 0,
  ...over,
});

const record = (over: Partial<SessionRecord>): SessionRecord => ({
  version: 1,
  definition,
  status: 'running',
  index: 0,
  phaseStartAt: T,
  pausedAt: null,
  writtenAt: T,
  ...over,
});

describe('toRecord / parseRecord', () => {
  it('stores wall-clock anchors for a running session', () => {
    const r = toRecord(definition, snapshot({ index: 1, phaseElapsedMs: 30_000 }), T);
    expect(r).toEqual(record({ index: 1, phaseStartAt: T - 30_000, writtenAt: T }));
  });

  it('stores the pause time for a paused session', () => {
    const r = toRecord(definition, snapshot({ status: 'paused', index: 1, phaseElapsedMs: 30_000 }), T);
    expect(r).toMatchObject({ status: 'paused', phaseStartAt: T - 30_000, pausedAt: T });
  });

  it('round-trips through JSON', () => {
    const r = record({ status: 'paused', pausedAt: T + 5 });
    expect(parseRecord(JSON.stringify(r))).toEqual(r);
  });

  it.each([
    ['null', null],
    ['bad JSON', '{not json'],
    ['another version', JSON.stringify({ ...record({}), version: 2 })],
    ['a missing definition', JSON.stringify({ ...record({}), definition: undefined })],
    ['an unknown status', JSON.stringify({ ...record({}), status: 'done' })],
    ['an index out of range', JSON.stringify(record({ index: 9 }))],
  ])('rejects %s', (_name, raw) => {
    expect(parseRecord(raw)).toBeNull();
  });
});

describe('assessRecord (FR-024, FR-025)', () => {
  it('returns none without a record', () => {
    expect(assessRecord(null, T)).toEqual({ kind: 'none' });
  });

  it('reports the clock when now is before the last write', () => {
    expect(assessRecord(record({ writtenAt: T }), T - 1)).toEqual({
      kind: 'interrupted',
      reason: 'clock',
      title: 'Run',
      at: T,
    });
  });

  it('reports a stale record last written more than 60 minutes ago', () => {
    const r = record({ status: 'paused', pausedAt: T, index: 2 });
    expect(assessRecord(r, T + 60 * MIN)).toMatchObject({ kind: 'resume' });
    expect(assessRecord(r, T + 60 * MIN + 1)).toEqual({ kind: 'interrupted', reason: 'stale', title: 'Run', at: T });
  });

  it('resumes a paused session paused, at the same elapsed time', () => {
    const r = record({ status: 'paused', index: 1, phaseStartAt: T - 40_000, pausedAt: T, writtenAt: T });
    expect(assessRecord(r, T + 10 * MIN)).toEqual({
      kind: 'resume',
      assessment: { definition, index: 1, phaseElapsedMs: 40_000, paused: true },
    });
  });

  it('resumes a running session at the clock position in the same phase', () => {
    const r = record({ index: 1, phaseStartAt: T - 30_000, writtenAt: T });
    expect(assessRecord(r, T + 20_000)).toEqual({
      kind: 'resume',
      assessment: { definition, index: 1, phaseElapsedMs: 50_000, paused: false },
    });
  });

  it('walks forward through timed phases that ended while the app was dead', () => {
    const r = record({ index: 0, phaseStartAt: T, writtenAt: T + 10_000 });
    // A ends at T+60 s, B at T+180 s; at T+100 s the session is 40 s into B.
    expect(assessRecord(r, T + 100_000)).toMatchObject({
      kind: 'resume',
      assessment: { index: 1, phaseElapsedMs: 40_000, paused: false },
    });
  });

  it('stops at an untimed phase, which waits for the user', () => {
    const r = record({ index: 0, phaseStartAt: T, writtenAt: T + 10_000 });
    expect(assessRecord(r, T + 30 * MIN)).toMatchObject({
      kind: 'resume',
      assessment: { index: 2, phaseElapsedMs: 30 * MIN - 180_000, paused: false },
    });
  });

  it('reports a session that would have finished', () => {
    const r = record({ index: 3, phaseStartAt: T, writtenAt: T + 10_000 });
    expect(assessRecord(r, T + 59_999)).toMatchObject({ kind: 'resume', assessment: { index: 3 } });
    expect(assessRecord(r, T + 60_000)).toEqual({
      kind: 'interrupted',
      reason: 'finished',
      title: 'Run',
      at: T + 10_000,
    });
  });
});
