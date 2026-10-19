import * as Speech from 'expo-speech';

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

/** The looping silent clip is the fourth player created in init(). */
const HOLD = 3;

describe('cue player: ducking', () => {
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

  const lastSpeech = () => speech.speak.mock.calls[speech.speak.mock.calls.length - 1][1] as Speech.SpeechOptions;

  it('asks for ducking audio focus, background playback and silent-mode playback', async () => {
    const { setAudioModeAsync } = jest.requireMock('expo-audio') as { setAudioModeAsync: jest.Mock };
    await ready();
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    });
    expect(mockPlayers[HOLD].loop).toBe(true);
  });

  it('holds focus with the silent clip from just before speech until 1 s after it', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Get ready' }, 10_000, 0);

    expect(mockPlayers[HOLD].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[HOLD].play.mock.invocationCallOrder[0]).toBeLessThan(
      speech.speak.mock.invocationCallOrder[0],
    );

    lastSpeech().onDone?.();
    jest.advanceTimersByTime(999);
    expect(mockPlayers[HOLD].pause).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockPlayers[HOLD].pause).toHaveBeenCalledTimes(1);
  });

  it.each(['onStopped', 'onError'] as const)('releases the hold after %s too', async (callback) => {
    const player = await ready();
    player.play({ type: 'say', text: 'Halfway' }, 10_000, 0);
    (lastSpeech()[callback] as () => void)();
    jest.advanceTimersByTime(1_000);
    expect(mockPlayers[HOLD].pause).toHaveBeenCalledTimes(1);
  });

  it('keeps one hold across phrases less than 1 s apart', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'One' }, 10_000, 0);
    lastSpeech().onDone?.();
    jest.advanceTimersByTime(600);
    player.play({ type: 'say', text: 'Two' }, Date.now(), 0);
    jest.advanceTimersByTime(600);
    expect(mockPlayers[HOLD].pause).not.toHaveBeenCalled();

    lastSpeech().onDone?.();
    jest.advanceTimersByTime(1_000);
    expect(mockPlayers[HOLD].pause).toHaveBeenCalledTimes(1);
  });

  it('silence() releases the hold at once', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Get ready' }, 10_000, 0);
    player.silence();
    expect(mockPlayers[HOLD].pause).toHaveBeenCalled();
  });

  it('stops speech when another app takes focus mid-phrase, and skips speech until focus returns', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Interval' }, 10_000, 0);
    mockPlayers[HOLD].emit({ playing: true });
    speech.stop.mockClear();

    mockPlayers[HOLD].emit({ playing: false }); // e.g. a phone call took focus
    expect(speech.stop).toHaveBeenCalledTimes(1);

    speech.speak.mockClear();
    player.play({ type: 'say', text: 'Halfway' }, Date.now(), 0);
    expect(speech.speak).not.toHaveBeenCalled();

    mockPlayers[HOLD].emit({ playing: true }); // expo-audio resumed it itself: focus is back
    expect(mockPlayers[HOLD].pause).toHaveBeenCalled();

    player.play({ type: 'say', text: 'Cool down' }, Date.now(), 0);
    expect(speech.speak).toHaveBeenCalledWith('Cool down', expect.any(Object));
  });

  it('speaks again after 15 s if focus never comes back (another app took it for good)', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Interval' }, 10_000, 0);
    mockPlayers[HOLD].emit({ playing: true });
    mockPlayers[HOLD].emit({ playing: false }); // e.g. the user pressed play in a music app
    speech.speak.mockClear();

    jest.advanceTimersByTime(14_000);
    player.play({ type: 'say', text: 'Still lost' }, Date.now(), 0);
    expect(speech.speak).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    player.play({ type: 'say', text: 'Cool down' }, Date.now(), 0);
    expect(speech.speak).toHaveBeenCalledWith('Cool down', expect.any(Object));
  });

  it('does not treat the late status of its own pause as lost focus after Skip or Back mid-phrase', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'Halfway' }, 10_000, 0);
    mockPlayers[HOLD].emit({ playing: true });

    // Skip: the session silences, then plays the next phase's start cue straight away.
    player.silence();
    player.play({ type: 'say', text: 'Cool down', interrupt: true }, Date.now(), 1);
    speech.stop.mockClear();
    speech.speak.mockClear();
    mockPlayers[HOLD].emit({ playing: false }); // the pause from silence() reports late
    mockPlayers[HOLD].emit({ playing: true }); // then the new play() starts

    expect(speech.stop).not.toHaveBeenCalled();
    player.play({ type: 'say', text: '10 seconds' }, Date.now(), 1);
    expect(speech.speak).toHaveBeenCalledWith('10 seconds', expect.any(Object));
  });

  it('does not treat its own pause as lost focus', async () => {
    const player = await ready();
    player.play({ type: 'say', text: 'One' }, 10_000, 0);
    mockPlayers[HOLD].emit({ playing: true });
    lastSpeech().onDone?.();
    jest.advanceTimersByTime(1_000);
    mockPlayers[HOLD].emit({ playing: false });

    speech.speak.mockClear();
    player.play({ type: 'say', text: 'Two' }, Date.now(), 0);
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });
});
