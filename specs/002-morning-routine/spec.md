# Feature Specification: Morning Routine

**Feature Branch**: `002-morning-routine`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Morning routine mode (spec 002, builds on the spec 001 cue engine). The user keeps one editable morning routine: an ordered list of steps, each with a title and either a duration (timed) or no duration (untimed, waits for the user to tap Done). The user can add, rename, reorder, change the duration of, and delete steps; the routine is saved on the device and survives restarts. A sensible default routine is provided on first use (e.g. drink water, make the bed, stretch, breathing, plan the day, shower). Starting the routine runs it as a session: at each step start the app speaks the step number, count, title, and either its duration or "tap Done when finished" (the first step is preceded by a greeting); for timed steps it warns "one minute left" (only for steps long enough for that to be useful) and "10 seconds" (likewise), beeps on the last 3 seconds with the higher final beep before a step change, and ends the routine with the completion chime and a short spoken sign-off. Untimed steps show elapsed time and a prominent Done button (Done = skip to the next step). While running, the screen shows the current step, its time remaining or elapsed, the step list with done/current/upcoming state, and the spec 001 controls; the notification shows "Step N of M: title". The screen stays on during the routine. The routine is a plain-data SessionDefinition with mode id "routine" so spec 001 recovery after an OS kill works unchanged. On the home screen, Morning routine is no longer "coming soon" and opens the routine screen. Editing is not allowed while a session is running. Validation: a routine needs at least one step; empty titles fall back to "Step N"; durations are whole seconds within a sensible range."

## Overview

Morning routine is the first real mode on top of the spec 001 cue engine. The user keeps one
routine: a list of steps such as "Drink a glass of water" or "Stretch". Each step is either timed
or untimed. Running the routine talks the user through it, so they can follow it without looking
at the phone: it announces each step, warns before a timed step ends, counts down the last seconds
with beeps, and waits on untimed steps until the user taps Done.

Everything that makes cues reliable comes from spec 001 and is reused unchanged: timing with the
screen off, ducking music, the controls, the notification, and recovery after the OS kills the
app. This spec adds the routine itself, its cues, the editor, and the routine screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run my morning routine with spoken guidance (Priority: P1)

The user opens Morning routine from the home screen and taps Start. The app greets them and
announces the first step: its number, the total number of steps, its title, and how long it lasts,
or that it waits for Done. Timed steps warn when a minute is left (long steps only) and at 10
seconds, beep on the last 3 seconds, and move on by themselves. Untimed steps wait until the user
taps Done. After the last step, the completion chime plays and the app signs off.

**Why this priority**: This is the mode's reason to exist. With only the default routine and no
editor, it already gives the user a guided morning.

**Independent Test**: On a fresh install, open Morning routine, tap Start, and let the default
routine run with the screen off, tapping Done on the untimed steps. Every step is announced, the
warnings and beeps come at the right seconds, and the routine ends with the chime and sign-off.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user taps Morning routine, **Then** the routine screen
   opens showing the steps, the total timed duration, and a Start button. Morning routine is no
   longer marked coming soon.
2. **Given** the routine screen, **When** the user taps Start, **Then** the app says "Good
   morning." followed by the first step's announcement, e.g. "Step 1 of 6. Drink a glass of water.
   1 minute."
3. **Given** a timed step of 3 minutes or longer, **When** 60 seconds remain, **Then** the app says
   "One minute left."
4. **Given** a timed step of 30 seconds or longer, **When** 10 seconds remain, **Then** the app
   says "10 seconds."
5. **Given** a timed step that is not the last, **When** 3, 2, and 1 seconds remain, **Then** the
   app beeps, with the higher final beep at 1 second, and the next step is announced on time.
6. **Given** an untimed step, **When** it starts, **Then** the announcement ends with "Tap Done
   when finished.", the step does not end by itself, and **When** the user taps Done, **Then** the
   next step starts and is announced.
7. **Given** the last step ends (by time or Done), **Then** the completion chime plays followed by
   "Routine complete. Have a great day."
8. **Given** a running routine, **When** the screen is off or music is playing, **Then** cues keep
   their timing and music is ducked, never paused (spec 001 guarantees apply).

---

### User Story 2 - Make the routine my own (Priority: P1)

The user edits the routine before starting it: renames steps, changes durations, switches a step
between timed and untimed, adds new steps, reorders them, and deletes ones they don't need. Changes
are saved on the phone as they are made and are still there after the app restarts.

**Why this priority**: Nobody's morning matches the default. Without editing, the mode is a demo.

**Independent Test**: Edit the default routine (rename one step, make one untimed, add one, move
one, delete one), force-stop the app, reopen it, and check the routine is exactly as edited. Run
it and confirm the announcements match the edited steps.

**Acceptance Scenarios**:

1. **Given** the routine screen with no session running, **When** the user changes a step's title,
   **Then** the new title is shown and used in that step's announcement.
2. **Given** a step, **When** the user sets its duration in minutes and seconds, **Then** the step
   is timed with that duration; **When** the user marks it untimed, **Then** it waits for Done.
3. **Given** the routine, **When** the user adds a step, **Then** a new timed step (2 minutes, empty
   title) is added at the end and ready to edit.
4. **Given** the routine, **When** the user moves a step up or down, **Then** the order changes and
   the step numbers in announcements follow the new order.
5. **Given** a routine with more than one step, **When** the user deletes a step, **Then** it is
   removed. **Given** a routine with one step, **Then** that step cannot be deleted.
6. **Given** any edits, **When** the app is closed and reopened (including after a force-stop),
   **Then** the routine is exactly as last edited.
7. **Given** a step whose title is left empty, **When** the routine runs, **Then** that step is
   shown and announced as "Step N".
8. **Given** an edited routine, **When** the user chooses Restore default routine and confirms,
   **Then** the default routine replaces it. **When** the user cancels, **Then** nothing changes.

---

### User Story 3 - See where I am at a glance (Priority: P2)

While the routine runs, the screen shows the current step's title and position ("Step 2 of 6"), its
time remaining (or elapsed, for an untimed step), and the full step list marking which steps are
done, which is current, and which are upcoming. Untimed steps show a large Done button. The
notification shows "Step N of M: title", so the user can check progress from the lock screen. The
screen stays on while the routine screen is open.

**Why this priority**: The voice carries the routine; the screen is for a quick check. It matters,
but the routine is usable by ear alone.

**Independent Test**: Run the default routine and check the screen at each step: current step,
clock, list states, the Done button on untimed steps, and the notification text. Leave the phone
untouched on the routine screen for longer than its screen timeout and confirm the screen stays on.

**Acceptance Scenarios**:

1. **Given** a running timed step, **Then** the screen shows "Step N of M", the step title, and the
   time remaining counting down.
2. **Given** a running untimed step, **Then** the screen shows the time elapsed counting up and a
   prominent Done button.
3. **Given** a running routine, **Then** the step list marks earlier steps as done, the current step
   as current, and later steps as upcoming, and updates on every step change, including after skip
   and back.
4. **Given** a running routine, **Then** the notification reads "Step N of M: title", and
   "Paused · Step N of M: title" while paused.
5. **Given** the routine has finished or was stopped, **Then** the screen says "All done" or
   "Stopped" and offers Start again, and editing is available again.
6. **Given** a session is running or paused, **Then** the routine cannot be edited; edit controls
   are hidden or disabled until the session ends.

---

### Edge Cases

- **Routine started, then edited**: not possible; editing is blocked while a session runs or is
  paused. A running session always uses the routine as it was when started.
- **OS kills the app mid-routine**: spec 001 recovery applies unchanged. The resumed session uses
  the routine as it was when started, even if the stored routine differs.
- **Another session is running** (e.g. the sample session) when the user starts the routine: the
  other session stops and the routine starts (spec 001 FR-011).
- **Very short timed steps** (5–9 seconds): the step announcement and the final beeps may follow
  each other closely. The 10-second warning is skipped for steps under 30 seconds, and the
  one-minute warning for steps under 3 minutes, so warnings never land on top of the announcement.
- **All steps untimed**: allowed. The total timed duration shows as zero and the routine advances
  only on Done.
- **Long titles**: titles are limited in length; the screen and notification truncate visually but
  the full title is spoken.
- **Stored routine missing or unreadable** (first launch, or data from a future version): the
  default routine is used and saved.
- **Many steps**: the editor and step list scroll; the routine is limited to a maximum number of
  steps.

## Requirements *(mandatory)*

### Functional Requirements

**Routine content**

- **FR-001**: The app MUST keep one morning routine: an ordered list of 1 to 30 steps. Each step has
  a title (up to 60 characters) and either a duration of 5 seconds to 60 minutes in whole seconds
  (timed) or no duration (untimed).
- **FR-002**: On first use, or when the stored routine is missing or unreadable, the app MUST
  provide a default routine: Drink a glass of water (1 min), Make the bed (untimed), Stretch
  (5 min), Breathing (3 min), Plan the day (3 min), Shower (untimed).
- **FR-003**: Users MUST be able to rename a step, set its duration, switch it between timed and
  untimed, add a step (at the end, timed, 2 minutes, empty title), move a step up or down, and
  delete a step, but not the last remaining one.
- **FR-004**: Every change MUST be saved on the device as it is made, with no separate save action,
  and MUST survive closing, force-stopping, and restarting the app.
- **FR-005**: Users MUST be able to restore the default routine after confirming.
- **FR-006**: A step with an empty or blank title MUST be shown and announced as "Step N", where N
  is its position.
- **FR-007**: Editing MUST NOT be possible while a session is running or paused.

**Running the routine**

- **FR-008**: Starting the routine MUST run it as a session of the cue engine from spec 001, with
  one phase per step, in order, titled "Morning routine" in the notification. All spec 001
  guarantees apply: screen-off timing, ducking, controls, notification, recovery, and the timing
  log.
- **FR-009**: At each step's start the app MUST announce "Step N of M. <title>." followed by the
  spoken duration (e.g. "1 minute.", "2 minutes 30 seconds.") for a timed step or "Tap Done when
  finished." for an untimed step. The first announcement MUST be preceded by "Good morning."
- **FR-010**: For a timed step of at least 3 minutes, the app MUST say "One minute left." when 60
  seconds remain.
- **FR-011**: For a timed step of at least 30 seconds, the app MUST say "10 seconds." when 10
  seconds remain.
- **FR-012**: For every timed step, the app MUST beep when 3, 2, and 1 seconds remain. Before a step
  change the beep at 1 second MUST be the higher final beep; on the last step all three are normal
  beeps and the completion chime follows.
- **FR-013**: When the last step ends, the app MUST play the completion chime followed by "Routine
  complete. Have a great day."
- **FR-014**: An untimed step MUST NOT end by itself. Done MUST end it and start the next step
  (or complete the routine on the last step), exactly like skip.
- **FR-015**: The screen MUST stay on while the routine screen is open and a routine session is
  running or paused (spec 001 FR-021a).
- **FR-016**: The routine session MUST be fully described by its plain data (steps as phases, mode
  "routine"), so that spec 001 recovery rebuilds the same cues after an OS kill.

**Routine screen**

- **FR-017**: Before starting, the routine screen MUST show the steps with their durations (or
  "untimed"), the total timed duration, the editing controls, and Start.
- **FR-018**: While running, the routine screen MUST show "Step N of M", the step title, time
  remaining (timed) or elapsed (untimed), the step list with done/current/upcoming state, a large
  Done button on untimed steps, and the spec 001 controls.
- **FR-019**: The notification MUST read "Step N of M: <title>" and "Paused · Step N of M: <title>"
  while paused.
- **FR-020**: After the routine finishes or is stopped, the screen MUST say "All done" or "Stopped"
  and offer Start again.
- **FR-021**: The home screen MUST show Morning routine as available (no longer coming soon), and
  tapping it MUST open the routine screen. A session recovered after an OS kill MUST open the
  screen of its mode (the routine screen for routine sessions).

### Key Entities

- **Routine**: the user's single morning routine. An ordered list of steps. Stored on the device;
  versioned so later changes can migrate it.
- **Step**: one item of the routine. A stable identity (so reordering and editing are unambiguous),
  a title, and a duration in whole seconds or none (untimed).
- **Routine session**: a spec 001 session built from a snapshot of the routine when Start is
  tapped. Each step becomes one phase; the title is "Morning routine".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the home screen, the user starts their routine in 2 taps (Morning routine,
  Start).
- **SC-002**: Every announcement, warning, and beep plays on its due second with the accuracy of
  spec 001 SC-001, with the screen off, across a full run of the default routine.
- **SC-003**: Adding a new step with a title and a duration takes under 30 seconds.
- **SC-004**: In 100% of trials, edits are present after a force-stop and relaunch.
- **SC-005**: An untimed step never advances without a tap on Done (or skip), however long it runs.
- **SC-006**: A routine killed by the OS mid-session resumes in 2 taps on relaunch, at the step and
  second the clock gives (spec 001 SC-008), with the routine's own cues.

## Assumptions

- One routine per user. Multiple named routines, scheduling, reminders, and history are out of
  scope (roadmap: later).
- Cue wording is English only, like spec 001. Spoken durations use minutes and seconds ("2 minutes
  30 seconds"); hours are not needed because steps are at most 60 minutes.
- The duration limits (5 s to 60 min) and step limit (30) are generous for a morning routine and
  keep the editor and announcements sensible. The 3-minute and 30-second thresholds for warnings
  follow the prior implementation, where they worked well.
- Reordering uses move up/down buttons, which are accessible and simple to test; drag-and-drop can
  come later.
- Duration is entered as minutes and seconds.
- Starting the routine replaces any other running session, as in spec 001.
- Depends on spec 001 (cue engine, session controller, background service, recovery, and the
  key-value store), which is merged to `develop`.
