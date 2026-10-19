let mockElapsed = 10_000;
let mockBootCount: number | null = 5;

jest.mock('modules/cadence-session', () => ({
  __esModule: true,
  default: {
    elapsedRealtime: jest.fn(() => mockElapsed),
    bootCount: jest.fn(() => mockBootCount),
  },
}));

describe('Android SessionClock (CL1)', () => {
  const originalDateNow = Date.now;

  afterEach(() => {
    Date.now = originalDateNow;
    jest.resetModules();
  });

  it('anchors wall and elapsed time on load, and advances with elapsedRealtime, not Date.now()', async () => {
    let fakeWall = 1_700_000_000_000;
    Date.now = jest.fn(() => fakeWall);

    mockElapsed = 50_000;
    mockBootCount = 42;

    const { sessionClock } = await import('./clock.android');

    // Initial now() should be anchorWall + (50_000 - 50_000) = 1_700_000_000_000
    expect(sessionClock.now()).toBe(1_700_000_000_000);
    expect(sessionClock.elapsed()).toBe(50_000);
    expect(sessionClock.bootCount()).toBe(42);

    // Wall clock jumps forward by 1 hour (3_600_000 ms)
    fakeWall += 3_600_000;
    // elapsedRealtime only advances 5 seconds (5_000 ms)
    mockElapsed += 5_000;

    // sessionClock.now() must advance by 5_000 ms, NOT by 1 hour
    expect(sessionClock.now()).toBe(1_700_000_005_000);
    expect(sessionClock.elapsed()).toBe(55_000);

    // Wall clock jumps backwards by 2 hours
    fakeWall -= 7_200_000;
    // elapsedRealtime advances another 10 seconds
    mockElapsed += 10_000;

    expect(sessionClock.now()).toBe(1_700_000_015_000);
  });

  it('falls back to Date.now() when native module is null or unavailable', async () => {
    jest.doMock('modules/cadence-session', () => ({
      __esModule: true,
      default: null,
    }));
    const { sessionClock } = await import('./clock.android');
    expect(sessionClock.elapsed()).toBeNull();
    expect(sessionClock.bootCount()).toBeNull();
    expect(typeof sessionClock.now()).toBe('number');
  });
});
