import type { Routine } from './types';

/** Shortest timed step: the step announcement finishes before the countdown beeps. */
export const MIN_STEP_SEC = 15;
export const MAX_STEP_SEC = 60 * 60;
export const MAX_STEPS = 30;
export const MAX_TITLE = 60;

const DEFAULT_STEPS: [string, number | null][] = [
  ['Drink a glass of water', 60],
  ['Make the bed', null],
  ['Stretch', 300],
  ['Breathing', 180],
  ['Plan the day', 180],
  ['Shower', null],
];

/** The routine a new user starts with (FR-002). */
export function defaultRoutine(newId: () => string): Routine {
  return {
    version: 1,
    steps: DEFAULT_STEPS.map(([title, durationSec]) => ({ id: newId(), title, durationSec })),
  };
}
