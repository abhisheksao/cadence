import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleDefinition } from '@/modes/sample';
import type { SessionState } from '@/session/controller';
import { useSession } from '@/session/useSession';

import SampleScreen from './SampleScreen';

jest.mock('@/session/useSession', () => ({ useSession: jest.fn() }));

const mockedUseSession = jest.mocked(useSession);
const controller = { start: jest.fn(() => Promise.resolve()) };

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
};

describe('Sample screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts the sample session', () => {
    withState(null);
    render(<SampleScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start sample' }));
    expect(controller.start).toHaveBeenCalledWith(sampleDefinition());
  });

  it('shows the current phase and status', () => {
    withState(running);
    render(<SampleScreen />);
    expect(screen.getByText('Interval')).toBeOnTheScreen();
    expect(screen.getByText('Running')).toBeOnTheScreen();
  });
});
