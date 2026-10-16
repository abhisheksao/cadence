import type { KeyValueStore } from '@/storage/types';

import { MAX_STEPS, MAX_STEP_SEC, MIN_STEP_SEC, defaultRoutine } from './defaults';
import type { Routine, Step } from './types';

/** Storage key of the routine (research R4). */
export const ROUTINE_KEY = 'routine:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isStep(v: unknown): v is Step {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.title !== 'string') return false;
  const d = v.durationSec;
  return d === null || (Number.isInteger(d) && (d as number) >= MIN_STEP_SEC && (d as number) <= MAX_STEP_SEC);
}

/** Reads a stored routine; anything invalid or from another version gives null. */
export function parseRoutine(raw: string | null): Routine | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.steps)) return null;
  const steps: unknown[] = value.steps;
  if (steps.length === 0 || steps.length > MAX_STEPS || !steps.every(isStep)) return null;
  if (new Set(steps.map((s) => s.id)).size !== steps.length) return null;
  return { version: 1, steps };
}

/**
 * Holds the routine in memory and saves every change as one value (FR-004). Loads synchronously
 * on first use, so a screen never shows the default before the saved routine.
 */
export class RoutineStore {
  private routine: Routine | null = null;
  private readonly listeners = new Set<(r: Routine) => void>();

  constructor(private readonly deps: { store: KeyValueStore; newId: () => string }) {}

  get(): Routine {
    if (this.routine === null) {
      const saved = parseRoutine(this.deps.store.getSync(ROUTINE_KEY));
      this.routine = saved ?? defaultRoutine(this.deps.newId);
      // The first read is the initial value, not a change: save the default, notify nobody.
      if (!saved) this.save(this.routine);
    }
    return this.routine as Routine;
  }

  subscribe(fn: (r: Routine) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  update(fn: (r: Routine) => Routine) {
    const next = fn(this.get());
    if (next !== this.routine) this.replace(next);
  }

  restoreDefault() {
    this.replace(defaultRoutine(this.deps.newId));
  }

  private replace(routine: Routine) {
    this.routine = routine;
    this.save(routine);
    this.listeners.forEach((fn) => fn(routine));
  }

  private save(routine: Routine) {
    this.deps.store.set(ROUTINE_KEY, JSON.stringify(routine)).catch((e: unknown) => {
      console.warn('Could not save the routine', e);
    });
  }
}
