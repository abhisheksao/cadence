import type { Cue, CueHandler } from '@/engine/types';
import { spokenDuration } from '@/format/clock';
import type { Routine } from '@/routine/types';
import type { SessionDefinition } from '@/session/types';

import type { ModeDefinition } from './types';

export const ROUTINE_MODE_ID = 'routine';

/** Warn "One minute left." only on steps at least this long (FR-010). */
const MINUTE_WARNING_MIN_SEC = 180;
/** Warn "10 seconds." only on steps at least this long (FR-011). */
const TEN_SECOND_WARNING_MIN_SEC = 30;

/**
 * A snapshot of the routine as a session (research R1). The phases carry everything the cues
 * need, so a recovered session gets the same cues even if the routine was edited since.
 */
export function routineDefinition(routine: Routine): SessionDefinition {
  const count = routine.steps.length;
  return {
    modeId: ROUTINE_MODE_ID,
    title: 'Morning routine',
    phases: routine.steps.map((step, i) => ({
      kind: 'step',
      title: step.title.trim() || `Step ${i + 1}`,
      subtitle: `Step ${i + 1} of ${count}`,
      durationSec: step.durationSec,
    })),
    settings: {},
    keepScreenOn: true,
  };
}

function handlerFor(definition: SessionDefinition): CueHandler {
  const count = definition.phases.length;
  return {
    cueFor({ phase, index, remaining, next, isPhaseStart }) {
      const d = phase.durationSec;
      if (isPhaseStart) {
        const greeting = index === 0 ? 'Good morning. ' : '';
        const how = d === null ? 'Tap Done when finished.' : `${spokenDuration(d)}.`;
        return { type: 'say', text: `${greeting}Step ${index + 1} of ${count}. ${phase.title}. ${how}`, interrupt: true };
      }
      if (d === null || remaining === null) return null;
      if (remaining === 60 && d >= MINUTE_WARNING_MIN_SEC) return { type: 'say', text: 'One minute left.' };
      if (remaining === 10 && d >= TEN_SECOND_WARNING_MIN_SEC) return { type: 'say', text: '10 seconds.' };
      // The last beep before a step change is the higher one; the last step ends with the chime.
      if (remaining === 1 && next) return { type: 'beepLast' };
      if (remaining >= 1 && remaining <= 3) return { type: 'beep' };
      return null;
    },
    completion(): Cue[] {
      return [
        { type: 'chime' },
        { type: 'say', text: 'Routine complete. Have a great day.', offsetMs: 700 },
      ];
    },
  };
}

export const routineMode: ModeDefinition = {
  id: ROUTINE_MODE_ID,
  route: '/routine',
  cueFor: handlerFor,
};
