import { BEEP_LATENCY_MS, TtsLatency, startDelay } from './latency';

describe('startDelay', () => {
  it('starts a sound early by its latency', () => {
    expect(startDelay(10_000, 9_000, 120)).toBe(880);
  });

  it('never returns a negative delay', () => {
    expect(startDelay(10_000, 9_950, 120)).toBe(0);
  });

  it('uses 120 ms for beeps', () => {
    expect(BEEP_LATENCY_MS).toBe(120);
  });
});

describe('TtsLatency', () => {
  it('starts at 400 ms', () => {
    expect(new TtsLatency().value).toBe(400);
  });

  it('moves 30% of the way towards each sample (time to onStart + 80 ms output)', () => {
    const latency = new TtsLatency();
    latency.sample(220, false); // sample = 300
    expect(latency.value).toBeCloseTo(0.7 * 400 + 0.3 * 300);
  });

  it('ignores samples taken while other speech was queued', () => {
    const latency = new TtsLatency();
    latency.sample(2_000, true);
    expect(latency.value).toBe(400);
  });

  it('stays between 100 and 900 ms', () => {
    const high = new TtsLatency();
    for (let i = 0; i < 50; i++) high.sample(5_000, false);
    expect(high.value).toBe(900);

    const low = new TtsLatency();
    for (let i = 0; i < 50; i++) low.sample(0, false);
    expect(low.value).toBe(100);
  });
});
