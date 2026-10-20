import type { Cue } from '@/engine/types';

export type CueLogEntry = { type: Cue['type']; planned: number; actual: number; phase: number };

/**
 * One line per played cue, read over adb by scripts/timing-report.mjs (FR-022a).
 * It never includes spoken text.
 */
export function formatCueLog({ type, planned, actual, phase }: CueLogEntry) {
  return `CADENCE_CUE v=1 type=${type} planned=${planned} actual=${actual} err=${actual - planned} phase=${phase}`;
}

export function logCue(entry: CueLogEntry) {
  console.info(formatCueLog(entry));
}

export type SkipLogEntry = { type: Cue['type']; planned: number; reason: 'focus'; phase: number };

/**
 * One line per skipped cue when audio focus was refused (FR-027).
 */
export function formatSkipLog({ type, planned, reason, phase }: SkipLogEntry) {
  return `CADENCE_SKIP v=1 type=${type} planned=${planned} reason=${reason} phase=${phase}`;
}

export function logSkip(entry: SkipLogEntry) {
  console.info(formatSkipLog(entry));
}
