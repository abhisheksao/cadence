import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { UNDO_MS, UndoBar } from './UndoBar';

describe('UndoBar (UI7)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers Undo', async () => {
    const onUndo = jest.fn();
    await render(<UndoBar onUndo={onUndo} onExpire={jest.fn()} />);
    expect(screen.getByText('Step deleted')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('expires after 5 seconds', async () => {
    const onExpire = jest.fn();
    await render(<UndoBar onUndo={jest.fn()} onExpire={onExpire} />);
    expect(UNDO_MS).toBe(5_000);
    await act(() => jest.advanceTimersByTime(4_999));
    expect(onExpire).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('restarts the 5 seconds for a new delete (new key)', async () => {
    const onExpire = jest.fn();
    await render(<UndoBar key="1" onUndo={jest.fn()} onExpire={onExpire} />);
    await act(() => jest.advanceTimersByTime(4_000));
    await screen.rerender(<UndoBar key="2" onUndo={jest.fn()} onExpire={onExpire} />);
    await act(() => jest.advanceTimersByTime(4_000));
    expect(onExpire).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
