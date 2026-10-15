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

/** Whether the field can move further in direction `dir` (FR-004, WS1). */
export function canAdjust(s: RunWalkSettings, field: RunWalkField, dir: 1 | -1): boolean {
  const { min, max } = LIMITS[field];
  return dir === 1 ? s[field] < max : s[field] > min;
}

/** Moves the field by its step and clamps it into range (FR-004, WS1). */
export function adjust(s: RunWalkSettings, field: RunWalkField, dir: 1 | -1): RunWalkSettings {
  const { min, max, step } = LIMITS[field];
  const next = dir === 1 ? Math.min(max, s[field] + step) : Math.max(min, s[field] - step);
  return { ...s, [field]: next };
}

/** Sets run, walk, and rounds from the preset without changing warm-up, cool-down, or voice options (FR-003, WS2). */
export function applyPreset(s: RunWalkSettings, p: Preset): RunWalkSettings {
  return {
    ...s,
    runSec: p.runSec,
    walkSec: p.walkSec,
    rounds: p.rounds,
  };
}

/** The preset matching run, walk, and rounds, or null when any one differs (FR-003, WS2). */
export function matchingPreset(s: RunWalkSettings): Preset | null {
  return (
    PRESETS.find(
      (p) => p.runSec === s.runSec && p.walkSec === s.walkSec && p.rounds === s.rounds,
    ) ?? null
  );
}

/** Total workout duration in seconds, matching the definition's phases (FR-006, WS3). */
export function totalSec(s: RunWalkSettings): number {
  const ready = 10;
  const walks = s.cooldownSec > 0 ? s.rounds - 1 : s.rounds;
  return ready + s.warmupSec + s.rounds * s.runSec + walks * s.walkSec + s.cooldownSec;
}

