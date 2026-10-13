# ADR 0001: Time cues from the wall clock

- **Status:** Accepted (spec 001, research R1)
- **Date:** 2026-10-13

## Context

Cadence plays cues on exact seconds for up to an hour with the screen off (constitution
Principle I). JavaScript timers are only a wake-up signal: on Android they arrive late, in bursts,
or not at all while the CPU sleeps. So the engine has to work out where it is from a clock, not
by counting ticks.

JavaScript has two clocks:

- `performance.now()` is monotonic, but on Android it is backed by `CLOCK_MONOTONIC`, which
  **stops while the CPU is in deep sleep**. The background service holds no wakelock, so the CPU
  can sleep between cues. A session timed this way falls behind real time.
- `Date.now()` keeps counting through sleep, but the user can change it.

## Decision

The engine reads an injected `Clock` whose production implementation is `Date.now()`. Every
tick recomputes the phase and second from `now - phaseStart`. Phases advance by their exact
duration, so a late tick never shifts the schedule.

If the clock goes **backwards** while the app runs, the engine shifts its anchors back by the same
amount, so progress does not jump (at most one 100 ms tick is lost). Forward jumps are followed,
because the engine cannot tell them apart from deep sleep.

Recovery after an OS kill uses the same clock: the saved record holds wall-clock anchors, and on
relaunch the position is wherever the clock says the session has reached (FR-024).

## Consequences

- Cues stay on time through deep sleep. This is the failure Principle I exists to prevent.
- A manual forward clock change while a session runs skips ahead. That case is rare and
  acceptable. A backwards change is handled.
- Tests drive the engine with a `FakeClock` and `FakeScheduler`, including jitter, suspension, and
  clock jumps (`src/test-utils/fakeClock.ts`).
- Spec 006's native service can read `SystemClock.elapsedRealtime()`, which is monotonic and
  counts sleep. That would remove the forward-jump caveat.

## Alternatives considered

- `performance.now()`: drifts across deep sleep.
- Comparing both clocks: cannot tell sleep from a forward clock change.
- A native module for `elapsedRealtime()`: the right answer, but it is native work that belongs in
  spec 006.
