# ADR 0002: Duck music during speech with a silent clip

- **Status:** Accepted (spec 001, research R3)
- **Date:** 2026-10-13

## Context

Cadence must never pause the user's music. Other audio should dip while a cue plays and come back
afterwards (Principle II, FR-015). On Android that means asking for transient, duckable audio focus
(`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`) for each cue and giving it up afterwards.

- `expo-audio` with `interruptionMode: 'duckOthers'` does this for its own players: it requests
  duckable focus when a player starts and abandons it when none is playing. Beeps and the chime are
  `expo-audio` players, so they duck correctly.
- `expo-speech` requests **no** audio focus and has no ducking option. Spoken cues would play on
  top of the music at full volume.

## Decision

While speech plays, the cue player also plays a looping **silent clip** (`silence.wav`) through
`expo-audio`. The clip starts just before `Speech.speak` and stops after `onDone`, `onStopped`, or
`onError`, plus a 1 s hold window. Holding that player holds the ducking focus, so the music dips
for the phrase. Phrases close together share one dip.

The same clip detects phone calls. When another app takes focus, `expo-audio` pauses the clip on
its own. The player then stops speech and skips later phrases until the clip resumes (the call is
over), or for at most 15 s, after which it assumes another app has taken focus for good.

## Consequences

- Music ducks for both sounds and speech, and is never paused.
- A phrase that **starts** while a call is already in progress cannot be detected, because
  `play()` succeeds even when focus is refused. It may be heard. This is documented as a known
  limitation.
- Two cues close together may make the music dip twice. The hold window reduces this. It is tuned
  on a device.
- Spec 006's native service can request focus directly, check the result, and remove the silent
  clip.

## Alternatives considered

- `interruptionMode: 'doNotMix'`: takes full focus and pauses music, which breaks Principle II.
- `mixWithOthers`: requests no focus, so music is never ducked.
- A native TTS wrapper that requests focus itself: native work that belongs in spec 006.
