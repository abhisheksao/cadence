import { fireEvent, render, screen } from '@testing-library/react-native';

import { routineDefinition } from '@/modes/routine';
import { runWalkDefinition } from '@/modes/runWalk';
import { defaultRoutine } from '@/routine/defaults';
import { defaultSettings } from '@/runWalk/settings';
import { useRunWalk } from '@/runWalk/useRunWalk';
import type { SessionState } from '@/session/controller';
import { useSession } from '@/session/useSession';

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
