# Quickstart: Validating Spec 001

How to show that the cue engine and background session work, both automatically and on a device.
Entities: [data-model.md](./data-model.md). Interfaces: [contracts/](./contracts/).

## Prerequisites

- Node 22+, Android SDK with `adb`, a physical Android phone with USB debugging (the reference
  device is an older phone from an OEM known for aggressive background killing).
- `npm install` in the repo root.

## 1. Automated checks

```sh
npm run check        # expo lint + tsc --noEmit + jest
```

Expected: all green. Engine guarantees E1–E16 and controller guarantees C1–C8 each have at least
one test; `assessRecord` and the timing-report parser have table-driven tests.

## 2. Build and install

```sh
npx expo run:android                    # development build on the connected phone
# release check (local only, no EAS):
npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## The sample session

Defined in `src/modes/sample.ts` (mode id `sample`, `keepScreenOn: true`):

| # | Phase | Duration | Cues |
|---|---|---|---|
| 1 | Get ready | 10 s | says title at start; beeps at 3, 2, 1 left; final beep at 0 |
| 2 | Tap Skip when ready | untimed | says title once |
| 3 | Interval | 20 s | says title; "Halfway" at 10 s; beeps at 3, 2, 1; final beep |
| 4 | Cool down | 15 s | says title; beeps at 3, 2, 1 |
| — | Complete | — | chime, then "Sample complete" |

## 3. On-device scenarios

Each maps to a user story or edge case and is listed as an on-device task in `tasks.md` (Principle VII).

| # | Story | Steps | Expected |
|---|---|---|---|
| D1 | US5 | Launch the app | Home lists Morning routine, Run / walk, Breathe (coming soon) and Sample session |
| D2 | US4 | Fresh install, start the sample | Notification permission prompt (Android 13+), then the battery exemption prompt once; second start shows neither |
| D3 | US1 | Start the sample, lock the screen, pocket the phone | Every cue on its second, completion chime, notification disappears a few seconds later |
| D4 | US3 | Play music in another app, run the sample | Music dips for each beep and phrase, never pauses |
| D5 | US2 | Pause 10 s, resume, skip, back at 5 s, back at 1 s, stop | Matches the acceptance scenarios; audio silenced within 300 ms of each tap |
| D6 | US4 | Pull down the shade during the sample, pause, resume; then swipe the notification away (Android 14+) | Title + phase; "Paused" label while paused; tap opens the app; after a swipe the session continues and the notification returns at the next phase |
| D7 | Kill recovery | Start the sample, `adb shell am force-stop io.github.abhisheksao.cadence` during phase 3, reopen within a minute | Resume/Discard offered; Resume lands on the clock position (±1 s) and announces the phase (SC-008) |
| D8 | Kill recovery | Repeat D7 but reopen after the session would have ended | "Session interrupted" note, no resume |
| D9 | Edge | Silent/vibrate mode on, run the sample | Cues still heard |
| D10 | US1/SC-003 | 60-minute session (sample phases repeated via a debug long-session option) with the screen off, 3 runs | Completes every time; no `am_kill` for the app in `adb logcat -b events` |
| D11 | Edge | Call the phone from another phone during the sample, talk 30 s, hang up | No speech over the call; beeps may be silenced; timing continues; cues resume on schedule after the call, missed ones are not replayed |

## 4. Timing accuracy (SC-001, SC-002)

```sh
adb logcat -c
adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log    # run D3 or D10 meanwhile
node scripts/timing-report.mjs cues.log
```

Expected: beeps p95 ≤ 150 ms, speech p95 ≤ 300 ms, and no growth from the first to the last
5 minutes. Format: [contracts/timing-log.md](./contracts/timing-log.md).

## 5. iOS sanity (optional in 001)

`npx expo run:ios` builds and shows the screens; the sample plays while the app is in front.
Background behaviour is not expected until spec 008.
