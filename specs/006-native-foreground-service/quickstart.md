# Quickstart: Validating Spec 006

How to check the native foreground service automatically and on a physical device. Entities:
[data-model.md](./data-model.md). Guarantees: [contracts/native-service.md](./contracts/native-service.md).
Spec 001's quickstart (D1–D11) and timing report still apply and are re-run here as regression.

## 1. Automated checks

```sh
npm run check        # expo lint + tsc --noEmit + jest (+ spec-link check)
npx expo-doctor
```

Expected: all green. Every non-device guarantee (NS*, NC*, CL*, CP*) has at least one test.
`grep -r "react-native-background-actions\|withBackgroundActions" src app.json package.json plugins`
returns nothing.

## 2. Build and install

```sh
npx expo prebuild -p android --clean && (cd android && ./gradlew assembleRelease)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Permission diff (SC-007, ND5): compare with the previous release APK.

```sh
aapt dump permissions <old>.apk | sort > /tmp/old.txt
aapt dump permissions android/app/build/outputs/apk/release/app-release.apk | sort > /tmp/new.txt
diff /tmp/old.txt /tmp/new.txt   # expected: no output
```

Useful while testing:

```sh
adb logcat -s ReactNativeJS | grep -E "CADENCE_(CUE|SKIP)"
adb shell dumpsys power | grep -i cadence          # wake locks held by the app
adb shell dumpsys notification --noredact | grep -A3 cadence
```

## 3. On-device checks

Use the sample session or a short run/walk (e.g. 1-min warm-up, 2 × 1-min run / 1-min walk) with
music playing in another app.

| # | Story | Steps | Expected |
|---|---|---|---|
| N1 | US1 | Start a session, lock the phone for 30 min, capture the log, run `npm run timing-report` | Same p50/p95 targets as 001; notification present throughout (SC-001) |
| N2 | US1 | Start, pull down the shade, tap the notification body | Notification appears within 1 s; tap opens that mode's live screen |
| N3 | US1 | Let a session finish; then start one and press Stop | Notification gone and no Cadence wake lock in `dumpsys power` within 1 s (SC-006) |
| N4 | US1 | Deny notification permission (Android 13+ device, or revoke in settings), start | Session runs with screen off; no notification |
| N5 | US2 | Watch the notification through 3 phase changes | Countdown ticks on its own and reaches 0:00 within 1 s of each change; an untimed routine step counts up (SC-003) |
| N6 | US2 | Locked phone: Pause, wait 20 s, Resume, Skip, all from the lock screen | Each takes effect within 1 s; paused shows the frozen time; Skip plays the next phase's start cue (SC-002) |
| N7 | US2 | App open on the session screen: tap Pause in the shade; then Resume in the app | App and notification agree within 1 s both ways (FR-014) |
| N8 | US2 | Tap Pause/Resume 6 times fast | Ends in the state of the last tap; app and notification agree |
| N9 | Edge | Swipe Cadence away from recents mid-session; wait 2 phase changes; tap the notification | Cues and countdown never stop; tap opens the live session, no resume prompt (FR-025) |
| N10 | Edge | After N9, let the session finish | Speech still works after the swipe-away (R2); notification removed |
| N11 | US3 | Settings → turn off automatic time, move clock +5 min, later −3 min | No cue jumps or repeats (SC-004) |
| N12 | US3 | Lock the phone idle for 15 min mid-session | No drift (timing report) |
| N13 | US3 | `adb shell am kill io.github.abhisheksao.cadence` while backgrounded, change the clock +10 min, reopen | Resume offered at the position real elapsed time gives, not the clock |
| N14 | US3 | Kill as N13, reboot the phone, reopen | 001 behavior (wall clock with sanity checks) |
| N15 | US4 | Music playing; let several cues play | Music dips for each cue and returns ~1 s after; never pauses |
| N16 | US4 | Call the phone; answer; talk 30 s across ≥ 3 cue times, at least one a phase start; hang up | No Cadence sound during the call; one short vibration per phase start; cues resume on time after (SC-005) |
| N17 | US4 | During a phrase, start a call | Phrase cut off; later cues skipped until the call ends |
| N18 | US4 | Mid-session, start music in another app | Next cue plays and ducks it (FR-024) |
| N19 | Edge | Dev build: start a session, then reload JS (`r` in Metro) | Notification and wake lock gone within 10 s (FR-026) |
| N20 | Edge | Start a session while another is running | One notification only; the new session's title (FR-005) |
| N21 | Regression | 001 quickstart D1–D11 on the new build | Pass, with D11 now strict (no phrase heard during a call) |

Record results in `tasks.md` against the device-check task(s).
