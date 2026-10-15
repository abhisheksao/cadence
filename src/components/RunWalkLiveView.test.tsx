import { render, screen } from '@testing-library/react-native';

import { defaultSettings } from '@/runWalk/settings';
import { runWalkDefinition } from '@/modes/runWalk';
import type { SessionState } from '@/session/controller';

import { RunWalkLiveView } from './RunWalkLiveView';

const definition = runWalkDefinition(defaultSettings());

function makeState(index: number, elapsedSec = 314): SessionState {
  const phase = definition.phases[index];
  return {
    status: 'running',
    index,
    phase,
    phaseElapsedMs: 4_000,
    phaseRemainingMs: (phase.durationSec ?? 0) * 1_000 - 4_000,
    totalElapsedMs: elapsedSec * 1_000,
    title: definition.title,
    definition,
    backgroundWarning: false,
  };
}

describe('RunWalkLiveView (US3)', () => {
  it('uses accent colour for run, green for walk, and text colour for ready', async () => {
    // 0 ready -> text color (#0E1116 in light mode)
    const { rerender } = await render(<RunWalkLiveView state={makeState(0)} />);
    const readyTitle = screen.getByRole('header', { name: 'Get ready' });
    expect(readyTitle.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#0E1116' })]),
    );

    // 2 run -> accent (#FF7A45)
    await rerender(<RunWalkLiveView state={makeState(2)} />);
    const runTitle = screen.getByRole('header', { name: 'Run' });
    expect(runTitle.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#FF7A45' })]),
    );

    // 3 walk -> green (#2EA043)
    await rerender(<RunWalkLiveView state={makeState(3)} />);
    const walkTitle = screen.getByRole('header', { name: 'Walk' });
    expect(walkTitle.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#2EA043' })]),
    );

    // 1 warmup -> green (#2EA043)
    await rerender(<RunWalkLiveView state={makeState(1)} />);
    const warmupTitle = screen.getByRole('header', { name: 'Warm up' });
    expect(warmupTitle.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#2EA043' })]),
    );

    // 17 cooldown -> green (#2EA043)
    await rerender(<RunWalkLiveView state={makeState(17)} />);
    const cooldownTitle = screen.getByRole('header', { name: 'Cool down' });
    expect(cooldownTitle.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#2EA043' })]),
    );
  });

  it('shows "elapsed / total" as m:ss', async () => {
    // 314 s elapsed = 5:14, total default is 1,720 s = 28:40
    await render(<RunWalkLiveView state={makeState(2, 314)} />);
    expect(screen.getByText('5:14 / 28:40')).toBeOnTheScreen();
  });

  it('shows "Next: <title> <m:ss>" and none on the last phase', async () => {
    // Phase 2 is Run (60 s), next is Walk (90 s -> 1:30)
    const { rerender } = await render(<RunWalkLiveView state={makeState(2)} />);
    expect(screen.getByText('Next: Walk 1:30')).toBeOnTheScreen();

    // Last phase is 17 (Cool down), no next phase
    await rerender(<RunWalkLiveView state={makeState(17)} />);
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });
});
