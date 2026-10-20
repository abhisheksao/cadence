import type { SessionSnapshot } from '@/engine/types';
import type { SessionDefinition } from '@/session/types';

import { formatClock, notificationState } from './notification';

const makeDefinition = (title = 'Morning Routine'): SessionDefinition => ({
  modeId: 'routine',
  title,
  phases: [],
  settings: null,
  keepScreenOn: true,
});

describe('formatClock (NS5)', () => {
  it('formats whole seconds under an hour as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_599_000)).toBe('59:59');
  });

  it('formats durations from 1 hour as h:mm:ss', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_665_000)).toBe('1:01:05');
    expect(formatClock(36_000_000)).toBe('10:00:00');
  });

  it('clamps negative milliseconds to 0:00', () => {
    expect(formatClock(-1_000)).toBe('0:00');
    expect(formatClock(-100)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(formatClock(1_999)).toBe('0:01');
    expect(formatClock(999)).toBe('0:00');
  });
});

describe('notificationState (NS1–NS5)', () => {
  const definition = makeDefinition('Morning Routine');

  it('NS1: running timed phase produces countdown timer with remainingMs and paused=false', () => {
    const snapshot: SessionSnapshot = {
      status: 'running',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', durationSec: 30 },
      phaseElapsedMs: 5_000,
      phaseRemainingMs: 25_000,
      totalElapsedMs: 5_000,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Pushups',
      timer: { kind: 'countdown', remainingMs: 25_000 },
      paused: false,
    });
  });

  it('NS1: phase with subtitle forms "<subtitle>: <title>"', () => {
    const snapshot: SessionSnapshot = {
      status: 'running',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', subtitle: 'Set 1', durationSec: 30 },
      phaseElapsedMs: 0,
      phaseRemainingMs: 30_000,
      totalElapsedMs: 0,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Set 1: Pushups',
      timer: { kind: 'countdown', remainingMs: 30_000 },
      paused: false,
    });
  });

  it('NS1 & NS5: clamps negative remainingMs to 0', () => {
    const snapshot: SessionSnapshot = {
      status: 'running',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', durationSec: 30 },
      phaseElapsedMs: 35_000,
      phaseRemainingMs: -5_000,
      totalElapsedMs: 35_000,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Pushups',
      timer: { kind: 'countdown', remainingMs: 0 },
      paused: false,
    });
  });

  it('NS2: running untimed phase produces elapsed timer with elapsedMs and paused=false', () => {
    const snapshot: SessionSnapshot = {
      status: 'running',
      index: 1,
      phase: { kind: 'step', title: 'Plank', durationSec: null },
      phaseElapsedMs: 12_345,
      phaseRemainingMs: null,
      totalElapsedMs: 42_345,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Plank',
      timer: { kind: 'elapsed', elapsedMs: 12_345 },
      paused: false,
    });
  });

  it('NS2 & NS5: clamps negative elapsedMs to 0', () => {
    const snapshot: SessionSnapshot = {
      status: 'running',
      index: 1,
      phase: { kind: 'step', title: 'Plank', durationSec: null },
      phaseElapsedMs: -1_000,
      phaseRemainingMs: null,
      totalElapsedMs: 0,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Plank',
      timer: { kind: 'elapsed', elapsedMs: 0 },
      paused: false,
    });
  });

  it('NS3: paused timed phase sets timer to null, paused=true, and formats frozen "m:ss left"', () => {
    const snapshot: SessionSnapshot = {
      status: 'paused',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', durationSec: 60 },
      phaseElapsedMs: 15_000,
      phaseRemainingMs: 45_000,
      totalElapsedMs: 15_000,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Paused · Pushups · 0:45 left',
      timer: null,
      paused: true,
    });
  });

  it('NS3: paused timed phase with subtitle formats "Paused · <subtitle>: <title> · m:ss left"', () => {
    const snapshot: SessionSnapshot = {
      status: 'paused',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', subtitle: 'Set 1', durationSec: 60 },
      phaseElapsedMs: 15_000,
      phaseRemainingMs: 45_000,
      totalElapsedMs: 15_000,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Paused · Set 1: Pushups · 0:45 left',
      timer: null,
      paused: true,
    });
  });

  it('NS3: paused untimed phase sets timer to null, paused=true, and formats frozen elapsed "m:ss"', () => {
    const snapshot: SessionSnapshot = {
      status: 'paused',
      index: 1,
      phase: { kind: 'step', title: 'Plank', durationSec: null },
      phaseElapsedMs: 75_000,
      phaseRemainingMs: null,
      totalElapsedMs: 135_000,
    };

    expect(notificationState(definition, snapshot)).toEqual({
      title: 'Morning Routine',
      text: 'Paused · Plank · 1:15',
      timer: null,
      paused: true,
    });
  });

  it('NS4: returns null when status is idle, done, stopped, or phase is undefined', () => {
    const base: SessionSnapshot = {
      status: 'idle',
      index: 0,
      phase: { kind: 'step', title: 'Pushups', durationSec: 30 },
      phaseElapsedMs: 0,
      phaseRemainingMs: 30_000,
      totalElapsedMs: 0,
    };

    expect(notificationState(definition, base)).toBeNull();
    expect(notificationState(definition, { ...base, status: 'done' })).toBeNull();
    expect(notificationState(definition, { ...base, status: 'stopped' })).toBeNull();
    expect(notificationState(definition, { ...base, status: 'running', phase: undefined })).toBeNull();
  });
});
