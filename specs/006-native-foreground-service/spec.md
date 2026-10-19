# Feature Specification: Native Foreground Service

**Feature Branch**: `006-native-foreground-service`

**Created**: 2026-10-17

**Status**: Implemented (device checks in progress)

**Input**: User description: "Native foreground service (spec 006). Replace react-native-background-actions with a custom Kotlin Expo Module (local module under modules/, configured via config plugin, no hand edits to android/) that keeps a Cadence session (routine, run/walk, breathe) running with the screen off as an Android mediaPlayback foreground service, behind the existing BackgroundHost interface (src/platform/background.ts). Scope: (1) ongoing notification with live phase name and a system-run countdown to the end of the current phase (Chronometer, no per-second JS updates), plus Pause/Resume and Skip action buttons that control the session even when the app UI is not visible, and tap-to-open the session screen; (2) a sleep-inclusive clock (SystemClock.elapsedRealtime) exposed to JS so the engine is immune to manual wall-clock changes while still correct across deep sleep (fixes the "device clock changed" edge case from 001); (3) native audio focus: request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK directly around cues and expose whether it was granted, so speech is skipped when a phone call is already in progress (fixes 001 D11 limitation) and the looping silent-clip ducking workaround can be dropped; (4) partial wake lock held only while a session runs; (5) clean stop on session end, on swipe-away/task removal, and if the JS side dies. Keep existing permissions (no new ones), keep battery-exemption and notification-permission flow, keep ducking-never-pausing music (Principle II), Android-first with iOS no-op unchanged. Remove the react-native-background-actions dependency and plugins/withBackgroundActions. Out of scope: native TTS wrapper, iOS Live Activities (spec 008), workout DSL (007)."

## Overview

Spec 001 keeps sessions running with the screen off through a third-party background library.
That library was enough to prove the cue engine, but it left four known gaps that spec 001
explicitly deferred to this spec:

1. The ongoing notification shows only the session title and current phase. It cannot show a
   live countdown, and it has no buttons, so pausing or skipping means unlocking the phone and
   opening the app.
2. The only sleep-proof time source available to the app is the wall clock, so a forward manual
   clock change mid-session cannot be told apart from the phone sleeping, and the session jumps.
3. Speech does not request audio focus itself. Ducking works through a looping silent clip, and a
   phrase that starts while a phone call is already in progress may be heard over the call.
4. The app depends on an extra library for something the platform already provides, and that
   library's lifecycle (what happens on swipe-away, or if the app's script side dies) is not
   under the app's control.

This spec replaces the library with Cadence's own background service. Every mode (morning
routine, run/walk, breathe) benefits without change to the modes themselves: what the user sees
in the app, the cues, the timing guarantees, and session recovery stay as specified in 001–004.

## Clarifications

### Session 2026-10-17

- Q: Which buttons does the notification show? → A: Pause/Resume and Skip only. Stop and Back
  stay in the app so an accidental tap in a pocket cannot end a session.
- Q: What happens when the user swipes Cadence away from recent apps mid-session? → A: The
  session stops as if the user pressed Stop; no resume prompt on next launch. (First answered
  "keep running"; changed after planning found that keeping speech alive after a swipe-away
  needs a native speech engine, which is out of scope.)
- Q: What does the notification count down to? → A: The end of the current phase only; no
  session-total time or progress bar in the notification.
- Q: What happens to a cue whose audio focus is refused (e.g. during a call)? → A: The sound is
  skipped; a phase-start cue is replaced by one short vibration. Other skipped cues (per-second
  counts, warnings, beeps) are silent and still.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same screen-off reliability, own service (Priority: P1) 🎯 MVP

A user starts any session (routine, run/walk, or breathe), locks the phone, and puts it in a
pocket with music playing. The session keeps running and every cue plays on time, exactly as
today. An ongoing notification shows the session title and current phase, and tapping it opens
the app on that session's screen. When the session ends or is stopped, the notification goes
away and the phone is free to sleep normally. The app no longer ships the third-party background
library.

**Why this priority**: Nothing else in this spec matters if the replacement is less reliable
than what it replaces. This story alone is a shippable swap with no user-visible regression.

**Independent Test**: Install a build with the library removed. Run the 001 screen-off checks
(sample session, 10-minute run/walk, a breathe session) with the screen locked and music
playing; confirm cue timing, ducking, the notification, tap-to-open, and that the notification
disappears at the end.

**Acceptance Scenarios**:

1. **Given** no session is running, **When** the user starts a session in any mode, **Then** an
   ongoing notification appears within 1 second showing the session title and current phase
   title, and the session keeps running with the screen off.
2. **Given** a running session with the screen off for 30 minutes, **When** the timing log is
   reviewed, **Then** cue timing meets the same targets as spec 001 (SC-001/SC-002 of 001).
3. **Given** a running session, **When** the user taps the notification body, **Then** the app
   opens on that session's live screen (not the home screen).
4. **Given** a running session, **When** it completes or the user stops it, **Then** the
   notification is removed within 1 second and the phone is no longer kept awake by Cadence.
5. **Given** the user denied notification permission (Android 13+), **When** they start a
   session, **Then** the session still runs with the screen off; only the notification is hidden
   (unchanged from 001 FR-016).
6. **Given** the OS refuses to start the background service, **When** the user starts a session,
   **Then** the session runs while the app is open and the user is told cues may stop when the
   screen is off (unchanged from 001).
7. **Given** a release build, **When** its merged manifest is inspected, **Then** it requests no
   permission that the 001 build did not already request.

---

### User Story 2 - Control the session from the notification (Priority: P2)

During a run, the user does not want to unlock the phone to pause at a traffic light or skip a
warm-up. They pull down the shade (or look at the lock screen) and see the current phase with a
countdown to its end ticking down on its own, plus Pause and Skip buttons. Tapping Pause pauses
the session exactly as the in-app button does; the button becomes Resume and the countdown
freezes. Tapping Skip moves to the next phase and the new phase's start cue plays.

**Why this priority**: The most requested convenience left over from 001, and the main visible
reason to own the service. It depends on Story 1's service existing.

**Independent Test**: Start a run/walk session, lock the phone, and use only the notification:
watch the countdown reach zero at the phase change, pause, wait 20 seconds, resume, skip a phase.
Then open the app and confirm its state matches.

**Acceptance Scenarios**:

1. **Given** a running timed phase, **When** the user views the notification, **Then** it shows a
   countdown to the end of the current phase that advances every second without the app doing
   per-second work, and reaches 0:00 within 1 second of the phase actually ending.
2. **Given** a running untimed phase (e.g. an untimed routine step), **When** the user views the
   notification, **Then** it shows the time elapsed in that step counting up instead of a
   countdown.
3. **Given** a running session, **When** the user taps Pause in the notification, **Then** the
   session pauses exactly as the in-app Pause does (cues stop, time stops), the notification shows
   a paused label with the countdown frozen at the remaining time, and the button becomes Resume.
4. **Given** a paused session, **When** the user taps Resume in the notification, **Then** the
   session resumes exactly as the in-app Resume does and the countdown continues from where it
   froze.
5. **Given** a running session that is not on its last phase, **When** the user taps Skip in the
   notification, **Then** the session moves to the next phase exactly as the in-app Skip does, and
   that phase's start cue plays.
6. **Given** the app is open on the session screen, **When** the user acts from the notification,
   **Then** the in-app screen reflects the change within 1 second; and when the user acts in the
   app, the notification reflects it within 1 second.
7. **Given** the phone is locked, **When** the user looks at the lock screen, **Then** the
   session notification and its buttons are visible and usable (subject to the user's own
   lock-screen notification settings).

---

### User Story 3 - Correct timing when the clock changes (Priority: P3)

A user is mid-session when the phone's clock changes: they adjust it by hand, travel across a
time zone, or the network corrects it. The session does not jump forward or back; it carries on
as if nothing happened. Sleep still counts: if the phone was in deep sleep, the session is where
real elapsed time says it should be.

**Why this priority**: Rare in practice, but it is a stated gap in the core timing guarantee
(Principle I), and it is cheap once the app has its own native service.

**Independent Test**: Start a 10-minute sample session, move the system clock forward 5 minutes
and later back 3 minutes; confirm the session position and cue times follow real elapsed time,
not the clock. Separately, leave the phone locked and idle for 15 minutes and confirm no drift.

**Acceptance Scenarios**:

1. **Given** a running session, **When** the device clock is moved forward by any amount,
   **Then** the session does not skip ahead; cue times stay within the 001 timing targets.
2. **Given** a running session, **When** the device clock is moved backward, **Then** the session
   does not repeat or stall (as in 001).
3. **Given** a running session with the screen off long enough for the phone to enter deep sleep,
   **When** it wakes for the next cue, **Then** the session position matches real elapsed time
   (no drift from sleep).
4. **Given** the app was killed mid-session and the phone was **not** restarted, **When** the user
   reopens it and resumes, **Then** the resume position follows real elapsed time, unaffected by
   any clock change in between.
5. **Given** the app was killed mid-session and the phone **was** restarted, **When** the user
   reopens it, **Then** recovery behaves as in 001 (wall clock with sanity checks).

---

### User Story 4 - Cues never talk over a phone call (Priority: P4)

A user is in a session when a call comes in, or answers a call and the session's next cue falls
during it. No Cadence sound (speech, beep, or chime) plays while the call holds the audio. When
the call ends, cues resume on schedule; cues that fell during the call are not replayed. Music
the user is listening to is still ducked during each cue and never paused.

**Why this priority**: Closes the 001 known limitation (a phrase starting during a call could be
heard). It also removes the silent-clip workaround, which simplifies the audio path. Lower
priority because it is an edge case the user can work around by pausing.

**Independent Test**: Run a sample session with music playing; place a call to the phone, answer
it for 30 seconds across several cue times, hang up. Confirm no cue was heard during the call,
cues resume afterwards, and music ducked (not paused) for each cue before and after.

**Acceptance Scenarios**:

1. **Given** music is playing in another app, **When** a cue plays, **Then** the music dips in
   volume for the cue and returns to full volume within about 1 second after the cue (unchanged
   behavior from 001, achieved without the silent clip).
2. **Given** a phone call is already in progress, **When** a cue (speech, beep, or chime) comes
   due, **Then** it does not play, and it is not replayed after the call. If it was a phase-start
   cue, the phone vibrates once briefly instead; other cues are skipped with no vibration.
3. **Given** a phrase is playing, **When** a call starts, **Then** the phrase is cut off (as in
   001) and later cues are skipped until the call ends.
4. **Given** a call has ended, **When** the next cue comes due, **Then** it plays on time.
5. **Given** the user starts music in another app mid-session (which keeps audio focus for good),
   **When** the next cue comes due, **Then** the cue still plays, ducking that music (Cadence is
   never silenced for the rest of the session by a music app).

---

### Edge Cases

- **User swipes Cadence away from recent apps mid-session**: the session stops cleanly, as if the
  user had pressed Stop: the notification is removed, cues stop, the phone is no longer kept
  awake, and no interrupted-session prompt is shown on next launch.
- **The app's script side dies or reloads while the service is running** (crash, development
  reload): the service notices within 10 seconds, stops itself, and removes its notification; no
  orphan notification or wake lock is left behind. The saved session record is kept, so the next
  launch offers to resume as in 001.
- **The OS kills the whole app process** (e.g. an OEM battery cleaner): the service goes with it;
  recovery on next launch is unchanged from 001.
- **Notification button tapped after the session already ended** (stale notification, double
  tap): nothing happens and no error is shown.
- **Skip on the last phase** from the notification: behaves exactly as the in-app Skip on the
  last phase (ends the session as 001 specifies).
- **Rapid taps** on Pause/Resume: each tap is applied in order; the final state matches the last
  tap and the notification and app agree.
- **Very short phases** (e.g. 4-second breathe phases, 1-second phases): the countdown restarts at
  each phase change and never shows a negative or stale value.
- **Starting a second session while one runs**: the existing session is replaced, as in 001; only
  one service and one notification exist at any time.
- **Notification permission revoked mid-session**: the session continues; the notification and
  its buttons are simply not shown.
- **Audio focus refused for a reason other than a call** (e.g. another app holds exclusive
  focus): the cue is skipped (with the phase-start vibration), the same as during a call; the
  session timing is unaffected.
- **Phone rebooted mid-session**: the service does not restart on its own; recovery on next
  launch follows 001.

## Requirements *(mandatory)*

### Functional Requirements

**Background service (Story 1)**

- **FR-001**: The app MUST keep an active session running with the screen off using its own
  foreground service, declared as a media-playback service, for every mode (routine, run/walk,
  breathe), with the same timing and cue guarantees as spec 001.
- **FR-002**: The third-party background library and its config plugin MUST be removed. All
  native configuration MUST come from `app.json`, config plugins, or a local module
  (Principle V).
- **FR-003**: The service MUST be reached only through the existing platform-neutral background
  interface; shared code MUST NOT branch on platform, and the iOS implementation stays a no-op
  (Principle IV).
- **FR-004**: The service MUST keep the CPU awake only while a session is running or paused, and
  MUST release that hold within 1 second of the session ending, being stopped, or the service
  stopping for any reason.
- **FR-005**: Only one session service and notification MUST exist at any time.
- **FR-006**: The release build MUST request no permissions beyond those of the current release
  build; the notification-permission request and once-only battery-exemption prompt MUST work as
  in 001 (FR-016, FR-017).
- **FR-007**: If the OS refuses to start the service, the session MUST still run while the app is
  open and the user MUST be told cues may stop with the screen off (as in 001).

**Notification (Stories 1 and 2)**

- **FR-008**: While a session runs, an ongoing notification MUST show the session title, the
  current phase title, and a paused label while paused.
- **FR-009**: For a timed phase, the notification MUST show a countdown to the end of the phase,
  advanced by the system with no per-second updates from the app, and MUST be within 1 second of
  the session's own remaining time at each phase change. The notification MUST NOT show
  session-total time left or a session progress bar.
- **FR-010**: For an untimed phase, the notification MUST show time elapsed in the phase counting
  up.
- **FR-011**: While paused, the countdown (or count-up) MUST be frozen at the value at the moment
  of pausing.
- **FR-012**: The notification MUST offer a Pause button while running and a Resume button while
  paused, and a Skip button, and no other buttons (Stop and Back stay in the app). Each MUST have exactly the effect of the corresponding in-app control
  (same cues, same state, same saved session record), whether or not the app's screen is open.
- **FR-013**: Tapping the notification body MUST open the app on the live screen of the running
  session's mode.
- **FR-014**: The notification and the in-app screen MUST agree within 1 second after any control
  is used from either place.
- **FR-015**: The notification MUST be visible on the lock screen with its buttons, subject to the
  user's own lock-screen notification settings.
- **FR-016**: A notification button that refers to a session that no longer exists MUST do
  nothing.

**Clock (Story 3)**

- **FR-017**: While the app is running, session timing MUST use a clock that keeps counting
  through deep sleep and is not affected by changes to the device's date, time, or time zone.
  The engine MUST still take its clock as an injected input so it can be tested on a simulated
  clock (Principle I, 001 FR-008).
- **FR-018**: The saved session record MUST hold enough to resume by that same clock after the
  app is killed without a phone restart, and MUST fall back to the 001 wall-clock recovery with
  sanity checks after a restart.
- **FR-019**: The 001 "Device clock changed mid-session" edge case MUST be updated: forward and
  backward clock changes are both ignored.

**Audio focus (Story 4)**

- **FR-020**: Before each cue sound (speech, beep, or chime), the app MUST request transient,
  ducking audio focus itself and MUST release it within about 1 second after the last of a group
  of close cues, so other audio returns to full volume (Principle II). It MUST NOT request focus
  that pauses other apps' audio.
- **FR-021**: If the focus request is refused (e.g. a call is in progress), the cue MUST NOT play
  and MUST NOT be replayed later; session timing MUST continue unaffected. If the skipped cue is
  a phase-start cue, the phone MUST vibrate once briefly (under 0.5 s) in its place; other
  skipped cues MUST produce no vibration.
- **FR-022**: If focus is lost while a cue is playing, the cue MUST be cut off, and later cues
  MUST be skipped until focus can be obtained again.
- **FR-023**: The looping silent-clip workaround from 001 MUST be removed.
- **FR-024**: A music app that takes and keeps focus MUST NOT silence Cadence for the rest of the
  session: Cadence's next request ducks it as normal.

**Lifecycle (edge cases)**

- **FR-025**: When the user removes Cadence from recent apps during a session, the session MUST
  stop as if the user pressed Stop (notification removed, cues stopped, wake hold released, no
  resume prompt on next launch).
- **FR-026**: If the app's script side stops responding to the service for more than 10 seconds,
  the service MUST stop itself and remove its notification, keeping the saved session record so
  the next launch can offer to resume.
- **FR-027**: The timing log (001 FR-022a) MUST keep its format so existing reports keep working,
  and MUST record cues skipped because focus was refused.

**Testing (Principle VII)**

- **FR-028**: Every behavior here that can run off-device (clock selection, recovery choice,
  focus-refused skipping, notification state derived from session state, button actions mapped
  to controller calls) MUST be covered by automated tests written before the code.
- **FR-029**: Behavior that needs a device (screen off, notification countdown and buttons, lock
  screen, phone call, swipe-away, clock change, release manifest) MUST have its on-device steps
  written in the feature's tasks before implementation and run before the PR is merged.

### Key Entities

- **Service state**: what the notification shows at any moment: session title, phase title,
  whether the phase is timed, when the current phase ends (or started, if untimed) on the
  sleep-proof clock, running or paused, and which buttons apply. Derived from the session; never
  the source of truth.
- **Session control action**: a request coming from the notification (pause, resume, skip,
  open), tagged with the session it belongs to so stale actions can be ignored.
- **Saved session record** (from 001): extended with the sleep-proof clock reading and a way to
  tell whether the phone has restarted since it was saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cue timing with the screen off is no worse than with the 001 implementation:
  same p50/p95 targets from the timing report over a 30-minute screen-off session.
- **SC-002**: The user can pause, resume, and skip a session from the lock screen without
  unlocking the phone, and each action takes effect within 1 second.
- **SC-003**: The notification's countdown is within 1 second of the real phase end at every
  phase change over a 30-minute session, with no per-second work by the app.
- **SC-004**: Moving the device clock forward or backward by up to 1 hour mid-session shifts no
  cue by more than the 001 timing tolerance.
- **SC-005**: Across a 10-minute session with a 30-second phone call spanning at least 3 cue
  times, 0 Cadence sounds are heard during the call, each phase start during the call produces
  exactly one short vibration, and music is ducked (never paused) for every cue outside it.
- **SC-006**: After a session ends, is stopped, or the app is swiped away, no Cadence
  notification remains and Cadence holds no wake lock within 1 second (10 seconds if the script
  side died).
- **SC-007**: The release build's permission list is identical to the current release build's.
- **SC-008**: The app has one fewer third-party native dependency.

## Assumptions

- Target platform is Android only; minimum Android version is whatever the current Expo SDK
  supports (the test phone runs Android 9). iOS keeps its no-op background host until spec 008.
- Swiping the app away stops the session (clarified).
- The phase-start vibration (FR-021) uses the vibrate permission the app already has, so FR-006
  (no new permissions) still holds. It ignores the phone's vibrate setting only as far as the OS
  allows; a phone set to "no vibration" may stay still.
- Lock-screen notification shows the session and phase titles in full; they are not considered
  sensitive.
- Speech itself is still produced by the existing text-to-speech path; only focus handling
  moves. A native speech wrapper is out of scope.
- The 10-second script-side timeout and 1-second focus hold are starting values and may be tuned
  on device in the plan.
- The constitution's "wall-clock timestamps" (Principle I) is read as "real elapsed time, not
  summed ticks"; a sleep-inclusive monotonic clock satisfies it better than the wall clock. The
  plan should record this reading in its Constitution Check.
- Out of scope: native text-to-speech, iOS Live Activities (008), workout text format and deep
  links (007), media-session/lock-screen media controls (they would need focus that pauses
  music).
