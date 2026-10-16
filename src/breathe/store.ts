import type { KeyValueStore } from '@/storage/types';

import { LIMITS, defaultSettings } from './settings';
import type { BreatheCueStyle, BreatheField, BreatheSettings } from './types';

/** Storage key of the guided breathing settings. */
export const BREATHE_KEY = 'breathe:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const VALID_CUE_STYLES: ReadonlySet<string> = new Set<BreatheCueStyle>(['voice', 'count', 'tones']);

/** Reads stored settings; unreadable JSON, a non-object, or another version gives null. */
export function parseBreathe(raw: string | null): BreatheSettings | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1) return null;
  const d = defaultSettings();
  const num = (k: BreatheField) => {
    const rawVal = value[k];
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) return d[k];
    const { min, max, step } = LIMITS[k];
    const snapped = Math.round(rawVal / step) * step;
    return Math.max(min, Math.min(max, snapped));
  };
  const flag = (k: 'prepEnabled' | 'keepScreenOn') =>
    typeof value[k] === 'boolean' ? (value[k] as boolean) : d[k];
  const cueStyle = (rawStyle: unknown): BreatheCueStyle =>
    typeof rawStyle === 'string' && VALID_CUE_STYLES.has(rawStyle) ? (rawStyle as BreatheCueStyle) : d.cueStyle;

  return {
    version: 1,
    inhaleSec: num('inhaleSec'),
    holdSec: num('holdSec'),
    exhaleSec: num('exhaleSec'),
    postHoldSec: num('postHoldSec'),
    targetMinutes: num('targetMinutes'),
    prepEnabled: flag('prepEnabled'),
    cueStyle: cueStyle(value.cueStyle),
    keepScreenOn: flag('keepScreenOn'),
  };
}

/**
 * Holds the breathing settings in memory and saves every change as one value. Loads
 * synchronously on first use, so the UI immediately has access to persisted settings.
 */
export class BreatheStore {
  private settings: BreatheSettings | null = null;
  private readonly listeners = new Set<(s: BreatheSettings) => void>();

  constructor(private readonly deps: { store: KeyValueStore }) {}

  get(): BreatheSettings {
    if (this.settings === null) {
      const saved = parseBreathe(this.deps.store.getSync(BREATHE_KEY));
      this.settings = saved ?? defaultSettings();
      if (!saved) this.save(this.settings);
    }
    return this.settings;
  }

  subscribe(fn: (s: BreatheSettings) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  update(fn: (s: BreatheSettings) => BreatheSettings) {
    const next = fn(this.get());
    if (next === this.settings) return;
    this.settings = next;
    this.save(next);
    this.listeners.forEach((l) => l(next));
  }

  private save(settings: BreatheSettings) {
    this.deps.store.set(BREATHE_KEY, JSON.stringify(settings)).catch((e: unknown) => {
      console.warn('Could not save the breathe settings', e);
    });
  }
}
