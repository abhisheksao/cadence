import type { Cue, CueHandler, Phase } from '@/engine/types';
import { spokenDuration } from '@/format/clock';
import type { RunWalkSettings, RunWalkVoice } from '@/runWalk/types';
import type { SessionDefinition } from '@/session/types';

import type { ModeDefinition } from './types';

export const RUN_WALK_MODE_ID = 'run-walk';

/** Length of the get-ready phase (clarification Q4). */
const READY_SEC = 10;
/** "<Phase> ends in" this many seconds before the end, ahead of the beeps at 3, 2, 1 (FR-010). */
const ENDS_IN_SEC = 5;

/**
 * A snapshot of the settings as a session (research R1). The phases and voice flags carry
 * everything the cues need, so a recovered workout gets the same cues.
 */
export function runWalkDefinition(settings: RunWalkSettings): SessionDefinition<RunWalkVoice> {
  const { warmupSec, runSec, walkSec, rounds, cooldownSec } = settings;
  const phases: Phase[] = [{ kind: 'ready', title: 'Get ready', durationSec: READY_SEC }];
  if (warmupSec > 0) phases.push({ kind: 'warmup', title: 'Warm up', durationSec: warmupSec });
  for (let r = 1; r <= rounds; r++) {
    const subtitle = `Round ${r} of ${rounds}`;
    phases.push({ kind: 'run', title: 'Run', subtitle, durationSec: runSec });
    // With a cool-down, the last round goes straight into it (FR-007).
    if (r < rounds || cooldownSec === 0) phases.push({ kind: 'walk', title: 'Walk', subtitle, durationSec: walkSec });
  }
  if (cooldownSec > 0) phases.push({ kind: 'cooldown', title: 'Cool down', durationSec: cooldownSec });
  return {
    modeId: RUN_WALK_MODE_ID,
    title: 'Run / walk',
    phases,
    settings: { announceRound: settings.announceRound, halfway: settings.halfway, timeLeft: settings.timeLeft },
    keepScreenOn: settings.keepScreenOn,
  };
}

function handlerFor(definition: SessionDefinition<RunWalkVoice>): CueHandler {
  const voice = definition.settings;
  // Round numbers come from the phases, so the handler needs nothing else (research R1).
  const runIndexes = definition.phases.flatMap((p, i) => (p.kind === 'run' ? [i] : []));

  function startPhrase(phase: Phase, index: number) {
    const d = spokenDuration(phase.durationSec ?? 0);
    switch (phase.kind) {
      case 'ready':
        return `Get ready. Starting in ${READY_SEC} seconds.`;
      case 'warmup':
        return `Warm up. Walk for ${d}.`;
      case 'run': {
        if (!voice.announceRound) return `Run for ${d}.`;
        const round = runIndexes.indexOf(index) + 1;
        return round === runIndexes.length ? `Run for ${d}. Last round.` : `Run for ${d}. Round ${round} of ${runIndexes.length}.`;
      }
      case 'cooldown':
        return `Now cool down. Walk for ${d}.`;
      default:
        return `Walk for ${d}.`;
    }
  }

  return {
    cueFor({ phase, index, sec, remaining, next, isPhaseStart }) {
      if (isPhaseStart) return { type: 'say', text: startPhrase(phase, index), interrupt: true };
      if (remaining === null) return null;

      const isTimeLeft =
        voice.timeLeft &&
        phase.kind !== 'ready' &&
        sec >= 5 &&
        remaining > 5 &&
        remaining % 30 === 0;

      const isHalfway =
        voice.halfway &&
        phase.kind === 'run' &&
        (phase.durationSec ?? 0) >= 120 &&
        sec === Math.floor((phase.durationSec ?? 0) / 2);

      if (isHalfway && isTimeLeft) {
        return { type: 'say', text: `Halfway. ${spokenDuration(remaining)} left.` };
      }
      if (isHalfway) {
        return { type: 'say', text: 'Halfway.' };
      }
      if (isTimeLeft) {
        return { type: 'say', text: `${spokenDuration(remaining)} left.` };
      }

      if (remaining === ENDS_IN_SEC && phase.kind !== 'ready') return { type: 'say', text: `${phase.title} ends in` };
      // The last beep before a phase change is the higher one; the last phase ends with the chime.
      if (remaining === 1 && next) return { type: 'beepLast' };
      if (remaining >= 1 && remaining <= 3) return { type: 'beep' };
      return null;
    },
    completion(): Cue[] {
      return [
        { type: 'chime' },
        { type: 'say', text: 'Workout complete. Great job.', offsetMs: 700 },
      ];
    },
  };
}

export const runWalkMode: ModeDefinition = {
  id: RUN_WALK_MODE_ID,
  route: '/run-walk',
  cueFor: (definition) => handlerFor(definition as SessionDefinition<RunWalkVoice>),
};
