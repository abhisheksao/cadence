import type { Cue, CueOpportunity, Phase } from '@/engine/types';
import { createModeRegistry } from '@/modes/registry';
import { defaultSettings } from '@/runWalk/settings';
import type { RunWalkSettings } from '@/runWalk/types';
import { SessionController } from '@/session/controller';
import { validateDefinition } from '@/session/validate';
import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';
import { FakeBackgroundHost, FakeCuePlayer, MemoryStore } from '@/test-utils/fakes';

import { RUN_WALK_MODE_ID, runWalkDefinition, runWalkMode } from './runWalk';

const settings = (over: Partial<RunWalkSettings> = {}): RunWalkSettings => ({ ...defaultSettings(), ...over });

const asList = (c: Cue | Cue[] | null): Cue[] => (c === null ? [] : Array.isArray(c) ? c : [c]);

/** The cues the run/walk handler gives for second `sec` of phase `index`. */
function cuesAt(s: RunWalkSettings, index: number, sec: number, isPhaseStart = sec === 0) {
  const def = runWalkDefinition(s);
  const phase = def.phases[index];
  const op: CueOpportunity = {
    phase,
    index,
    sec,
    remaining: phase.durationSec === null ? null : phase.durationSec - sec,
    prev: def.phases[index - 1],
    next: def.phases[index + 1],
    at: 0,
    isPhaseStart,
  };
  return asList(runWalkMode.cueFor(def).cueFor(op));
}

const say = (text: string, interrupt?: boolean) => ({ type: 'say', text, ...(interrupt ? { interrupt } : {}) });

describe('runWalkDefinition (data-model.md)', () => {
  it('WD1: the defaults give get-ready, warm-up, 8 runs, 7 walks and the cool-down: 18 phases, 1,720 s', () => {
    const def = runWalkDefinition(defaultSettings());
    expect(def.phases).toHaveLength(18);
    expect(def.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0)).toBe(1_720);
    expect(def.phases.slice(0, 4)).toEqual([
      { kind: 'ready', title: 'Get ready', durationSec: 10 },
      { kind: 'warmup', title: 'Warm up', durationSec: 300 },
      { kind: 'run', title: 'Run', subtitle: 'Round 1 of 8', durationSec: 60 },
      { kind: 'walk', title: 'Walk', subtitle: 'Round 1 of 8', durationSec: 90 },
    ]);
    expect(def.phases.slice(-2)).toEqual([
      { kind: 'run', title: 'Run', subtitle: 'Round 8 of 8', durationSec: 60 },
      { kind: 'cooldown', title: 'Cool down', durationSec: 300 },
    ]);
  });

  it('WD1: keeps the last walk when there is no cool-down', () => {
    const def = runWalkDefinition(settings({ rounds: 2, cooldownSec: 0 }));
    expect(def.phases.map((p) => p.kind)).toEqual(['ready', 'warmup', 'run', 'walk', 'run', 'walk']);
    expect(def.phases[5].subtitle).toBe('Round 2 of 2');
  });

  it('WD2: leaves out a warm-up and cool-down of 0', () => {
    const def = runWalkDefinition(settings({ warmupSec: 0, cooldownSec: 0, rounds: 1 }));
    expect(def.phases.map((p) => p.kind)).toEqual(['ready', 'run', 'walk']);
  });

  it('WD1: one round with a cool-down has a single run', () => {
    const def = runWalkDefinition(settings({ rounds: 1 }));
    expect(def.phases.map((p) => p.kind)).toEqual(['ready', 'warmup', 'run', 'cooldown']);
    expect(def.phases[2].subtitle).toBe('Round 1 of 1');
  });

  it('WD3: copies keep screen on and the voice options', () => {
    const def = runWalkDefinition(settings({ keepScreenOn: true, announceRound: false, halfway: true, timeLeft: false }));
    expect(def).toMatchObject({
      modeId: RUN_WALK_MODE_ID,
      title: 'Run / walk',
      keepScreenOn: true,
      settings: { announceRound: false, halfway: true, timeLeft: false },
    });
    expect(runWalkDefinition(defaultSettings()).keepScreenOn).toBe(false);
  });

  it.each([
    ['the defaults', defaultSettings()],
    ['the smallest', settings({ warmupSec: 0, runSec: 15, walkSec: 15, rounds: 1, cooldownSec: 0 })],
    ['the largest', settings({ warmupSec: 1_800, runSec: 1_800, walkSec: 1_800, rounds: 30, cooldownSec: 1_800 })],
  ])('WD4: %s settings give a valid session', (_name, s) => {
    expect(validateDefinition(runWalkDefinition(s), (id) => id === 'run-walk')).toEqual([]);
  });

  it('registers as mode "run-walk" with the run/walk screen as its route', () => {
    expect(runWalkMode.id).toBe('run-walk');
    expect(runWalkMode.route).toBe('/run-walk');
  });
});

describe('run/walk cues (contracts/run-walk.md)', () => {
  // Phases of the defaults: 0 ready, 1 warmup, 2 run 1, 3 walk 1, …, 16 run 8, 17 cooldown.
  const s = defaultSettings();

  it('WC1: get-ready', () => {
    expect(cuesAt(s, 0, 0)).toEqual([say('Get ready. Starting in 10 seconds.', true)]);
  });

  it('WC2: warm-up', () => {
    expect(cuesAt(s, 1, 0)).toEqual([say('Warm up. Walk for 5 minutes.', true)]);
  });

  it('WC3: a run says its round', () => {
    expect(cuesAt(s, 2, 0)).toEqual([say('Run for 1 minute. Round 1 of 8.', true)]);
    expect(cuesAt(s, 14, 0)).toEqual([say('Run for 1 minute. Round 7 of 8.', true)]);
  });

  it('WC4: the last run says "Last round."', () => {
    expect(cuesAt(s, 16, 0)).toEqual([say('Run for 1 minute. Last round.', true)]);
  });

  it('WC4: "Last round." also without a cool-down, where a walk follows', () => {
    const noCool = settings({ rounds: 2, cooldownSec: 0 });
    expect(cuesAt(noCool, 4, 0)).toEqual([say('Run for 1 minute. Last round.', true)]);
  });

  it('WC5: no round when "say the round" is off', () => {
    const quiet = settings({ announceRound: false });
    expect(cuesAt(quiet, 2, 0)).toEqual([say('Run for 1 minute.', true)]);
    expect(cuesAt(quiet, 16, 0)).toEqual([say('Run for 1 minute.', true)]);
  });

  it('WC6: a walk', () => {
    expect(cuesAt(s, 3, 0)).toEqual([say('Walk for 1 minute 30 seconds.', true)]);
  });

  it('WC7: the cool-down', () => {
    expect(cuesAt(s, 17, 0)).toEqual([say('Now cool down. Walk for 5 minutes.', true)]);
  });

  it('announces the landing phase after a recovery (isPhaseStart mid-phase)', () => {
    expect(cuesAt(s, 3, 40, true)).toEqual([say('Walk for 1 minute 30 seconds.', true)]);
  });

  it.each([
    [1, 'Warm up', 300],
    [2, 'Run', 60],
    [3, 'Walk', 90],
    [17, 'Cool down', 300],
  ])('WC8: phase %i says "%s ends in" at 5 s left', (index, title, d) => {
    expect(cuesAt(s, index, d - 5)).toEqual([say(`${title} ends in`)]);
  });

  it('WC9/WC10: beeps at 3 and 2 s left, the high beep at 1 s before a phase change', () => {
    for (const index of [0, 1, 2, 3]) {
      const d = runWalkDefinition(s).phases[index].durationSec as number;
      expect([d - 3, d - 2, d - 1].map((sec) => cuesAt(s, index, sec).map((c) => c.type))).toEqual([
        ['beep'],
        ['beep'],
        ['beepLast'],
      ]);
    }
  });

  it('WC10: the last phase ends with three normal beeps', () => {
    expect([297, 298, 299].map((sec) => cuesAt(s, 17, sec).map((c) => c.type))).toEqual([['beep'], ['beep'], ['beep']]);
  });

  it('WC13: completes with the chime and the sign-off 700 ms later', () => {
    const handler = runWalkMode.cueFor(runWalkDefinition(s));
    expect(asList(handler.completion(0))).toEqual([
      { type: 'chime' },
      { type: 'say', text: 'Workout complete. Great job.', offsetMs: 700 },
    ]);
  });

  it('WC14: get-ready only beeps after its announcement', () => {
    expect([1, 2, 3, 4, 5, 6].flatMap((sec) => cuesAt(s, 0, sec))).toEqual([]);
  });

  it('WC14: nothing at 4 s left or on other quiet seconds', () => {
    const quiet = settings({ halfway: false, timeLeft: false });
    expect(cuesAt(quiet, 2, 56)).toEqual([]);
    expect(cuesAt(quiet, 2, 1)).toEqual([]);
    expect(cuesAt(quiet, 2, 30)).toEqual([]);
    expect(cuesAt(quiet, 3, 60)).toEqual([]);
  });

  describe('WC11: time-left cues', () => {
    it('says time left at every multiple of 30 s with remaining > 5 and sec >= 5', () => {
      expect(cuesAt(s, 1, 30)).toEqual([say('4 minutes 30 seconds left.')]);
      expect(cuesAt(s, 1, 60)).toEqual([say('4 minutes left.')]);
      expect(cuesAt(s, 1, 240)).toEqual([say('1 minute left.')]);
      expect(cuesAt(s, 1, 270)).toEqual([say('30 seconds left.')]);
    });

    it('none when remaining <= 5', () => {
      expect(cuesAt(s, 1, 295)).toEqual([say('Warm up ends in')]);
    });

    it('none when timeLeft is off', () => {
      const quiet = settings({ timeLeft: false });
      expect(cuesAt(quiet, 1, 30)).toEqual([]);
      expect(cuesAt(quiet, 1, 60)).toEqual([]);
      expect(cuesAt(quiet, 1, 270)).toEqual([]);
    });

    it('none at sec 0–4 of a 30 s phase or a 31 s phase', () => {
      const shortWalk = settings({ walkSec: 30 });
      expect(cuesAt(shortWalk, 3, 0)).toEqual([say('Walk for 30 seconds.', true)]);
      for (let sec = 1; sec <= 4; sec++) {
        expect(cuesAt(shortWalk, 3, sec)).toEqual([]);
      }

      const def = runWalkDefinition(defaultSettings());
      const phase31: Phase = { kind: 'walk', title: 'Walk', durationSec: 31 };
      const handler = runWalkMode.cueFor(def);
      const op = (sec: number): CueOpportunity => ({
        phase: phase31,
        index: 1,
        sec,
        remaining: 31 - sec,
        at: 0,
        isPhaseStart: sec === 0,
      });
      expect(asList(handler.cueFor(op(1)))).toEqual([]);
      expect(asList(handler.cueFor(op(2)))).toEqual([]);
      expect(asList(handler.cueFor(op(3)))).toEqual([]);
      expect(asList(handler.cueFor(op(4)))).toEqual([]);
    });

    it('none in get-ready phase', () => {
      const def = runWalkDefinition(defaultSettings());
      const ready30: Phase = { kind: 'ready', title: 'Get ready', durationSec: 30 };
      const handler = runWalkMode.cueFor(def);
      const op: CueOpportunity = {
        phase: ready30,
        index: 0,
        sec: 0,
        remaining: 30,
        at: 0,
        isPhaseStart: false,
      };
      expect(asList(handler.cueFor(op))).toEqual([]);
    });
  });

  describe('WC12: halfway cues', () => {
    it('says "Halfway. 1 minute left." merged on a 120 s run at sec 60', () => {
      const run120 = settings({ runSec: 120 });
      expect(cuesAt(run120, 2, 60)).toEqual([say('Halfway. 1 minute left.')]);
    });

    it('says "Halfway." on a 121 s run at sec 60', () => {
      const def = runWalkDefinition(settings({ runSec: 120 }));
      const run121: Phase = { kind: 'run', title: 'Run', durationSec: 121 };
      const handler = runWalkMode.cueFor(def);
      const op: CueOpportunity = {
        phase: run121,
        index: 2,
        sec: 60,
        remaining: 61,
        at: 0,
        isPhaseStart: false,
      };
      expect(asList(handler.cueFor(op))).toEqual([say('Halfway.')]);
    });

    it('no halfway cue on a 119 s run', () => {
      const def = runWalkDefinition(settings({ runSec: 120 }));
      const run119: Phase = { kind: 'run', title: 'Run', durationSec: 119 };
      const handler = runWalkMode.cueFor(def);
      const op: CueOpportunity = {
        phase: run119,
        index: 2,
        sec: 59,
        remaining: 60,
        at: 0,
        isPhaseStart: false,
      };
      expect(asList(handler.cueFor(op))).toEqual([say('1 minute left.')]);
    });

    it('no halfway cue on walks', () => {
      const walk120 = settings({ walkSec: 120 });
      expect(cuesAt(walk120, 3, 60)).toEqual([say('1 minute left.')]);
    });

    it('none when halfway is off', () => {
      const quiet = settings({ runSec: 120, halfway: false });
      expect(cuesAt(quiet, 2, 60)).toEqual([say('1 minute left.')]);
    });

    it('only says "Halfway." on a 120 s run when timeLeft is off', () => {
      const noTimeLeft = settings({ runSec: 120, timeLeft: false });
      expect(cuesAt(noTimeLeft, 2, 60)).toEqual([say('Halfway.')]);
    });
  });
});

describe('run/walk: engine run (SC-002, SC-003)', () => {
  const T0 = 1_000_000;

  it('plays a short workout on schedule from get-ready to the sign-off', async () => {
    const clock = new FakeClock(T0);
    const scheduler = new FakeScheduler(clock);
    const player = new FakeCuePlayer();
    const modes = createModeRegistry();
    modes.register(runWalkMode);
    const controller = new SessionController({
      clock,
      scheduler,
      player,
      background: new FakeBackgroundHost(),
      store: new MemoryStore(),
      modes,
    });
    const short = settings({ warmupSec: 60, runSec: 120, walkSec: 30, rounds: 2, cooldownSec: 60, halfway: false, timeLeft: false });
    await controller.start(runWalkDefinition(short));
    scheduler.advance(401_000);

    const heard = player.played.map(({ cue, at }) => [cue.type === 'say' ? cue.text : cue.type, at - T0] as const);
    const countdown = (title: string, end: number, last = false) => [
      [`${title} ends in`, (end - 5) * 1_000],
      ['beep', (end - 3) * 1_000],
      ['beep', (end - 2) * 1_000],
      [last ? 'beep' : 'beepLast', (end - 1) * 1_000],
    ];
    expect(heard).toEqual([
      ['Get ready. Starting in 10 seconds.', 0],
      ['beep', 7_000],
      ['beep', 8_000],
      ['beepLast', 9_000],
      ['Warm up. Walk for 1 minute.', 10_000],
      ...countdown('Warm up', 70),
      ['Run for 2 minutes. Round 1 of 2.', 70_000],
      ...countdown('Run', 190),
      ['Walk for 30 seconds.', 190_000],
      ...countdown('Walk', 220),
      ['Run for 2 minutes. Last round.', 220_000],
      ...countdown('Run', 340),
      ['Now cool down. Walk for 1 minute.', 340_000],
      ...countdown('Cool down', 400, true),
      ['chime', 400_000],
      ['Workout complete. Great job.', 400_700],
    ]);
    expect(controller.getState()?.status).toBe('done');
  });
});
