import type { Cue, CueHandler } from '@/engine/types';
import type { SessionDefinition } from '@/session/types';

import type { ModeDefinition } from './types';

/**
 * A short session that exercises every cue type, a timed and an untimed phase. It lets the
 * engine be checked on a device before the real modes exist (quickstart.md).
 */
export function sampleDefinition(): SessionDefinition {
  return {
    modeId: 'sample',
    title: 'Sample session',
    phases: [
      { kind: 'ready', title: 'Get ready', durationSec: 10 },
      { kind: 'wait', title: 'Tap Skip when ready', durationSec: null },
      { kind: 'interval', title: 'Interval', durationSec: 20 },
      { kind: 'cooldown', title: 'Cool down', durationSec: 15 },
    ],
    settings: {},
    keepScreenOn: true,
  };
}

/** Length of the soak run used to check timing drift and OS kills (SC-003, quickstart D10). */
const SOAK_SEC = 60 * 60;

/**
 * The sample's timed phases repeated to exactly 60 minutes. The screen may turn off, since the
 * soak is meant to be run with it off.
 */
export function soakDefinition(): SessionDefinition {
  const timed = sampleDefinition().phases.filter((p) => p.durationSec !== null);
  const phases = [];
  for (let total = 0, i = 0; total < SOAK_SEC; i++) {
    const phase = timed[i % timed.length];
    phases.push(phase);
    total += phase.durationSec ?? 0;
  }
  return { modeId: 'sample', title: '60-minute soak', phases, settings: {}, keepScreenOn: false };
}

const handler: CueHandler = {
  cueFor({ phase, sec, remaining, next, isPhaseStart }) {
    if (isPhaseStart) return { type: 'say', text: phase.title, interrupt: true };
    if (remaining === null) return null;
    if (phase.kind === 'interval' && sec === 10) return { type: 'say', text: 'Halfway' };
    // The last beep before a phase change is the higher one; the last phase ends with the chime.
    if (remaining === 1 && next) return { type: 'beepLast' };
    if (remaining <= 3) return { type: 'beep' };
    return null;
  },
  completion(): Cue[] {
    return [
      { type: 'chime' },
      { type: 'say', text: 'Sample complete', offsetMs: 700 },
    ];
  },
};

export const sampleMode: ModeDefinition = {
  id: 'sample',
  route: '/sample',
  cueFor: () => handler,
};
