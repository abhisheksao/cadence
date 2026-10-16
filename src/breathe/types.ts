/** Audio guidance style for breath cues. */
export type BreatheCueStyle = 'voice' | 'count' | 'tones';

/** The cue options the handler reads from the session definition. */
export type BreatheVoice = { cueStyle: BreatheCueStyle };

/** The guided breathing setting, stored as JSON under `breathe:v1`. */
export type BreatheSettings = {
  version: 1;
  /** 1–30 in steps of 1. */
  inhaleSec: number;
  /** 0–30 in steps of 1; 0 means no hold. */
  holdSec: number;
  /** 1–30 in steps of 1. */
  exhaleSec: number;
  /** 0–30 in steps of 1; 0 means no hold. */
  postHoldSec: number;
  /** 1–30 in steps of 1. */
  targetMinutes: number;
  /** 5-second countdown preparation before cycles start. */
  prepEnabled: boolean;
  /** Voice, counted seconds aloud, or gentle tones. */
  cueStyle: BreatheCueStyle;
  /** Keep screen awake during session. */
  keepScreenOn: boolean;
};

/** The values changed with − / + steppers. */
export type BreatheField = 'inhaleSec' | 'holdSec' | 'exhaleSec' | 'postHoldSec' | 'targetMinutes';

/** A predefined breathing pattern. */
export type BreathePreset = {
  id: string;
  name: string;
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  postHoldSec: number;
  targetMinutes: number;
};
