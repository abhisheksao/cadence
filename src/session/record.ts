import type { SessionSnapshot } from '@/engine/types';

import type { RecoveryResult, SessionDefinition, SessionRecord } from './types';

/** Storage key of the saved session (research R7). */
export const RECORD_KEY = 'session-record:v1';

/** A record not refreshed for longer than this is too old to resume (FR-025). */
const STALE_MS = 60 * 60 * 1_000;

/** Saves where a running or paused session is, as wall-clock anchors (FR-023). */
export function toRecord(
  definition: SessionDefinition,
  snapshot: SessionSnapshot,
  now: number,
  clock?:
    | { elapsed?: () => number | null; bootCount?: () => number | null }
    | { elapsedAt?: number; bootCount?: number },
): SessionRecord {
  const paused = snapshot.status === 'paused';
  let elapsedAt: number | undefined;
  let bootCount: number | undefined;

  if (clock) {
    if ('elapsed' in clock && typeof clock.elapsed === 'function') {
      const e = clock.elapsed();
      if (typeof e === 'number' && Number.isFinite(e) && e >= 0) elapsedAt = e;
    } else if ('elapsedAt' in clock && typeof clock.elapsedAt === 'number' && Number.isFinite(clock.elapsedAt) && clock.elapsedAt >= 0) {
      elapsedAt = clock.elapsedAt;
    }

    if ('bootCount' in clock && typeof clock.bootCount === 'function') {
      const b = clock.bootCount();
      if (typeof b === 'number' && Number.isInteger(b) && b >= 0) bootCount = b;
    } else if ('bootCount' in clock && typeof clock.bootCount === 'number' && Number.isInteger(clock.bootCount) && clock.bootCount >= 0) {
      bootCount = clock.bootCount;
    }
  }

  const record: SessionRecord = {
    version: 1,
    definition,
    status: paused ? 'paused' : 'running',
    index: snapshot.index,
    phaseStartAt: now - snapshot.phaseElapsedMs,
    pausedAt: paused ? now : null,
    writtenAt: now,
  };

  if (elapsedAt !== undefined) record.elapsedAt = elapsedAt;
  if (bootCount !== undefined) record.bootCount = bootCount;

  return record;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Reads a stored record; anything malformed or from another version gives null. */
export function parseRecord(raw: string | null): SessionRecord | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1) return null;
  const { definition, status, index, phaseStartAt, pausedAt, writtenAt, elapsedAt, bootCount } = value;
  if (!isObject(definition) || !Array.isArray(definition.phases) || typeof definition.title !== 'string') return null;
  if (status !== 'running' && status !== 'paused') return null;
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= definition.phases.length) return null;
  if (typeof phaseStartAt !== 'number' || typeof writtenAt !== 'number') return null;
  if (status === 'paused' ? typeof pausedAt !== 'number' : pausedAt !== null) return null;

  if (elapsedAt !== undefined) {
    if (typeof elapsedAt !== 'number' || !Number.isFinite(elapsedAt) || elapsedAt < 0) return null;
  }
  if (bootCount !== undefined) {
    if (typeof bootCount !== 'number' || !Number.isInteger(bootCount) || bootCount < 0) return null;
  }

  return value as SessionRecord;
}

/**
 * Computes the effective time for recovery assessment (CL5, CL6).
 * Same boot: advances by elapsed delta, independent of wall clock changes.
 * Different boot, missing fields, or null clock: falls back to wallNow.
 */
export function recoveryNow(
  record: SessionRecord,
  options: { elapsed: number | null; bootCount: number | null; wallNow: number },
): number {
  const { elapsed, bootCount, wallNow } = options;
  if (
    record.bootCount !== undefined &&
    bootCount !== null &&
    record.bootCount === bootCount &&
    record.elapsedAt !== undefined &&
    elapsed !== null
  ) {
    return record.writtenAt + (elapsed - record.elapsedAt);
  }
  return wallNow;
}

/**
 * Decides whether a saved session can be resumed, and where.
 * Pure: the caller passes the current wall time.
 */
export function assessRecord(record: SessionRecord | null, now: number): RecoveryResult {
  if (!record) return { kind: 'none' };
  const { definition, writtenAt } = record;
  const interrupted = (reason: 'clock' | 'stale' | 'finished'): RecoveryResult => ({
    kind: 'interrupted',
    reason,
    title: definition.title,
    at: writtenAt,
  });

  if (now < writtenAt) return interrupted('clock');
  if (now - writtenAt > STALE_MS) return interrupted('stale');

  if (record.status === 'paused') {
    const phaseElapsedMs = (record.pausedAt ?? writtenAt) - record.phaseStartAt;
    return { kind: 'resume', assessment: { definition, index: record.index, phaseElapsedMs, paused: true } };
  }

  // Walk the clock forward through phases that ended while the app was dead.
  let index = record.index;
  let start = record.phaseStartAt;
  for (;;) {
    const duration = definition.phases[index].durationSec;
    if (duration === null) break; // An untimed phase waits for the user.
    const end = start + duration * 1_000;
    if (now < end) break;
    if (index === definition.phases.length - 1) return interrupted('finished');
    index += 1;
    start = end;
  }
  return { kind: 'resume', assessment: { definition, index, phaseElapsedMs: now - start, paused: false } };
}
