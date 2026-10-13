# Quickstart: Validating Spec 002

How to show that the morning routine works, automatically and on a device. Entities:
[data-model.md](./data-model.md). Interfaces and guarantees: [contracts/routine.md](./contracts/routine.md).
Spec 001's [quickstart](../001-cue-engine/quickstart.md) covers the engine, the background service,
and the timing log, which this mode reuses.

## 1. Automated checks

```sh
npm run check        # expo lint + tsc --noEmit + jest
```

Expected: all green. Each guarantee RC1–RC9, RS1–RS4, and UI1–UI9 has at least one test. The edit
operations and `parseRoutine` have table tests. One engine-level test runs the default routine on
the fake clock and checks every cue and its due time.

## 2. Build and install

Same as spec 001: `npx expo run:android`, or a local release build with
`npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)`.

## 3. On-device checks

| # | Story | Steps | Expected |
|---|---|---|---|
| R1 | US1 | Fresh install, open the home screen | Morning routine has no "Coming soon"; tapping it shows the default six steps, total timed 12:00, Start and Edit |
| R2 | US1 | Start, lock the screen, put music on | "Good morning. Step 1 of 6. Drink a glass of water. 1 minute." Music ducks for each cue and is never paused |
| R3 | US1 | Let step 1 run out | "10 seconds." at 0:10; beeps at 0:03, 0:02, high beep at 0:01; "Step 2 of 6. Make the bed. Tap Done when finished." |
| R4 | US1/US3 | Wait 2 minutes on step 2, then tap the large Done | Step 2 does not advance by itself; Done announces step 3 right away |
| R5 | US1 | Let Stretch (5 min) run with the screen off | "One minute left." at 1:00 left, "10 seconds.", beeps, next step on time |
| R6 | US3 | On a timed step, tap the compact Done | Next step starts and is announced right away |
| R7 | US3 | Pull down the notification during a step, then pause | "Step N of M: <title>", then "Paused · Step N of M: <title>" |
| R8 | US3 | Leave the routine screen untouched past the screen timeout | Screen stays on |
| R9 | US3 | Go back to home mid-routine | Tile shows "In progress"; tapping it shows the live routine |
| R10 | US1 | Finish the last step | Chime, "Routine complete. Have a great day.", screen says "All done" with Start again and Edit |
| R11 | US2 | Edit: rename a step, make one untimed, set 0:05 on another (becomes 0:15), add a step, move one, delete one and Undo, delete another | Every change shows right away; Undo restores the step in place |
| R12 | US2 | Force-stop the app (`adb shell am force-stop io.github.abhisheksao.cadence`) and reopen | Routine exactly as edited; announcements follow the new order and titles |
| R13 | US2 | Restore default routine → Cancel, then → Confirm | Cancel keeps the edits; Confirm brings back the six default steps |
| R14 | Edge | Start the sample session, then open Morning routine | Routine screen shows the Start view; Start stops the sample and starts the routine |
| R15 | Recovery | Force-stop mid-routine, edit nothing, reopen within a minute | Resume offer; Resume opens the routine screen at the clock position and announces "Step N of M…" |

Timing accuracy (SC-002) uses the spec 001 timing log while running R2–R5:

```sh
adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log
npm run timing-report cues.log
```
