import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleDefinition, soakDefinition } from '@/modes/sample';
import type { SessionState } from '@/session/controller';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';

import SampleScreen from './SampleScreen';

jest.mock('@/session/useSession', () => ({ useSession: jest.fn() }));
jest.mock('@/session/useKeepScreenOn', () => ({ useKeepScreenOn: jest.fn() }));

const mockedUseSession = jest.mocked(useSession);
const mockedKeepScreenOn = jest.mocked(useKeepScreenOn);
const controller = {
  start: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  resume: jest.fn(),
  skip: jest.fn(),
  back: jest.fn(),
  stop: jest.fn(),
};

function withState(state: SessionState | null) {
  mockedUseSession.mockReturnValue({
    state,
    controller: controller as unknown as ReturnType<typeof useSession>['controller'],
  });
}

const running: SessionState = {
  title: 'Sample session',
  status: 'running',
  index: 2,
  phase: { kind: 'interval', title: 'Interval', durationSec: 20 },
  phaseElapsedMs: 4_000,
  phaseRemainingMs: 16_000,
  totalElapsedMs: 30_000,
  backgroundWarning: false,
  definition: sampleDefinition(),
};

describe('Sample screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts the sample session', async () => {
    withState(null);
    await render(<SampleScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start sample' }));
    expect(controller.start).toHaveBeenCalledWith(sampleDefinition());
  });

  it('starts the 60-minute soak', async () => {
    withState(null);
    await render(<SampleScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start 60-minute soak' }));
    expect(controller.start).toHaveBeenCalledWith(soakDefinition());
  });

  it('shows the session view and controls while a session runs', async () => {
    withState(running);
    await render(<SampleScreen />);
    expect(screen.getByText('Interval')).toBeOnTheScreen();
    expect(screen.getByText('0:16')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start sample' })).toBeNull();
  });

  it('offers the start buttons again once the session has ended', async () => {
    withState({ ...running, status: 'done' });
    await render(<SampleScreen />);
    expect(screen.getByText('Done')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start sample' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('passes the running definition and status to useKeepScreenOn', async () => {
    withState(running);
    await render(<SampleScreen />);
    expect(mockedKeepScreenOn).toHaveBeenLastCalledWith(running.definition, 'running');

    withState(null);
    await render(<SampleScreen />);
    expect(mockedKeepScreenOn).toHaveBeenLastCalledWith(undefined, undefined);
  });

  it('warns that cues may stop only when the background service was refused', async () => {
    withState(running);
    await render(<SampleScreen />);
    expect(screen.queryByText('Cues may stop when the screen is off')).toBeNull();

    withState({ ...running, backgroundWarning: true });
    await render(<SampleScreen />);
    expect(screen.getByText('Cues may stop when the screen is off')).toBeOnTheScreen();
  });
});
