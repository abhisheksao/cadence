# Research: Cue Engine and Background Session

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-13

Versions were checked against the Expo SDK 57 docs and `bundledNativeModules.json` for the
`sdk-57` branch. A previous single-prompt implementation of Cadence on the same SDK, tested on the
reference device, is used as evidence where noted ("prior implementation").

## R1. Engine clock: wall clock, not monotonic

- **Decision**: The engine uses an injected `Clock` whose production implementation is
  `Date.now()`. A guard handles the clock going **backwards** while the app runs: if `now` is
  earlier than the last value seen, all anchors (session start, phase start, pause start) shift
  back by the difference, so progress does not jump. Forward jumps are followed.
- **Rationale**: The only monotonic clock available to JS (`performance.now()`, backed by
  `CLOCK_MONOTONIC` on Android) **stops while the CPU is in deep sleep**. The background library
  holds no wakelock, so the CPU can sleep between cues with the screen off; a monotonic clock would
  then fall behind real time and cues would drift, which is the main failure Principle I exists to
  prevent. The constitution already says "wall-clock timestamps". The prior implementation used
  `Date.now()` and held time on the reference device. A forward manual clock change cannot be
  told apart from deep sleep without a sleep-inclusive clock (`elapsedRealtime`), which JS cannot
  read. Spec 006's native service can provide one.
- **Spec impact**: FR-004 and the "device clock changed" edge case are updated to match (see
  plan, Constitution Check IX).
- **Alternatives considered**: `performance.now()` (drifts across deep sleep); a hybrid that
  compares both clocks (cannot tell sleep from a forward change); a native module that reads
  `SystemClock.elapsedRealtime()` (right answer, but it is native work that belongs in 006).

## R2. Scheduling loop

- **Decision**: A 100 ms tick (an injected `Scheduler`, `setInterval` in production) recomputes
  the position from the clock each time and fires every cue due before `now + 1000 ms` (look-ahead),
  with `at` set to the exact due time. Per-second cues more than 2000 ms late are dropped; after a
  catch-up across phases, only the phase the engine lands in gets its start cue (the spec changes
  the prior implementation, which announced every missed phase start).
- **Rationale**: Ticks only trigger recomputation, so a late or missed tick costs nothing. The
  1 s look-ahead lets the audio layer start sounds early by their latency (R4). Proven on the
  reference device.
- **Alternatives considered**: a `setTimeout` chain to the next due cue (fewer wake-ups, but a
  single late timer delays a cue with no chance to correct); native alarms (`AlarmManager`; too
  coarse and rate-limited for second-level cues).

## R3. Audio ducking (Principle II)

- **Decision**: `expo-audio` with `setAudioModeAsync({ interruptionMode: 'duckOthers',
  shouldPlayInBackground: true, playsInSilentMode: true })`. Beeps and the chime are
  `expo-audio` players.
- **Findings** (expo-audio `sdk-57` Android source, `AudioModule.kt`): with `duckOthers` the module
  requests `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` when a player starts and abandons focus when no
  player is playing. So other apps duck for each sound and come back after it, exactly as FR-015
  requires. `mixWithOthers` (used by the prior implementation) requests no focus at all, so music
  was never ducked.
- **Speech**: `expo-speech` on Android requests no audio focus and has no ducking option. To duck
  during speech, the audio layer plays a looping **silent clip** through `expo-audio` from just
  before `Speech.speak` until `onDone`/`onStopped`/`onError`; holding that player holds the
  ducking focus. Spec 006's native service can request focus directly and drop the silent clip.
- **Phone calls** (expo-audio `sdk-57` source): `play()` starts playback even when the focus
  request is refused, so a refusal is invisible to JS. When another app takes focus, expo-audio
  pauses its players and resumes them itself on regaining focus. The cue player uses that: if the
  silent clip stops on its own mid-phrase, speech stops and is skipped until the clip resumes on
  its own (call over), then the clip is paused again. **Known limitation**: a phrase that starts
  while a call is already in progress cannot be detected and may be heard. Spec 006 requests
  focus natively and can check the result.
- **Hold window**: the silent clip keeps playing for 1 s after a phrase, so phrases close together
  share one dip and the music returns about a second after the last one (spec US3).
- **Risk**: two cues close together cause the music to dip twice. Acceptable; tune on device.
- **Alternatives considered**: `doNotMix` (pauses music, violates Principle II); `mixWithOthers`
  (no ducking); a native TTS wrapper (006 territory).

## R4. Latency compensation and the timing log

- **Decision**: Beeps start `at - 120 ms`. Speech starts `at - ttsLatency`, where `ttsLatency` is
  an exponential moving average (initial 400 ms, clamped 100–900 ms) of `onStart - speak() + 80 ms`,
  sampled only when nothing else was queued. This is pure logic in `latency.ts`, unit-tested.
- **Timing log (FR-022a)**: one `console.info` line per cue in a fixed, grep-able format (see
  [contracts/timing-log.md](./contracts/timing-log.md)). React Native sends `console` output to the
  Android system log (tag `ReactNativeJS`) in release builds too, so `adb logcat -s ReactNativeJS`
  captures it. Actual start for sounds is the player's `playing` status change; for speech it is
  `onStart`.
- **Report (FR-022b)**: `scripts/timing-report.mjs` reads a captured log and prints p50/p95 error
  per cue type and first-5-minutes vs last-5-minutes error.

## R5. Background execution on Android

- **Decision**: `react-native-background-actions` 4.1.0 (the background library), declared as a
  `mediaPlayback` foreground service by a local config plugin `plugins/withBackgroundActions.js`.
  `expo-audio`'s plugin keeps `enableBackgroundPlayback: true` (adds the media-playback
  permissions). Permissions in `app.json`: `POST_NOTIFICATIONS`, `WAKE_LOCK`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`,
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- **Rationale**: Proven on the reference device with this SDK. Android 14+ refuses to start a
  foreground service without a declared type, which the plugin adds without editing `android/`
  (Principle V). The library can set title, text, and a progress bar, but not a system-run
  countdown, which is why that moved to 006.
- **Permissions removed**: `expo-audio` adds `RECORD_AUDIO` by default and the template adds
  external storage and `SYSTEM_ALERT_WINDOW`. None are needed: the expo-audio plugin gets
  `recordAudioAndroid: false`, and `android.blockedPermissions` removes the rest. Remaining
  defaults: `INTERNET` (development builds load JS from the dev server; the app makes no network
  calls), `MODIFY_AUDIO_SETTINGS` (expo-audio), `VIBRATE` (template default, harmless).
- **Permissions justification (Principle III)**: notifications (show the required ongoing
  notification), wake lock and foreground service (keep running with the screen off), battery
  exemption request (OEM kills; asked once, user can decline).
- **Alternatives considered**: `expo-audio`'s own media service with lock-screen controls (needs
  `doNotMix`, which pauses music); `expo-task-manager`/`expo-background-task` (periodic, minutes
  apart; not for second-level timing); a custom Kotlin service (spec 006).

## R6. Notification permission and battery exemption

- **Decision**: `PermissionsAndroid.request(POST_NOTIFICATIONS)` (React Native core) on Android 13+;
  `expo-intent-launcher` for `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` with a fallback to the
  battery-optimisation settings screen; an "asked" flag in storage.
- **Rationale**: Both are small and avoid pulling in `expo-notifications`, which the app does not
  otherwise need.

## R7. Storage for the session record and flags

- **Decision**: `expo-sqlite/kv-store` (`Storage`, sync and async API). The session record is one
  JSON value under a versioned key (`session-record:v1`).
- **Rationale**: Principle VIII prefers Expo modules; the sync API lets the launch check read the
  record before first render. The same store serves later specs (routine settings, presets).
- **Alternatives considered**: `@react-native-async-storage/async-storage` (prior implementation;
  third-party, async only); `expo-file-system` (no benefit for small values).

## R8. Screen-on (FR-021a)

- **Decision**: `expo-keep-awake` (`useKeepAwake` with a tag) on the session screen, only when the
  session's definition has `keepScreenOn: true` and the session is running or paused.

## R9. Navigation shell

- **Decision**: Expo Router with routes in `src/app/`: `npx expo install expo-router
  react-native-safe-area-context react-native-screens expo-linking expo-constants
  expo-status-bar`; `package.json` `main` set to `expo-router/entry`; `typedRoutes` enabled;
  `@/*` path alias to `src/*`. Delete the template's `App.tsx` and `index.ts`.

## R10. Test setup (Principle VII)

- **Decision**: `npx expo install jest-expo jest @types/jest @testing-library/react-native --dev`;
  `jest.preset = "jest-expo"`; tests next to the code as `*.test.ts(x)`; a hand-written
  `FakeClock` + `FakeScheduler` pair in `src/test-utils/` drives the engine deterministically.
  Native modules (`expo-audio`, `expo-speech`, the background library, `expo-sqlite/kv-store`) are
  mocked at their adapter boundary, so most tests never touch them.
- **Scripts**: `test` (`jest`), `test:watch`, `lint` (`expo lint`), `typecheck` (`tsc --noEmit`),
  and `check` running all three.
- **Note**: `react-test-renderer` is deprecated for React 19; React Native Testing Library is the
  supported path.

## R11. Cue sounds

- **Decision**: Port the generator script (`scripts/gen-sounds.mjs`): short sine tones with
  attack/decay, written as 16-bit mono WAV: `beep.wav`, `beep-last.wav`, `chime.wav`, plus a 1 s
  `silence.wav` for speech ducking (R3). The generated files are committed so builds don't depend
  on running the script.

## R12. Recovery after an OS kill

- **Decision**: A session is described as plain data (`SessionDefinition`: mode id, title, phases,
  mode settings, keepScreenOn). Modes register a `ModeDefinition` (id + `cueFor(definition)`),
  so the controller can rebuild the cue logic from the stored definition. The record stores
  wall-clock anchors and is written on every control event and at least once a minute
  (FR-023). On launch, pure function `assessRecord(record, now)` returns `resume(position)`,
  `interrupted(reason)`, or `none` (FR-024/025). Unit-tested on a fake clock.
- **Rationale**: Recovery math is pure and testable; the plain-data definition also serves spec
  007 (sharing) and makes modes 002–004 easier to test.
