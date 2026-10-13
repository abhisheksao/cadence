import type { Cue } from '@/engine/types';

/** Plays cues on time (contracts/platform.md). */
export interface CuePlayer {
  /** Load sounds, set the audio mode (duckOthers), warm up TTS. Idempotent. */
  init(): Promise<void>;
  /**
   * Play `cue` so it is heard at wall time `at` (latency-compensated). Speech is skipped, not
   * queued, while another app holds full audio focus, e.g. during a phone call.
   */
  play(cue: Cue, at: number): void;
  /** Cancel scheduled cues and stop current speech and sounds immediately. */
  silence(): void;
}
