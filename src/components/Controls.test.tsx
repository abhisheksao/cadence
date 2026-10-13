import { fireEvent, render, screen } from '@testing-library/react-native';

import { Controls, type SessionControls } from './Controls';

function controls(): jest.Mocked<SessionControls> {
  return { pause: jest.fn(), resume: jest.fn(), skip: jest.fn(), back: jest.fn(), stop: jest.fn() };
}

describe('Controls', () => {
  it('shows Pause while running and each button calls its control', async () => {
    const c = controls();
    await render(<Controls status="running" controls={c} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip to next phase' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));

    expect(c.pause).toHaveBeenCalledTimes(1);
    expect(c.skip).toHaveBeenCalledTimes(1);
    expect(c.back).toHaveBeenCalledTimes(1);
    expect(c.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('shows Resume while paused', async () => {
    const c = controls();
    await render(<Controls status="paused" controls={c} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(c.resume).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('renders nothing when no session is active', async () => {
    await render(<Controls status="done" controls={controls()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
