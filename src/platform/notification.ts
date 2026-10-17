import type { Phase, SessionSnapshot } from '@/engine/types';
import type { SessionDefinition } from '@/session/types';

export type NotificationTimer =
  | { kind: 'countdown'; remainingMs: number }
  | { kind: 'elapsed'; elapsedMs: number }
  | null;

export type NotificationState = {
  title: string;
  text: string;
  timer: NotificationTimer;
  paused: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats milliseconds as m:ss, or h:mm:ss from an hour up. Negative values clamp to 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function phaseText(phase: Phase): string {
  return phase.subtitle ? `${phase.subtitle}: ${phase.title}` : phase.title;
}

/**
 * Derives the ongoing notification state from the session definition and live snapshot (FR-008–FR-011).
 * Returns null if the session is not running or paused, or has no active phase.
 */
export function notificationState(
  definition: Pick<SessionDefinition, 'title'>,
  snapshot: SessionSnapshot,
): NotificationState | null {
  const { status, phase } = snapshot;
  if (!phase || (status !== 'running' && status !== 'paused')) {
    return null;
  }

  const text = phaseText(phase);
  const isTimed = phase.durationSec !== null;

  if (status === 'paused') {
    const timeFormatted = isTimed
      ? `${formatClock(snapshot.phaseRemainingMs ?? 0)} left`
      : formatClock(snapshot.phaseElapsedMs);
    return {
      title: definition.title,
      text: `Paused · ${text} · ${timeFormatted}`,
      timer: null,
      paused: true,
    };
  }

  const timer: NotificationTimer = isTimed
    ? { kind: 'countdown', remainingMs: Math.max(0, snapshot.phaseRemainingMs ?? 0) }
    : { kind: 'elapsed', elapsedMs: Math.max(0, snapshot.phaseElapsedMs) };

  return {
    title: definition.title,
    text,
    timer,
    paused: false,
  };
}
