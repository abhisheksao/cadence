# Research: Native Foreground Service (006)

Sources: installed packages (`expo` 57.0.28, `expo-modules-core` 57.0.22, `react-native` 0.86.3,
`expo-audio`, `expo-speech`, `react-native-background-actions` 4.1.0, read from `node_modules`),
the Expo Modules API docs (docs.expo.dev/modules/module-api, /modules/get-started), and spec 001
research R1–R5.

## R1. Keeping the JS session running in the background

- **Decision**: The service is a `HeadlessJsTaskService` subclass in a local Expo module. On
  start it calls `startForeground` (type `mediaPlayback`) and starts one headless JS task,
  `CadenceSession`, with `allowedInForeground = true` and no timeout. JS registers the task with
  `AppRegistry.registerHeadlessTask`; the task resolves when the controller releases it
  (the existing `keepAliveUntil` promise).
- **Rationale**: React Native's timer module stops firing timers while the host is paused (screen
  off, app in background) **unless a headless JS task is active**. That is the whole reason the
  current library works: `RNBackgroundActionsTask extends HeadlessJsTaskService` (read in
  `node_modules`). Doing the same keeps the engine's 100 ms tick and the player's timers alive,
  and it is proven on this RN version and the test phone by 001.
- **Alternatives considered**: a plain `Service` with no headless task (JS timers stop with the
  screen off); driving cue times from native alarms (`AlarmManager` is too coarse, and would move
  the engine to Kotlin, losing the tested TS engine).

## R2. Swipe-away stops the session (clarification Q2)

- **Findings** (installed sources):
  - `ReactHostImpl.onHostDestroy(activity)` (RN 0.86) only moves the lifecycle state; the JS
    runtime survives the activity, so JS can still run the stop path after a swipe-away.
  - **expo-speech**: `OnActivityDestroys { textToSpeech.shutdown() }`, and its `TextToSpeech` is
    a `by lazy` value that is never recreated. Keeping a session alive past a swipe-away would
    have needed a native speech engine; that is why clarify Q2 was changed to "stop" after this
    finding (the user chose not to widen scope).
- **Decision**: The service keeps the default `stopWithTask="false"` and overrides
  `onTaskRemoved`. On task removal it sends `onTaskRemoved` to JS, which calls
  `sessionController.stop()` (stops the engine, silences the player, clears the saved record so
  no resume prompt appears, and stops the service). As a backstop the service stops itself 1 s
  later if JS has not done so; the record is then left for the next launch, as for a JS death.
- **Known limitation (unchanged from 001)**: if the OS destroys the activity for another reason
  while a session runs in the background (e.g. developer option "Don't keep activities"),
  expo-speech stops speaking for the rest of that session; beeps and timing continue. Not
  observed on the test phone; a native speech engine would fix it (future spec, if needed).
- **Alternatives considered**: `stopWithTask="true"` (the system kills the service without
  telling JS, so the record stays and the next launch shows a resume prompt, contradicting
  FR-025); keeping the session alive (needs native speech, out of scope).

## R3. Sleep-proof clock (Story 3)

- **Decision**: A native synchronous function `elapsedRealtime()` (an Expo Modules `Function`,
  runs on the JS thread via JSI, no bridge hop). JS builds a **session clock**:
  `now() = anchorWall + (elapsedRealtime() - anchorElapsed)`, with both anchors read once when
  the module loads. Values look like wall time (epoch ms), so timing-log lines, saved records,
  and the engine's arithmetic keep their meaning, but they advance only with real elapsed time,
  including deep sleep, and ignore wall-clock changes.
- **Recovery**: the record additionally stores `elapsedAt` (raw `elapsedRealtime` at write) and
  `bootCount` (`Settings.Global.BOOT_COUNT`, API 24+, no permission). On relaunch, if
  `bootCount` matches, the "now" passed to the existing pure `assessRecord` is
  `writtenAt + (elapsedNow - elapsedAt)`, in the record's own frame. Otherwise (rebooted, field
  missing, or iOS) it is `Date.now()`, exactly as in 001. `assessRecord` itself is unchanged.
- **Who uses it**: the engine (already injected), the controller's record writes, and the cue
  player, which today calls `Date.now()` directly for start delays and log times and must now
  take the same clock (cue `at` values are in the session-clock frame).
- **iOS / web**: the session clock is `Date.now()`; `bootCount` is null.
- **Alternatives considered**: using raw `elapsedRealtime` as the clock (the record and log would
  need converting to wall time for the reboot fallback); polling an offset to detect clock
  changes (cannot tell sleep from a change, same as 001).

## R4. Audio focus and cue playback (Story 4)

- **Decision**: One focus owner: the local module.
  - `requestFocus()` (sync `Function`): `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` with
    `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE` / `CONTENT_TYPE_SPEECH` attributes; returns `true`
    if granted. Holding focus across a group of close cues is decided in JS (1 s hold, as in 001).
  - `abandonFocus()` releases it.
  - Focus loss (`LOSS`, `LOSS_TRANSIENT`) is sent to JS as an event; the player cuts off the
    current cue (`silence`), and simply requests again for the next cue.
  - expo-audio switches to `interruptionMode: 'mixWithOthers'`, which requests no focus
    (001 research R3, expo-audio source), so its beep players never compete with ours.
- **Why this fixes the call case**: Android's focus manager refuses focus requests while a call
  holds focus, so a cue that comes due during a call gets `false` and is skipped
  (FR-021). After the call, the next request is granted. A music app that took permanent focus
  is simply ducked by our next request (FR-024), so the 15 s "give up waiting" timer and the
  silent clip both go (FR-023).
- **Phase-start vibration** (clarification Q4): the engine already knows which opportunities are
  phase starts (`CueOpportunity.isPhaseStart`); `onCue` gains that flag and passes it to
  `player.play`. On a refused phase-start cue the player calls the module's `vibrate(200)`.
  Native uses `Vibrator`/`VibrationEffect` (API 26+, plain `vibrate(ms)` below). `VIBRATE` is
  already in the merged manifest (001 R5), so no new permission.
- **Risks**: some OEM builds may still vibrate-suppress during a call (on-device check Q6);
  `NAVIGATION_GUIDANCE` routes on the media volume on every Android version we target.
- **Alternatives considered**: keeping expo-audio's `duckOthers` and adding our own focus for
  speech only (two focus clients in one app fight; a loss to one is invisible to the other);
  `USAGE_MEDIA` attributes (some OEMs pause rather than duck music for media-on-media).

## R5. Notification (Story 2)

- **Decision**:
  - Own channel `cadence-session`, importance LOW, no sound or vibration, lock-screen visibility
    PUBLIC. On first run the old channel `RN_BACKGROUND_ACTIONS_CHANNEL` is deleted so it does
    not linger in system settings.
  - Timed phase: `setUsesChronometer(true)` + `setChronometerCountDown(true)` (API 24+) with
    `setWhen(System.currentTimeMillis() + remainingMs)`. JS passes **remaining ms**, not an
    absolute time, so no clock frame crosses the boundary. Untimed phase: count-up with
    `setWhen(now - elapsedMs)`. Paused: no chronometer; the text shows the frozen value
    (e.g. "Paused · Run 2 of 6 · 1:23 left").
  - The notification is rebuilt only on start, phase change, pause and resume (as today); the
    system ticks the chronometer.
  - Actions: Pause/Resume (one slot, label switches) and Skip, as `PendingIntent`s to a
    non-exported `BroadcastReceiver` in the module, carrying the `sessionId`. The receiver
    forwards to the module, which emits `onAction` to JS only if the id matches the live
    session (FR-016). The controller then pauses/resumes/skips exactly as the in-app buttons do
    and the normal notification update follows (FR-012, FR-014).
  - Content intent: `ACTION_VIEW cadence://<mode route>` restricted to the app's package. Expo
    Router handles it as a deep link (warm: `onNewIntent`; after a swipe-away: a new activity
    over the live runtime). Risk: a duplicate screen if the user is already on it; mitigate with
    `router.navigate` semantics in `src/app/+native-intent.tsx` if the on-device check shows it.
- **Alternatives considered**: `MediaStyle` with a media session (implies media controls and
  focus that pauses music; out of scope); per-second notification updates from JS (battery,
  rate-limited by the OS, and exactly what the countdown exists to avoid).

## R6. Wake lock and liveness (FR-004, FR-026)

- **Decision**:
  - The service holds one `PARTIAL_WAKE_LOCK` from start to destroy, acquired with a 10-minute
    timeout and renewed on every heartbeat, so a forgotten lock expires on its own.
  - JS sends `heartbeat()` every 2 s while a session is running or paused (controller scheduler).
    A native watchdog checks every 5 s; no heartbeat for 10 s → the service stops itself,
    removes the notification and releases the lock. The saved record is left alone, so the next
    launch offers to resume (FR-026).
  - Module `OnDestroy` (JS runtime torn down, e.g. a dev reload) stops the service at once.
  - Session end, Stop, and `keepAliveUntil` resolving all call `stop()`; the headless task also
    finishing makes `HeadlessJsTaskService` stop itself.
- **Rationale**: 001 relied on the CPU waking for each tick; with the screen off for long stretches
  OEMs throttle that. An explicit partial wake lock is the documented way for a timing app, and
  it is released the moment the session is not running.
- **Alternatives considered**: no wake lock (001 behavior; risks late ticks after deep sleep on
  aggressive OEM builds); a wake lock without timeout (leaks if the watchdog itself fails).

## R7. Module packaging (Principle V)

- **Decision**: `npx create-expo-module@latest --local` → `modules/cadence-session/`. Its own
  `android/src/main/AndroidManifest.xml` declares the service
  (`foregroundServiceType="mediaPlayback"`, `exported="false"`) and the receiver
  (`exported="false"`); Android manifest merging adds them at build time, as expo-audio does for
  its permission. **No new `<uses-permission>`** in the module manifest: all needed ones
  (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `POST_NOTIFICATIONS`,
  `VIBRATE`) are already in `app.json` or the merged manifest. `plugins/withBackgroundActions.js`
  and its `app.json` entry are deleted, and `react-native-background-actions` is uninstalled
  (also from the Jest `transformIgnorePatterns`).
- **iOS**: the module declares `platforms: ["android"]`; JS uses `requireOptionalNativeModule`
  and the existing `*.ios.ts` no-ops, so nothing iOS-side changes (Principle IV; 008 adds iOS).
- **Native tests**: Kotlin stays a thin adapter; every decision (what the notification shows,
  which action to apply, whether a cue plays, recovery frame) is a pure TS function with Jest
  tests. The native side is covered by the on-device steps in quickstart (Principle VII allows
  this for screen-off/focus/OEM behavior).

## R8. Session id

- **Decision**: The controller makes a fresh id per launch (`<clock now base36>-<counter>`, like
  `src/routine/ids.ts`), passes it to `start`, and the module stamps it on every action intent.
  Actions for any other id are dropped natively.
