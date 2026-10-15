import { useSyncExternalStore } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { defaultSettings } from '@/breathe/settings';
import { BreatheStore } from '@/breathe/store';
import { useBreathe } from '@/breathe/useBreathe';
import { breatheDefinition } from '@/modes/breathe';
import { runWalkDefinition } from '@/modes/runWalk';
import { defaultSettings as defaultRunWalkSettings } from '@/runWalk/settings';
import type { SessionState } from '@/session/controller';
import { useSession } from '@/session/useSession';
import { MemoryStore } from '@/test-utils/fakes';

import BreatheScreen from './BreatheScreen';

jest.mock('@/session/useSession', () => ({ useSession: jest.fn() }));
jest.mock('@/session/useKeepScreenOn', () => ({ useKeepScreenOn: jest.fn() }));
jest.mock('@/breathe/useBreathe', () => ({ useBreathe: jest.fn() }));

const settings = defaultSettings();
const definition = breatheDefinition(settings);

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

function breatheState(index: number, over: Partial<SessionState> = {}): SessionState {
  const phase = definition.phases[index];
  return {
    status: 'running',
    index,
    phase,
    phaseElapsedMs: 1_000,
    phaseRemainingMs: (phase.durationSec as number) * 1_000 - 1_000,
    totalElapsedMs: 6_000,
    title: definition.title,
    definition,
    backgroundWarning: false,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBreathe).mockReturnValue({
    settings,
    store: {
      get: () => settings,
      subscribe: () => () => {},
      update: jest.fn(),
    } as unknown as ReturnType<typeof useBreathe>['store'],
  });
});

describe('BreatheScreen (US1 settings and live)', () => {
  it('BU2: shows Box preset, target 3 min, 11 cycles, and Start button when idle', async () => {
    withSession(null);
    await render(<BreatheScreen />);

    expect(screen.getByText('Box (4-4-4-4)')).toBeOnTheScreen();
    expect(screen.getAllByText(/3 min/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/11 cycles/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Start$/i })).toBeOnTheScreen();
  });

  it('BU3: tapping Start invokes controller.start with current definition', async () => {
    withSession(null);
    await render(<BreatheScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Start$/i }));

    expect(controller.start).toHaveBeenCalledTimes(1);
    expect(controller.start).toHaveBeenCalledWith(definition);
  });

  it('BU4: displays live view with phase title and cycle count when session is running', async () => {
    withSession(breatheState(1)); // Phase 1 is Inhale (after prep)
    await render(<BreatheScreen />);

    expect(screen.getByText('Inhale')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 of 11')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /pause/i })).toBeOnTheScreen();
  });

  it('BU7: another mode session (e.g. run-walk) displays the idle settings view', async () => {
    const rwDef = runWalkDefinition(defaultRunWalkSettings());
    withSession({
      status: 'running',
      index: 0,
      phase: rwDef.phases[0],
      phaseElapsedMs: 1_000,
      phaseRemainingMs: 9_000,
      totalElapsedMs: 1_000,
      title: rwDef.title,
      definition: rwDef,
      backgroundWarning: false,
    });
    await render(<BreatheScreen />);

    expect(screen.getByText('Box (4-4-4-4)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Start$/i })).toBeOnTheScreen();
  });
});

describe('BreatheScreen: settings editing (US2)', () => {
  let memory: MemoryStore;
  let store: BreatheStore;

  beforeEach(() => {
    memory = new MemoryStore();
    store = new BreatheStore({ store: memory });
    jest.mocked(useBreathe).mockImplementation(() => {
      const s = useSyncExternalStore(
        (onChange) => store.subscribe(onChange),
        () => store.get(),
      );
      return { settings: s, store };
    });
    withSession(null);
  });

  it('tapping 4-7-8 Relax preset updates fields and marks it selected', async () => {
    await render(<BreatheScreen />);
    expect(screen.getByRole('button', { name: 'Box (4-4-4-4), selected' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '4-7-8 Relax' }));
    expect(store.get().inhaleSec).toBe(4);
    expect(store.get().holdSec).toBe(7);
    expect(store.get().exhaleSec).toBe(8);
    expect(store.get().postHoldSec).toBe(0);
    expect(store.get().targetMinutes).toBe(2);
    expect(screen.getByRole('button', { name: '4-7-8 Relax, selected' })).toBeOnTheScreen();
  });

  it('+ on Inhale updates the store, unmarks preset, and updates total', async () => {
    await render(<BreatheScreen />);
    expect(screen.getByText(/181s|3:01/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Increase Inhale' }));
    expect(store.get().inhaleSec).toBe(5);
    // 5+4+4+4 = 17s cycle. 3 min (180s) / 17 = 11 cycles. 5s prep + 11*17 = 192s (3:12).
    expect(screen.queryByRole('button', { name: 'Box (4-4-4-4), selected' })).toBeNull();
    expect(screen.getByText(/3:12/)).toBeOnTheScreen();
  });

  it('Hold at 0 displays as Off', async () => {
    await render(<BreatheScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Coherent (5-5)' }));
    expect(screen.getAllByText('Off').length).toBe(2); // holdSec and postHoldSec are both 0
  });
});
