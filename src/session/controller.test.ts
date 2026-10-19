import type { CueHandler } from '@/engine/types';
import { createModeRegistry } from '@/modes/registry';
import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';
import { FakeBackgroundHost, FakeCuePlayer, MemoryStore } from '@/test-utils/fakes';

import { SessionController } from './controller';
import { RECORD_KEY, parseRecord, toRecord } from './record';
import type { SessionDefinition } from './types';

const T0 = 1_000_000;

/** Test mode: says the phase title at each start, beeps on every other second. */
const testHandler: CueHandler = {
  cueFor: (op) => (op.isPhaseStart ? { type: 'say', text: op.phase.title } : { type: 'beep' }),
  completion: () => ({ type: 'chime' }),
};

const definition = (title: string, durations: number[]): SessionDefinition => ({
  modeId: 'test',
  title,
  phases: durations.map((d, i) => ({ kind: 'step', title: `${title} ${i + 1}`, durationSec: d })),
  settings: {},
  keepScreenOn: false,
});

function setup() {
  const clock = new FakeClock(T0);
  const scheduler = new FakeScheduler(clock);
  const player = new FakeCuePlayer();
  const background = new FakeBackgroundHost();
  const store = new MemoryStore();
  const modes = createModeRegistry();
  modes.register({ id: 'test', route: '/sample', cueFor: () => testHandler });
  const controller = new SessionController({ clock, scheduler, player, background, store, modes });
  return { clock, scheduler, player, background, store, controller };
}

describe('SessionController: start', () => {
  it('C1: rejects an invalid definition without touching the background service', async () => {
    const { controller, background } = setup();
    await expect(controller.start({ ...definition('Bad', [5]), phases: [] })).rejects.toThrow(
      'phases: must not be empty',
    );
    expect(background.calls).toEqual([]);
    expect(controller.getState()).toBeNull();
  });

  it('C1: prepares and starts the background service before the engine', async () => {
    const { controller, background, player } = setup();
    let playedWhenServiceStarted = -1;
    const start = background.start.bind(background);
    background.start = async (info) => {
      playedWhenServiceStarted = player.played.length;
      return start(info);
    };

    await controller.start(definition('Run', [5, 5]));

    expect(background.calls.map((c) => c.kind)).toEqual(['prepare', 'start']);
    expect(background.callsOf('start')[0]).toMatchObject({ title: 'Run', text: 'Run 1' });
    expect(playedWhenServiceStarted).toBe(0);
    expect(player.initialised).toBe(1);
    expect(controller.getState()).toMatchObject({ status: 'running', title: 'Run', index: 0 });
  });

  it('C2: sends engine cues to the player with their due time and phase', async () => {
    const { controller, scheduler, player } = setup();
    await controller.start(definition('Run', [2, 2]));
    scheduler.advance(2_500);

    expect(player.played.map((p) => [p.cue.type, p.at - T0, p.phase])).toEqual([
      ['say', 0, 0],
      ['beep', 1_000, 0],
      ['say', 2_000, 1],
      ['beep', 3_000, 1],
    ]);
  });

  it('C5: keeps the background service up for 4 s after the session is done', async () => {
    const { controller, scheduler, background } = setup();
    let released = false;
    await controller.start(definition('Run', [2]));
    void background.keepAliveUntil?.then(() => {
      released = true;
    });

    scheduler.advance(2_100);
    expect(controller.getState()?.status).toBe('done');
    scheduler.advance(3_800);
    await Promise.resolve();
    expect(background.callsOf('stop')).toHaveLength(0);
    expect(released).toBe(false);

    scheduler.advance(200);
    await Promise.resolve();
    expect(background.callsOf('stop')).toHaveLength(1);
    expect(released).toBe(true);
  });

  it('C6: starting a second session stops the first and silences the player', async () => {
    const { controller, scheduler, player } = setup();
    await controller.start(definition('First', [10]));
    scheduler.advance(1_000);

    await controller.start(definition('Second', [10]));
    const silencedAfterSwitch = player.silenced;
    const switchedAt = player.played.length;
    scheduler.advance(3_000);

    expect(silencedAfterSwitch).toBeGreaterThanOrEqual(1);
    expect(controller.getState()).toMatchObject({ title: 'Second', status: 'running' });
    const later = player.played.slice(switchedAt);
    expect(later.length).toBeGreaterThan(0);
    expect(later.some((p) => p.cue.type === 'say' && p.cue.text.startsWith('First'))).toBe(false);
  });

  it('notifies subscribers with each new state', async () => {
    const { controller, scheduler } = setup();
    const seen: (string | undefined)[] = [];
    const unsubscribe = controller.subscribe((s) => seen.push(s?.status));
    await controller.start(definition('Run', [1]));
    scheduler.advance(1_200);
    unsubscribe();

    expect(seen).toContain('running');
    expect(seen[seen.length - 1]).toBe('done');
  });

  it('notifies listeners only on visible changes: ten 100 ms ticks inside one second notify at most once; second boundary, phase change, pause notify', async () => {
    const { controller, scheduler } = setup();
    await controller.start(definition('Run', [2, 2]));

    const listener = jest.fn();
    controller.subscribe(listener);

    // Ten 100 ms ticks inside one second: ticks 1..9 (100 ms to 900 ms) cause no visible change.
    for (let i = 0; i < 9; i++) {
      scheduler.advance(100);
    }
    expect(listener).toHaveBeenCalledTimes(0);

    // Tick 10 (at 1_000 ms) hits the second boundary: notifies once.
    scheduler.advance(100);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ phaseElapsedMs: 1_000, phaseRemainingMs: 1_000 }),
    );

    // Ticks 1,100 ms to 1,900 ms do not notify.
    for (let i = 0; i < 9; i++) {
      scheduler.advance(100);
    }
    expect(listener).toHaveBeenCalledTimes(1);

    // Second boundary + phase change at 2,000 ms notifies.
    scheduler.advance(100);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 1 }),
    );

    // Pause notifies.
    controller.pause();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paused' }),
    );

    // Ticks while paused do not notify.
    scheduler.advance(500);
    expect(listener).toHaveBeenCalledTimes(3);

    // Resume notifies.
    controller.resume();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'running' }),
    );
  });
});

describe('SessionController: controls', () => {
  it('pause, skip, back and stop silence the player immediately (FR-010)', async () => {
    const { controller, scheduler, player } = setup();
    await controller.start(definition('Run', [10, 10, 10]));
    scheduler.advance(1_000);

    for (const action of ['pause', 'resume', 'skip', 'back', 'stop'] as const) {
      const before = player.silenced;
      controller[action]();
      if (action === 'resume') expect(player.silenced).toBe(before);
      else expect(player.silenced).toBe(before + 1);
    }
  });

  it('passes each control to the engine', async () => {
    const { controller, scheduler } = setup();
    await controller.start(definition('Run', [10, 10]));
    scheduler.advance(4_000);

    controller.pause();
    expect(controller.getState()?.status).toBe('paused');
    controller.resume();
    expect(controller.getState()?.status).toBe('running');
    controller.skip();
    expect(controller.getState()?.index).toBe(1);
    controller.back();
    expect(controller.getState()?.index).toBe(0);
  });

  it('stop stops the background service right away', async () => {
    const { controller, scheduler, background } = setup();
    let released = false;
    await controller.start(definition('Run', [10]));
    void background.keepAliveUntil?.then(() => {
      released = true;
    });
    scheduler.advance(1_000);

    controller.stop();
    await Promise.resolve();

    expect(controller.getState()?.status).toBe('stopped');
    expect(background.callsOf('stop')).toHaveLength(1);
    expect(released).toBe(true);
  });

  it('ignores controls when no session is running', () => {
    const { controller } = setup();
    expect(() => {
      controller.pause();
      controller.resume();
      controller.skip();
      controller.back();
      controller.stop();
    }).not.toThrow();
  });
});

describe('SessionController: notification', () => {
  const updates = (background: FakeBackgroundHost) => background.callsOf('update').map((c) => c.text);

  it('C3: shows the phase title on each phase change, and nothing on ordinary ticks', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [30, 40]));
    // The first phase's title goes out with start(), not as an update.
    expect(updates(background)).toEqual([]);

    scheduler.advance(29_000);
    expect(updates(background)).toEqual([]);
    scheduler.advance(2_000);
    expect(updates(background)).toEqual(['Run 2']);

    scheduler.advance(30_000);
    expect(updates(background)).toEqual(['Run 2']);
  });

  it('C3: pause shows a paused label and resume restores the title', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [30, 30]));
    scheduler.advance(5_000);

    controller.pause();
    expect(updates(background)).toEqual(['Paused · Run 1 · 0:25 left']);
    scheduler.advance(60_000);
    expect(updates(background)).toEqual(['Paused · Run 1 · 0:25 left']);

    controller.resume();
    expect(updates(background)).toEqual(['Paused · Run 1 · 0:25 left', 'Run 1']);
  });

  it('C3: skip and back update the title, keeping the paused label while paused', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [30, 30]));
    scheduler.advance(1_000);

    controller.skip();
    expect(updates(background)).toEqual(['Run 2']);
    controller.pause();
    controller.back();
    expect(updates(background)).toEqual(['Run 2', 'Paused · Run 2 · 0:30 left', 'Paused · Run 1 · 0:30 left']);
  });

  it('C3: keeps updating after the user dismisses the notification (the update re-posts it)', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [10, 10, 10]));
    scheduler.advance(10_500);
    // Dismissal is invisible to the app; the next update must still be sent.
    scheduler.advance(10_000);
    expect(updates(background)).toEqual(['Run 2', 'Run 3']);
  });

  it('C3: sends no updates after the session ends', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [2]));
    scheduler.advance(10_000);
    controller.pause();
    controller.resume();
    expect(updates(background)).toEqual([]);
  });

  it('C7: runs the session and exposes a warning when the OS refuses the service', async () => {
    const { controller, scheduler, background, player } = setup();
    background.startResult = false;
    await controller.start(definition('Run', [5]));
    scheduler.advance(2_000);

    expect(controller.getState()).toMatchObject({ status: 'running', backgroundWarning: true });
    expect(player.played.length).toBeGreaterThan(0);
  });

  it('C7: no warning when the service starts', async () => {
    const { controller } = setup();
    await controller.start(definition('Run', [5]));
    expect(controller.getState()?.backgroundWarning).toBe(false);
  });
});

describe('SessionController: state', () => {
  it('exposes the running definition, for the session screen (FR-021a)', async () => {
    const { controller } = setup();
    const def = definition('Run', [5]);
    await controller.start(def);
    expect(controller.getState()?.definition).toEqual(def);
  });
});

describe('SessionController: recovery', () => {
  /** Captures every value written to the record key, in order (null = cleared). */
  function recordWrites(store: MemoryStore) {
    const writes: (ReturnType<typeof parseRecord> | 'cleared')[] = [];
    const set = store.set.bind(store);
    const remove = store.remove.bind(store);
    store.set = async (key, value) => {
      if (key === RECORD_KEY) writes.push(parseRecord(value));
      return set(key, value);
    };
    store.remove = async (key) => {
      if (key === RECORD_KEY) writes.push('cleared');
      return remove(key);
    };
    return writes;
  }

  it('C4: writes the record on start, controls and phase changes', async () => {
    const { controller, scheduler, store } = setup();
    const writes = recordWrites(store);
    await controller.start(definition('Run', [10, 10, 10]));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ status: 'running', index: 0, phaseStartAt: T0, writtenAt: T0 });

    scheduler.advance(10_500); // phase change
    expect(writes[writes.length - 1]).toMatchObject({ index: 1, phaseStartAt: T0 + 10_000 });

    const count = () => writes.length;
    for (const action of ['pause', 'resume', 'skip', 'back'] as const) {
      const before = count();
      controller[action]();
      expect(count()).toBeGreaterThan(before);
    }
    controller.pause();
    expect(writes[writes.length - 1]).toMatchObject({ status: 'paused', pausedAt: T0 + 10_500 });
  });

  it('C4: refreshes the record every 60 s while running, not while paused', async () => {
    const { controller, scheduler, store } = setup();
    const writes = recordWrites(store);
    await controller.start(definition('Long', [600]));
    scheduler.advance(60_000);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ writtenAt: T0 + 60_000, phaseStartAt: T0 });
    scheduler.advance(60_000);
    expect(writes).toHaveLength(3);

    controller.pause();
    const paused = writes.length;
    scheduler.advance(180_000);
    expect(writes).toHaveLength(paused);
  });

  it('C4: clears the record when the session is done or stopped', async () => {
    const { controller, scheduler, store } = setup();
    await controller.start(definition('Run', [2]));
    expect(store.getSync(RECORD_KEY)).not.toBeNull();
    scheduler.advance(3_000);
    expect(store.getSync(RECORD_KEY)).toBeNull();

    await controller.start(definition('Run', [20]));
    scheduler.advance(1_000);
    controller.stop();
    expect(store.getSync(RECORD_KEY)).toBeNull();
    scheduler.advance(120_000);
    expect(store.getSync(RECORD_KEY)).toBeNull();
  });

  it('C8: checkForInterrupted assesses the stored record against the clock', async () => {
    const { controller, store, clock } = setup();
    expect(controller.checkForInterrupted()).toEqual({ kind: 'none' });

    const def = definition('Run', [60, 60]);
    store.data.set(RECORD_KEY, JSON.stringify(toRecord(def, snapshotAt(0, 20_000), T0)));
    clock.advance(50_000);
    expect(controller.checkForInterrupted()).toEqual({
      kind: 'resume',
      assessment: { definition: def, index: 1, phaseElapsedMs: 10_000, paused: false },
    });

    clock.advance(200_000);
    expect(controller.checkForInterrupted()).toMatchObject({ kind: 'interrupted', reason: 'finished', title: 'Run' });
  });

  it('CL7: checkForInterrupted resumes by elapsed time on the same boot even when wall clock jumped', async () => {
    const { controller, store, clock } = setup();
    clock.setBootCount(12);
    clock.setElapsed(100_000);

    const def = definition('Run', [60, 60]);
    store.data.set(
      RECORD_KEY,
      JSON.stringify(toRecord(def, snapshotAt(0, 20_000), T0, clock)),
    );

    // Wall clock jumps forward by 10 minutes (600_000 ms), but real elapsed only advances by 30_000 ms (to 130_000 ms)
    clock.set(T0 + 600_000);
    clock.setElapsed(130_000);

    // With wall clock it would have finished (600 s > 120 s). But with elapsed, only 30 s passed!
    // Phase 0 had 20s elapsed, so 20s + 30s = 50s into phase 0.
    expect(controller.checkForInterrupted()).toEqual({
      kind: 'resume',
      assessment: { definition: def, index: 0, phaseElapsedMs: 50_000, paused: false },
    });

    // When bootCount differs (e.g. rebooted: bootCount = 13), it falls back to wall time
    clock.setBootCount(13);
    // At T0 + 600_000 with wall clock, 120s session is finished:
    expect(controller.checkForInterrupted()).toMatchObject({
      kind: 'interrupted',
      reason: 'finished',
      title: 'Run',
    });
  });

  it('C8: resumeInterrupted rebuilds the cues, restarts the service and announces the phase', async () => {
    const { controller, scheduler, player, background, store } = setup();
    const def = definition('Run', [60, 60]);
    await controller.resumeInterrupted({ definition: def, index: 1, phaseElapsedMs: 10_000, paused: false });

    expect(background.calls.map((c) => c.kind)).toEqual(['prepare', 'start']);
    expect(background.callsOf('start')[0]).toMatchObject({ title: 'Run', text: 'Run 2' });
    expect(player.played[0]).toMatchObject({ cue: { type: 'say', text: 'Run 2' }, at: T0, phase: 1 });
    expect(controller.getState()).toMatchObject({ status: 'running', index: 1, phaseElapsedMs: 10_000 });
    expect(parseRecord(store.getSync(RECORD_KEY))).toMatchObject({ index: 1, phaseStartAt: T0 - 10_000 });

    scheduler.advance(50_500);
    expect(controller.getState()?.status).toBe('done');
  });

  it('C8: a paused recovery shows the paused label in the notification', async () => {
    const { controller, background } = setup();
    await controller.resumeInterrupted({
      definition: definition('Run', [60]),
      index: 0,
      phaseElapsedMs: 5_000,
      paused: true,
    });
    expect(controller.getState()?.status).toBe('paused');
    expect(background.callsOf('start')[0]).toMatchObject({ text: 'Paused · Run 1 · 0:55 left' });
  });

  it('C8: resumeInterrupted rejects a definition whose mode is unknown', async () => {
    const { controller, background } = setup();
    await expect(
      controller.resumeInterrupted({
        definition: { ...definition('Run', [60]), modeId: 'gone' },
        index: 0,
        phaseElapsedMs: 0,
        paused: false,
      }),
    ).rejects.toThrow('unknown mode');
    expect(background.calls).toEqual([]);
  });

  it('C8: discardInterrupted clears the record', async () => {
    const { controller, store } = setup();
    store.data.set(RECORD_KEY, JSON.stringify(toRecord(definition('Run', [60]), snapshotAt(0, 0), T0)));
    await controller.discardInterrupted();
    expect(store.getSync(RECORD_KEY)).toBeNull();
  });
});

function snapshotAt(index: number, phaseElapsedMs: number) {
  return {
    status: 'running' as const,
    index,
    phase: undefined,
    phaseElapsedMs,
    phaseRemainingMs: null,
    totalElapsedMs: 0,
  };
}

describe('SessionController: notification text from the phase subtitle', () => {
  const withSubtitles = (): SessionDefinition => ({
    modeId: 'test',
    title: 'Morning routine',
    phases: [
      { kind: 'step', title: 'Water', subtitle: 'Step 1 of 2', durationSec: 30 },
      { kind: 'step', title: 'Stretch', subtitle: 'Step 2 of 2', durationSec: 30 },
    ],
    settings: {},
    keepScreenOn: true,
  });

  it('C3: starts with "<subtitle>: <title>" and updates on phase change and pause', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(withSubtitles());
    expect(background.callsOf('start')[0]).toMatchObject({ text: 'Step 1 of 2: Water' });

    scheduler.advance(30_500);
    controller.pause();
    controller.resume();
    expect(background.callsOf('update').map((c) => c.text)).toEqual([
      'Step 2 of 2: Stretch',
      'Paused · Step 2 of 2: Stretch · 0:29 left',
      'Step 2 of 2: Stretch',
    ]);
  });

  it('C3: a paused recovery starts with the paused subtitle text', async () => {
    const { controller, background } = setup();
    await controller.resumeInterrupted({ definition: withSubtitles(), index: 1, phaseElapsedMs: 5_000, paused: true });
    expect(background.callsOf('start')[0]).toMatchObject({ text: 'Paused · Step 2 of 2: Stretch · 0:25 left' });
  });
});

describe('SessionController: US1 native service contract (NC1, NC5, NC7, NC8)', () => {
  it('NC1: start passes a fresh sessionId per launch, route, and notificationState of the first phase', async () => {
    const { controller, background } = setup();
    await controller.start(definition('Run', [30]));
    const start1 = background.callsOf('start')[0];
    expect(start1.sessionId).toBeTruthy();
    expect(start1.route).toBe('/sample');
    expect(start1.notification).toEqual({
      title: 'Run',
      text: 'Run 1',
      timer: { kind: 'countdown', remainingMs: 30_000 },
      paused: false,
    });

    controller.stop();
    await controller.start(definition('Run', [30]));
    const start2 = background.callsOf('start')[1];
    expect(start2.sessionId).toBeTruthy();
    expect(start2.sessionId).not.toBe(start1.sessionId);
  });

  it('NC1: a resumed paused session starts with the paused notificationState', async () => {
    const { controller, background } = setup();
    await controller.resumeInterrupted({
      definition: definition('Run', [30]),
      index: 0,
      phaseElapsedMs: 5_000,
      paused: true,
    });
    const startCall = background.callsOf('start')[0];
    expect(startCall.notification).toEqual({
      title: 'Run',
      text: 'Paused · Run 1 · 0:25 left',
      timer: null,
      paused: true,
    });
  });

  it('NC5: heartbeat is called at least every 2 s while running and while paused; none after stop or end', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [60]));
    background.calls.length = 0;

    scheduler.advance(6_000);
    const runningBeats = background.callsOf('heartbeat').length;
    expect(runningBeats).toBeGreaterThanOrEqual(3);

    controller.pause();
    background.calls.length = 0;
    scheduler.advance(6_000);
    const pausedBeats = background.callsOf('heartbeat').length;
    expect(pausedBeats).toBeGreaterThanOrEqual(3);

    controller.stop();
    background.calls.length = 0;
    scheduler.advance(10_000);
    expect(background.callsOf('heartbeat')).toHaveLength(0);
  });

  it('NC5: no heartbeat after wind-down completes', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [1]));
    scheduler.advance(1_000); // reaches done
    scheduler.advance(4_500); // completes windDown
    background.calls.length = 0;

    scheduler.advance(10_000);
    expect(background.callsOf('heartbeat')).toHaveLength(0);
  });

  it('NC7: stop, end after wind-down, and replacement each call stop once and unsubscribe listeners', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [10]));
    expect(background.listenerCount()).toBeGreaterThan(0);

    controller.stop();
    expect(background.callsOf('stop')).toHaveLength(1);
    expect(background.listenerCount()).toBe(0);

    // End after wind-down
    await controller.start(definition('Run', [1]));
    expect(background.listenerCount()).toBeGreaterThan(0);
    scheduler.advance(1_000); // done
    scheduler.advance(4_500); // wind down finished
    expect(background.callsOf('stop')).toHaveLength(2);
    expect(background.listenerCount()).toBe(0);

    // Replacement
    await controller.start(definition('Run', [10]));
    expect(background.listenerCount()).toBeGreaterThan(0);
    await controller.start(definition('Run 2', [10]));
    expect(background.callsOf('stop')).toHaveLength(3);
  });

  it('NC8: emitTaskRemoved with live session stops engine, silences player, clears record, calls stop', async () => {
    const { controller, background, player, store } = setup();
    await controller.start(definition('Run', [30]));

    background.emitTaskRemoved();

    expect(controller.getState()?.status).toBe('stopped');
    expect(player.silenced).toBeGreaterThan(0);
    expect(store.getSync(RECORD_KEY)).toBeNull();
    expect(background.callsOf('stop')).toHaveLength(1);
    expect(background.listenerCount()).toBe(0);
  });

  it('NC8: emitTaskRemoved with no live session does nothing', () => {
    const { background } = setup();
    expect(() => background.emitTaskRemoved()).not.toThrow();
    expect(background.callsOf('stop')).toHaveLength(0);
  });
});

describe('SessionController: US2 notification controls (NC2, NC3, NC4, NC6)', () => {
  it('NC2: phase change, pause, resume, skip and back each call update once with the right NotificationState', async () => {
    const { controller, scheduler, background } = setup();
    const untimedDef: SessionDefinition = {
      modeId: 'test',
      title: 'Workout',
      phases: [
        { kind: 'step', title: 'Warmup', durationSec: 30 },
        { kind: 'step', title: 'Stretch', durationSec: null },
        { kind: 'step', title: 'Cool', durationSec: 20 },
      ],
      settings: {},
      keepScreenOn: false,
    };
    await controller.start(untimedDef);
    background.calls.length = 0;

    // Advance 5 s into Warmup
    scheduler.advance(5_000);
    expect(background.callsOf('update')).toHaveLength(0); // no update on plain ticks

    // Pause
    controller.pause();
    expect(background.callsOf('update')).toHaveLength(1);
    expect(background.callsOf('update')[0].notification).toEqual({
      title: 'Workout',
      text: 'Paused · Warmup · 0:25 left',
      timer: null,
      paused: true,
    });

    // Resume
    controller.resume();
    expect(background.callsOf('update')).toHaveLength(2);
    expect(background.callsOf('update')[1].notification).toEqual({
      title: 'Workout',
      text: 'Warmup',
      timer: { kind: 'countdown', remainingMs: 25_000 },
      paused: false,
    });

    // Skip to untimed Stretch
    controller.skip();
    expect(background.callsOf('update')).toHaveLength(3);
    expect(background.callsOf('update')[2].notification).toEqual({
      title: 'Workout',
      text: 'Stretch',
      timer: { kind: 'elapsed', elapsedMs: 0 },
      paused: false,
    });

    // Advance 12 s in untimed Stretch
    scheduler.advance(12_000);
    // Pause during untimed phase
    controller.pause();
    expect(background.callsOf('update')).toHaveLength(4);
    expect(background.callsOf('update')[3].notification).toEqual({
      title: 'Workout',
      text: 'Paused · Stretch · 0:12',
      timer: null,
      paused: true,
    });

    // Back to start of Stretch
    controller.back();
    expect(background.callsOf('update')).toHaveLength(5);
    expect(background.callsOf('update')[4].notification).toEqual({
      title: 'Workout',
      text: 'Paused · Stretch · 0:00',
      timer: null,
      paused: true,
    });

    // Back to Warmup while paused
    controller.back();
    expect(background.callsOf('update')).toHaveLength(6);
    expect(background.callsOf('update')[5].notification).toEqual({
      title: 'Workout',
      text: 'Paused · Warmup · 0:30 left',
      timer: null,
      paused: true,
    });
  });

  it('NC3: emitAction(pause|resume|skip) gives the same cues, record writes and state as in-app controls', async () => {
    const { controller, scheduler, background, player, store } = setup();
    await controller.start(definition('Run', [30, 30]));
    scheduler.advance(5_000);

    // emitAction pause
    background.emitAction('pause');
    expect(controller.getState()?.status).toBe('paused');
    expect(player.silenced).toBeGreaterThan(0);
    const pausedRecord = JSON.parse(store.getSync(RECORD_KEY)!);
    expect(pausedRecord.status).toBe('paused');
    expect(background.callsOf('update').at(-1)?.notification).toMatchObject({
      paused: true,
      text: 'Paused · Run 1 · 0:25 left',
    });

    // emitAction resume
    background.emitAction('resume');
    expect(controller.getState()?.status).toBe('running');
    const runningRecord = JSON.parse(store.getSync(RECORD_KEY)!);
    expect(runningRecord.status).toBe('running');
    expect(background.callsOf('update').at(-1)?.notification).toMatchObject({
      paused: false,
      text: 'Run 1',
      timer: { kind: 'countdown', remainingMs: 25_000 },
    });

    // emitAction skip
    const playedBefore = player.played.length;
    background.emitAction('skip');
    expect(controller.getState()?.index).toBe(1);
    expect(player.played.length).toBeGreaterThan(playedBefore);
    expect(background.callsOf('update').at(-1)?.notification).toMatchObject({
      paused: false,
      text: 'Run 2',
      timer: { kind: 'countdown', remainingMs: 30_000 },
    });
  });

  it('NC4: pause while paused / resume while running are ignored; sequence ends in last state', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [30, 30]));
    scheduler.advance(5_000);

    // Resume while running is ignored
    const updatesBefore = background.callsOf('update').length;
    background.emitAction('resume');
    expect(background.callsOf('update')).toHaveLength(updatesBefore);
    expect(controller.getState()?.status).toBe('running');

    // Pause
    background.emitAction('pause');
    expect(controller.getState()?.status).toBe('paused');
    const updatesAfterPause = background.callsOf('update').length;

    // Pause while paused is ignored
    background.emitAction('pause');
    expect(background.callsOf('update')).toHaveLength(updatesAfterPause);
    expect(controller.getState()?.status).toBe('paused');

    // Sequence: pause -> resume -> pause ends paused
    background.emitAction('resume');
    expect(controller.getState()?.status).toBe('running');
    background.emitAction('pause');
    expect(controller.getState()?.status).toBe('paused');
  });

  it('NC6: actions with no live session do nothing and do not throw', () => {
    const { background } = setup();
    expect(() => {
      background.emitAction('pause');
      background.emitAction('resume');
      background.emitAction('skip');
    }).not.toThrow();
  });
});

