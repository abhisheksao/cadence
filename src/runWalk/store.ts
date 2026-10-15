import type { KeyValueStore } from '@/storage/types';

import { LIMITS, defaultSettings } from './settings';
import type { RunWalkField, RunWalkSettings } from './types';

/** Storage key of the run / walk settings (research R3). */
export const RUN_WALK_KEY = 'run-walk:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Reads stored settings; unreadable JSON, a non-object or another version gives null. */
export function parseRunWalk(raw: string | null): RunWalkSettings | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1) return null;
  const d = defaultSettings();
  const num = (k: RunWalkField) => {
    const rawVal = value[k];
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) return d[k];
    const { min, max, step } = LIMITS[k];
    const snapped = Math.round(rawVal / step) * step;
    return Math.max(min, Math.min(max, snapped));
  };
  const flag = (k: 'announceRound' | 'halfway' | 'timeLeft' | 'keepScreenOn') =>
    typeof value[k] === 'boolean' ? (value[k] as boolean) : d[k];
  return {
    version: 1,
    warmupSec: num('warmupSec'),
    runSec: num('runSec'),
    walkSec: num('walkSec'),
    rounds: num('rounds'),
    cooldownSec: num('cooldownSec'),
    announceRound: flag('announceRound'),
    halfway: flag('halfway'),
    timeLeft: flag('timeLeft'),
    keepScreenOn: flag('keepScreenOn'),
  };
}

/**
 * Holds the run / walk settings in memory and saves every change as one value (FR-005). Loads
 * synchronously on first use, so a screen never shows the defaults before the saved settings.
 */
export class RunWalkStore {
  private settings: RunWalkSettings | null = null;
  private readonly listeners = new Set<(s: RunWalkSettings) => void>();

  constructor(private readonly deps: { store: KeyValueStore }) {}

  get(): RunWalkSettings {
    if (this.settings === null) {
      const saved = parseRunWalk(this.deps.store.getSync(RUN_WALK_KEY));
      this.settings = saved ?? defaultSettings();
      // The first read is the initial value, not a change: save the defaults, notify nobody.
      if (!saved) this.save(this.settings);
    }
    return this.settings;
  }

  subscribe(fn: (s: RunWalkSettings) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  update(fn: (s: RunWalkSettings) => RunWalkSettings) {
    const next = fn(this.get());
    if (next === this.settings) return;
    this.settings = next;
    this.save(next);
    this.listeners.forEach((l) => l(next));
  }

  private save(settings: RunWalkSettings) {
    this.deps.store.set(RUN_WALK_KEY, JSON.stringify(settings)).catch((e: unknown) => {
      console.warn('Could not save the run / walk settings', e);
    });
  }
}
