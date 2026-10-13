import type { Clock, Scheduler } from '@/engine/clock';

/** A clock that only moves when a test says so. */
export class FakeClock implements Clock {
  constructor(private time = 0) {}

  now() {
    return this.time;
  }

  set(time: number) {
    this.time = time;
  }

  advance(ms: number) {
    this.time += ms;
  }
}

type Timer = {
  intervalMs: number;
  /** Nominal time of the next call, as setInterval would schedule it. */
  nominal: number;
  /** Actual time of the next call: nominal + jitter, never before the previous call. */
  fireAt: number;
  fn: () => void;
  cancelled: boolean;
  order: number;
};

/** Small deterministic PRNG (mulberry32), so jittered runs repeat exactly for a seed. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs interval callbacks against a FakeClock. `jitterMs` delays each call by a seeded random
 * amount, like a busy JS thread would, without shifting the nominal schedule.
 */
export class FakeScheduler implements Scheduler {
  private timers: Timer[] = [];
  private nextOrder = 0;
  private readonly jitterMs: number;
  private readonly random: () => number;

  constructor(
    private readonly clock: FakeClock,
    options: { jitterMs?: number; seed?: number } = {},
  ) {
    this.jitterMs = options.jitterMs ?? 0;
    this.random = prng(options.seed ?? 1);
  }

  every(intervalMs: number, fn: () => void) {
    const now = this.clock.now();
    const timer: Timer = {
      intervalMs,
      nominal: now + intervalMs,
      fireAt: this.withJitter(now + intervalMs, now),
      fn,
      cancelled: false,
      order: this.nextOrder++,
    };
    this.timers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  }

  /** Moves the clock forward by `ms`, running due callbacks in time order. */
  advance(ms: number) {
    const target = this.clock.now() + ms;
    for (;;) {
      const due = this.timers
        .filter((t) => !t.cancelled && t.fireAt <= target)
        .sort((a, b) => a.fireAt - b.fireAt || a.order - b.order)[0];
      if (!due) break;
      this.clock.set(due.fireAt);
      due.nominal += due.intervalMs;
      due.fireAt = this.withJitter(due.nominal, due.fireAt);
      due.fn();
    }
    this.clock.set(target);
  }

  /** Moves the clock forward without running callbacks, as if the OS suspended the app. */
  suspend(ms: number) {
    const target = this.clock.now() + ms;
    for (const t of this.timers) {
      while (t.nominal <= target) t.nominal += t.intervalMs;
      t.fireAt = t.nominal;
    }
    this.clock.set(target);
  }

  /**
   * Changes the wall clock by `ms` (negative = backwards) without disturbing pending intervals,
   * which run on elapsed time like setInterval does. Simulates the user changing the time.
   */
  jumpClock(ms: number) {
    for (const t of this.timers) {
      t.nominal += ms;
      t.fireAt += ms;
    }
    this.clock.set(this.clock.now() + ms);
  }

  private withJitter(nominal: number, notBefore: number) {
    const jitter = this.jitterMs > 0 ? Math.floor(this.random() * (this.jitterMs + 1)) : 0;
    return Math.max(nominal + jitter, notBefore);
  }
}
