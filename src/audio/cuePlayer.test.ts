import * as Speech from 'expo-speech';

import { FakeAudioFocus } from '@/test-utils/fakes';

import { createCuePlayer } from './cuePlayer';

type MockPlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  loop: boolean;
  emit: (status: { playing: boolean }) => void;
};

const mockPlayers: MockPlayer[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const listeners: ((s: { playing: boolean }) => void)[] = [];
    const player = {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      loop: false,
      addListener: jest.fn((_event: string, cb: (s: { playing: boolean }) => void) => {
        listeners.push(cb);
        return { remove: jest.fn() };
      }),
      emit: (status: { playing: boolean }) => listeners.forEach((cb) => cb(status)),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

const speech = jest.mocked(Speech);
/** Players are created in init() in this order. */
const BEEP = 0;

describe('cue player: scheduling', () => {
  let log: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    jest.clearAllMocks();
    mockPlayers.length = 0;
    log = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  async function ready() {
    const player = createCuePlayer({ log });
    await player.init();
    return player;
  }

  it('starts a beep 120 ms before it is due', async () => {
    const player = await ready();
    player.play({ type: 'beep' }, 11_000, 0);

    jest.advanceTimersByTime(879);
    expect(mockPlayers[BEEP].play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockPlayers[BEEP].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[BEEP].play).toHaveBeenCalledTimes(1);
  });

  it('plays immediately when the cue is already due', async () => {
    const player = await ready();
    player.play({ type: 'beep' }, 10_050, 0);
    expect(mockPlayers[BEEP].play).toHaveBeenCalledTimes(1);
  });

  it('starts speech early by the learned TTS latency (400 ms at first)', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Get ready' }, 11_000, 0);

    jest.advanceTimersByTime(599);
    expect(speech.speak).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(speech.speak).toHaveBeenCalledWith('Get ready', expect.any(Object));
  });

  it('stops queued speech before an interrupting phrase', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Next', interrupt: true }, 10_000, 1);

    expect(speech.stop).toHaveBeenCalledTimes(1);
    expect(speech.stop.mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
  });

  it('silence() cancels scheduled cues and stops speech', async () => {
    const player = await ready();
    player.play({ type: 'beep' }, 12_000, 0);
    player.play({ type: 'say', text: 'Later' }, 12_000, 0);
    player.silence();
    jest.advanceTimersByTime(5_000);

    expect(mockPlayers[BEEP].play).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
    expect(speech.stop).toHaveBeenCalled();
  });

  it('logs one timing line when a sound actually starts playing', async () => {
    const player = await ready();
    player.play({ type: 'beep' }, 11_000, 2);
    jest.advanceTimersByTime(880); // now 10_880
    jest.advanceTimersByTime(15); // playback reported 15 ms later
    mockPlayers[BEEP].emit({ playing: true });
    mockPlayers[BEEP].emit({ playing: true });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('CADENCE_CUE v=1 type=beep planned=11000 actual=10895 err=-105 phase=2');
  });

  it('logs one timing line when speech starts', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Halfway' }, 10_400, 3);
    const options = speech.speak.mock.calls[0][1] as Speech.SpeechOptions;
    jest.advanceTimersByTime(380);
    options.onStart?.();

    expect(log).toHaveBeenCalledWith('CADENCE_CUE v=1 type=say planned=10400 actual=10380 err=-20 phase=3');
  });

  it('CP1: uses the injected clock for start delays and timing log actual times', async () => {
    let clockTime = 50_000;
    const fakeClock = { now: () => clockTime };
    const player = createCuePlayer({ log, clock: fakeClock });
    await player.init();

    // Cue is planned for 51_000. Beep latency is 120 ms, so planned start is 50_880.
    // fakeClock is at 50_000, so delay is 880 ms regardless of system Date.now() (which is at 10_000).
    player.play({ type: 'beep' }, 51_000, 1);

    jest.advanceTimersByTime(879);
    expect(mockPlayers[BEEP].play).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockPlayers[BEEP].play).toHaveBeenCalledTimes(1);

    // When reporting playback, actual time should be clock.now()
    clockTime = 50_900;
    mockPlayers[BEEP].emit({ playing: true });
    expect(log).toHaveBeenCalledWith('CADENCE_CUE v=1 type=beep planned=51000 actual=50900 err=-100 phase=1');
  });
});

describe('cue player: focus and ducking (CP2–CP8)', () => {
  let log: jest.Mock;
  let focus: FakeAudioFocus;
  let vibrate: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    jest.clearAllMocks();
    mockPlayers.length = 0;
    log = jest.fn();
    focus = new FakeAudioFocus();
    vibrate = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  async function ready(interruptionMode?: 'duckOthers' | 'mixWithOthers') {
    const player = createCuePlayer({ log, focus, vibrate, interruptionMode });
    await player.init();
    return player;
  }

  const lastSpeech = () => speech.speak.mock.calls[speech.speak.mock.calls.length - 1][1] as Speech.SpeechOptions;

  it('CP2: requests focus before each cue unless focus is already held', async () => {
    const player = await ready();
    expect(focus.requestCalls).toBe(0);

    player.play({ type: 'beep' }, 10_000, 0);
    expect(focus.requestCalls).toBe(1);

    // Another cue immediately while focus is held does not re-request focus
    player.play({ type: 'beep' }, 10_050, 0);
    expect(focus.requestCalls).toBe(1);
  });

  it('CP3: refused focus → cue not played, not queued, CADENCE_SKIP line logged', async () => {
    const player = await ready();
    focus.shouldGrant = false;

    player.play({ type: 'beep' }, 10_000, 0);
    expect(mockPlayers[BEEP].play).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('CADENCE_SKIP v=1 type=beep planned=10000 reason=focus phase=0');

    player.play({ type: 'say', text: 'Hello' }, 10_000, 1);
    expect(speech.speak).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('CADENCE_SKIP v=1 type=say planned=10000 reason=focus phase=1');
  });

  it('CP4: refused focus + phaseStart → vibrate(200) once; refused without phaseStart → no vibration', async () => {
    const player = await ready();
    focus.shouldGrant = false;

    // Refused + phaseStart = true
    player.play({ type: 'say', text: 'Phase 2' }, 10_000, 2, true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(200);

    // Refused + phaseStart = false
    vibrate.mockClear();
    player.play({ type: 'beep' }, 11_000, 2, false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('CP5: abandons focus 1 s after speech/sounds end; cues within 1 s reuse the hold', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Run' }, 10_000, 0);
    expect(focus.requestCalls).toBe(1);

    lastSpeech().onDone?.();
    jest.advanceTimersByTime(500);
    expect(focus.abandonCalls).toBe(0);

    // Within 1 s window:
    player.play({ type: 'say', text: 'Faster' }, 10_500, 0);
    expect(focus.requestCalls).toBe(1); // reused hold

    lastSpeech().onDone?.();
    jest.advanceTimersByTime(999);
    expect(focus.abandonCalls).toBe(0);

    jest.advanceTimersByTime(1);
    expect(focus.abandonCalls).toBe(1); // abandoned 1 s later
  });

  it('CP6: onFocusLost cuts off current speech and sounds; next cue requests focus again', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Interval' }, 10_000, 0);
    expect(speech.speak).toHaveBeenCalled();

    focus.emitLoss();
    expect(speech.stop).toHaveBeenCalled();

    // Next cue requests focus again
    speech.speak.mockClear();
    player.play({ type: 'say', text: 'Next' }, 12_000, 0);
    expect(focus.requestCalls).toBe(2);
    expect(speech.speak).toHaveBeenCalledWith('Next', expect.any(Object));
  });

  it('CP7: granted focus after an earlier loss plays at once with no 15 s give-up timer', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'First' }, 10_000, 0);
    focus.emitLoss();

    // Focus is granted on the next request right away
    focus.shouldGrant = true;
    player.play({ type: 'say', text: 'Second' }, 10_100, 0);
    expect(speech.speak).toHaveBeenCalledWith('Second', expect.any(Object));
  });

  it('CP8: no silent clip created; Android init sets mixWithOthers', async () => {
    const { setAudioModeAsync } = jest.requireMock('expo-audio') as { setAudioModeAsync: jest.Mock };
    await ready('mixWithOthers');
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    });
    // Exactly 3 sound players created (beep, beepLast, chime), NO silent clip!
    expect(mockPlayers).toHaveLength(3);
  });
});
