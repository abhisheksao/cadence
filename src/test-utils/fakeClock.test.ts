import { FakeClock, FakeScheduler } from './fakeClock';

describe('FakeClock', () => {
  it('returns the time it was set to and moves forward with advance()', () => {
    const clock = new FakeClock(1_000);
    expect(clock.now()).toBe(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
    clock.set(5_000);
    expect(clock.now()).toBe(5_000);
  });

  it('can be set backwards, to simulate the user changing the device clock', () => {
    const clock = new FakeClock(10_000);
    clock.set(4_000);
    expect(clock.now()).toBe(4_000);
  });
});

describe('FakeScheduler', () => {
  it('calls an interval callback on schedule, advancing the clock before each call', () => {
    const clock = new FakeClock(0);
    const scheduler = new FakeScheduler(clock);
    const seen: number[] = [];
    scheduler.every(100, () => seen.push(clock.now()));

    scheduler.advance(1_000);

    expect(seen).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1_000]);
    expect(clock.now()).toBe(1_000);
  });

  it('schedules from the clock time when every() is called', () => {
    const clock = new FakeClock(1_000_000);
    const scheduler = new FakeScheduler(clock);
    const seen: number[] = [];
    scheduler.every(100, () => seen.push(clock.now()));

    scheduler.advance(300);

    expect(seen).toEqual([1_000_100, 1_000_200, 1_000_300]);
  });

  it('stops calling after cancel', () => {
    const clock = new FakeClock(0);
    const scheduler = new FakeScheduler(clock);
    const fn = jest.fn();
    const cancel = scheduler.every(100, fn);

    scheduler.advance(250);
    cancel();
    scheduler.advance(1_000);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('runs callbacks from several intervals in time order', () => {
    const clock = new FakeClock(0);
    const scheduler = new FakeScheduler(clock);
    const order: string[] = [];
    scheduler.every(300, () => order.push(`a@${clock.now()}`));
    scheduler.every(200, () => order.push(`b@${clock.now()}`));

    scheduler.advance(600);

    expect(order).toEqual(['b@200', 'a@300', 'b@400', 'a@600', 'b@600']);
  });

  it('delays calls by a seeded random jitter, keeping the nominal schedule and order', () => {
    const run = (seed: number) => {
      const clock = new FakeClock(0);
      const scheduler = new FakeScheduler(clock, { jitterMs: 300, seed });
      const seen: number[] = [];
      scheduler.every(100, () => seen.push(clock.now()));
      scheduler.advance(2_000);
      return seen;
    };

    const seen = run(42);
    // Each nominal tick k*100 fires somewhere in [k*100, k*100 + 300], never out of order.
    seen.forEach((t, i) => {
      expect(t).toBeGreaterThanOrEqual((i + 1) * 100);
      if (i > 0) expect(t).toBeGreaterThanOrEqual(seen[i - 1]);
    });
    expect(seen.some((t, i) => t !== (i + 1) * 100)).toBe(true);
    expect(run(42)).toEqual(seen); // deterministic for a seed
    expect(run(7)).not.toEqual(seen);
  });

  it('jumps the wall clock without disturbing interval spacing, like a manual time change', () => {
    const clock = new FakeClock(100_000);
    const scheduler = new FakeScheduler(clock);
    const seen: number[] = [];
    scheduler.every(100, () => seen.push(clock.now()));
    scheduler.advance(250); // fires at 100_100, 100_200; now 100_250

    scheduler.jumpClock(-30_000); // now 70_250
    scheduler.advance(200);

    expect(clock.now()).toBe(70_450);
    expect(seen).toEqual([100_100, 100_200, 70_300, 70_400]);
  });

  it('can skip time without running callbacks, to simulate the app being suspended', () => {
    const clock = new FakeClock(0);
    const scheduler = new FakeScheduler(clock);
    const fn = jest.fn();
    scheduler.every(100, fn);

    scheduler.suspend(25_000);

    expect(fn).not.toHaveBeenCalled();
    expect(clock.now()).toBe(25_000);
    scheduler.advance(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
