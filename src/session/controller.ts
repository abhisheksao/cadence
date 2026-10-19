import type { CuePlayer } from '@/audio/types';
import type { Clock, Scheduler } from '@/engine/clock';
import { Engine } from '@/engine/engine';
import type { SessionSnapshot } from '@/engine/types';
import type { ModeRegistry } from '@/modes/types';
import type { BackgroundHost } from '@/platform/background';
import type { SessionClock } from '@/platform/clock';
import { notificationState } from '@/platform/notification';
import type { KeyValueStore } from '@/storage/types';

import { RECORD_KEY, assessRecord, parseRecord, recoveryNow, toRecord } from './record';
import type { RecoveryResult, ResumeAssessment, SessionDefinition } from './types';
import { validateDefinition } from './validate';

/** Keep the service up this long after the end so the completion cue finishes (FR-014). */
const WIND_DOWN_MS = 4_000;
/** How often the saved record is refreshed while running (FR-023). */
const RECORD_REFRESH_MS = 60_000;

type Position = Omit<ResumeAssessment, 'definition'>;

/** What screens show: the engine snapshot plus session-level details. */
export type SessionState = SessionSnapshot & {
  title: string;
  definition: SessionDefinition;
  /** True if the OS refused the background service (cues may stop with the screen off). */
  backgroundWarning: boolean;
};

export type ControllerDeps = {
  clock: SessionClock | Clock;
  scheduler: Scheduler;
  player: CuePlayer;
  background: BackgroundHost;
  store: KeyValueStore;
  modes: ModeRegistry;
};

let sessionCounter = 0;
function newSessionId(now: number): string {
  sessionCounter += 1;
  return `${now.toString(36)}-${sessionCounter.toString(36)}`;
}

type Active = {
  engine: Engine;
  definition: SessionDefinition;
  backgroundWarning: boolean;
  /** Ends the background service's task. */
  release: () => void;
  cancelWindDown: (() => void) | null;
  /** Stops the periodic record refresh. */
  cancelRefresh: () => void;
  cancelHeartbeat: () => void;
  unsubscribe: () => void;
  unsubTaskRemoved: () => void;
  unsubAction: () => void;
};

/**
 * Runs one session at a time: validates it, starts the background service, wires the engine's
 * cues to the player, and winds the service down afterwards.
 */
export class SessionController {
  private active: Active | null = null;
  private lastActive: Active | null = null;
  private state: SessionState | null = null;
  private readonly listeners = new Set<(s: SessionState | null) => void>();

  constructor(private readonly deps: ControllerDeps) {}

  getState() {
    return this.state;
  }

  subscribe(fn: (s: SessionState | null) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Starts a new session, replacing any current one (FR-011). */
  start(definition: SessionDefinition) {
    return this.launch(definition, null);
  }

  /** Continues a session found by checkForInterrupted() (FR-024). */
  resumeInterrupted(assessment: ResumeAssessment) {
    const { definition, ...position } = assessment;
    return this.launch(definition, position);
  }

  /** On launch: is there a session that was killed mid-way (FR-024, FR-025)? */
  checkForInterrupted(): RecoveryResult {
    const record = parseRecord(this.deps.store.getSync(RECORD_KEY));
    if (!record) return { kind: 'none' };
    const wallNow = this.deps.clock.now();
    const clock = this.deps.clock;
    const elapsed = 'elapsed' in clock && typeof clock.elapsed === 'function' ? clock.elapsed() : null;
    const bootCount = 'bootCount' in clock && typeof clock.bootCount === 'function' ? clock.bootCount() : null;
    const now = recoveryNow(record, { elapsed, bootCount, wallNow });
    return assessRecord(record, now);
  }

  /** Forgets an interrupted session: after Discard, or once the user has seen it was lost. */
  discardInterrupted() {
    return this.deps.store.remove(RECORD_KEY);
  }

  private async launch(definition: SessionDefinition, position: Position | null) {
    const { modes, player, background, clock, scheduler } = this.deps;
    const errors = validateDefinition(definition, (id) => modes.has(id));
    if (errors.length > 0) throw new Error(`Invalid session: ${errors.join('; ')}`);
    const mode = modes.get(definition.modeId);
    if (!mode) throw new Error(`Invalid session: modeId: unknown mode "${definition.modeId}"`);

    this.replaceActive();
    await player.init();
    await background.prepare();

    let release = () => {};
    const keepAliveUntil = new Promise<void>((resolve) => {
      release = resolve;
    });
    let engineStarted = false;
    let wasPaused = false;
    const engine = new Engine(
      definition.phases,
      mode.cueFor(definition),
      {
        onCue: (cue, at, phase, phaseStart) => player.play(cue, at, phase, phaseStart),
        onCancelPending: () => player.silence(),
        // The first phase's title goes out with background.start().
        onPhaseChange: () => {
          if (!engineStarted) return;
          this.updateNotification(engine);
          this.saveRecord(engine);
        },
        onStatusChange: (status) => {
          if (status === 'paused' || (status === 'running' && wasPaused)) this.updateNotification(engine);
          wasPaused = status === 'paused';
          if (status === 'running' || status === 'paused') {
            if (engineStarted) this.saveRecord(engine);
          } else {
            this.clearRecord();
          }
          if (status === 'done') this.windDown(engine);
        },
      },
      { clock, scheduler },
    );
    const initialIndex = position?.index ?? 0;
    const initialPhase = definition.phases[initialIndex];
    const initialDurationMs = initialPhase?.durationSec == null ? null : initialPhase.durationSec * 1_000;
    const initialRemainingMs =
      initialDurationMs === null ? null : Math.max(0, initialDurationMs - (position?.phaseElapsedMs ?? 0));
    const initialSnapshot: SessionSnapshot = {
      status: position?.paused ? 'paused' : 'running',
      index: initialIndex,
      phase: initialPhase,
      phaseElapsedMs: position?.phaseElapsedMs ?? 0,
      phaseRemainingMs: initialRemainingMs,
      totalElapsedMs: 0,
    };
    const initialNotification = notificationState(definition, initialSnapshot)!;
    const route = typeof mode.route === 'string' ? mode.route : (mode.route.pathname ?? '/');
    const sessionId = newSessionId(clock.now());
    const serviceStarted = await background.start({
      sessionId,
      route,
      notification: initialNotification,
      keepAliveUntil,
    });

    const cancelHeartbeat = scheduler.every(2_000, () => background.heartbeat());
    const unsubTaskRemoved = background.onTaskRemoved(() => {
      this.stop();
    });
    const unsubAction = background.onAction((action) => {
      const state = this.getState();
      if (!state) return;
      if (action === 'pause') {
        if (state.status === 'running') this.pause();
      } else if (action === 'resume') {
        if (state.status === 'paused') this.resume();
      } else if (action === 'skip') {
        this.skip();
      }
    });

    const active: Active = {
      engine,
      definition,
      backgroundWarning: !serviceStarted,
      release,
      cancelWindDown: null,
      cancelRefresh: () => {},
      cancelHeartbeat,
      unsubscribe: () => {},
      unsubTaskRemoved,
      unsubAction,
    };
    this.active = active;
    active.unsubscribe = engine.subscribe((snapshot) => this.publish(active, snapshot));
    if (position) engine.startAt(position);
    else engine.start();
    engineStarted = true;
    this.saveRecord(engine);
    // Refresh the record while running, so a later relaunch can tell it is recent (FR-023).
    active.cancelRefresh = scheduler.every(RECORD_REFRESH_MS, () => {
      if (engine.snapshot().status === 'running') this.saveRecord(engine);
    });
  }

  pause() {
    this.active?.engine.pause();
  }

  resume() {
    this.active?.engine.resume();
  }

  skip() {
    this.active?.engine.skip();
  }

  back() {
    this.active?.engine.back();
  }

  /** Stops the session and the background service right away (no wind-down: no chime). */
  stop() {
    const active = this.active;
    if (!active) return;
    active.engine.stop();
    this.active = null;
    this.lastActive = null;
    active.unsubscribe();
    active.cancelRefresh();
    active.cancelHeartbeat();
    active.unsubTaskRemoved();
    active.unsubAction();
    active.cancelWindDown?.();
    active.cancelWindDown = null;
    active.release();
    void this.deps.background.stop();
  }

  /** Stops the current session (if any) and its service: a new one replaces it. */
  private replaceActive() {
    const previous = this.active;
    if (!previous) return;
    this.active = null;
    this.lastActive = null;
    previous.unsubscribe();
    previous.cancelRefresh();
    previous.cancelHeartbeat();
    previous.unsubTaskRemoved();
    previous.unsubAction();
    previous.cancelWindDown?.();
    previous.engine.stop();
    this.deps.player.silence();
    previous.release();
    void this.deps.background.stop();
  }

  /**
   * Shows the current phase, or the paused label, in the notification (C3). Called on phase
   * changes and pause/resume only.
   */
  private updateNotification(engine: Engine) {
    if (this.active?.engine !== engine) return;
    const notification = notificationState(this.active.definition, engine.snapshot());
    if (notification) {
      this.deps.background.update(notification);
    }
  }

  private saveRecord(engine: Engine) {
    const active = this.active;
    if (active?.engine !== engine) return;
    const clock = this.deps.clock;
    const elapsed = 'elapsed' in clock && typeof clock.elapsed === 'function' ? clock.elapsed() : null;
    const bootCount = 'bootCount' in clock && typeof clock.bootCount === 'function' ? clock.bootCount() : null;
    const record = toRecord(active.definition, engine.snapshot(), clock.now(), {
      elapsedAt: elapsed ?? undefined,
      bootCount: bootCount ?? undefined,
    });
    this.deps.store.set(RECORD_KEY, JSON.stringify(record)).catch((e: unknown) => {
      console.warn('Could not save the session record', e);
    });
  }

  private clearRecord() {
    this.deps.store.remove(RECORD_KEY).catch((e: unknown) => {
      console.warn('Could not clear the session record', e);
    });
  }

  private windDown(engine: Engine) {
    const active = this.active;
    if (!active || active.engine !== engine) return;
    active.cancelRefresh();
    const cancel = this.deps.scheduler.every(WIND_DOWN_MS, () => {
      cancel();
      active.cancelHeartbeat();
      active.unsubTaskRemoved();
      active.unsubAction();
      active.unsubscribe();
      active.cancelWindDown = null;
      active.release();
      if (this.active === active) {
        this.active = null;
        this.lastActive = null;
        void this.deps.background.stop();
      }
    });
    active.cancelWindDown = cancel;
  }

  private publish(active: Active, snapshot: SessionSnapshot) {
    if (this.active !== active) return;
    const nextState: SessionState = {
      ...snapshot,
      title: active.definition.title,
      definition: active.definition,
      backgroundWarning: active.backgroundWarning,
    };
    if (this.lastActive !== active || hasVisibleChange(this.state, nextState)) {
      this.lastActive = active;
      this.state = nextState;
      this.listeners.forEach((fn) => fn(this.state));
    }
  }
}

function toRemainingSec(ms: number | null): number | null {
  return ms === null ? null : Math.ceil(ms / 1_000);
}

function hasVisibleChange(prev: SessionState | null, next: SessionState): boolean {
  if (!prev) return true;
  return (
    prev.status !== next.status ||
    prev.index !== next.index ||
    prev.backgroundWarning !== next.backgroundWarning ||
    Math.floor(prev.phaseElapsedMs / 1_000) !== Math.floor(next.phaseElapsedMs / 1_000) ||
    toRemainingSec(prev.phaseRemainingMs) !== toRemainingSec(next.phaseRemainingMs) ||
    Math.floor(prev.totalElapsedMs / 1_000) !== Math.floor(next.totalElapsedMs / 1_000)
  );
}

