import type { Preset, RunWalkField, RunWalkSettings } from './types';

/** Range and step of each adjustable value (FR-001, FR-004). */
export const LIMITS: Readonly<Record<RunWalkField, { min: number; max: number; step: number }>> = {
  warmupSec: { min: 0, max: 1_800, step: 60 },
  runSec: { min: 15, max: 1_800, step: 15 },
  walkSec: { min: 15, max: 1_800, step: 15 },
  rounds: { min: 1, max: 30, step: 1 },
  cooldownSec: { min: 0, max: 1_800, step: 60 },
};

export const PRESETS: readonly Preset[] = [
  { label: '1:00 / 1:30 ×8', runSec: 60, walkSec: 90, rounds: 8 },
  { label: '1:30 / 2:00 ×6', runSec: 90, walkSec: 120, rounds: 6 },
  { label: '2:00 / 1:00 ×6', runSec: 120, walkSec: 60, rounds: 6 },
  { label: '5:00 / 1:00 ×4', runSec: 300, walkSec: 60, rounds: 4 },
];

/** The setting a new user starts with (FR-002). */
export function defaultSettings(): RunWalkSettings {
  return {
    version: 1,
    warmupSec: 300,
    runSec: 60,
    walkSec: 90,
    rounds: 8,
    cooldownSec: 300,
    announceRound: true,
    halfway: true,
    timeLeft: true,
    keepScreenOn: false,
  };
}
