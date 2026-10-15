import { useSyncExternalStore } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { routineDefinition } from '@/modes/routine';
import { runWalkDefinition } from '@/modes/runWalk';
import { defaultRoutine } from '@/routine/defaults';
import { defaultSettings } from '@/runWalk/settings';
import { RunWalkStore } from '@/runWalk/store';
import { useRunWalk } from '@/runWalk/useRunWalk';
import type { SessionState } from '@/session/controller';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';
import { MemoryStore } from '@/test-utils/fakes';

import RunWalkScreen from './RunWalkScreen';

jest.mock('@/session/useSession', () => ({ useSession: jest.fn() }));
jest.mock('@/session/useKeepScreenOn', () => ({ useKeepScreenOn: jest.fn() }));
jest.mock('@/runWalk/useRunWalk', () => ({ useRunWalk: jest.fn() }));

const settings = defaultSettings();
const definition = runWalkDefinition(settings);

const controller = {
  start: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  resume: jest.fn(),
  skip: jest.fn(),
  back: jest.fn(),
  stop: jest.fn(),
};

function withSession(state: SessionState | null) {
  jest.mocked(useSession).mockReturnValue({
    state,
    controller: controller as unknown as ReturnType<typeof useSession>['controller'],
  });
}

/** A run/walk session in phase `index`, 4 s into it. */
function runWalkState(index: number, over: Partial<SessionState> = {}): SessionState {
  const phase = definition.phases[index];
  return {
    status: 'running',
    index,
    phase,
    phaseElapsedMs: 4_000,
    phaseRemainingMs: (phase.durationSec as number) * 1_000 - 4_000,
    totalElapsedMs: 314_000,
    title: definition.title,
    definition,
    backgroundWarning: false,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRunWalk).mockReturnValue({
    settings,
    store: {} as ReturnType<typeof useRunWalk>['store'],
  });
});

describe('Run/walk screen: settings view (WU3)', () => {
  it('shows the total workout time for the defaults', async () => {
    withSession(null);
    await render(<RunWalkScreen />);
    expect(screen.getByText('Total 28:40')).toBeOnTheScreen();
  });

  it('starts a run-walk session from a snapshot of the settings', async () => {
    withSession(null);
    await render(<RunWalkScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(controller.start).toHaveBeenCalledWith(definition);
  });

  it('WU7: shows the settings view while another mode is running', async () => {
    const routine = routineDefinition(defaultRoutine(() => 'x'));
    withSession({ ...runWalkState(2), definition: routine, phase: routine.phases[0], title: routine.title });
    await render(<RunWalkScreen />);
    expect(screen.getByRole('button', { name: 'Start' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });
});

describe('Run/walk screen: live view (WU4)', () => {
  it.each(['running', 'paused'] as const)('shows the phase, round, time left and controls while %s', async (status) => {
    withSession(runWalkState(2, { status }));
    await render(<RunWalkScreen />);
    expect(screen.getByText('Run')).toBeOnTheScreen();
    expect(screen.getByText('Round 1 of 8')).toBeOnTheScreen();
    expect(screen.getByLabelText('56 seconds left')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: status === 'running' ? 'Pause' : 'Resume' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('shows the Paused badge while paused', async () => {
    withSession(runWalkState(3, { status: 'paused' }));
    await render(<RunWalkScreen />);
    expect(screen.getByText('Paused')).toBeOnTheScreen();
  });

  it('the controls reach the session', async () => {
    withSession(runWalkState(2));
    await render(<RunWalkScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.pause).toHaveBeenCalledTimes(1);
  });
});

describe('Run/walk screen: settings editing (US2)', () => {
  let memory: MemoryStore;
  let store: RunWalkStore;

  beforeEach(() => {
    memory = new MemoryStore();
    store = new RunWalkStore({ store: memory });
    jest.mocked(useRunWalk).mockImplementation(() => {
      const s = useSyncExternalStore(
        (onChange) => store.subscribe(onChange),
        () => store.get(),
      );
      return { settings: s, store };
    });
    withSession(null);
  });

  it('tapping a preset updates run, walk, rounds and marks it selected', async () => {
    await render(<RunWalkScreen />);
    expect(screen.getByRole('button', { name: '1:00 / 1:30 ×8', selected: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '2:00 / 1:00 ×6' }));
    expect(store.get().runSec).toBe(120);
    expect(store.get().walkSec).toBe(60);
    expect(store.get().rounds).toBe(6);
    expect(screen.getByRole('button', { name: '2:00 / 1:00 ×6', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1:00 / 1:30 ×8', selected: false })).toBeOnTheScreen();
  });

  it('+ on run updates the store, unmarks the preset, and the total', async () => {
    await render(<RunWalkScreen />);
    expect(screen.getByText('Total 28:40')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Increase Run' }));
    expect(store.get().runSec).toBe(75);
    expect(screen.queryByRole('button', { selected: true })).toBeNull();
    expect(screen.getByText('Total 30:40')).toBeOnTheScreen();
  });

  it('− on rounds is disabled at 1', async () => {
    store.update((s) => ({ ...s, rounds: 1 }));
    await render(<RunWalkScreen />);
    expect(screen.getByRole('button', { name: 'Decrease Rounds' })).toBeDisabled();
  });

  it('warm-up at 0 reads "Off"', async () => {
    store.update((s) => ({ ...s, warmupSec: 0 }));
    await render(<RunWalkScreen />);
    expect(screen.getByText('Off')).toBeOnTheScreen();
  });

  it('switches for voice options and keep screen on update the store', async () => {
    await render(<RunWalkScreen />);

    const roundSwitch = screen.getByRole('switch', { name: 'Say the round' });
    expect(roundSwitch.props.value).toBe(true);
    await fireEvent(roundSwitch, 'valueChange', false);
    expect(store.get().announceRound).toBe(false);

    const halfwaySwitch = screen.getByRole('switch', { name: 'Say halfway' });
    expect(halfwaySwitch.props.value).toBe(true);
    await fireEvent(halfwaySwitch, 'valueChange', false);
    expect(store.get().halfway).toBe(false);

    const timeSwitch = screen.getByRole('switch', { name: 'Say time left' });
    expect(timeSwitch.props.value).toBe(true);
    await fireEvent(timeSwitch, 'valueChange', false);
    expect(store.get().timeLeft).toBe(false);

    const keepSwitch = screen.getByRole('switch', { name: 'Keep screen on' });
    expect(keepSwitch.props.value).toBe(false);
    await fireEvent(keepSwitch, 'valueChange', true);
    expect(store.get().keepScreenOn).toBe(true);
  });
});

describe('Run/walk screen: ended view and keep screen on (WU5, WU6)', () => {
  it.each([
    ['done', 'Complete'],
    ['stopped', 'Stopped'],
  ] as const)('shows %s with total elapsed time and Start again', async (status, banner) => {
    withSession(runWalkState(17, { status, totalElapsedMs: 1_720_000 }));
    await render(<RunWalkScreen />);
    expect(screen.getByText(banner)).toBeOnTheScreen();
    expect(screen.getByText('28:40')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
    expect(controller.start).toHaveBeenCalledWith(definition);
  });

  it('useKeepScreenOn receives definition and status while live, and undefined for another mode', async () => {
    withSession(runWalkState(2, { status: 'running' }));
    await render(<RunWalkScreen />);
    expect(useKeepScreenOn).toHaveBeenLastCalledWith(definition, 'running');

    withSession({ ...runWalkState(0), definition: routineDefinition(defaultRoutine(() => 'x')), title: 'Routine' });
    await screen.rerender(<RunWalkScreen />);
    expect(useKeepScreenOn).toHaveBeenLastCalledWith(undefined, undefined);
  });
});


