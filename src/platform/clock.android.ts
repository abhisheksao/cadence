import CadenceSession from 'modules/cadence-session';

import type { SessionClock } from './clock';

export function createSessionClock(
  module: typeof CadenceSession = CadenceSession,
  getWallTime: () => number = () => Date.now(),
): SessionClock {
  let anchorWall = getWallTime();
  let anchorElapsed: number | null = null;

  try {
    if (module && typeof module.elapsedRealtime === 'function') {
      anchorElapsed = module.elapsedRealtime();
      anchorWall = getWallTime();
    }
  } catch {
    anchorElapsed = null;
  }

  return {
    now() {
      if (anchorElapsed !== null && module && typeof module.elapsedRealtime === 'function') {
        try {
          const currentElapsed = module.elapsedRealtime();
          return anchorWall + (currentElapsed - anchorElapsed);
        } catch {
          // Fall back to getWallTime() if call fails
        }
      }
      return getWallTime();
    },

    elapsed() {
      if (module && typeof module.elapsedRealtime === 'function') {
        try {
          return module.elapsedRealtime();
        } catch {
          return null;
        }
      }
      return null;
    },

    bootCount() {
      if (module && typeof module.bootCount === 'function') {
        try {
          return module.bootCount();
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export const sessionClock: SessionClock = createSessionClock();
