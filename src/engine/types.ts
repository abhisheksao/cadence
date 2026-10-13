/** One step of a session (FR-001). */
export type Phase = {
  /** Free label the mode uses to pick cues, e.g. "warmup", "step", "inhale". */
  kind: string;
  title: string;
  subtitle?: string;
  /** Whole seconds ≥ 1, or null for an untimed phase that waits for skip. */
  durationSec: number | null;
};

/** Given to the mode once per whole second of each phase (FR-002). */
export type CueOpportunity = {
  phase: Phase;
  index: number;
  /** Whole seconds elapsed in the phase (0 at phase start). */
  sec: number;
  /** durationSec - sec, or null for untimed phases. */
  remaining: number | null;
  prev?: Phase;
  next?: Phase;
  /** Wall time at which this second is due. Can be up to 1 s in the future. */
  at: number;
  /** True at sec 0, and for the phase announced after a catch-up (FR-007). */
  isPhaseStart: boolean;
};

export type Cue =
  | { type: 'beep' | 'beepLast' | 'chime'; offsetMs?: number }
  | { type: 'say'; text: string; interrupt?: boolean; offsetMs?: number };

/** A mode's cue logic for one session (FR-003). */
export interface CueHandler {
  /** Which cue(s), if any, to play for this second. Must be pure and fast. */
  cueFor(op: CueOpportunity): Cue | Cue[] | null;
  /** Cue(s) for session completion; `at` is the exact end time. */
  completion(at: number): Cue | Cue[] | null;
}

export type Status = 'idle' | 'running' | 'paused' | 'done' | 'stopped';

export type EngineEvents = {
  /** A cue is due at `at` (possibly up to 1 s ahead). */
  onCue(cue: Cue, at: number): void;
  onPhaseChange?(phase: Phase, index: number): void;
  onStatusChange?(status: Status): void;
  /** Cues already handed out must be cancelled (pause, skip, back, stop). */
  onCancelPending?(): void;
};

/** Live state for screens (FR-012). */
export type SessionSnapshot = {
  status: Status;
  index: number;
  phase: Phase | undefined;
  phaseElapsedMs: number;
  /** null for untimed phases. */
  phaseRemainingMs: number | null;
  totalElapsedMs: number;
};
