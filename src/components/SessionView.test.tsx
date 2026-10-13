import { render, screen } from '@testing-library/react-native';

import type { SessionState } from '@/session/controller';

import { SessionView } from './SessionView';

const timed: SessionState = {
  title: 'Sample session',
  status: 'running',
  index: 2,
  phase: { kind: 'interval', title: 'Interval', subtitle: 'Easy pace', durationSec: 20 },
  phaseElapsedMs: 4_200,
  phaseRemainingMs: 15_800,
  totalElapsedMs: 30_000,
  backgroundWarning: false,
  definition: {
    modeId: 'sample',
    title: 'Sample session',
    phases: [],
    settings: {},
    keepScreenOn: true,
  },
};

describe('SessionView', () => {
  it('shows the phase title, subtitle and time left, rounded up to the second', async () => {
    await render(<SessionView state={timed} />);
    expect(screen.getByText('Interval')).toBeOnTheScreen();
    expect(screen.getByText('Easy pace')).toBeOnTheScreen();
    expect(screen.getByText('0:16')).toBeOnTheScreen();
    expect(screen.getByLabelText('16 seconds left')).toBeOnTheScreen();
    expect(screen.queryByText('Paused')).toBeNull();
  });

  it('shows elapsed time for an untimed phase', async () => {
    await render(
      <SessionView
        state={{
          ...timed,
          phase: { kind: 'wait', title: 'Tap Skip when ready', durationSec: null },
          phaseElapsedMs: 75_900,
          phaseRemainingMs: null,
        }}
      />,
    );
    expect(screen.getByText('Tap Skip when ready')).toBeOnTheScreen();
    expect(screen.getByText('1:15')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 minute 15 seconds elapsed')).toBeOnTheScreen();
  });

  it('shows "Paused" while paused', async () => {
    await render(<SessionView state={{ ...timed, status: 'paused' }} />);
    expect(screen.getByText('Paused')).toBeOnTheScreen();
  });

  it('shows "Done" when the session has finished', async () => {
    await render(<SessionView state={{ ...timed, status: 'done', phaseRemainingMs: 0 }} />);
    expect(screen.getByText('Done')).toBeOnTheScreen();
  });
});
