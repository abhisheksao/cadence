import type { CuePlayer } from '@/audio/types';
import type { Clock, Scheduler } from '@/engine/clock';
import { Engine } from '@/engine/engine';
import type { SessionSnapshot } from '@/engine/types';
import type { ModeRegistry } from '@/modes/types';
import type { BackgroundHost } from '@/platform/background';
import type { KeyValueStore } from '@/storage/types';

import { RECORD_KEY, assessRecord, parseRecord, toRecord } from './record';
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
  clock: Clock;
  scheduler: Scheduler;
  player: CuePlayer;
  background: BackgroundHost;
  store: KeyValueStore;
  modes: ModeRegistry;
};

type Active = {
  engine: Engine;
  definition: SessionDefinition;
  backgroundWarning: boolean;
  /** Ends the background service's task. */
  release: () => void;
  cancelWindDown: (() => void) | null;
  /** Stops the periodic record refresh. */
  cancelRefresh: () => void;
  unsubscribe: () => void;
};

/**
 * Runs one session at a time: validates it, starts the background service, wires the engine's
 * cues to the player, and winds the service down afterwards (contracts/platform.md).
 */
export class SessionController {
  private active: Active | null = null;
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
    return assessRecord(parseRecord(this.deps.store.getSync(RECORD_KEY)), this.deps.clock.now());
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
        onCue: (cue, at, phase) => player.play(cue, at, phase),
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
    const firstTitle = definition.phases[position?.index ?? 0].title;
    const serviceStarted = await background.start({
      title: definition.title,
      text: position?.paused ? `Paused · ${firstTitle}` : firstTitle,
      keepAliveUntil,
    });

    const active: Active = {
      engine,
      definition,
      backgroundWarning: !serviceStarted,
      release,
      cancelWindDown: null,
      cancelRefresh: () => {},
      unsubscribe: () => {},
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
    active.cancelRefresh();
    active.cancelWindDown?.();
    active.cancelWindDown = null;
    active.release();
    void this.deps.background.stop();
  }

  /** Stops the current session (if any) without stopping the service: a new one replaces it. */
  private replaceActive() {
    const previous = this.active;
    if (!previous) return;
    this.active = null;
    previous.unsubscribe();
    previous.cancelRefresh();
    previous.cancelWindDown?.();
    previous.engine.stop();
    this.deps.player.silence();
    previous.release();
  }

  /**
   * Shows the current phase, or the paused label, in the notification (C3). Called on phase
   * changes and pause/resume only.
   */
  private updateNotification(engine: Engine) {
    if (this.active?.engine !== engine) return;
    const { status, phase } = engine.snapshot();
    if (!phase || (status !== 'running' && status !== 'paused')) return;
    this.deps.background.update(status === 'paused' ? `Paused · ${phase.title}` : phase.title);
  }

  private saveRecord(engine: Engine) {
    const active = this.active;
    if (active?.engine !== engine) return;
    const record = toRecord(active.definition, engine.snapshot(), this.deps.clock.now());
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
      active.cancelWindDown = null;
      active.release();
      if (this.active === active) void this.deps.background.stop();
    });
    active.cancelWindDown = cancel;
  }

  private publish(active: Active, snapshot: SessionSnapshot) {
    if (this.active !== active) return;
    this.state = { ...snapshot, title: active.definition.title, definition: active.definition, backgroundWarning: active.backgroundWarning };
    this.listeners.forEach((fn) => fn(this.state));
  }
}
