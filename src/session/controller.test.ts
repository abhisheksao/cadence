import type { CueHandler } from '@/engine/types';
import { createModeRegistry } from '@/modes/registry';
import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';
import { FakeBackgroundHost, FakeCuePlayer, MemoryStore } from '@/test-utils/fakes';

import { SessionController } from './controller';
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
