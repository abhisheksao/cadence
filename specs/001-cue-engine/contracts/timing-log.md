# Contract: Timing Log and Report

## Log line (FR-022a)

One line per played cue, written with `console.info` (Android tag `ReactNativeJS`), in all build
types:

```text
CADENCE_CUE v=1 type=<beep|beepLast|chime|say> planned=<wall ms> actual=<wall ms> err=<actual-planned ms> phase=<index>
```

- `planned` is the cue's `at`; `actual` is the player's start-of-playback event (sounds) or the
  speech `onStart` callback (speech).
- No other fields. No spoken text, settings, or identifiers (Principle III). The log never
  leaves the device.

Capture:

```sh
adb logcat -c && adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log
```

## Report (FR-022b)

```sh
node scripts/timing-report.mjs cues.log
```

Output (per cue type): count, p50 and p95 of `|err|`, and p95 for the first 5 minutes vs the last
5 minutes of the session. Exit code 1 if beeps p95 > 150 ms or speech p95 > 300 ms (SC-001), or
the last-5-minutes p95 is more than 50 ms worse than the first 5 minutes (SC-002). Pass
`--no-fail` to just print.

The parser is a pure function with unit tests (sample logs in `scripts/__fixtures__/`).
