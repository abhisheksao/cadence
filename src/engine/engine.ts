import type { Clock, Scheduler } from './clock';
import type { Cue, CueHandler, EngineEvents, Phase, SessionSnapshot, Status } from './types';

/** How often the engine wakes up to recompute its position from the clock. */
const TICK_MS = 100;
/** Cues are handed out this far ahead so the audio layer can start them early (research R2). */
const LOOKAHEAD_MS = 1_000;
/** Per-second cues later than this are dropped instead of played in a burst (FR-007). */
const STALE_MS = 2_000;
/** Back restarts the current phase after this long in it; before, it goes to the previous one. */
const BACK_RESTART_AFTER_MS = 3_000;

/**
 * A phase timeline driven by the wall clock. Each tick works out the current phase and second
 * from `clock.now()`, never from counting ticks, so late or missing ticks cannot cause drift.
 */
export class Engine {
  private status: Status = 'idle';
  private index = 0;
  /** Wall time the current phase started. */
  private phaseStartAt = 0;
  /** Sum of the durations of finished phases. */
  private completedMs = 0;
  /** The next cue opportunity to hand out. Can run ahead of `index` by LOOKAHEAD_MS. */
  private cursor = { index: 0, sec: 0 };
  private completionSent = false;
  /** Announce the current phase on the next resume: a session recovered while paused. */
  private announceOnResume = false;
  /** Wall time the session was paused, while paused. */
  private pausedAt = 0;
  /** Latest clock reading, to detect the clock going backwards. */
  private lastNow = 0;
  private cancelTick: (() => void) | null = null;
  private readonly listeners = new Set<(s: SessionSnapshot) => void>();

  constructor(
    private readonly phases: Phase[],
    private readonly handler: CueHandler,
    private readonly events: EngineEvents,
    private readonly deps: { clock: Clock; scheduler: Scheduler },
  ) {}

  start() {
    if (this.status !== 'idle' || this.phases.length === 0) return;
    this.index = 0;
    this.lastNow = this.deps.clock.now();
    this.phaseStartAt = this.lastNow;
    this.cursor = { index: 0, sec: 0 };
    this.setStatus('running');
    this.events.onPhaseChange?.(this.phases[0], 0);
    this.cancelTick = this.deps.scheduler.every(TICK_MS, () => this.tick());
    this.tick();
  }

  /**
   * Starts at a recovered position (FR-024). The phase is announced as a phase start, now or,
   * when paused, on resume; later seconds keep the grid of the original phase start.
   */
  startAt(position: { index: number; phaseElapsedMs: number; paused: boolean }) {
    const { index, phaseElapsedMs, paused } = position;
    if (this.status !== 'idle' || index < 0 || index >= this.phases.length) return;
    this.index = index;
    this.lastNow = this.deps.clock.now();
    this.phaseStartAt = this.lastNow - phaseElapsedMs;
    this.completedMs = this.phases.slice(0, index).reduce((sum, p) => sum + (p.durationSec ?? 0) * 1_000, 0);
    this.cancelTick = this.deps.scheduler.every(TICK_MS, () => this.tick());
    if (paused) {
      this.pausedAt = this.lastNow;
      this.announceOnResume = true;
      this.setStatus('paused');
      this.events.onPhaseChange?.(this.phases[index], index);
      this.emit();
      return;
    }
    this.setStatus('running');
    this.events.onPhaseChange?.(this.phases[index], index);
    this.announce(this.lastNow);
    this.tick();
  }

  pause() {
    if (this.status !== 'running') return;
    this.events.onCancelPending?.();
    this.pausedAt = this.now();
    // Cues handed out early were cancelled, so hand them out again on resume: rewind the cursor
    // to the first second of this phase that is not yet due.
    const elapsed = this.pausedAt - this.phaseStartAt;
    this.cursor = { index: this.index, sec: Math.floor(elapsed / 1_000) + 1 };
    this.completionSent = false;
    this.setStatus('paused');
    this.emit();
  }

  resume() {
    if (this.status !== 'paused') return;
    const now = this.now();
    this.phaseStartAt += now - this.pausedAt;
    this.setStatus('running');
    if (this.announceOnResume) {
      this.announceOnResume = false;
      this.announce(now);
    }
    this.tick();
  }

  /** Finish the current phase now: untimed phases and "skip". In the last phase, completes. */
  skip() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.events.onCancelPending?.();
    const now = this.status === 'paused' ? this.pausedAt : this.now();
    this.completedMs += now - this.phaseStartAt;
    this.completionSent = false;
    if (this.index === this.phases.length - 1) {
      this.finish('done');
      return;
    }
    this.jumpTo(this.index + 1, now);
  }

  /** More than 3 s into a phase: restart it. Otherwise go to the previous phase (FR-009). */
  back() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.events.onCancelPending?.();
    const now = this.status === 'paused' ? this.pausedAt : this.now();
    const restart = now - this.phaseStartAt > BACK_RESTART_AFTER_MS || this.index === 0;
    const target = restart ? this.index : this.index - 1;
    this.completedMs = this.phases.slice(0, target).reduce((sum, p) => sum + (p.durationSec ?? 0) * 1_000, 0);
    this.completionSent = false;
    this.jumpTo(target, now);
  }

  stop() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.events.onCancelPending?.();
    this.finish('stopped');
  }

  snapshot(): SessionSnapshot {
    const phase = this.phases[this.index];
    let phaseElapsedMs = 0;
    if (this.status === 'running') phaseElapsedMs = this.now() - this.phaseStartAt;
    if (this.status === 'paused') phaseElapsedMs = this.pausedAt - this.phaseStartAt;
    if (this.status === 'done') phaseElapsedMs = (phase?.durationSec ?? 0) * 1_000;
    const durationMs = phase?.durationSec == null ? null : phase.durationSec * 1_000;
    return {
      status: this.status,
      index: this.index,
      phase,
      phaseElapsedMs,
      phaseRemainingMs: durationMs === null ? null : Math.max(0, durationMs - phaseElapsedMs),
      totalElapsedMs: this.completedMs + phaseElapsedMs,
    };
  }

  subscribe(fn: (s: SessionSnapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Starts phase `index` from its beginning at `now`; stays paused if paused. */
  private jumpTo(index: number, now: number) {
    this.index = index;
    this.phaseStartAt = now;
    this.cursor = { index, sec: 0 };
    // The new phase gets its own start cue, so a pending recovery announcement is not needed.
    this.announceOnResume = false;
    this.events.onPhaseChange?.(this.phases[index], index);
    if (this.status === 'running') this.tick();
    else this.emit();
  }

  /**
   * Reads the clock. If it went backwards (the user changed the time), shifts every anchor back
   * by the same amount so progress does not jump (research R1). Forward jumps are followed.
   */
  private now() {
    const now = this.deps.clock.now();
    if (now < this.lastNow) {
      const shift = this.lastNow - now;
      this.phaseStartAt -= shift;
      this.pausedAt -= shift;
    }
    this.lastNow = now;
    return now;
  }

  private tick() {
    if (this.status !== 'running') return;
    const now = this.now();

    // Close out phases whose time is up. Advancing by the exact duration keeps the schedule
    // anchored however late this tick is.
    let ended = false;
    for (;;) {
      const phase = this.phases[this.index];
      if (phase.durationSec === null) break;
      const end = this.phaseStartAt + phase.durationSec * 1_000;
      if (now < end) break;
      if (this.index === this.phases.length - 1) {
        ended = true;
        break;
      }
      this.completedMs += phase.durationSec * 1_000;
      this.phaseStartAt = end;
      this.index += 1;
      this.events.onPhaseChange?.(this.phases[this.index], this.index);
    }

    this.fireCues(now);
    if (ended) this.finish('done');
    else this.emit();
  }

  /** Hands out every cue due before now + LOOKAHEAD_MS, looking into later phases if needed. */
  private fireCues(now: number) {
    const horizon = now + LOOKAHEAD_MS;
    let { index: i, sec: s } = this.cursor;
    let start = this.startOf(i);

    while (i < this.phases.length) {
      const phase = this.phases[i];
      const last = phase.durationSec === null ? Infinity : phase.durationSec - 1;
      for (; s <= last; s++) {
        const at = start + s * 1_000;
        if (at > horizon) {
          this.cursor = { index: i, sec: s };
          return;
        }
        this.offer(i, s, at, now);
      }
      // Only timed phases get here: an untimed phase's loop always returns above.
      start += (phase.durationSec ?? 0) * 1_000;
      i += 1;
      s = 0;
      if (start > horizon) break;
    }
    this.cursor = { index: i, sec: s };

    if (i >= this.phases.length && !this.completionSent && start <= horizon) {
      this.completionSent = true;
      // After a gap that ran past the end, play the completion cue now rather than in the past.
      const at = start >= now - STALE_MS ? start : now;
      this.deliver(this.handler.completion(at), at, i - 1);
    }
  }

  /** Offers the current second as a phase start, due now; the regular seconds resume after it. */
  private announce(now: number) {
    const sec = Math.floor((now - this.phaseStartAt) / 1_000);
    this.offer(this.index, sec, now, now, true);
    this.cursor = { index: this.index, sec: sec + 1 };
  }

  private offer(index: number, sec: number, at: number, now: number, announce = false) {
    const isPhaseStart = announce || sec === 0;
    let due = at;
    if (at < now - STALE_MS) {
      // After a long gap, announce the phase we landed in (now) and drop everything else.
      if (!(isPhaseStart && index === this.index)) return;
      due = now;
    }
    const phase = this.phases[index];
    const cues = this.handler.cueFor({
      phase,
      index,
      sec,
      remaining: phase.durationSec === null ? null : phase.durationSec - sec,
      prev: this.phases[index - 1],
      next: this.phases[index + 1],
      at: due,
      isPhaseStart,
    });
    this.deliver(cues, due, index);
  }

  private deliver(cues: Cue | Cue[] | null, at: number, phase: number) {
    if (cues === null) return;
    for (const cue of Array.isArray(cues) ? cues : [cues]) {
      this.events.onCue(cue, at + (cue.offsetMs ?? 0), phase);
    }
  }

  /** Wall time phase `i` starts, from the current phase's anchor. Phases on the way are timed. */
  private startOf(i: number) {
    let start = this.phaseStartAt;
    for (let k = this.index; k < i; k++) start += (this.phases[k].durationSec ?? 0) * 1_000;
    for (let k = i; k < this.index; k++) start -= (this.phases[k].durationSec ?? 0) * 1_000;
    return start;
  }

  private finish(status: 'done' | 'stopped') {
    if (this.status === 'done' || this.status === 'stopped' || this.status === 'idle') return;
    this.cancelTick?.();
    this.cancelTick = null;
    // Reached by skipping the last phase before the look-ahead asked for the completion cue.
    if (status === 'done' && !this.completionSent) {
      this.completionSent = true;
      const at = this.deps.clock.now();
      this.deliver(this.handler.completion(at), at, this.index);
    }
    this.setStatus(status);
    this.emit();
  }

  private setStatus(status: Status) {
    this.status = status;
    this.events.onStatusChange?.(status);
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}
