import { MAX_STEPS, MAX_STEP_SEC, MAX_TITLE, MIN_STEP_SEC } from './defaults';
import type { Routine, Step } from './types';

/** A deleted step and where it was, for Undo. */
export type RemovedStep = { step: Step; index: number };

/** Whole seconds within 15 s–60 min (FR-001, clarification Q1). */
export function normaliseDuration(sec: number) {
  if (Number.isNaN(sec)) return MIN_STEP_SEC;
  return Math.min(MAX_STEP_SEC, Math.max(MIN_STEP_SEC, Math.round(sec)));
}

export function updateStep(
  routine: Routine,
  id: string,
  patch: { title?: string; durationSec?: number | null },
): Routine {
  if (!routine.steps.some((s) => s.id === id)) return routine;
  return {
    ...routine,
    steps: routine.steps.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s };
      if (patch.title !== undefined) next.title = patch.title.slice(0, MAX_TITLE);
      if (patch.durationSec !== undefined) {
        next.durationSec = patch.durationSec === null ? null : normaliseDuration(patch.durationSec);
      }
      return next;
    }),
  };
}

/** Appends a 2-minute step with an empty title, up to 30 steps. */
export function addStep(routine: Routine, id: string): Routine {
  if (routine.steps.length >= MAX_STEPS) return routine;
  return { ...routine, steps: [...routine.steps, { id, title: '', durationSec: 120 }] };
}

export function moveStep(routine: Routine, id: string, dir: -1 | 1): Routine {
  const i = routine.steps.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= routine.steps.length) return routine;
  const steps = [...routine.steps];
  [steps[i], steps[j]] = [steps[j], steps[i]];
  return { ...routine, steps };
}

/** Removes a step, never the only one, and returns it for Undo. */
export function deleteStep(routine: Routine, id: string): { routine: Routine; removed: RemovedStep | null } {
  const index = routine.steps.findIndex((s) => s.id === id);
  if (index < 0 || routine.steps.length <= 1) return { routine, removed: null };
  return {
    routine: { ...routine, steps: routine.steps.filter((s) => s.id !== id) },
    removed: { step: routine.steps[index], index },
  };
}

/** Puts a deleted step back where it was, or at the end if the list has shrunk. */
export function restoreStep(routine: Routine, removed: RemovedStep): Routine {
  if (routine.steps.length >= MAX_STEPS || routine.steps.some((s) => s.id === removed.step.id)) return routine;
  const steps = [...routine.steps];
  steps.splice(Math.min(removed.index, steps.length), 0, removed.step);
  return { ...routine, steps };
}
