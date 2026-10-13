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
  modes.register({ id: 'test', cueFor: () => testHandler });
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
    expect(updates(background)).toEqual(['Paused · Run 1']);
    scheduler.advance(60_000);
    expect(updates(background)).toEqual(['Paused · Run 1']);

    controller.resume();
    expect(updates(background)).toEqual(['Paused · Run 1', 'Run 1']);
  });

  it('C3: skip and back update the title, keeping the paused label while paused', async () => {
    const { controller, scheduler, background } = setup();
    await controller.start(definition('Run', [30, 30]));
    scheduler.advance(1_000);

    controller.skip();
    expect(updates(background)).toEqual(['Run 2']);
    controller.pause();
    controller.back();
    expect(updates(background)).toEqual(['Run 2', 'Paused · Run 2', 'Paused · Run 1']);
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
    expect(background.callsOf('start')[0]).toMatchObject({ text: 'Paused · Run 1' });
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
