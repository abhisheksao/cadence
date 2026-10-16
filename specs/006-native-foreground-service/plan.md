# Implementation Plan: Native Foreground Service

**Branch**: `006-native-foreground-service` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-native-foreground-service/spec.md`

## Summary

Replace `react-native-background-actions` with a local Expo module, `modules/cadence-session`
(Kotlin, Android only), that runs the session as a `mediaPlayback` foreground service with a
headless JS task (the same mechanism that keeps JS timers alive today, research R1). The module
also provides: a notification with a system-run phase countdown and Pause/Resume + Skip actions
(R5), a sleep-proof clock and boot count (R3), audio focus and vibration (R4), a text-to-speech
engine that survives the activity being destroyed (R2), a partial wake lock and a JS heartbeat
watchdog (R6). All decisions stay in tested TypeScript: what the notification shows, which action
applies, whether a cue plays or vibrates, and which clock frame recovery uses. Kotlin is a thin
adapter verified on device.

One design finding changes the spec: keeping the session alive after a swipe-away (clarify Q2)
is impossible with `expo-speech`, which shuts its engine down when the activity is destroyed
and never recreates it. Speech therefore moves into the module on Android (thin wrapper, same
behavior). The spec is updated in this change (Principle IX).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Kotlin (Android Gradle plugin from Expo SDK 57)

**Primary Dependencies**: Expo SDK 57 (`expo-modules-core` 57.0.22), React Native 0.86.3
(New Architecture), Expo Router, `expo-audio` (beeps/chime), `expo-speech` (iOS only after this
change), `expo-intent-launcher` (battery exemption). Removed: `react-native-background-actions`.

**Storage**: Existing `kvStore` key `session-record:v1`, with two optional fields (data-model)

**Testing**: Jest (`jest-expo`) + React Native Testing Library; fakes in `src/test-utils`;
on-device steps N1–N21 (quickstart)

**Target Platform**: Android (minSdk from SDK 57; test phone Android 9); iOS unchanged no-op

**Project Type**: Mobile app with a local native module

**Performance Goals**: Cue timing as 001 (SC-001); notification actions ≤ 1 s; countdown within
1 s at each phase change; zero per-second JS → native notification calls

**Constraints**: No new permissions; duck never pause; no network; CNG (no `android/` edits)

**Scale/Scope**: One module (~6 Kotlin files), ~8 TS files changed or added, 4 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- [x] **I. Screen-off reliability**: foreground service + headless task + partial wake lock. The
  clock is still injected (`Clock`); production switches from `Date.now()` to a session clock
  driven by `elapsedRealtime`. Reading of "wall-clock timestamps": the principle forbids summing
  ticks and requires real elapsed time; a sleep-inclusive clock anchored to wall time meets that
  better than `Date.now()`, which is the gap 001 deferred here. No amendment needed; this reading
  is recorded here and in research R3.
- [x] **II. Duck, never pause**: one focus owner requests `GAIN_TRANSIENT_MAY_DUCK`, released 1 s
  after the last cue; expo-audio set to request no focus (R4).
- [x] **III. Offline & private**: no network; no new permissions (VIBRATE, WAKE_LOCK, FGS types,
  POST_NOTIFICATIONS already present). Lock-screen text is the session/phase title only.
- [x] **IV. Android-first, iOS-ready**: module is Android-only behind `BackgroundHost`,
  `SessionClock`, `AudioFocus`, `SpeechEngine` interfaces with `*.android.ts` / `*.ios.ts`
  files. iOS keeps `Date.now()`, expo-speech and a no-op host; nothing here blocks 008.
- [x] **V. CNG**: local Expo module with its own manifest; `plugins/withBackgroundActions.js`
  removed; `android/` stays generated.
- [x] **VI. Local builds**: `expo prebuild` + Gradle only.
- [x] **VII. Test-first**: each story's Jest tests and device steps come before its code in
  tasks; native adapter covered by device steps (allowed for screen-off/focus/OEM behavior).
- [x] **VIII. Quality gates**: strict TS, no `any`; module created with `create-expo-module
  --local`; library removed with `npm uninstall`.
- [x] **IX. Traceability**: spec updated for native speech (R2) and the cue hand-off change.

Post-design re-check: still passes. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/006-native-foreground-service/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/native-service.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
modules/cadence-session/                 # NEW local Expo module (Android only)
├── expo-module.config.json              # platforms: ["android"]
├── index.ts                             # typed requireOptionalNativeModule + event types
└── android/
    ├── build.gradle
    └── src/main/
        ├── AndroidManifest.xml          # <service mediaPlayback, exported=false>, <receiver exported=false>; no permissions
        └── java/io/github/abhisheksao/cadence/session/
            ├── CadenceSessionModule.kt  # JS surface: clock, service, focus, vibrate, speech, events; OnDestroy → stop
            ├── SessionService.kt        # HeadlessJsTaskService: startForeground, headless task, wake lock, watchdog
            ├── SessionNotification.kt   # channel, chronometer, actions, content deep link; deletes old channel
            ├── ActionReceiver.kt        # notification buttons → module (sessionId filter)
            ├── Focus.kt                 # AudioFocusRequest (MAY_DUCK, nav-guidance attrs), loss listener
            └── Speech.kt                # TextToSpeech on application context, utterance events

src/platform/
├── background.ts                        # BackgroundHost interface (changed: notification state, heartbeat, onAction)
├── background.android.ts                # rewritten on the module; keeps notification-permission + battery flow
├── background.ios.ts                    # no-op, new methods added
├── notification.ts (+ .test.ts)         # NEW pure notificationState(), time formatting
├── clock.ts / clock.android.ts / clock.ios.ts (+ tests)   # NEW SessionClock
├── audio.ts / audio.android.ts / audio.ios.ts             # NEW AudioFocus, SpeechEngine, vibrate, interruption mode
src/engine/engine.ts, types.ts           # onCue gains phaseStart
src/audio/cuePlayer.ts (+ test)          # injected clock/focus/speech/vibrate; silent clip + give-up timer removed
src/audio/timingLog.ts (+ test)          # adds formatSkipLog (CADENCE_SKIP)
src/session/controller.ts (+ test)       # sessionId, route, notification state, actions, heartbeat
src/session/record.ts (+ test), types.ts # elapsedAt/bootCount, recoveryNow()
src/session/index.ts                     # wires session clock + platform audio
src/components/LaunchCheck.tsx (+ test)  # live session → open its route, no prompt
src/test-utils/fakes.ts                  # FakeBackgroundHost (actions, heartbeat), FakeAudioFocus, FakeSpeech
assets/sounds/silence.wav                # deleted
plugins/withBackgroundActions.js         # deleted
app.json, package.json                   # plugin entry, dependency, jest transformIgnorePatterns cleaned
```

**Structure Decision**: Single Expo app plus one local module under `modules/`. Native code only
in that module; shared code talks to it through `src/platform/*` interfaces.

## Delivery order (for /speckit-tasks)

1. **Foundational**: create the module skeleton (`create-expo-module --local`), interfaces and
   fakes; engine `phaseStart` hand-off. No behavior change yet.
2. **US1 (MVP)**: service + headless task + wake lock + basic notification (title/phase, tap
   opens route) + heartbeat watchdog + LaunchCheck live-session path + native speech (needed for
   swipe-away). Remove the library, plugin and silent clip only after N1–N3, N9, N10 pass.
3. **US2**: chronometer countdown/count-up, paused text, actions and session-id filter.
4. **US3**: session clock, record fields, `recoveryNow`.
5. **US4**: focus owner, skip + `CADENCE_SKIP` log, phase-start vibration, `mixWithOthers`.
6. **Polish**: README/roadmap, 001 spec cross-references (D11 limitation and clock edge case
   marked fixed by 006), permission diff, full device pass N1–N21, PR to `develop`.

Each story: failing tests committed as `test(006): …`, then `feat(006): …`.

## Risks

| Risk | Mitigation |
|---|---|
| Deep link from the notification pushes a duplicate screen | `+native-intent.tsx` rewrite / navigate semantics; device check N2, N9 |
| Headless task + bridgeless edge cases after activity recreate | Same mechanism as the current library (proven); N9/N10 early in US1 |
| Native TTS start latency differs from expo-speech | Same `TextToSpeech` engine underneath; EMA latency compensation unchanged; check timing report N1 |
| OEM suppresses vibration during a call | Accept; documented in device results (N16) |
| Wake lock raises battery use on long sessions | Held only while a session is live; 10-min timeout renewed by heartbeat |
| Silent lock-screen notifications hidden by default on some Android versions | Channel importance tuned on device (N6); LOW → DEFAULT without sound if needed |
