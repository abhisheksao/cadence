import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatTimeOfDay } from '@/format/clock';
import type { SessionDefinition } from '@/session/types';

import { ResumePrompt } from './ResumePrompt';

const definition: SessionDefinition = {
  modeId: 'sample',
  title: 'Sample session',
  phases: [
    { kind: 'ready', title: 'Get ready', durationSec: 10 },
    { kind: 'interval', title: 'Interval', durationSec: 20 },
  ],
  settings: {},
  keepScreenOn: true,
};

const callbacks = () => ({ onResume: jest.fn(), onDiscard: jest.fn(), onDismiss: jest.fn() });

describe('ResumePrompt', () => {
  it('offers to resume, naming the session and phase', async () => {
    const cb = callbacks();
    await render(
      <ResumePrompt
        result={{ kind: 'resume', assessment: { definition, index: 1, phaseElapsedMs: 4_000, paused: false } }}
        {...cb}
      />,
    );
    expect(screen.getByText('Resume Sample session?')).toBeOnTheScreen();
    expect(screen.getByText('Interval · 0:16 left')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(cb.onResume).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(cb.onDiscard).toHaveBeenCalledTimes(1);
    expect(cb.onDismiss).not.toHaveBeenCalled();
  });

  it('says when a recovered session is paused', async () => {
    await render(
      <ResumePrompt
        result={{ kind: 'resume', assessment: { definition, index: 0, phaseElapsedMs: 2_000, paused: true } }}
        {...callbacks()}
      />,
    );
    expect(screen.getByText('Get ready · 0:08 left · Paused')).toBeOnTheScreen();
  });

  it('tells the user when a session was interrupted, with an OK button', async () => {
    const cb = callbacks();
    const at = new Date(2026, 9, 13, 7, 5).getTime();
    await render(
      <ResumePrompt result={{ kind: 'interrupted', reason: 'finished', title: 'Sample session', at }} {...cb} />,
    );
    expect(
      screen.getByText(`Your session 'Sample session' was interrupted at ${formatTimeOfDay(at)}`),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(cb.onDismiss).toHaveBeenCalledTimes(1);
  });
});
