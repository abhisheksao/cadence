import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

import type { Cue } from '@/engine/types';

import { BEEP_LATENCY_MS, TtsLatency, startDelay } from './latency';
import { formatCueLog } from './timingLog';
import type { CuePlayer } from './types';

type SoundCue = 'beep' | 'beepLast' | 'chime';

/** Below this, a timer isn't worth it: play now. */
const MIN_DELAY_MS = 5;

/**
 * Plays cues on time with expo-audio (sounds) and expo-speech (phrases). Cues arrive up to 1 s
 * early with the moment they are due; each is started early by its output latency so it is
 * heard on the second (research R4).
 */
export function createCuePlayer({ log = (line: string) => console.info(line) } = {}): CuePlayer {
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

  function schedule(at: number, latencyMs: number, fn: () => void) {
    const delay = startDelay(at, Date.now(), latencyMs);
    if (delay <= MIN_DELAY_MS) return fn();
    const timer = setTimeout(() => {
      pending.delete(timer);
      fn();
    }, delay);
    pending.add(timer);
  }

  function playSound(type: SoundCue, planned: number, phase: number) {
    const player = sounds.get(type);
    if (!player) return;
    awaitingStart.set(type, { planned, phase });
    player.seekTo(0);
    player.play();
  }

  function speak(text: string, interrupt: boolean, planned: number, phase: number) {
    if (interrupt) {
      Speech.stop();
      queued = 0;
      generation += 1;
    }
    const wasQueued = queued > 0;
    const sentAt = Date.now();
    const gen = generation;
    const settle = () => {
      if (gen === generation) queued = Math.max(0, queued - 1);
    };
    queued += 1;
    Speech.speak(text, {
      language: 'en-US',
      rate: 1.05,
      onStart: () => {
        const now = Date.now();
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
        await setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true });
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
            log(formatCueLog({ type, planned: waiting.planned, actual: Date.now(), phase: waiting.phase }));
          });
          sounds.set(type, player);
        }
        // Binds the TTS engine up front so the first cue of a session isn't dropped.
        await Speech.getAvailableVoicesAsync().catch(() => []);
      })();
      return ready;
    },

    play(cue: Cue, at: number, phase = -1) {
      if (cue.type === 'say') {
        schedule(at, tts.value, () => speak(cue.text, cue.interrupt ?? false, at, phase));
      } else {
        const type = cue.type;
        schedule(at, BEEP_LATENCY_MS, () => playSound(type, at, phase));
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
    },
  };
}
