import CadenceSession from 'modules/cadence-session';

import type { AudioFocus } from './audio';

export const audioFocus: AudioFocus = {
  request() {
    if (CadenceSession && typeof CadenceSession.requestFocus === 'function') {
      try {
        return CadenceSession.requestFocus();
      } catch {
        return false;
      }
    }
    return true;
  },

  abandon() {
    if (CadenceSession && typeof CadenceSession.abandonFocus === 'function') {
      try {
        CadenceSession.abandonFocus();
      } catch {
        // Ignore
      }
    }
  },

  onLoss(fn: () => void) {
    if (CadenceSession && typeof CadenceSession.addListener === 'function') {
      try {
        const sub = CadenceSession.addListener('onFocusLost', () => fn());
        return () => sub.remove();
      } catch {
        return () => {};
      }
    }
    return () => {};
  },
};

export function vibrate(ms: number) {
  if (CadenceSession && typeof CadenceSession.vibrate === 'function') {
    try {
      CadenceSession.vibrate(ms);
    } catch {
      // Ignore
    }
  }
}

export const audioInterruptionMode = 'mixWithOthers' as const;
