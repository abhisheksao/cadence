# Feature Specification: Run / Walk

**Feature Branch**: `003-run-walk`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Run / walk mode (spec 003, builds on the spec 001 cue engine). The user sets up an interval workout: an optional warm-up walk, a number of rounds of run then walk, and an optional cool-down walk. Presets cover common plans (1:00/1:30 ×8, 1:30/2:00 ×6, 2:00/1:00 ×6, 5:00/1:00 ×4) and every value can be adjusted. The settings are saved on the device. Starting the workout runs it as a session: a short get-ready phase, then each phase is announced ("Run for 1 minute. Round 3 of 8.", "Walk for 1 minute 30 seconds."); before each switch the app counts down by voice ("Run ends in 5, 4, 3, 2, 1"); optional cues say the time left every 30 seconds and "Halfway" on long runs; the workout ends with the completion chime and a short spoken sign-off. While running, the screen shows the phase (run and walk in different colours), the round, the time remaining, total elapsed and total time, and what comes next, with the spec 001 controls; the notification shows the phase and round. The workout is a plain-data SessionDefinition with mode id "run-walk" so spec 001 recovery works unchanged. On the home screen, Run / walk is no longer coming soon and opens the run/walk screen."

## Overview

Run / walk is the second mode on top of the spec 001 cue engine. It is for interval training such
as couch-to-5K: the user runs for a while, walks for a while, and repeats, usually with a walk to
warm up and cool down. The phone stays in a pocket with music playing, so every switch is cued by
voice, with a countdown so the user knows exactly when to change pace.

Everything that makes cues reliable comes from spec 001 and is reused unchanged: timing with the
screen off, ducking music, the controls, the notification, and recovery after the OS kills the
app. This spec adds the workout settings, the presets, the run/walk cues, and the run/walk screen.

## Clarifications

### Session 2026-10-14

- Q: How often should the "time left" cue speak during a phase? → A: Every 30 seconds, in every
  phase (as before).
- Q: How is the last stretch before a switch counted down? → A: "<Phase> ends in" at 5 seconds
  left, then beeps on 3, 2, 1 with the higher final beep before a phase change (as in the routine),
  instead of spoken numbers.
- Q: Should the screen stay on during a workout? → A: A "Keep screen on" setting, off by default.
- Q: How long is the get-ready phase? → A: 10 seconds, fixed.
- Q: How are lengths and rounds set? → A: − / + step buttons only (15 s for run/walk, 1 round, 1
  min for warm-up/cool-down); no typed entry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a cued interval workout (Priority: P1)

The user opens Run / walk from the home screen and taps Start with the default workout. After a
short get-ready phase the app announces the warm-up walk, then each run and walk with its length
and round, counts down by voice before every switch, and ends with the completion chime and a
sign-off. The phone stays in a pocket, the screen is off, and music keeps playing.

**Why this priority**: This is the mode's reason to exist. With only the default workout it is
already a usable interval timer.

**Independent Test**: On a fresh install, open Run / walk, tap Start, lock the phone, and listen
through a shortened workout (e.g. 1 round, no warm-up or cool-down). Every phase is announced, the
countdown lands on the switch, and the workout ends with the chime and sign-off.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user taps Run / walk, **Then** the run/walk screen opens
   with the current settings, the total workout time, and a Start button. Run / walk is no longer
   marked coming soon.
2. **Given** the run/walk screen, **When** the user taps Start, **Then** the app says "Get ready.
   Starting in 10 seconds." and, 10 seconds later, starts the first phase.
3. **Given** a warm-up of 5 minutes, **When** it starts, **Then** the app says "Warm up. Walk for 5
   minutes."
4. **Given** round 3 of 8 with a 1-minute run, **When** the run starts, **Then** the app says "Run
   for 1 minute. Round 3 of 8."; on the final round it says "Run for 1 minute. Last round."
5. **Given** a 90-second walk, **When** it starts, **Then** the app says "Walk for 1 minute 30
   seconds."
6. **Given** any phase after get-ready, **When** 5 seconds remain, **Then** the app says "<Phase>
   ends in" (e.g. "Run ends in"), and **When** 3, 2, and 1 seconds remain, **Then** it beeps, with
   the higher final beep at 1 second, and the next phase is announced on time.
7. **Given** the get-ready phase, **When** 3, 2, and 1 seconds remain, **Then** the app beeps the
   same way, without the "ends in" lead-in.
8. **Given** a cool-down of 5 minutes, **When** it starts, **Then** the app says "Now cool down.
   Walk for 5 minutes."
9. **Given** the last phase ends, **Then** the completion chime plays followed by "Workout
   complete. Great job."
10. **Given** a running workout, **When** the screen is off or music is playing, **Then** cues keep
    their timing and music is ducked, never paused (spec 001 guarantees apply).

---

### User Story 2 - Set up my own intervals (Priority: P1)

The user picks a preset or adjusts the run length, walk length, number of rounds, warm-up, and
cool-down. The total time updates as they change. The settings are saved and are still there the
next time they open the app.

**Why this priority**: Interval plans change week to week as the user gets fitter. Without
adjusting, the mode only fits one week of one plan.

**Independent Test**: Pick a preset, then change the run length, the rounds, and turn off the
cool-down. Check the total time after each change, force-stop the app, reopen it, and confirm the
settings are as left. Start it and check the announcements match.

**Acceptance Scenarios**:

1. **Given** the run/walk screen, **When** the user taps a preset (1:00 / 1:30 ×8, 1:30 / 2:00 ×6,
   2:00 / 1:00 ×6, or 5:00 / 1:00 ×4), **Then** the run length, walk length, and rounds are set to
   it, and the preset shows as selected. Warm-up, cool-down, and voice options are unchanged.
2. **Given** the settings match a preset, **Then** that preset shows as selected; **When** the user
   changes the run, walk, or rounds so they match no preset, **Then** no preset is selected.
3. **Given** the run or walk length, **When** the user adjusts it, **Then** it changes in
   15-second steps within 15 seconds to 30 minutes.
4. **Given** the rounds, **When** the user adjusts them, **Then** they change by 1 within 1 to 30.
5. **Given** the warm-up or cool-down, **When** the user adjusts it, **Then** it changes in
   1-minute steps within 0 (none) to 30 minutes; at 0 that phase is left out of the workout.
6. **Given** any change, **Then** the total workout time shown updates immediately.
7. **Given** any changes, **When** the app is closed and reopened (including after a force-stop),
   **Then** the settings are as last set.

---

### User Story 3 - Keep track while I run (Priority: P2)

Voice cues can say the time left every 30 seconds and "Halfway" in the middle of long runs, so the
user always knows where they are without looking. A glance at the screen shows whether they should
be running or walking, the round, the time left, and what comes next. The notification shows the
phase and round on the lock screen.

**Why this priority**: The switches and countdown (Story 1) carry the workout. These cues and the
screen make it easier to pace, but the workout works without them.

**Independent Test**: With all voice options on, run a workout with 2-minute runs and check the
time-left and halfway cues. Turn each option off and confirm its cue stops. Check the screen and
notification at each phase change and while paused.

**Acceptance Scenarios**:

1. **Given** "Say time left" is on, **When** a phase has a multiple of 30 seconds remaining (and
   more than 5 seconds), **Then** the app says the time left, e.g. "2 minutes left." or "30 seconds
   left.", except within the first 5 seconds of the phase.
2. **Given** "Say halfway" is on and a run of 2 minutes or longer, **When** half the run has
   passed (rounded down to the second), **Then** the app says "Halfway."; if a time-left cue falls
   on the same second, both are said together ("Halfway. 1 minute left.").
3. **Given** "Say the round" is off, **When** a run starts, **Then** the announcement leaves out
   the round ("Run for 1 minute.").
4. **Given** a running workout, **Then** the screen shows the phase name in large text, with run
   and walk in clearly different colours, the round ("Round 3 of 8") for runs and walks, the time
   remaining counting down, the total elapsed and total workout time, and the next phase with its
   length.
5. **Given** a running workout, **Then** the notification reads the phase and, for runs and walks,
   the round, in the same form as the routine (e.g. "Round 3 of 8: Run"), with "Paused · " in
   front while paused.
6. **Given** "Keep screen on" is on, **When** a workout runs with the run/walk screen open, **Then**
   the screen stays on past its timeout; **Given** it is off, **Then** the screen turns off as usual.
7. **Given** the workout has finished or was stopped, **Then** the screen says "Complete" or
   "Stopped" with the total time and offers Start again, and the settings can be changed again.

---

### Edge Cases

- **Settings changed during a workout**: not possible; while a run/walk session is running or
  paused, the screen shows the live workout instead of the settings. A running workout always uses
  the settings it was started with.
- **OS kills the app mid-workout**: spec 001 recovery applies unchanged. The resumed workout uses
  the settings it was started with, even if the stored settings differ.
- **Another session is running** (e.g. the morning routine): the run/walk screen shows its normal
  settings view. Starting the workout stops the other session (spec 001 FR-011).
- **User leaves the run/walk screen mid-workout**: the workout keeps running. The home screen's
  Run / walk tile shows "In progress", and opening it shows the live workout.
- **Last walk with a cool-down**: when there is a cool-down, the last round has no walk of its
  own; the last run goes straight into the cool-down, which is a walk anyway. Without a cool-down,
  the last round ends with its walk.
- **No warm-up and no cool-down**: the workout is get-ready, then the rounds.
- **Short phases**: phases are at least 15 seconds, so the start announcement finishes before the
  "ends in" countdown. A 15-second phase gets its announcement and the countdown, and no time-left
  or halfway cues.
- **Skip and back**: work as in spec 001. Skipping to a phase announces it in full (including the
  round), and the countdown and other cues follow from the new phase.
- **Stored settings missing or unreadable** (first launch, or data from a future version): the
  defaults are used and saved.
- **Values out of range in stored data**: each value is brought into its allowed range.
- **Screen**: by default the screen turns off as usual during a workout, since the phone is
  normally in a pocket. With "Keep screen on" turned on, it stays on while the run/walk screen is
  open and a workout is running or paused. The setting is read when Start is tapped and is part of
  the workout snapshot.

## Requirements *(mandatory)*

### Functional Requirements

**Workout settings**

- **FR-001**: The app MUST keep one run/walk workout setting: run length and walk length (15
  seconds to 30 minutes each), rounds (1 to 30), warm-up and cool-down (0 to 30 minutes each, 0
  meaning none), three voice options (say the round, say halfway, say time left), and a "Keep screen
  on" option.
- **FR-002**: The defaults MUST be: warm-up 5 minutes, run 1 minute, walk 1 minute 30 seconds, 8
  rounds, cool-down 5 minutes, all voice options on, keep screen on off.
- **FR-003**: The app MUST offer four presets that set run, walk, and rounds: 1:00 / 1:30 ×8,
  1:30 / 2:00 ×6, 2:00 / 1:00 ×6, and 5:00 / 1:00 ×4. A preset MUST show as selected exactly when
  the current run, walk, and rounds match it.
- **FR-004**: Values MUST be changed with − / + step buttons only (no typed entry); a button MUST
  be disabled at its limit. Run and walk lengths MUST be adjustable in 15-second steps, rounds in steps of 1, and
  warm-up and cool-down in 1-minute steps, each within its range.
- **FR-005**: Every change MUST be saved on the device as it is made, with no separate save
  action, and MUST survive closing, force-stopping, and restarting the app. Missing or unreadable
  stored settings MUST fall back to the defaults; out-of-range values MUST be brought into range.
- **FR-006**: The run/walk screen MUST show the total workout time (all phases, including
  get-ready), updated on every change.

**The workout**

- **FR-007**: The workout MUST consist of, in order: a 10-second get-ready phase; a warm-up walk if
  warm-up is above 0; for each round a run then a walk; and a cool-down walk if cool-down is above
  0. When there is a cool-down, the last round MUST have no walk.
- **FR-008**: Starting the workout MUST run it as a session of the cue engine from spec 001, titled
  "Run / walk" in the notification. All spec 001 guarantees apply: screen-off timing, ducking,
  controls, notification, recovery, and the timing log.
- **FR-009**: At each phase's start the app MUST announce it:
  - get-ready: "Get ready. Starting in 10 seconds."
  - warm-up: "Warm up. Walk for <duration>."
  - run: "Run for <duration>." followed, if "say the round" is on, by "Round N of M." or, on the
    last round, "Last round."
  - walk: "Walk for <duration>."
  - cool-down: "Now cool down. Walk for <duration>."

  Durations are spoken in minutes and seconds (e.g. "1 minute 30 seconds").
- **FR-010**: In every phase except get-ready, the app MUST say "<Phase> ends in" (Warm up, Run,
  Walk, or Cool down) when 5 seconds remain, then beep when 3, 2, and 1 seconds remain. In
  get-ready it MUST only beep. Before a phase change the beep at 1 second MUST be the higher final
  beep; on the last phase all three are normal beeps and the completion chime follows.
- **FR-011**: If "say time left" is on, the app MUST say "<duration> left." when the remaining time
  in a phase is a multiple of 30 seconds and more than 5 seconds, except within the first 5 seconds
  of the phase and in get-ready.
- **FR-012**: If "say halfway" is on, for runs of 2 minutes or longer the app MUST say "Halfway."
  when half the run has passed (rounded down to the second). If a time-left cue is due on the same
  second, the app MUST say both as one phrase: "Halfway. <duration> left."
- **FR-013**: When the last phase ends, the app MUST play the completion chime followed by "Workout
  complete. Great job."
- **FR-014**: If "Keep screen on" is on, the screen MUST stay on while the run/walk screen is open
  and a run/walk session is running or paused (spec 001 FR-021a); if it is off (the default), the
  run/walk mode MUST NOT keep the screen on.
- **FR-015**: The workout session MUST be fully described by its plain data (phases and voice
  options, mode "run-walk"), so that spec 001 recovery rebuilds the same cues after an OS kill.

**Run/walk screen**

- **FR-016**: When no run/walk session is running or paused, the run/walk screen MUST show the
  presets, the interval settings, the warm-up and cool-down, the voice options, "Keep screen on",
  the total time, and Start.
- **FR-017**: While running or paused, the run/walk screen MUST show the phase name in large text
  (run and walk in clearly different colours), the round for runs and walks, the time remaining,
  total elapsed and total workout time, a paused label when paused, the next phase with its length
  (none on the last phase), and the spec 001 controls.
- **FR-018**: The notification MUST read the phase title and, for runs and walks, the round first,
  as the routine does (e.g. "Round 3 of 8: Run"; "Warm up"; "Cool down"), with "Paused · " in
  front while paused.
- **FR-019**: After the workout finishes or is stopped, the screen MUST say "Complete" or
  "Stopped" with the total elapsed time and offer Start again, returning to the settings view.
- **FR-020**: The home screen MUST show Run / walk as available (no longer coming soon), and
  tapping it MUST open the run/walk screen. While a run/walk session is running or paused, the tile
  MUST show "In progress", and the run/walk screen MUST show the live workout. If another mode's
  session is running, the run/walk screen shows its normal settings view. A run/walk session
  recovered after an OS kill MUST open the run/walk screen.

### Key Entities

- **Run/walk settings**: the user's single workout setting: run and walk lengths, rounds, warm-up,
  cool-down, the three voice options, and "Keep screen on". Stored on the device; versioned so later changes can
  migrate it.
- **Preset**: a named run length, walk length, and round count. Fixed in the app; not editable.
- **Workout session**: a spec 001 session built from a snapshot of the settings when Start is
  tapped. Each get-ready, warm-up, run, walk, and cool-down becomes one phase; runs and walks carry
  their round; the title is "Run / walk".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the home screen, the user starts a workout in 2 taps (Run / walk, Start).
- **SC-002**: Every announcement and countdown beep plays on its due second with the accuracy of
  spec 001 SC-001, with the screen off and music playing, across a full run of the default
  workout (about 29 minutes).
- **SC-003**: The final beep of each countdown is followed by the next phase's announcement within
  the accuracy of spec 001 SC-001, so the user hears the switch exactly when the countdown ends.
- **SC-004**: Switching to a preset and changing one value takes under 15 seconds.
- **SC-005**: In 100% of trials, settings are present after a force-stop and relaunch.
- **SC-006**: A workout killed by the OS mid-session resumes in 2 taps on relaunch, at the phase
  and second the clock gives (spec 001 SC-008), with the workout's own cues.

## Assumptions

- One workout setting per user. Saved custom plans, multi-week programs (e.g. couch-to-5K
  schedules), GPS distance and pace, and history are out of scope (roadmap: later).
- Cue wording is English only, like specs 001 and 002.
- The countdown is "<Phase> ends in" followed by beeps on 3, 2, 1, the same beeps as the morning
  routine, so the two modes sound alike (clarified; the prior implementation spoke the numbers).
- The get-ready phase is a fixed 10 seconds (clarified), enough to lock the phone and put it away.
  The prior implementation used 6 seconds, which proved short.
- Time left every 30 seconds and halfway on runs of 2 minutes or more follow the prior
  implementation, where they kept long phases from going quiet; both can be turned off.
- Folding the last walk into the cool-down follows the prior implementation: a walk followed by a
  walk is just a longer walk.
- Values are changed with − / + step buttons only (15 s, 1 round, 1 min; clarified) rather than
  typed entry, which
  suits use with sweaty hands and is simple to test.
- The ranges (15 s to 30 min per interval, 1 to 30 rounds, up to 30 min warm-up and cool-down) cover
  common walk/run plans with room to spare.
- Depends on spec 001 (cue engine, session controller, background service, recovery, key-value
  store) and the mode routing and home tile "In progress" added in spec 002, all merged to
  `develop`.
