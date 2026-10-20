import type { SessionClock } from './clock';

export const sessionClock: SessionClock = {
  now: () => Date.now(),
  elapsed: () => null,
  bootCount: () => null,
};
