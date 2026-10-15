import { render, screen } from '@testing-library/react-native';

import { defaultSettings } from '@/breathe/settings';
import { breatheDefinition } from '@/modes/breathe';
import type { SessionState } from '@/session/controller';

import { BreatheLiveView } from './BreatheLiveView';

const definition = breatheDefinition(defaultSettings());

function makeState(index: number, elapsedSec = 10, status: SessionState['status'] = 'running'): SessionState {
  const phase = definition.phases[index];
  return {
    status,
    index,
    phase,
    phaseElapsedMs: 1_000,
    phaseRemainingMs: (phase.durationSec ?? 0) * 1_000 - 1_000,
    totalElapsedMs: elapsedSec * 1_000,
    title: definition.title,
    definition,
    backgroundWarning: false,
  };
}

describe('BreatheLiveView (BU4, BU5)', () => {
  it('renders phase title, cycle counter, and countdown clock during inhale', async () => {
    // Index 1 is Inhale of Cycle 1
    await render(<BreatheLiveView state={makeState(1, 6)} />);

    expect(screen.getByRole('header', { name: 'Inhale' })).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 of 11')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 seconds left')).toBeOnTheScreen();
    expect(screen.getByText('0:03')).toBeOnTheScreen();
    expect(screen.getByTestId('breath-pacer')).toBeOnTheScreen();
    expect(screen.getByText('0:06 / 3:01')).toBeOnTheScreen();
    expect(screen.queryByText('Paused')).toBeNull();
  });

  it('renders "Get ready" without cycle subtitle during prep phase', async () => {
    // Index 0 is prep
    await render(<BreatheLiveView state={makeState(0, 2)} />);

    expect(screen.getByRole('header', { name: 'Get ready' })).toBeOnTheScreen();
    expect(screen.queryByText(/Cycle/)).toBeNull();
    expect(screen.getByLabelText('4 seconds left')).toBeOnTheScreen();
  });

  it('displays Paused badge when session is paused', async () => {
    await render(<BreatheLiveView state={makeState(1, 6, 'paused')} />);

    expect(screen.getByText('Paused')).toBeOnTheScreen();
  });
});
