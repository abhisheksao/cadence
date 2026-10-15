# Quickstart: Validating Spec 004

How to validate that guided breathing works, both automatically and on a physical device. Entities: [data-model.md](./data-model.md). Interfaces and guarantees: [contracts/breathe.md](./contracts/breathe.md). Spec 001's quickstart covers the background service, cue ducking, and timing log, which this mode reuses.

## 1. Automated checks

```sh
npm run check        # expo lint + tsc --noEmit + jest
```

Expected: all green. Each guarantee BC1–BC14, BD1–BD4, BS1–BS6, and BU1–BU7 has at least one automated unit/component test. `adjust`, `parseBreathe`, `calculateCycles`, and `breatheDefinition` have table-driven unit tests.

## 2. Build and install

Same as previous specs:
```sh
npx expo run:android
# Or local release build:
npx expo prebuild -p android && (cd android && ./gradlew assembleRelease)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 3. On-device checks

For quick testing on device, use a 1-minute target with Box Breathing (1m target = 4 cycles = 64s + 5s prep = 69s total).

| # | Story | Steps | Expected |
|---|---|---|---|
| B1 | US1 | Open the home screen | Breathe tile has no "Coming soon"; tapping it opens Breathe screen with default Box preset selected and total time displayed |
| B2 | US1 | Start with Voice style, 5s prep enabled, screen on | "Get ready to breathe.", beeps at 3, 2, high beep at 1, then "Inhale.", "Hold.", "Exhale.", "Hold." ducking music cleanly |
| B3 | US3 | Watch live view during breathing | Visual breathing pacer expands smoothly during Inhale, stays full on Hold, contracts on Exhale, and stays small on Post-Hold |
| B4 | US3 | Change cue style to "Count" and start | App speaks "Inhale.", then counts "2", "3", "4" on subsequent seconds in rhythm |
| B5 | US3 | Change cue style to "Tones" and start | Plays gentle rising tone on Inhale, chime on Hold, falling tone on Exhale; zero spoken text |
| B6 | US1 | Let 1-minute session complete | Plays completion chime followed by "Breathing complete. Well done."; screen shows "Complete" with total elapsed time |
| B7 | US2 | Tap each preset (4-7-8, 3-4-7, Coherent) | Presets update inhale, hold, exhale, post-hold and target minutes; matching preset highlights; total time and cycles update |
| B8 | US2 | Select Coherent (5s inhale, 0s hold, 5s exhale, 0s hold) and start | Seamless transitions directly between Inhale and Exhale with zero pause or hold cues |
| B9 | US2 | Adjust target minutes and breath phase steppers | Steppers increment/decrement in 1s steps; cycles and total duration recalculate live; min/max boundaries clamp |
| B10 | US2 | Force-stop (`adb shell am force-stop io.github.abhisheksao.cadence`) and reopen | Stored breathing configuration is restored exactly as left |
| B11 | US3 | Toggle "Keep screen on" | When enabled, screen stays awake throughout session; when disabled, screen sleeps per system timeout while cues continue |
| B12 | US3 | Pause and Resume mid-breath | Circle animation freezes on Pause, Paused banner appears, notification updates to "Paused"; resuming continues smoothly |
| B13 | US3 | Skip and Back controls | Skips to next breath phase or cycles back; cues immediately re-align to new phase |
| B14 | Edge | Mid-session, switch to background/home | Breathe home tile shows "In progress"; tapping returns to live breath session |
| B15 | Recovery | Force-stop mid-session, reopen app | Relaunch prompts to resume; tapping Resume restores breathing session at current wall-clock position |

Timing accuracy (SC-001) is verified via the spec 001 timing log:

```sh
adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log
node scripts/timing-report.mjs cues.log
```
