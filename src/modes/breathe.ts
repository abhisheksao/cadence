import { calculateCycles } from '@/breathe/settings';
import type { BreatheSettings, BreatheVoice } from '@/breathe/types';
import type { Cue, CueHandler, Phase } from '@/engine/types';
import type { SessionDefinition } from '@/session/types';

import type { ModeDefinition } from './types';

export const BREATHE_MODE_ID = 'breathe';

/** Length of the get-ready preparation phase. */
const PREP_SEC = 5;

/**
 * Creates a session definition from breathing settings. Zero-duration hold phases are omitted,
 * and total cycles are calculated from the target duration.
 */
export function breatheDefinition(settings: BreatheSettings): SessionDefinition<BreatheVoice> {
  const { inhaleSec, holdSec, exhaleSec, postHoldSec, prepEnabled } = settings;
  const cycles = calculateCycles(settings);
  const phases: Phase[] = [];

  if (prepEnabled) {
    phases.push({ kind: 'prep', title: 'Get ready', durationSec: PREP_SEC });
  }

  for (let c = 1; c <= cycles; c++) {
    const subtitle = `Cycle ${c} of ${cycles}`;
    phases.push({ kind: 'inhale', title: 'Inhale', subtitle, durationSec: inhaleSec });
    if (holdSec > 0) {
      phases.push({ kind: 'hold', title: 'Hold', subtitle, durationSec: holdSec });
    }
    phases.push({ kind: 'exhale', title: 'Exhale', subtitle, durationSec: exhaleSec });
    if (postHoldSec > 0) {
      phases.push({ kind: 'post-hold', title: 'Hold', subtitle, durationSec: postHoldSec });
    }
  }

  return {
    modeId: BREATHE_MODE_ID,
    title: 'Breathe',
    phases,
    settings: { cueStyle: settings.cueStyle },
    keepScreenOn: settings.keepScreenOn,
  };
}

function handlerFor(definition: SessionDefinition<BreatheVoice>): CueHandler {
  const { cueStyle } = definition.settings;

  function phaseStartVoiceText(kind: string): string {
    switch (kind) {
      case 'inhale':
        return 'Inhale.';
      case 'exhale':
        return 'Exhale.';
      default:
        return 'Hold.';
    }
  }

  return {
    cueFor({ phase, sec, remaining, isPhaseStart }) {
      if (phase.kind === 'prep') {
        if (isPhaseStart) return { type: 'say', text: 'Get ready to breathe.', interrupt: true };
        if (remaining === 1) return { type: 'beepLast' };
        if (remaining !== null && remaining >= 2 && remaining <= 3) return { type: 'beep' };
        return null;
      }

      if (isPhaseStart) {
        if (cueStyle === 'voice' || cueStyle === 'count') {
          return { type: 'say', text: phaseStartVoiceText(phase.kind), interrupt: true };
        }
        if (cueStyle === 'tones') {
          return phase.kind === 'exhale' ? { type: 'beepLast' } : { type: 'beep' };
        }
      }

      if (cueStyle === 'count' && sec >= 1 && sec < (phase.durationSec ?? 0)) {
        return { type: 'say', text: String(sec + 1) };
      }

      return null;
    },

    completion(): Cue[] {
      if (cueStyle === 'tones') {
        return [{ type: 'chime' }];
      }
      return [
        { type: 'chime' },
        { type: 'say', text: 'Breathing complete. Well done.', offsetMs: 700 },
      ];
    },
  };
}

export const breatheMode: ModeDefinition = {
  id: BREATHE_MODE_ID,
  route: '/breathe',
  cueFor: (definition) => handlerFor(definition as SessionDefinition<BreatheVoice>),
};
