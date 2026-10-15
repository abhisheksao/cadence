import type { BreatheField, BreathePreset, BreatheSettings } from './types';

/** Range and step of each adjustable value. */
export const LIMITS: Readonly<Record<BreatheField, { min: number; max: number; step: number }>> = {
  inhaleSec: { min: 1, max: 30, step: 1 },
  holdSec: { min: 0, max: 30, step: 1 },
  exhaleSec: { min: 1, max: 30, step: 1 },
  postHoldSec: { min: 0, max: 30, step: 1 },
  targetMinutes: { min: 1, max: 30, step: 1 },
};

export const PRESETS: readonly BreathePreset[] = [
  {
    id: 'box',
    name: 'Box (4-4-4-4)',
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    postHoldSec: 4,
    targetMinutes: 3,
  },
  {
    id: '4-7-8',
    name: '4-7-8 Relax',
    inhaleSec: 4,
    holdSec: 7,
    exhaleSec: 8,
    postHoldSec: 0,
    targetMinutes: 2,
  },
  {
    id: '3-4-7',
    name: '3-4-7 Calm',
    inhaleSec: 3,
    holdSec: 4,
    exhaleSec: 7,
    postHoldSec: 0,
    targetMinutes: 2,
  },
  {
    id: 'coherent',
    name: 'Coherent (5-5)',
    inhaleSec: 5,
    holdSec: 0,
    exhaleSec: 5,
    postHoldSec: 0,
    targetMinutes: 5,
  },
];

/** The default settings a user starts with. */
export function defaultSettings(): BreatheSettings {
  return {
    version: 1,
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    postHoldSec: 4,
    targetMinutes: 3,
    prepEnabled: true,
    cueStyle: 'voice',
    keepScreenOn: false,
  };
}

/** Whether the field can move further in direction `dir`. */
export function canAdjust(s: BreatheSettings, field: BreatheField, dir: 1 | -1): boolean {
  const { min, max } = LIMITS[field];
  return dir === 1 ? s[field] < max : s[field] > min;
}

/** Moves the field by its step and clamps it into range. */
export function adjust(s: BreatheSettings, field: BreatheField, dir: 1 | -1): BreatheSettings {
  const { min, max, step } = LIMITS[field];
  const next = dir === 1 ? Math.min(max, s[field] + step) : Math.max(min, s[field] - step);
  return { ...s, [field]: next };
}

/** Sets breath phase durations and target minutes from the preset without changing toggles or cue style. */
export function applyPreset(s: BreatheSettings, p: BreathePreset): BreatheSettings {
  return {
    ...s,
    inhaleSec: p.inhaleSec,
    holdSec: p.holdSec,
    exhaleSec: p.exhaleSec,
    postHoldSec: p.postHoldSec,
    targetMinutes: p.targetMinutes,
  };
}

/** The preset matching all phase durations and target minutes, or null if any value differs. */
export function matchingPreset(s: BreatheSettings): BreathePreset | null {
  return (
    PRESETS.find(
      (p) =>
        p.inhaleSec === s.inhaleSec &&
        p.holdSec === s.holdSec &&
        p.exhaleSec === s.exhaleSec &&
        p.postHoldSec === s.postHoldSec &&
        p.targetMinutes === s.targetMinutes,
    ) ?? null
  );
}

/** Calculates the number of complete breath cycles for the target duration. */
export function calculateCycles(s: BreatheSettings): number {
  const cycleSec = s.inhaleSec + s.holdSec + s.exhaleSec + s.postHoldSec;
  if (cycleSec <= 0) return 1;
  return Math.max(1, Math.round((s.targetMinutes * 60) / cycleSec));
}

/** Total session duration in seconds, including preparation if enabled. */
export function totalSec(s: BreatheSettings): number {
  const prep = s.prepEnabled ? 5 : 0;
  const cycleSec = s.inhaleSec + s.holdSec + s.exhaleSec + s.postHoldSec;
  return prep + calculateCycles(s) * cycleSec;
}
