import type { Phase } from '@/engine/types';

/** A JSON value, for mode settings that must survive a relaunch. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Plain, JSON-serialisable description of a session (FR-026). Everything needed to rebuild the
 * session and its cues after a relaunch.
 */
export type SessionDefinition<S extends Json = Json> = {
  /** Must match a registered ModeDefinition. */
  modeId: string;
  /** Shown in the notification. */
  title: string;
  phases: Phase[];
  /** Mode-specific; opaque to the engine. */
  settings: S;
  /** Keep the screen on while the session screen is open (FR-021a). */
  keepScreenOn: boolean;
};

/** Saved copy of a running or paused session, used to recover after an OS kill (FR-023). */
export type SessionRecord = {
  version: 1;
  definition: SessionDefinition;
  status: 'running' | 'paused';
  /** Phase index at the last write. */
  index: number;
  /** Wall time the current phase started, at the last write. */
  phaseStartAt: number;
  /** Wall time the session was paused, or null. */
  pausedAt: number | null;
  /** Wall time of the last write. */
  writtenAt: number;
  /** Raw elapsedRealtime in ms at the write (FR-018). */
  elapsedAt?: number;
  /** Boot count of the device at the write (FR-018). */
  bootCount?: number;
};

/** Where to resume a recovered session. */
export type ResumeAssessment = {
  definition: SessionDefinition;
  index: number;
  phaseElapsedMs: number;
  paused: boolean;
};

export type InterruptedReason = 'clock' | 'stale' | 'finished';

/** Result of the launch check (FR-024, FR-025). */
export type RecoveryResult =
  | { kind: 'none' }
  | { kind: 'resume'; assessment: ResumeAssessment }
  | { kind: 'interrupted'; reason: InterruptedReason; title: string; at: number };
