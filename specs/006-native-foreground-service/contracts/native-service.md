# Contract: Native Service, Clock, Focus, and Speech

Builds on the spec 001 contracts (engine, platform, cue player). Entities:
[data-model.md](../data-model.md). IDs are the test names to use; "device" rows are checked by
[quickstart.md](../quickstart.md), all others by Jest.

## Local module JS surface (`modules/cadence-session/index.ts`)

Android only; `requireOptionalNativeModule('CadenceSession')` is `null` elsewhere. Only
`src/platform/*.android.ts` imports it (Principle IV).

```ts
type NotificationTimer = { kind: 'countdown'; remainingMs: number } | { kind: 'elapsed'; elapsedMs: number } | null;
type NotificationPayload = { title: string; text: string; timer: NotificationTimer; paused: boolean };

interface CadenceSessionModule {
  // Clock (sync, JSI)
  elapsedRealtime(): number;
  bootCount(): number | null;

  // Service
  startService(args: NotificationPayload & { sessionId: string; route: string }): Promise<boolean>;
  updateNotification(p: NotificationPayload): void;
  heartbeat(): void;
  stopService(): Promise<void>;

  // Focus and vibration (sync)
  requestFocus(): boolean;
  abandonFocus(): void;
  vibrate(ms: number): void;

  // Events: onAction { sessionId, action: 'pause'|'resume'|'skip' }, onTaskRemoved { sessionId },
  // onFocusLost {}
}
```

## BackgroundHost (changed, `src/platform/background.ts`)

```ts
interface BackgroundHost {
  readonly canRequestBatteryExemption: boolean;
  prepare(): Promise<void>;                       // unchanged
  start(info: { sessionId: string; route: string; notification: NotificationState; keepAliveUntil: Promise<void> }): Promise<boolean>;
  update(notification: NotificationState): void;  // was update(text)
  heartbeat(): void;
  onAction(fn: (action: SessionAction) => void): () => void;
  onTaskRemoved(fn: () => void): () => void;
  stop(): Promise<void>;
  requestBatteryExemption(): Promise<void>;       // unchanged
}
```

| # | Guarantee | Spec |
|---|---|---|
| NS1 | `notificationState` for a running timed phase → `timer: countdown` with `remainingMs = phaseRemainingMs`, text = phase text, `paused: false` | FR-008, FR-009 |
| NS2 | Running untimed phase → `timer: elapsed` with `elapsedMs = phaseElapsedMs` | FR-010 |
| NS3 | Paused → `timer: null`, `paused: true`, text `"Paused · <phase text> · m:ss left"` (timed) or `"Paused · <phase text> · m:ss"` (untimed) | FR-008, FR-011 |
| NS4 | Status `idle`/`done`/`stopped` → `null` | FR-008 |
| NS5 | Times are clamped at 0 and formatted `m:ss` (`h:mm:ss` from 1 hour) | Edge: short phases |
| NC1 | Controller `start` passes a fresh `sessionId`, the mode's `route`, and the first `NotificationState` | FR-012, FR-013 |
| NC2 | Phase change, pause, resume, and skip/back each call `update` once with the new state | FR-009, FR-014 |
| NC3 | `onAction('pause' \| 'resume' \| 'skip')` has the same effect as `pause()`/`resume()`/`skip()` (cues, record, state) | FR-012 |
| NC4 | A `pause` while paused or `resume` while running does nothing; a sequence of actions ends in the state of the last one | Edge: rapid taps |
| NC5 | While running or paused, `heartbeat` is called at least every 2 s; never after stop or end | FR-026 |
| NC6 | Actions arriving with no live session do nothing | FR-016 |
| NC7 | Stop, end (after wind-down) and replacement each call `stop` once; the action subscription is removed | FR-004, FR-005 |
| NC8 | `onTaskRemoved` with a live session has exactly the effect of `stop()`: engine stopped, player silenced, record cleared, `stop` called | FR-025 |
| ND1 (device) | Countdown reaches 0:00 within 1 s of each phase change; no per-second JS updates | SC-003 |
| ND2 (device) | Buttons work from the lock screen and the shade; app and notification agree within 1 s | SC-002, FR-014, FR-015 |
| ND3 (device) | Tap opens the mode's live screen | FR-013 |
| ND6 (device) | Swipe-away mid-session: notification gone, cues stop, no wake lock within 1 s; next launch shows no resume prompt | FR-025, SC-006 |
| ND4 (device) | No notification and no Cadence wake lock 1 s after stop/end; 10 s after the JS side is frozen | SC-006 |
| ND5 (device) | Release merged manifest has the same permission list as the 001 release | SC-007 |

## Session clock and recovery

| # | Guarantee | Spec |
|---|---|---|
| CL1 | Android `now()` advances with `elapsedRealtime`, not with `Date.now()` changes | FR-017 |
| CL2 | iOS/web `now()` is `Date.now()`; `elapsed()` and `bootCount()` are null | Principle IV |
| CL3 | `toRecord` stores `elapsedAt` and `bootCount` when the clock provides them | FR-018 |
| CL4 | `parseRecord` accepts records without the new fields; rejects them with a wrong type | FR-018 |
| CL5 | `recoveryNow`: same boot → `writtenAt + (elapsed - elapsedAt)`, independent of `wallNow` | FR-018, Story 3 #4 |
| CL6 | `recoveryNow`: different boot, missing field, or null clock → `wallNow` | Story 3 #5 |
| CL7 | `checkForInterrupted` uses `recoveryNow` | FR-018 |
| CD1 (device) | Clock moved ±1 h mid-session: no cue shifts beyond the 001 tolerance | SC-004 |

## Cue player (changed, `src/audio/cuePlayer.ts`)

New dependencies, injected: `clock: Clock`, `focus: AudioFocus`, `vibrate(ms)`. Platform files
supply them (Android: the module; iOS: always-granted focus, no-op vibrate). Speech stays on
expo-speech on both platforms.

| # | Guarantee | Spec |
|---|---|---|
| CP1 | Start delays and timing-log times use the injected clock, not `Date.now()` | FR-017 |
| CP2 | Before each cue sound, `focus.request()` is called unless focus is already held | FR-020 |
| CP3 | Refused → the cue is not played and not queued; one `CADENCE_SKIP v=1 type=<t> planned=<ms> reason=focus phase=<n>` line is logged | FR-021, FR-027 |
| CP4 | Refused and `phaseStart` → `vibrate(200)` once; refused and not phase start → no vibration | FR-021 (Q4) |
| CP5 | Focus is abandoned 1 s after the last speech/sound ends; a cue inside that window reuses the hold | FR-020 |
| CP6 | `onFocusLost` → current speech and sounds are cut off; the next cue requests focus again | FR-022 |
| CP7 | A later request that is granted plays normally (no 15 s give-up timer) | FR-024 |
| CP8 | The silent clip is gone; `init` sets `interruptionMode: 'mixWithOthers'` on Android | FR-023 |
| CP9 | `CADENCE_CUE` lines keep their exact v=1 format | FR-027 |
| CD2 (device) | During a call: 0 Cadence sounds, one short vibration per phase start; music ducked, never paused, outside the call | SC-005 |
