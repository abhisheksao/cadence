import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

import { type Clock, systemClock } from '@/engine/clock';
import type { Cue } from '@/engine/types';
import { audioFocus, audioInterruptionMode, vibrate as platformVibrate, type AudioFocus } from '@/platform/audio';

import { BEEP_LATENCY_MS, TtsLatency, startDelay } from './latency';
import { formatCueLog, formatSkipLog } from './timingLog';
import type { CuePlayer } from './types';

type SoundCue = 'beep' | 'beepLast' | 'chime';

/** Below this, a timer isn't worth it: play now. */
const MIN_DELAY_MS = 5;
/** Keep ducking this long after a phrase or sound, so cues close together share one dip (FR-020). */
const HOLD_AFTER_CUE_MS = 1_000;

/**
 * Plays cues on time with expo-audio (sounds) and expo-speech (phrases). Cues arrive up to 1 s
 * early with the moment they are due; each is started early by its output latency so it is
 * heard on the second.
 *
 * Requests transient ducking audio focus before each cue and abandons it 1 s after playback
 * completes (FR-020). When focus is refused (e.g. during a phone call), cues are skipped
 * and logged; phase start cues produce a short vibration (FR-021).
 */
export function createCuePlayer({
  log = (line: string) => console.info(line),
  clock = systemClock,
  focus = audioFocus,
  vibrate = platformVibrate,
  interruptionMode = audioInterruptionMode,
}: {
  log?: (line: string) => void;
  clock?: Clock;
  focus?: AudioFocus;
  vibrate?: (ms: number) => void;
  interruptionMode?: 'duckOthers' | 'mixWithOthers';
} = {}): CuePlayer {
  const sounds = new Map<SoundCue, AudioPlayer>();
  /** Per sound, the cue waiting for its playback-start event, for the timing log. */
  const awaitingStart = new Map<SoundCue, { planned: number; phase: number }>();
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const tts = new TtsLatency();
  let ready: Promise<void> | null = null;
  /** Utterances sent and not yet finished. */
  let queued = 0;
  /** Bumped when speech is flushed, so callbacks from flushed utterances are ignored. */
  let generation = 0;

  let focusHeld = false;
  let holdRelease: ReturnType<typeof setTimeout> | null = null;

  focus.onLoss(() => {
    focusHeld = false;
    if (holdRelease) {
      clearTimeout(holdRelease);
      holdRelease = null;
    }
    Speech.stop();
    queued = 0;
    generation += 1;
    sounds.forEach((player) => player.pause());
    awaitingStart.clear();
  });

  function acquireFocus(cueType: Cue['type'], planned: number, phase: number, phaseStart: boolean): boolean {
    if (holdRelease) {
      clearTimeout(holdRelease);
      holdRelease = null;
    }
    if (focusHeld) return true;

    const granted = focus.request();
    if (granted) {
      focusHeld = true;
      return true;
    }

    log(formatSkipLog({ type: cueType, planned, reason: 'focus', phase }));
    if (phaseStart) {
      vibrate(200);
    }
    return false;
  }

  function releaseFocus() {
    if (holdRelease) clearTimeout(holdRelease);
    holdRelease = null;
    if (focusHeld) {
      focusHeld = false;
      focus.abandon();
    }
  }

  function releaseFocusSoon() {
    if (holdRelease) clearTimeout(holdRelease);
    holdRelease = setTimeout(() => {
      if (queued === 0) {
        releaseFocus();
      }
    }, HOLD_AFTER_CUE_MS);
  }

  function schedule(at: number, latencyMs: number, fn: () => void) {
    const delay = startDelay(at, clock.now(), latencyMs);
    if (delay <= MIN_DELAY_MS) return fn();
    const timer = setTimeout(() => {
      pending.delete(timer);
      fn();
    }, delay);
    pending.add(timer);
  }

  function playSound(type: SoundCue, planned: number, phase: number, phaseStart: boolean) {
    if (!acquireFocus(type, planned, phase, phaseStart)) return;
    const player = sounds.get(type);
    if (!player) return;
    awaitingStart.set(type, { planned, phase });
    player.seekTo(0);
    player.play();
    releaseFocusSoon();
  }

  function speak(text: string, interrupt: boolean, planned: number, phase: number, phaseStart: boolean) {
    if (!acquireFocus('say', planned, phase, phaseStart)) return;
    if (interrupt) {
      Speech.stop();
      queued = 0;
      generation += 1;
    }
    const wasQueued = queued > 0;
    const sentAt = clock.now();
    const gen = generation;
    const settle = () => {
      if (gen !== generation) return;
      queued = Math.max(0, queued - 1);
      if (queued === 0) releaseFocusSoon();
    };
    queued += 1;
    Speech.speak(text, {
      language: 'en-US',
      rate: 1.05,
      onStart: () => {
        const now = clock.now();
        tts.sample(now - sentAt, wasQueued);
        log(formatCueLog({ type: 'say', planned, actual: now, phase }));
      },
      onDone: settle,
      onStopped: settle,
      onError: settle,
    });
  }

  return {
    init() {
      ready ??= (async () => {
        await setAudioModeAsync({
          interruptionMode,
          shouldPlayInBackground: true,
          playsInSilentMode: true,
        });
        const sources: [SoundCue, number][] = [
          ['beep', require('../../assets/sounds/beep.wav')],
          ['beepLast', require('../../assets/sounds/beep-last.wav')],
          ['chime', require('../../assets/sounds/chime.wav')],
        ];
        for (const [type, source] of sources) {
          const player = createAudioPlayer(source);
          player.addListener('playbackStatusUpdate', (status) => {
            const waiting = awaitingStart.get(type);
            if (!status.playing || !waiting) return;
            awaitingStart.delete(type);
            log(formatCueLog({ type, planned: waiting.planned, actual: clock.now(), phase: waiting.phase }));
          });
          sounds.set(type, player);
        }
        // Binds the TTS engine up front so the first cue of a session isn't dropped.
        await Speech.getAvailableVoicesAsync().catch(() => []);
      })();
      return ready;
    },

    play(cue: Cue, at: number, phase = -1, phaseStart = false) {
      if (cue.type === 'say') {
        schedule(at, tts.value, () => speak(cue.text, cue.interrupt ?? false, at, phase, phaseStart));
      } else {
        const type = cue.type;
        schedule(at, BEEP_LATENCY_MS, () => playSound(type, at, phase, phaseStart));
      }
    },

    silence() {
      pending.forEach(clearTimeout);
      pending.clear();
      awaitingStart.clear();
      queued = 0;
      generation += 1;
      Speech.stop();
      sounds.forEach((player) => player.pause());
      releaseFocus();
    },
  };
}
