/**
 * Time sources for the engine. The engine never reads the time or sets timers itself, so tests
 * can drive it with a fake clock.
 *
 * Production uses the wall clock (Date.now()), not performance.now(): the monotonic clock stops
 * while the CPU sleeps between cues with the screen off, which would make cues drift
 * (research R1).
 */
export interface Clock {
  /** Wall time in ms. */
  now(): number;
}

export interface Scheduler {
  /** Calls fn every intervalMs until the returned cancel function is called. */
  every(intervalMs: number, fn: () => void): () => void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export const systemScheduler: Scheduler = {
  every(intervalMs, fn) {
    const id = setInterval(fn, intervalMs);
    return () => clearInterval(id);
  },
};
