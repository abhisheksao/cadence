import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { routineDefinition } from '@/modes/routine';
import { sampleDefinition } from '@/modes/sample';
import { defaultRoutine } from '@/routine/defaults';
import type { SessionState } from '@/session/controller';
import { useSession } from '@/session/useSession';

import HomeScreen from './HomeScreen';

jest.mock('@/components/BatteryLink', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BatteryLink: () => <MockText>Battery link</MockText> };
});

jest.mock('@/session/useSession', () => ({ useSession: jest.fn(() => ({ state: null, controller: {} })) }));

function SampleStub() {
  return <Text>Sample screen</Text>;
}

function RoutineStub() {
  return <Text>Routine screen</Text>;
}

function RunWalkStub() {
  return <Text>Run / walk screen</Text>;
}

const routes = { index: HomeScreen, sample: SampleStub, 'routine/index': RoutineStub, 'run-walk': RunWalkStub };

describe('Home screen (FR-019)', () => {
  it('lists Breathe with a description, marked coming soon', async () => {
    await renderRouter(routes);
    expect(screen.getByLabelText(/^Breathe, coming soon/)).toBeOnTheScreen();
    expect(screen.getByText('Breathe')).toBeOnTheScreen();
  });

  it('shows a description for each of the three modes; only Breathe is coming soon (WU1)', async () => {
    await renderRouter(routes);
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
    expect(screen.getAllByTestId('mode-description')).toHaveLength(3);
    expect(screen.queryByLabelText(/^Run \/ walk, coming soon/)).toBeNull();
  });

  it('opens run / walk (WU1)', async () => {
    const router = renderRouter(routes);
    await router;
    await fireEvent.press(screen.getByRole('button', { name: /^Run \/ walk/ }));
    expect(router.getPathname()).toBe('/run-walk');
    expect(screen.getByText('Run / walk screen')).toBeOnTheScreen();
  });

  it('opens the morning routine (FR-021)', async () => {
    const router = renderRouter(routes);
    await router;
    await fireEvent.press(screen.getByRole('button', { name: /^Morning routine/ }));
    expect(router.getPathname()).toBe('/routine');
    expect(screen.getByText('Routine screen')).toBeOnTheScreen();
  });

  it('opens the sample session', async () => {
    // RNTL 14's render is async; renderRouter adds getPathname() to the returned promise.
    const router = renderRouter(routes);
    await router;
    await fireEvent.press(screen.getByRole('button', { name: /Sample session/ }));
    expect(router.getPathname()).toBe('/sample');
    expect(screen.getByText('Sample screen')).toBeOnTheScreen();
  });

  it('shows the battery link', async () => {
    await renderRouter(routes);
    expect(screen.getByText('Battery link')).toBeOnTheScreen();
  });

  describe('"In progress" (FR-021)', () => {
    const live = (definition: SessionState['definition'], status: SessionState['status']): SessionState => ({
      status,
      index: 0,
      phase: definition.phases[0],
      phaseElapsedMs: 0,
      phaseRemainingMs: null,
      totalElapsedMs: 0,
      title: definition.title,
      definition,
      backgroundWarning: false,
    });
    const withState = (state: SessionState | null) =>
      jest.mocked(useSession).mockReturnValue({
        state,
        controller: {} as ReturnType<typeof useSession>['controller'],
      });
    const routine = routineDefinition(defaultRoutine(() => 'x'));

    afterEach(() => withState(null));

    it.each(['running', 'paused'] as const)('shows on the routine tile while a routine is %s', async (status) => {
      withState(live(routine, status));
      await renderRouter(routes);
      expect(screen.getByText('In progress')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: /^Morning routine, in progress/ })).toBeOnTheScreen();
    });

    it('does not show for a finished routine or another mode', async () => {
      withState(live(routine, 'done'));
      await renderRouter(routes);
      expect(screen.queryByText('In progress')).toBeNull();

      withState(live(sampleDefinition(), 'running'));
      await renderRouter(routes);
      expect(screen.queryByText('In progress')).toBeNull();
    });
  });
});
