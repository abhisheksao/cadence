import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { routineDefinition } from '@/modes/routine';
import { sampleDefinition } from '@/modes/sample';
import { defaultRoutine } from '@/routine/defaults';
import { useRoutine } from '@/routine/useRoutine';
import type { SessionState } from '@/session/controller';
import { useSession } from '@/session/useSession';

import RoutineScreen from './RoutineScreen';

jest.mock('@/session/useSession', () => ({ useSession: jest.fn() }));
jest.mock('@/session/useKeepScreenOn', () => ({ useKeepScreenOn: jest.fn() }));
jest.mock('@/routine/useRoutine', () => ({ useRoutine: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

let n = 0;
const routine = defaultRoutine(() => `id${++n}`);
const definition = routineDefinition(routine);

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

/** A routine session in step `index`, `elapsedMs` into it. */
function routineState(index: number, over: Partial<SessionState> = {}): SessionState {
  const phase = definition.phases[index];
  return {
    status: 'running',
    index,
    phase,
    phaseElapsedMs: 4_000,
    phaseRemainingMs: phase.durationSec === null ? null : phase.durationSec * 1_000 - 4_000,
    totalElapsedMs: 0,
    title: definition.title,
    definition,
    backgroundWarning: false,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRoutine).mockReturnValue({
    routine,
    store: {} as ReturnType<typeof useRoutine>['store'],
  });
});

describe('Routine screen: start view (UI2)', () => {
  it('lists the steps with their durations and the total timed duration', async () => {
    withSession(null);
    await render(<RoutineScreen />);
    expect(screen.getByText('Drink a glass of water')).toBeOnTheScreen();
    expect(screen.getByText('1:00')).toBeOnTheScreen();
    expect(screen.getAllByText('untimed')).toHaveLength(2);
    expect(screen.getByText('Total 12:00')).toBeOnTheScreen();
  });

  it('starts a routine session from a snapshot of the routine', async () => {
    withSession(null);
    await render(<RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(controller.start).toHaveBeenCalledWith(definition);
  });

  it('shows the start view while another mode is running', async () => {
    withSession({ ...routineState(0), definition: sampleDefinition(), title: 'Sample session' });
    await render(<RoutineScreen />);
    expect(screen.getByRole('button', { name: 'Start' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});

describe('Routine screen: live view (UI3)', () => {
  it('shows the current step with "Step N of M", Done and the controls', async () => {
    withSession(routineState(1));
    await render(<RoutineScreen />);
    expect(screen.getAllByText('Step 2 of 6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Make the bed').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('Done moves to the next step', async () => {
    withSession(routineState(1));
    await render(<RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(controller.skip).toHaveBeenCalledTimes(1);
  });
});

describe('Routine screen: Edit (FR-007)', () => {
  it('opens the Edit screen when no routine session is live', async () => {
    withSession(null);
    await render(<RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(router.push).toHaveBeenCalledWith('/routine/edit');
  });

  it.each(['running', 'paused'] as const)('hides Edit while a routine session is %s', async (status) => {
    withSession(routineState(0, { status }));
    await render(<RoutineScreen />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('allows editing while another mode runs', async () => {
    withSession({ ...routineState(0), definition: sampleDefinition(), title: 'Sample session' });
    await render(<RoutineScreen />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeOnTheScreen();
  });
});
