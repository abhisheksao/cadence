import { defaultSettings } from '@/breathe/settings';
import type { BreatheSettings } from '@/breathe/types';
import type { Cue, CueOpportunity } from '@/engine/types';
import { createModeRegistry } from '@/modes/registry';
import { SessionController } from '@/session/controller';
import { validateDefinition } from '@/session/validate';
import { FakeClock, FakeScheduler } from '@/test-utils/fakeClock';
import { FakeBackgroundHost, FakeCuePlayer, MemoryStore } from '@/test-utils/fakes';

import { BREATHE_MODE_ID, breatheDefinition, breatheMode } from './breathe';

const settings = (over: Partial<BreatheSettings> = {}): BreatheSettings => ({ ...defaultSettings(), ...over });

const asList = (c: Cue | Cue[] | null): Cue[] => (c === null ? [] : Array.isArray(c) ? c : [c]);

function cuesAt(s: BreatheSettings, index: number, sec: number, isPhaseStart = sec === 0) {
  const def = breatheDefinition(s);
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
  return asList(breatheMode.cueFor(def).cueFor(op));
}

const say = (text: string, interrupt?: boolean) => ({ type: 'say', text, ...(interrupt ? { interrupt } : {}) });
const beep = () => ({ type: 'beep' });
const beepLast = () => ({ type: 'beepLast' });
const chime = (offsetMs?: number) => ({ type: 'chime', ...(offsetMs !== undefined ? { offsetMs } : {}) });

describe('breatheDefinition', () => {
  it('BD1: defaults give 5s prep + 11 cycles of 4-4-4-4: 45 phases, 181 s', () => {
    const def = breatheDefinition(defaultSettings());
    expect(def.phases).toHaveLength(45);
    expect(def.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0)).toBe(181);
    expect(def.phases.slice(0, 5)).toEqual([
      { kind: 'prep', title: 'Get ready', durationSec: 5 },
      { kind: 'inhale', title: 'Inhale', subtitle: 'Cycle 1 of 11', durationSec: 4 },
      { kind: 'hold', title: 'Hold', subtitle: 'Cycle 1 of 11', durationSec: 4 },
      { kind: 'exhale', title: 'Exhale', subtitle: 'Cycle 1 of 11', durationSec: 4 },
      { kind: 'post-hold', title: 'Hold', subtitle: 'Cycle 1 of 11', durationSec: 4 },
    ]);
    expect(def.phases.slice(-4)).toEqual([
      { kind: 'inhale', title: 'Inhale', subtitle: 'Cycle 11 of 11', durationSec: 4 },
      { kind: 'hold', title: 'Hold', subtitle: 'Cycle 11 of 11', durationSec: 4 },
      { kind: 'exhale', title: 'Exhale', subtitle: 'Cycle 11 of 11', durationSec: 4 },
      { kind: 'post-hold', title: 'Hold', subtitle: 'Cycle 11 of 11', durationSec: 4 },
    ]);
  });

  it('BD1: leaves out prep phase when prepEnabled is false', () => {
    const def = breatheDefinition(settings({ prepEnabled: false }));
    expect(def.phases[0].kind).toBe('inhale');
    expect(def.phases).toHaveLength(44);
  });

  it('BD2: leaves out zero-duration hold phases', () => {
    const def = breatheDefinition(settings({ holdSec: 0, postHoldSec: 0, targetMinutes: 1, inhaleSec: 5, exhaleSec: 5 }));
    // 1 min / 10s = 6 cycles of inhale, exhale
    expect(def.phases.map((p) => p.kind)).toEqual([
      'prep',
      'inhale', 'exhale',
      'inhale', 'exhale',
      'inhale', 'exhale',
      'inhale', 'exhale',
      'inhale', 'exhale',
      'inhale', 'exhale',
    ]);
  });

  it('BD3: copies keepScreenOn and cueStyle', () => {
    const def = breatheDefinition(settings({ keepScreenOn: true, cueStyle: 'tones' }));
    expect(def).toMatchObject({
      modeId: BREATHE_MODE_ID,
      title: 'Breathe',
      keepScreenOn: true,
      settings: { cueStyle: 'tones' },
    });
  });

  it.each([
    ['the defaults', defaultSettings()],
    ['prep off', settings({ prepEnabled: false })],
    ['zero holds (coherent)', settings({ holdSec: 0, postHoldSec: 0 })],
    ['long cycles', settings({ inhaleSec: 30, holdSec: 30, exhaleSec: 30, postHoldSec: 30, targetMinutes: 30 })],
  ])('BD4: %s settings give a valid session', (_name, s) => {
    expect(validateDefinition(breatheDefinition(s), (id) => id === 'breathe')).toEqual([]);
  });

  it('registers as mode "breathe" with route "/breathe"', () => {
    expect(breatheMode.id).toBe('breathe');
    expect(breatheMode.route).toBe('/breathe');
  });
});

describe('breathe cues (voice style)', () => {
  const s = defaultSettings();

  it('BC1: prep start', () => {
    expect(cuesAt(s, 0, 0)).toEqual([say('Get ready to breathe.', true)]);
  });

  it('BC2: prep countdown at remaining 3, 2, 1', () => {
    expect(cuesAt(s, 0, 1)).toEqual([]);
    expect(cuesAt(s, 0, 2)).toEqual([beep()]);
    expect(cuesAt(s, 0, 3)).toEqual([beep()]);
    expect(cuesAt(s, 0, 4)).toEqual([beepLast()]);
  });

  it('BC3: inhale start', () => {
    expect(cuesAt(s, 1, 0)).toEqual([say('Inhale.', true)]);
  });

  it('BC4: hold start', () => {
    expect(cuesAt(s, 2, 0)).toEqual([say('Hold.', true)]);
  });

  it('BC5: exhale start', () => {
    expect(cuesAt(s, 3, 0)).toEqual([say('Exhale.', true)]);
  });

  it('BC6: post-hold start', () => {
    expect(cuesAt(s, 4, 0)).toEqual([say('Hold.', true)]);
  });

  it('BC14: intermediate seconds have no cues in voice style', () => {
    expect(cuesAt(s, 1, 1)).toEqual([]);
    expect(cuesAt(s, 1, 2)).toEqual([]);
    expect(cuesAt(s, 1, 3)).toEqual([]);
  });

  it('BC12: completion', () => {
    const def = breatheDefinition(s);
    const handler = breatheMode.cueFor(def);
    expect(handler.completion?.(181_000)).toEqual([
      chime(),
      { type: 'say', text: 'Breathing complete. Well done.', offsetMs: 700 },
    ]);
  });
});

describe('engine run', () => {
  it('runs a short 1-cycle session end to end with correct cues and timing', async () => {
    const clock = new FakeClock(1_000_000);
    const scheduler = new FakeScheduler(clock);
    const player = new FakeCuePlayer();
    const host = new FakeBackgroundHost();
    const store = new MemoryStore();
    const modes = createModeRegistry();
    modes.register(breatheMode);
    const controller = new SessionController({
      clock,
      scheduler,
      player,
      background: host,
      store,
      modes,
    });

    const shortDef = breatheDefinition(
      settings({
        inhaleSec: 4,
        holdSec: 4,
        exhaleSec: 4,
        postHoldSec: 4,
        targetMinutes: 1,
      }),
    );
    // 5s prep + 1 cycle (16s) = 21s
    const singleCycleDef = {
      ...shortDef,
      phases: shortDef.phases.slice(0, 5), // prep, inhale, hold, exhale, post-hold
    };

    await controller.start(singleCycleDef);
    scheduler.advance(22_000);

    // Inspect cues dispatched to FakeCuePlayer
    const log = player.played.map((p) => ({
      type: p.cue.type,
      text: p.cue.type === 'say' ? p.cue.text : undefined,
      at: p.at - 1_000_000,
    }));

    expect(log).toEqual([
      { type: 'say', text: 'Get ready to breathe.', at: 0 },
      { type: 'beep', text: undefined, at: 2_000 },
      { type: 'beep', text: undefined, at: 3_000 },
      { type: 'beepLast', text: undefined, at: 4_000 },
      { type: 'say', text: 'Inhale.', at: 5_000 },
      { type: 'say', text: 'Hold.', at: 9_000 },
      { type: 'say', text: 'Exhale.', at: 13_000 },
      { type: 'say', text: 'Hold.', at: 17_000 },
      { type: 'chime', text: undefined, at: 21_000 },
      { type: 'say', text: 'Breathing complete. Well done.', at: 21_700 },
    ]);
  });
});
