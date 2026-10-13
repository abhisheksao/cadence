import type { Cue } from '@/engine/types';

export type CueLogEntry = { type: Cue['type']; planned: number; actual: number; phase: number };

/**
 * One line per played cue, read over adb by scripts/timing-report.mjs (FR-022a). The format is
 * fixed by contracts/timing-log.md; it never includes spoken text.
 */
export function formatCueLog({ type, planned, actual, phase }: CueLogEntry) {
  return `CADENCE_CUE v=1 type=${type} planned=${planned} actual=${actual} err=${actual - planned} phase=${phase}`;
}

export function logCue(entry: CueLogEntry) {
  console.info(formatCueLog(entry));
}
