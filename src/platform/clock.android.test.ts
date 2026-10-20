import { createSessionClock, sessionClock } from './clock.android';

describe('Android SessionClock (CL1)', () => {
  it('anchors wall and elapsed time on creation, and advances with elapsedRealtime, not wall time', () => {
    let fakeWall = 1_700_000_000_000;
    let mockElapsed = 50_000;
    let mockBootCount: number | null = 42;

    const mockModule = {
      elapsedRealtime: () => mockElapsed,
      bootCount: () => mockBootCount,
    } as unknown as typeof import('modules/cadence-session').default;

    const clock = createSessionClock(mockModule, () => fakeWall);

    // Initial now() should be anchorWall + 0 = 1_700_000_000_000
    expect(clock.now()).toBe(1_700_000_000_000);
    expect(clock.elapsed()).toBe(50_000);
    expect(clock.bootCount()).toBe(42);

    // Wall clock jumps forward by 1 hour (3_600_000 ms)
    fakeWall += 3_600_000;
    // elapsedRealtime only advances 5 seconds (5_000 ms)
    mockElapsed += 5_000;

    // clock.now() must advance by 5_000 ms, NOT by 1 hour
    expect(clock.now()).toBe(1_700_000_005_000);
    expect(clock.elapsed()).toBe(55_000);

    // Wall clock jumps backwards by 2 hours
    fakeWall -= 7_200_000;
    // elapsedRealtime advances another 10 seconds
    mockElapsed += 10_000;

    expect(clock.now()).toBe(1_700_000_015_000);
  });

  it('falls back to wall time when native module is null or unavailable', () => {
    let fakeWall = 1_000;
    const clock = createSessionClock(null, () => fakeWall);
    expect(clock.elapsed()).toBeNull();
    expect(clock.bootCount()).toBeNull();
    expect(clock.now()).toBe(1_000);

    fakeWall = 2_000;
    expect(clock.now()).toBe(2_000);
  });

  it('default exported sessionClock implements SessionClock', () => {
    expect(typeof sessionClock.now()).toBe('number');
  });
});
