# Contract: Platform Ports

Everything that touches native APIs sits behind these interfaces (Principle IV). The session
controller depends only on the interfaces; tests use fakes. Android implementations live in
`*.android.ts`, the iOS placeholders in `*.ios.ts` (Metro picks the file per platform).

```ts
// src/audio/types.ts
export interface CuePlayer {
  /** Load sounds, set the audio mode (duckOthers), warm up TTS. Idempotent. */
  init(): Promise<void>;
  /** Play `cue` so it is heard at wall time `at` (latency-compensated). */
  play(cue: Cue, at: number): void;
  /** Cancel scheduled cues and stop current speech/sounds immediately. */
  silence(): void;
  // Speech is skipped (not queued for later) while another app holds full audio focus,
  // e.g. during a phone call (spec edge case; research R3).
}

// src/platform/background.ts
export interface BackgroundHost {
  /** Ask for notification permission (Android 13+) and, once ever, the battery exemption. */
  prepare(): Promise<void>;
  /** Start the foreground service; resolves false if the OS refused (FR edge case). */
  start(info: { title: string; text: string; keepAliveUntil: Promise<void> }): Promise<boolean>;
  /** Update notification text (phase changes, paused label only — never per second). */
  update(text: string): void;
  stop(): Promise<void>;
  /** Open the battery-optimisation request/settings (home screen link). */
  requestBatteryExemption(): Promise<void>;
}

// src/storage/kv.ts
export interface KeyValueStore {
  getSync(key: string): string | null;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

## Implementations

| Port | Android (`*.android.ts`) | iOS (`*.ios.ts`) in this spec | Tests |
|---|---|---|---|
| `CuePlayer` | `expo-audio` (beeps, chime, silent loop for ducking) + `expo-speech`; shared, not platform-split | same | `FakeCuePlayer` records `(cue, at)` |
| `BackgroundHost` | background library + `PermissionsAndroid` + `expo-intent-launcher` | no-op `start` → `true`; screens work, background not guaranteed until 008 | `FakeBackgroundHost` |
| `KeyValueStore` | `expo-sqlite/kv-store` | same | in-memory map |

## Session controller

```ts
// src/session/controller.ts
export class SessionController {
  constructor(deps: { clock: Clock; scheduler: Scheduler; player: CuePlayer;
                      background: BackgroundHost; store: KeyValueStore; modes: ModeRegistry });
  start(def: SessionDefinition): Promise<void>;   // stops any current session first (FR-011)
  resumeInterrupted(assessment: ResumeAssessment): Promise<void>;
  pause(): void; resume(): void; skip(): void; back(): void; stop(): void;
  /** On launch: read and assess the record (FR-024/025). */
  checkForInterrupted(): RecoveryResult;          // 'none' | resume offer | interrupted note
  subscribe(fn: (s: SessionSnapshot) => void): () => void;
}
export function useSession(): { snapshot: SessionSnapshot | null; controller: SessionController };
```

Controller guarantees (unit tests with all fakes):

| # | Guarantee | Spec |
|---|---|---|
| C1 | `start` validates, calls `background.prepare()` then `start()`, then the engine | FR-013/016/017 |
| C2 | Engine cues go to `player.play(cue, at)`; cancels go to `player.silence()` | FR-010 |
| C3 | Phase change / pause / resume update the notification text; nothing else does. If the user dismisses the notification (Android 14+), the session continues and the next update re-posts it | FR-013 |
| C4 | Record written on every control event and phase change, refreshed every 60 s, cleared on done/stop | FR-023 |
| C5 | Background stays up ≥ 4 s after `done` so the completion cue plays | FR-014 |
| C6 | Starting a second session stops the first | FR-011 |
| C7 | If `background.start` returns false, the session still runs and a warning is exposed | Edge cases |
| C8 | `resumeInterrupted` restores service, notification, cues; the landing phase's start cue plays | FR-024 |
