import type { CuePlayer } from '@/audio/types';
import type { Cue } from '@/engine/types';
import type { BackgroundHost } from '@/platform/background';
import type { KeyValueStore } from '@/storage/types';

/** Records every call, so tests can assert on what would have been played. */
export class FakeCuePlayer implements CuePlayer {
  played: { cue: Cue; at: number }[] = [];
  silenced = 0;
  initialised = 0;

  async init() {
    this.initialised += 1;
  }

  play(cue: Cue, at: number) {
    this.played.push({ cue, at });
  }

  silence() {
    this.silenced += 1;
  }
}

type BackgroundCall =
  | { kind: 'prepare' }
  | { kind: 'start'; title: string; text: string }
  | { kind: 'update'; text: string }
  | { kind: 'stop' }
  | { kind: 'requestBatteryExemption' };

export class FakeBackgroundHost implements BackgroundHost {
  calls: BackgroundCall[] = [];
  /** What start() resolves to; set false to simulate the OS refusing the service. */
  startResult = true;
  keepAliveUntil: Promise<void> | null = null;

  async prepare() {
    this.calls.push({ kind: 'prepare' });
  }

  async start(info: { title: string; text: string; keepAliveUntil: Promise<void> }) {
    this.calls.push({ kind: 'start', title: info.title, text: info.text });
    this.keepAliveUntil = info.keepAliveUntil;
    return this.startResult;
  }

  update(text: string) {
    this.calls.push({ kind: 'update', text });
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
