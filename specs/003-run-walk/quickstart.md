# Quickstart: Validating Spec 003

How to show that run/walk works, automatically and on a device. Entities:
[data-model.md](./data-model.md). Interfaces and guarantees: [contracts/run-walk.md](./contracts/run-walk.md).
Spec 001's [quickstart](../001-cue-engine/quickstart.md) covers the engine, the background service,
and the timing log, which this mode reuses.

## 1. Automated checks

```sh
npm run check        # expo lint + tsc --noEmit + jest
```

Expected: all green. Each guarantee WC1–WC14, WD1–WD4, WS1–WS6 and WU1–WU8 has at least one test.
`adjust`, `parseRunWalk` and `runWalkDefinition` have table tests. One engine-level test runs a
short workout (warm-up 1 min, 2 rounds of 2:00 / 0:30, cool-down 1 min) on the fake clock and
checks every cue and its due time.

## 2. Build and install

Same as spec 001: `npx expo run:android`, or a local release build with
`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`, then
`adb install -r android/app/build/outputs/apk/release/app-release.apk`.

## 3. On-device checks

For a quick run, set warm-up Off, run 2:00, walk 0:30, 2 rounds, cool-down 1:00 (total 5:40).

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Open the home screen | Run / walk has no "Coming soon"; tapping it shows the settings with the default 1:00 / 1:30 ×8 preset selected and total 28:40 |
| W2 | US1 | Quick settings, Start, lock the screen, music on | "Get ready. Starting in 10 seconds.", beeps at 3, 2, high beep at 1, then "Run for 2 minutes. Round 1 of 2." Music ducks and never pauses |
| W3 | US3 | Let the first run play | "1 minute 30 seconds left." at 1:30, "Halfway. 1 minute left." at 1:00, "30 seconds left." at 0:30, "Run ends in" at 0:05, beeps at 3, 2, high beep at 1, "Walk for 30 seconds." on time |
| W4 | US1 | Let round 2 run | "Run for 2 minutes. Last round."; after the run, "Now cool down. Walk for 1 minute." (no last walk) |
| W5 | US1 | Let the cool-down end | "Cool down ends in", three normal beeps, chime, "Workout complete. Great job."; screen says "Complete" with the total |
| W6 | US3 | Pull down the notification during a run, then pause | "Round 1 of 2: Run", then "Paused · Round 1 of 2: Run" |
| W7 | US3 | Turn off "Say the round", "Say halfway", "Say time left"; run again | Run start is "Run for 2 minutes."; no halfway or time-left cues; countdown unchanged |
| W8 | US3 | Keep screen on: on, Start, leave the phone past its screen timeout; repeat with it off | On: screen stays on. Off: screen turns off as usual and cues continue |
| W9 | US2 | Tap each preset; then change run by +15 s | Run, walk, rounds follow the preset and it is marked; after +15 s no preset is marked; total updates |
| W10 | US2 | Hold − on rounds to 1 and + on walk to 30:00; set warm-up to Off | − disabled at 1, + disabled at 30:00; warm-up reads Off and the workout starts with Run after Get ready |
| W11 | US2 | Force-stop (`adb shell am force-stop io.github.abhisheksao.cadence`) and reopen | Settings exactly as left |
| W12 | US3 | Skip and Back during a run, including while a phrase is playing | The new phase is announced in full with its round; countdown follows from the new phase |
| W13 | Edge | Start the sample session, then open Run / walk | Settings view; Start stops the sample and starts the workout |
| W14 | Edge | Mid-workout, go home | Run / walk tile shows "In progress"; tapping it shows the live workout |
| W15 | Recovery | Force-stop mid-run, reopen within a minute, wait 10 s on the prompt, Resume | Run/walk screen opens at the clock position (±1 s) and announces the phase with its round |

Timing accuracy (SC-002, SC-003) uses the spec 001 timing log while running W2–W5:

```sh
adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log
npm run timing-report cues.log
```
