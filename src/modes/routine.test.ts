import type { Cue, CueOpportunity, Phase } from '@/engine/types';
import { createModeRegistry } from '@/modes/registry';
import { defaultRoutine } from '@/routine/defaults';
import type { Routine } from '@/routine/types';
import { SessionController } from '@/session/controller';
import { validateDefinition } from '@/session/validate';
import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';
import { FakeBackgroundHost, FakeCuePlayer, MemoryStore } from '@/test-utils/fakes';

import { ROUTINE_MODE_ID, routineDefinition, routineMode } from './routine';

const routine = (steps: [string, number | null][]): Routine => ({
  version: 1,
  steps: steps.map(([title, durationSec], i) => ({ id: `s${i}`, title, durationSec })),
});

const asList = (c: Cue | Cue[] | null): Cue[] => (c === null ? [] : Array.isArray(c) ? c : [c]);

/** The cues the routine handler gives for second `sec` of step `index`. */
function cuesAt(r: Routine, index: number, sec: number, isPhaseStart = sec === 0) {
  const def = routineDefinition(r);
  const phase: Phase = def.phases[index];
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
  return asList(routineMode.cueFor(def).cueFor(op));
}

describe('routineDefinition', () => {
  it('turns each step into a phase with "Step N of M" and keeps the screen on', () => {
    const def = routineDefinition(routine([['Water', 60], ['  ', null], ['Stretch', 300]]));
    expect(def).toMatchObject({ modeId: ROUTINE_MODE_ID, title: 'Morning routine', settings: {}, keepScreenOn: true });
    expect(def.phases).toEqual([
      { kind: 'step', title: 'Water', subtitle: 'Step 1 of 3', durationSec: 60 },
      { kind: 'step', title: 'Step 2', subtitle: 'Step 2 of 3', durationSec: null },
      { kind: 'step', title: 'Stretch', subtitle: 'Step 3 of 3', durationSec: 300 },
    ]);
  });

  it('gives a valid session for the default routine', () => {
    const def = routineDefinition(defaultRoutine(() => 'x'));
    expect(validateDefinition(def, (id) => id === 'routine')).toEqual([]);
  });

  it('registers as mode "routine" with the routine screen as its route', () => {
    expect(routineMode.id).toBe('routine');
    expect(routineMode.route).toBe('/routine');
  });
});

describe('routine cues', () => {
  const r = routine([['Water', 60], ['Make the bed', null], ['Stretch', 150], ['Breathing', 180], ['Plan', 15]]);
  const say = (text: string, interrupt?: boolean) => ({ type: 'say', text, ...(interrupt ? { interrupt } : {}) });

  it('RC1: greets and announces the first step with its duration', () => {
    expect(cuesAt(r, 0, 0)).toEqual([say('Good morning. Step 1 of 5. Water. 1 minute.', true)]);
  });

  it('RC2: announces later steps without the greeting', () => {
    expect(cuesAt(r, 2, 0)).toEqual([say('Step 3 of 5. Stretch. 2 minutes 30 seconds.', true)]);
  });

  it('RC2: announces the landing step after a recovery (isPhaseStart mid-step)', () => {
    expect(cuesAt(r, 2, 40, true)).toEqual([say('Step 3 of 5. Stretch. 2 minutes 30 seconds.', true)]);
  });

  it('RC3: an untimed step asks for Done', () => {
    expect(cuesAt(r, 1, 0)).toEqual([say('Step 2 of 5. Make the bed. Tap Done when finished.', true)]);
  });

  it('RC4: "One minute left." only on steps of 3 minutes or more', () => {
    expect(cuesAt(r, 3, 120)).toEqual([say('One minute left.')]);
    expect(cuesAt(r, 2, 90)).toEqual([]);
  });

  it.each([
    [15, false],
    [29, false],
    [30, true],
    [60, true],
  ])('RC5: a %i s step says "10 seconds." → %s', (duration, spoken) => {
    const one = routine([['A', duration], ['B', 60]]);
    expect(cuesAt(one, 0, duration - 10)).toEqual(spoken ? [say('10 seconds.')] : []);
  });

  it('RC6/RC7: beeps at 3 and 2 s left, the high beep at 1 s before a step change', () => {
    expect([cuesAt(r, 0, 57), cuesAt(r, 0, 58), cuesAt(r, 0, 59)].map((c) => c.map((x) => x.type))).toEqual([
      ['beep'],
      ['beep'],
      ['beepLast'],
    ]);
  });

  it('RC7: the last step ends with three normal beeps', () => {
    expect([cuesAt(r, 4, 12), cuesAt(r, 4, 13), cuesAt(r, 4, 14)].map((c) => c.map((x) => x.type))).toEqual([
      ['beep'],
      ['beep'],
      ['beep'],
    ]);
  });

  it('RC8: completes with the chime and the sign-off 700 ms later', () => {
    const handler = routineMode.cueFor(routineDefinition(r));
    expect(asList(handler.completion(0))).toEqual([
      { type: 'chime' },
      { type: 'say', text: 'Routine complete. Have a great day.', offsetMs: 700 },
    ]);
  });

  it('RC9: silent on other seconds, and for the rest of an untimed step', () => {
    expect(cuesAt(r, 0, 5)).toEqual([]);
    expect(cuesAt(r, 0, 49)).toEqual([]);
    expect(cuesAt(r, 1, 1)).toEqual([]);
    expect(cuesAt(r, 1, 500)).toEqual([]);
  });
});

describe('routine: engine run (SC-002, SC-005)', () => {
  const T0 = 1_000_000;

  async function start() {
    const clock = new FakeClock(T0);
    const scheduler = new FakeScheduler(clock);
    const player = new FakeCuePlayer();
    const modes = createModeRegistry();
    modes.register(routineMode);
    const controller = new SessionController({
      clock,
      scheduler,
      player,
      background: new FakeBackgroundHost(),
      store: new MemoryStore(),
      modes,
    });
    await controller.start(routineDefinition(defaultRoutine(() => 'x')));
    const heard = () =>
      player.played.map(({ cue, at }) => [cue.type === 'say' ? cue.text : cue.type, at - T0] as const);
    return { scheduler, controller, heard };
  }

  it('plays step 1 on schedule and announces step 2', async () => {
    const { scheduler, heard } = await start();
    scheduler.advance(61_000);
    expect(heard()).toEqual([
      ['Good morning. Step 1 of 6. Drink a glass of water. 1 minute.', 0],
      ['10 seconds.', 50_000],
      ['beep', 57_000],
      ['beep', 58_000],
      ['beepLast', 59_000],
      ['Step 2 of 6. Make the bed. Tap Done when finished.', 60_000],
    ]);
  });

  it('waits on the untimed step until Done, then carries on to the end', async () => {
    const { scheduler, controller, heard } = await start();
    scheduler.advance(60_000 + 10 * 60_000);
    expect(controller.getState()).toMatchObject({ status: 'running', index: 1 });
    expect(heard()).toHaveLength(6);

    controller.skip(); // Done on "Make the bed"
    expect(heard()[6][0]).toBe('Step 3 of 6. Stretch. 5 minutes.');
    scheduler.advance(300_000 + 180_000 + 180_000 + 1_000);
    expect(controller.getState()).toMatchObject({ index: 5 });
    controller.skip(); // Done on "Shower", the last step
    scheduler.advance(1_000);

    const said = heard().map(([what]) => what);
    expect(said).toContain('One minute left.');
    expect(said.slice(-2)).toEqual(['chime', 'Routine complete. Have a great day.']);
    expect(controller.getState()?.status).toBe('done');
  });
});
