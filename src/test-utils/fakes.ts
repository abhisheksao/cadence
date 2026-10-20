import type { CuePlayer } from '@/audio/types';
import type { Cue } from '@/engine/types';
import type { BackgroundHost, SessionAction } from '@/platform/background';
import type { NotificationState } from '@/platform/notification';
import type { KeyValueStore } from '@/storage/types';

/** Records every call, so tests can assert on what would have been played. */
export class FakeCuePlayer implements CuePlayer {
  played: { cue: Cue; at: number; phase?: number; phaseStart?: boolean }[] = [];
  silenced = 0;
  initialised = 0;

  async init() {
    this.initialised += 1;
  }

  play(cue: Cue, at: number, phase?: number, phaseStart?: boolean) {
    this.played.push({ cue, at, phase, phaseStart });
  }

  silence() {
    this.silenced += 1;
  }
}

type BackgroundCall =
  | { kind: 'prepare' }
  | {
      kind: 'start';
      sessionId: string;
      route: string;
      notification: NotificationState;
      title: string;
      text: string;
    }
  | { kind: 'update'; notification: NotificationState; text: string }
  | { kind: 'heartbeat' }
  | { kind: 'stop' }
  | { kind: 'requestBatteryExemption' };

export class FakeBackgroundHost implements BackgroundHost {
  canRequestBatteryExemption = true;
  calls: BackgroundCall[] = [];
  /** What start() resolves to; set false to simulate the OS refusing the service. */
  startResult = true;
  keepAliveUntil: Promise<void> | null = null;
  private actionListeners = new Set<(action: SessionAction) => void>();
  private taskRemovedListeners = new Set<() => void>();

  async prepare() {
    this.calls.push({ kind: 'prepare' });
  }

  async start(info: {
    sessionId: string;
    route: string;
    notification: NotificationState;
    keepAliveUntil: Promise<void>;
  }) {
    this.calls.push({
      kind: 'start',
      sessionId: info.sessionId,
      route: info.route,
      notification: info.notification,
      title: info.notification.title,
      text: info.notification.text,
    });
    this.keepAliveUntil = info.keepAliveUntil;
    return this.startResult;
  }

  update(notification: NotificationState) {
    this.calls.push({ kind: 'update', notification, text: notification.text });
  }

  heartbeat() {
    this.calls.push({ kind: 'heartbeat' });
  }

  onAction(fn: (action: SessionAction) => void): () => void {
    this.actionListeners.add(fn);
    return () => {
      this.actionListeners.delete(fn);
    };
  }

  onTaskRemoved(fn: () => void): () => void {
    this.taskRemovedListeners.add(fn);
    return () => {
      this.taskRemovedListeners.delete(fn);
    };
  }

  emitAction(action: SessionAction) {
    this.actionListeners.forEach((fn) => fn(action));
  }

  emitTaskRemoved() {
    this.taskRemovedListeners.forEach((fn) => fn());
  }

  listenerCount(event?: 'action' | 'taskRemoved') {
    if (event === 'action') return this.actionListeners.size;
    if (event === 'taskRemoved') return this.taskRemovedListeners.size;
    return this.actionListeners.size + this.taskRemovedListeners.size;
  }

  async stop() {
    this.calls.push({ kind: 'stop' });
  }

  async requestBatteryExemption() {
    this.calls.push({ kind: 'requestBatteryExemption' });
  }

  callsOf<K extends BackgroundCall['kind']>(kind: K) {
    return this.calls.filter((c): c is Extract<BackgroundCall, { kind: K }> => c.kind === kind);
  }
}

/** In-memory KeyValueStore. */
export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();

  getSync(key: string) {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.data.set(key, value);
  }

  async remove(key: string) {
    this.data.delete(key);
  }
}

export interface AudioFocus {
  request(): boolean;
  abandon(): void;
  onLoss(fn: () => void): () => void;
}

export class FakeAudioFocus implements AudioFocus {
  private lossListeners = new Set<() => void>();
  public shouldGrant = true;
  public requestCalls = 0;
  public abandonCalls = 0;

  request(): boolean {
    this.requestCalls += 1;
    return this.shouldGrant;
  }

  abandon(): void {
    this.abandonCalls += 1;
  }

  onLoss(fn: () => void): () => void {
    this.lossListeners.add(fn);
    return () => {
      this.lossListeners.delete(fn);
    };
  }

  emitLoss(): void {
    this.lossListeners.forEach((fn) => fn());
  }
}
