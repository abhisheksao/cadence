# Feature Specification: Cue Engine and Background Session

**Feature Branch**: `001-cue-engine`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Cue engine and background session — the foundation every Cadence mode
(morning routine, run/walk, breathe) builds on. A session is an ordered list of phases, timed or
untimed; cues fire for each second and land on the second from the wall clock; start, pause,
resume, skip, back, stop; keeps running with the screen off via a foreground service with an
ongoing notification; cue audio ducks music and never pauses it; notification and
battery-optimisation prompts; app shell with a home screen listing the three modes; bundled cue
sounds; test setup; a sample session for on-device verification. Out of scope: the modes
themselves (002–004), notification action buttons and the native service (006), iOS background
execution (008), end-to-end tests and CI (005)."

## Clarifications

### Session 2026-10-13

- Q: What happens if the OS kills the app mid-session? → A: Recover in this spec: progress is
  saved, and on reopen the app offers to resume at the point the clock says the session has reached.
- Q: Should the screen stay on while the session screen is open? → A: It is a per-mode choice
  (e.g. on for routine/breathe, off for run/walk); the sample session keeps it on.
- Q: How is on-device cue accuracy (SC-001, SC-002) measured? → A: Each cue's planned and actual
  start time is written to the device log, read over adb, and summarised by a script in the repo.
- Q: How should Back behave? → A: More than 3 s into the phase, Back restarts it; otherwise it goes
  to the start of the previous phase (in the first phase, it restarts it).
- Q: What does the ongoing notification show? → A: Session title, current phase, and a live
  countdown of time left in the phase (elapsed time for untimed phases), run by the system.

## User Scenarios & Testing *(mandatory)*

The people using this feature directly are (a) someone running a session with the phone in a
pocket or on a table, and (b) the developers of later modes, who describe a session as a list of
phases and decide which cue to give for each second. Until the modes exist, a built-in sample
session stands in for them.

### User Story 1 - Hear cues on time with the screen off (Priority: P1)

A user starts a session, locks the phone, and puts it away. For every phase they hear the cues the
session defines (spoken phrases, beeps, a final beep before the phase changes) exactly on the
second, and a completion chime at the end, without touching the phone.

**Why this priority**: This is the reason Cadence exists. Without on-time, screen-off cues no mode
is usable.

**Independent Test**: Start the sample session, lock the screen, and listen through to the end.
Each cue is heard on its second and the session ends with the completion cue. Engine timing is
also verified by automated tests on a simulated clock.

**Acceptance Scenarios**:

1. **Given** a session with timed phases, **When** the user starts it, **Then** the first phase's
   start cue plays immediately and every later cue plays at session start + its planned offset.
2. **Given** a running session, **When** the screen is locked or another app is brought to the
   front, **Then** cues continue on schedule until the session ends.
3. **Given** a timed phase is ending, **When** its last second arrives, **Then** the next phase
   begins exactly when the previous one's duration has elapsed, with no gap or overlap.
4. **Given** the last phase ends, **When** the session completes, **Then** the completion cue plays
   once and the session stops running in the background shortly afterwards.
5. **Given** a session lasting 60 minutes, **When** it runs to the end, **Then** the final cues are
   no later than the first cues were relative to their planned times (no cumulative drift).

---

### User Story 2 - Control a running session (Priority: P1)

While a session runs, the user can pause and resume it, skip to the next phase, go back (restart the
current phase, or go to the previous one if the current phase has only just started), or stop
it. An untimed phase (e.g. "Brush teeth") waits until the user moves on.

**Why this priority**: Every mode needs these controls, and untimed phases are essential for the
morning routine.

**Independent Test**: In the sample session, pause, wait, resume, skip, go back, and stop, checking
the cues and on-screen phase after each action. Fully covered by automated tests on a simulated
clock.

**Acceptance Scenarios**:

1. **Given** a running session, **When** the user pauses, **Then** cue playback stops immediately
   (including anything already scheduled or speaking) and the elapsed time freezes.
2. **Given** a paused session, **When** the user resumes after any length of time, **Then** the
   phase continues from where it was paused and the remaining cues keep their spacing.
3. **Given** a running or paused session, **When** the user skips, **Then** the next phase starts
   from its beginning with its start cue; skipping the last phase completes the session.
4. **Given** a running or paused session more than 3 seconds into a phase, **When** the user goes
   back, **Then** the current phase restarts from its beginning with its start cue.
5. **Given** a running or paused session 3 seconds or less into a phase after the first, **When**
   the user goes back, **Then** the previous phase restarts from its beginning; in the first
   phase, back restarts it.
6. **Given** an untimed phase, **When** time passes, **Then** the phase does not end by itself and
   its elapsed time keeps counting until the user skips.
7. **Given** a running or paused session, **When** the user stops, **Then** all cues stop, no
   completion cue plays, and the session ends.
8. **Given** a session is running, **When** the user starts another session, **Then** the first one
   is stopped before the second begins.

---

### User Story 3 - Keep listening to music (Priority: P2)

The user plays music or a podcast in another app, then starts a session. Each cue briefly lowers
the other audio, which returns to full volume afterwards. The other audio is never paused.

**Why this priority**: Most users run Cadence alongside their own audio (constitution Principle
II), but cues alone still deliver value without it.

**Independent Test**: Play music in another app, run the sample session, and confirm the music
dips for each cue, returns to full volume, and never pauses.

**Acceptance Scenarios**:

1. **Given** music is playing in another app, **When** a cue plays, **Then** the music volume dips
   during the cue and returns to normal within about a second after it.
2. **Given** music is playing, **When** a session starts, pauses, resumes, or stops, **Then** the
   music keeps playing throughout.
3. **Given** the phone is in silent/vibrate mode, **When** a cue is due, **Then** the cue is still
   heard through the media audio stream.

---

### User Story 4 - Know a session is running and keep it alive (Priority: P2)

While a session runs, an ongoing notification shows the session title and current phase, and
tapping it returns to the app. Before the first session the app asks for the permissions it needs
to stay alive, and the home screen offers the battery setting again for phones that still stop
the app.

**Why this priority**: The notification is required for background running on Android and tells
the user the app is active. The battery-optimisation exemption prevents known OEM kills.

**Independent Test**: Start the sample session on a fresh install, answer the permission prompts,
check the notification text through a phase change, and tap it to return to the app.

**Acceptance Scenarios**:

1. **Given** a running session, **When** the user pulls down the notification shade, **Then** an
   ongoing notification shows the session title, the current phase title, and a live countdown of
   time left in the phase (elapsed time for an untimed phase), and it cannot be swiped away while
   the session runs.
2. **Given** the session is paused, **When** the user views the notification, **Then** the timer
   is frozen at the paused value and the notification says the session is paused.
3. **Given** the session ends or is stopped, **When** it finishes, **Then** the notification is
   removed.
4. **Given** a fresh install on Android 13 or later, **When** the user starts the first session,
   **Then** the app asks for notification permission; if denied, the session still runs.
5. **Given** the user has never been asked, **When** they start their first session, **Then** the
   app asks once to be exempted from battery optimisation; it does not ask again on later sessions.
6. **Given** the home screen, **When** the user taps the "app stopping mid-session?" link, **Then**
   the battery-optimisation request or settings screen opens.

---

### User Story 5 - Find the modes and try a sample session (Priority: P3)

On launch the user sees the home screen listing Morning routine, Run / walk, and Breathe. Until a
mode ships it is shown as coming soon. A sample session entry lets the user (and developers) run a
short session that exercises every cue type and control.

**Why this priority**: Navigation shell and on-device verification path; the modes themselves come
in later specs.

**Independent Test**: Launch the app, see the three modes and the sample session, open the sample
session, and run it to completion.

**Acceptance Scenarios**:

1. **Given** the app is launched, **When** the home screen shows, **Then** it lists the three modes
   with a short description each, marked as coming soon until implemented.
2. **Given** the home screen, **When** the user opens the sample session, **Then** a session screen
   shows the current phase title, subtitle, time remaining (or elapsed, for untimed phases), and
   the controls from User Story 2.
3. **Given** the sample session, **When** it runs, **Then** it includes at least one timed phase,
   one untimed phase, spoken cues, beeps, a final beep before a phase change, and the completion
   chime.

---

### Edge Cases

- **App delayed or throttled**: if the app does not run for a while (e.g. the OS suspends it), on
  waking it works out the correct phase and second from the clock. It announces the start of the
  phase it is now in (only the current phase, not every phase it missed) and drops per-second cues
  more than 2 seconds late instead of playing them in a burst.
- **Device clock changed mid-session** (manual change or time-zone switch): the session's progress
  must not jump; elapsed time is measured with a clock that only moves forward.
- **Pause during a cue**: the cue in progress is cut off and any cue scheduled ahead is cancelled;
  on resume, cues due from that point are played again.
- **Skip or back during a cue**: queued speech from the old phase is dropped so the new phase's
  start cue is not delayed.
- **Long speech**: if a spoken phrase is still playing when the next cue is due, the session never
  falls behind; a cue flagged as interrupting cuts off the previous phrase.
- **Phone call or another app taking full audio focus**: the session's timing continues; cues
  that fall during the call are not replayed afterwards.
- **Empty session** (no phases): it cannot be started.
- **Zero-length or very short phases**: a phase of 1 second plays its start cue and ends one
  second later; a phase must be at least 1 second long or untimed.
- **Background service cannot start** (e.g. OS refuses): the session still runs while the app is
  open and the user is told cues may stop when the screen is off.
- **App killed by the OS mid-session**: when the user reopens the app, it offers to resume the
  interrupted session at the phase and second the clock says it has reached (as if it had never
  stopped), or to discard it. If the session would already have finished, the app instead says
  the session was interrupted and when. Time spent paused before the kill still counts as paused.
- **Device restarted mid-session**: the monotonic clock resets on reboot, so a session interrupted
  by a restart is treated as interrupted (discard or note only), never resumed at a guessed point.

## Requirements *(mandatory)*

### Functional Requirements

**Session model**

- **FR-001**: A session MUST be an ordered, non-empty list of phases. Each phase MUST have a title,
  an optional subtitle, and either a whole-second duration of at least 1 second or no duration
  (untimed).
- **FR-002**: The engine MUST give the mode a cue opportunity for every whole second of every phase,
  carrying the phase, its position, seconds elapsed, seconds remaining (timed phases only), the
  neighbouring phases, and the exact time that second is due.
- **FR-003**: The mode MUST decide which cue (if any) to give for each second: a spoken phrase, a
  beep, a final beep, or nothing. The engine MUST also signal session completion so the
  completion chime can play at the exact end time.

**Timing**

- **FR-004**: Cue times MUST be computed from a monotonic clock as session start + planned offset,
  adjusted for time spent paused. Accumulated timer ticks MUST NOT be used (Principle I).
- **FR-005**: Cues MUST be delivered early enough that, after the device's output latency, they
  are heard on their due second. Speech latency MUST be learned from the device at runtime rather
  than fixed.
- **FR-006**: Timed phases MUST advance by their exact duration, so a late wake-up never shifts
  the schedule of later phases.
- **FR-007**: After a delay, the engine MUST catch up from the clock as described in Edge Cases:
  announce the current phase's start, drop per-second cues more than 2 seconds late.
- **FR-008**: The engine MUST accept its clock as an input so its behaviour can be verified on a
  simulated clock.

**Controls**

- **FR-009**: Users MUST be able to start, pause, resume, skip to next, go back, and stop, with the
  behaviour in User Story 2.
- **FR-010**: Pausing, skipping, going back, and stopping MUST cancel any cue already scheduled or
  speaking.
- **FR-011**: Only one session MAY run at a time; starting a new one MUST stop the current one.
- **FR-012**: The app MUST expose the session's live state (status, current phase, phase elapsed,
  total elapsed) to screens, updating at least every 250 ms while running.

**Background and audio**

- **FR-013**: On Android, a running session MUST run in a foreground service with an ongoing
  notification showing the session title, current phase, and a live countdown of time left in the
  phase (elapsed for untimed phases). The countdown MUST be kept by the system's notification
  timer rather than by updating the notification every second; the notification MUST be updated
  only on phase changes, pause, resume, skip, and back. Paused sessions MUST show a frozen timer
  and a paused label. The notification MUST be removed when the session ends, and tapping it MUST
  open the app.
- **FR-014**: The background service MUST stay up long enough after the last phase for the
  completion cue to finish playing.
- **FR-015**: Cue audio MUST request transient, ducking audio focus, release it after each cue,
  play in silent mode, and never pause or stop other apps' audio (Principle II).
- **FR-016**: The app MUST ask for notification permission on Android 13+ before the first session
  and MUST run the session even if it is denied.
- **FR-017**: The app MUST ask once, before the first session, to be exempted from battery
  optimisation, remember that it asked, and offer the request again from the home screen.
- **FR-018**: Platform-specific background and audio behaviour MUST sit behind an interface so an
  iOS implementation can be added later without changing the engine or screens (Principle IV).

**Shell and assets**

- **FR-019**: The home screen MUST list Morning routine, Run / walk, and Breathe (marked coming soon
  until implemented) and a sample session entry.
- **FR-020**: The app MUST bundle three short cue sounds: beep, final beep, and completion chime,
  generated reproducibly from a script in the repository.
- **FR-021**: The sample session screen MUST show the current phase title, subtitle, time remaining
  or elapsed, and all controls, and the sample session MUST exercise every cue type and an untimed
  phase.
- **FR-021a**: Each session MUST declare whether the screen stays on while its session screen is
  open and in the foreground. When set, the screen MUST NOT time out until the session ends or the
  user leaves the screen; when not set, the phone's normal timeout applies. The sample session
  keeps the screen on. Cues run regardless of this setting.
- **FR-022**: The app MUST work fully offline and collect no data (Principle III).

**Timing diagnostics**

- **FR-022a**: For every cue played, the app MUST write one line to the device's system log with
  the cue type, planned time, and actual start time as reported by the platform (playback start
  for sounds, speech-start callback for spoken cues), in all build types. The log MUST contain no
  user content beyond phase titles and MUST NOT leave the device (Principle III).
- **FR-022b**: The repository MUST include a script that reads a captured log and reports, per cue
  type, the 50th/95th-percentile timing error and the error trend over the session (first vs last
  5 minutes), so SC-001 and SC-002 can be checked.

**Recovery after an OS kill**

- **FR-023**: While a session is running or paused, the app MUST keep an on-device record of it
  (session definition, start time, pause history, current status), updated on every start, pause,
  resume, skip, back, and phase change, and cleared when the session completes or is stopped.
- **FR-024**: On launch, if such a record exists and the session would still be in progress, the
  app MUST offer Resume or Discard. Resume MUST continue at the position computed from the clock,
  with the background service, notification, and cues restored; the current phase's start cue
  MUST be announced.
- **FR-025**: If the session would already have finished, or the device has restarted since the
  record was written, the app MUST NOT resume; it MUST tell the user the session was interrupted
  (session title and time) and clear the record.
- **FR-026**: A session MUST be describable as plain data (mode, title, phases, mode settings) so it
  can be rebuilt with the same cues after a relaunch.

### Key Entities

- **Phase**: one step of a session. Title, optional subtitle, duration in seconds or untimed, and a
  kind label the mode can use to choose cues.
- **Session**: an ordered list of phases plus a title shown in the notification and the mode that
  owns it, and whether it keeps the screen on. Has a status: idle, running, paused, done, or stopped.
- **Session record**: the saved copy of a running or paused session used to recover after an OS
  kill: session definition, start time, pause history, status, and when it was last written.
- **Cue opportunity**: the per-second event given to the mode: phase, index, second, remaining,
  neighbours, due time.
- **Session state**: the live snapshot screens display: status, current phase, phase elapsed,
  total elapsed.
- **Cue sound**: one of beep, final beep, completion chime, or a spoken phrase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the reference Android test device, with the screen off, as measured by the
  timing log and script (FR-022a/b), beeps start within 150 ms and spoken cues begin within
  300 ms of their due second for 95% of cues.
- **SC-002**: Over a 60-minute session, timing error does not grow: the last 5 minutes' cues are as
  accurate as the first 5 minutes' (within the SC-001 bounds).
- **SC-003**: With the battery exemption granted, a 60-minute screen-off session on the reference
  device completes without the app being stopped, in 3 consecutive runs.
- **SC-004**: Music playing in another app is never paused during a session, in every on-device
  test run.
- **SC-005**: Pause, resume, skip, back, and stop take effect, including silencing current audio,
  within 300 ms of the tap.
- **SC-006**: Every timing and control rule in this spec (FR-002 – FR-011) is covered by an
  automated test on a simulated clock, written before the code it covers (Principle VII).
- **SC-007**: A new user can find and complete the sample session from launch with no instructions.
- **SC-008**: After the app is force-stopped mid-session and reopened, the user can resume within
  2 taps, and the resumed phase and second match the clock (within 1 second).

## Assumptions

- Phase durations are whole seconds; sub-second cue timing (e.g. breathing at fractional rates) is
  not needed in this spec.
- Spoken cues use the device's built-in text-to-speech engine in English; other languages are on
  the long-term roadmap.
- The reference test device is an older Android phone from an OEM known for aggressive background
  killing; passing there is taken as a good proxy for other devices.
- Notification controls (pause/skip from the notification) and a custom native service come in
  spec 006; this spec uses an existing background-task library.
- iOS must build and show the screens but need not keep sessions running in the background until
  spec 008.
- Automated end-to-end tests (screen-off flow) and CI come in spec 005; this spec sets up unit and
  component tests and lists on-device test steps.
- The sample session stays in the app after the modes ship, as a developer/diagnostic entry; it
  can be hidden later if it confuses users.
