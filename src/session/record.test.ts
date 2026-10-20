import type { SessionSnapshot } from '@/engine/types';

import { assessRecord, parseRecord, recoveryNow, toRecord } from './record';
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

  it('stores elapsedAt and bootCount when given (CL3)', () => {
    const r = toRecord(definition, snapshot({ index: 1, phaseElapsedMs: 30_000 }), T, {
      elapsed: () => 123_456,
      bootCount: () => 42,
    });
    expect(r).toEqual(
      record({
        index: 1,
        phaseStartAt: T - 30_000,
        writtenAt: T,
        elapsedAt: 123_456,
        bootCount: 42,
      }),
    );
  });

  it('stores the pause time for a paused session', () => {
    const r = toRecord(definition, snapshot({ status: 'paused', index: 1, phaseElapsedMs: 30_000 }), T);
    expect(r).toMatchObject({ status: 'paused', phaseStartAt: T - 30_000, pausedAt: T });
  });

  it('round-trips through JSON with optional elapsedAt/bootCount', () => {
    const r = record({ status: 'paused', pausedAt: T + 5, elapsedAt: 50_000, bootCount: 3 });
    expect(parseRecord(JSON.stringify(r))).toEqual(r);
  });

  it('parses legacy records without elapsedAt/bootCount (CL4)', () => {
    const r = record({ status: 'running' });
    const raw = JSON.stringify(r);
    const parsed = parseRecord(raw);
    expect(parsed).toEqual(r);
    expect(parsed?.elapsedAt).toBeUndefined();
    expect(parsed?.bootCount).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['bad JSON', '{not json'],
    ['another version', JSON.stringify({ ...record({}), version: 2 })],
    ['a missing definition', JSON.stringify({ ...record({}), definition: undefined })],
    ['an unknown status', JSON.stringify({ ...record({}), status: 'done' })],
    ['an index out of range', JSON.stringify(record({ index: 9 }))],
    ['negative elapsedAt (CL4)', JSON.stringify(record({ elapsedAt: -1 }))],
    ['string elapsedAt (CL4)', JSON.stringify(record({ elapsedAt: '123' as unknown as number }))],
    ['non-finite elapsedAt (CL4)', JSON.stringify(record({ elapsedAt: Infinity }))],
    ['negative bootCount (CL4)', JSON.stringify(record({ bootCount: -1 }))],
    ['float bootCount (CL4)', JSON.stringify(record({ bootCount: 1.5 }))],
    ['string bootCount (CL4)', JSON.stringify(record({ bootCount: '42' as unknown as number }))],
  ])('rejects %s', (_name, raw) => {
    expect(parseRecord(raw)).toBeNull();
  });
});

describe('recoveryNow (CL5, CL6)', () => {
  it('uses elapsed time delta when bootCount matches and elapsed is present (CL5)', () => {
    const rec = record({ writtenAt: T, elapsedAt: 100_000, bootCount: 42 });
    // Real elapsed advanced 30s (130_000 - 100_000 = 30_000).
    // Wall time jumped forward by 2 hours (+7_200_000).
    const result = recoveryNow(rec, {
      elapsed: 130_000,
      bootCount: 42,
      wallNow: T + 7_200_000,
    });
    // Must be T + 30_000, completely independent of wallNow
    expect(result).toBe(T + 30_000);
  });

  it.each([
    ['rebooted (different bootCount)', { elapsedAt: 100_000, bootCount: 42 }, { elapsed: 130_000, bootCount: 43, wallNow: T + 50_000 }, T + 50_000],
    ['record missing bootCount', { elapsedAt: 100_000 }, { elapsed: 130_000, bootCount: 42, wallNow: T + 50_000 }, T + 50_000],
    ['options bootCount is null', { elapsedAt: 100_000, bootCount: 42 }, { elapsed: 130_000, bootCount: null, wallNow: T + 50_000 }, T + 50_000],
    ['record missing elapsedAt', { bootCount: 42 }, { elapsed: 130_000, bootCount: 42, wallNow: T + 50_000 }, T + 50_000],
    ['options elapsed is null (e.g. iOS/web)', { elapsedAt: 100_000, bootCount: 42 }, { elapsed: null, bootCount: 42, wallNow: T + 50_000 }, T + 50_000],
  ])('falls back to wallNow on %s (CL6)', (_scenario, recordFields, options, expected) => {
    const rec = record({ writtenAt: T, ...recordFields });
    expect(recoveryNow(rec, options)).toBe(expected);
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
