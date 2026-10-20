import { sessionClock } from './clock.ios';

describe('iOS SessionClock (CL2)', () => {
  it('uses Date.now() and returns null for elapsed and bootCount', () => {
    const before = Date.now();
    const now = sessionClock.now();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
    expect(sessionClock.elapsed()).toBeNull();
    expect(sessionClock.bootCount()).toBeNull();
  });
});
