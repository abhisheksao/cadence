/** Output latency of a short sound on a typical older Android phone. */
export const BEEP_LATENCY_MS = 120;
/** Audio output latency after the TTS engine reports that it has started. */
export const TTS_OUTPUT_MS = 80;

/** How long to wait before starting a sound so it is heard at `at`. Never negative. */
export function startDelay(at: number, now: number, latencyMs: number) {
  return Math.max(0, at - latencyMs - now);
}

/**
 * Learned speech latency. It varies by phone and TTS engine (300–500 ms is typical on older
 * phones), so it is measured from each utterance's onStart (research R4).
 */
export class TtsLatency {
  value = 400;

  /**
   * @param startedAfterMs time from speak() to the engine's onStart callback
   * @param queued true if other speech was ahead of it, which makes the sample meaningless
   */
  sample(startedAfterMs: number, queued: boolean) {
    if (queued) return;
    const sample = startedAfterMs + TTS_OUTPUT_MS;
    this.value = Math.min(900, Math.max(100, this.value * 0.7 + sample * 0.3));
  }
}
