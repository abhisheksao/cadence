/** The run / walk workout setting, stored as JSON under `run-walk:v1`. */
export type RunWalkSettings = {
  version: 1;
  /** 0–1800 in steps of 60; 0 means no warm-up. */
  warmupSec: number;
  /** 15–1800 in steps of 15. */
  runSec: number;
  /** 15–1800 in steps of 15. */
  walkSec: number;
  /** 1–30. */
  rounds: number;
  /** 0–1800 in steps of 60; 0 means no cool-down. */
  cooldownSec: number;
  announceRound: boolean;
  halfway: boolean;
  timeLeft: boolean;
  keepScreenOn: boolean;
};

/** The values changed with − / + (FR-004). */
export type RunWalkField = 'warmupSec' | 'runSec' | 'walkSec' | 'rounds' | 'cooldownSec';

/** A fixed run / walk / rounds combination (FR-003). */
export type Preset = { label: string; runSec: number; walkSec: number; rounds: number };

/** The voice options the cue handler reads from the session definition (research R1). */
export type RunWalkVoice = { announceRound: boolean; halfway: boolean; timeLeft: boolean };
