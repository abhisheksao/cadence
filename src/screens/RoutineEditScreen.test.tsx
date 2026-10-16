import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { RoutineStore } from '@/routine/store';
import { MemoryStore } from '@/test-utils/fakes';

import RoutineEditScreen from './RoutineEditScreen';

let mockStore: RoutineStore;
let mockId = 0;

jest.mock('@/routine/useRoutine', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react');
  return {
    useRoutine: () => {
      const routine = useSyncExternalStore(
        (fn: () => void) => mockStore.subscribe(fn),
        () => mockStore.get(),
      );
      return { routine, store: mockStore };
    },
  };
});

beforeEach(() => {
  mockId = 0;
  mockStore = new RoutineStore({ store: new MemoryStore(), newId: () => `id${++mockId}` });
});

const titles = () => mockStore.get().steps.map((s) => s.title);

describe('Edit screen (UI6–UI8)', () => {
  it('saves a new title as it is typed (FR-004)', async () => {
    await render(<RoutineEditScreen />);
    await fireEvent.changeText(screen.getByLabelText('Step 1 title'), 'Water');
    expect(titles()[0]).toBe('Water');
  });

  it('adds a 2-minute step at the end', async () => {
    await render(<RoutineEditScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add step' }));
    expect(mockStore.get().steps).toHaveLength(7);
    expect(mockStore.get().steps[6]).toMatchObject({ title: '', durationSec: 120 });
    expect(screen.getByLabelText('Step 7 title')).toBeOnTheScreen();
  });

  it('moves a step', async () => {
    await render(<RoutineEditScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(titles().slice(0, 2)).toEqual(['Make the bed', 'Drink a glass of water']);
  });

  it('deletes a step and Undo puts it back in place (UI7)', async () => {
    await render(<RoutineEditScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete step 3' }));
    expect(titles()).not.toContain('Stretch');
    expect(screen.getByText('Step deleted')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(titles()[2]).toBe('Stretch');
    expect(screen.queryByText('Step deleted')).toBeNull();
  });

  it('hides the undo bar after 5 seconds', async () => {
    jest.useFakeTimers();
    try {
      await render(<RoutineEditScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Delete step 1' }));
      await act(() => jest.advanceTimersByTime(5_000));
      expect(screen.queryByText('Step deleted')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('cannot delete the only step', async () => {
    mockStore.update((r) => ({ ...r, steps: r.steps.slice(0, 1) }));
    await render(<RoutineEditScreen />);
    expect(screen.getByRole('button', { name: 'Delete step 1' })).toBeDisabled();
  });

  it('disables Add step at 30 steps', async () => {
    mockStore.update((r) => ({
      ...r,
      steps: Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, title: `T${i}`, durationSec: 60 })),
    }));
    await render(<RoutineEditScreen />);
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled();
  });

  it('restores the default routine only after confirming (UI8)', async () => {
    mockStore.update((r) => ({ ...r, steps: r.steps.slice(0, 2) }));
    await render(<RoutineEditScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Restore default routine' }));
    const confirm = screen.getByTestId('restore-confirm');
    await fireEvent.press(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(mockStore.get().steps).toHaveLength(2);
    expect(screen.queryByTestId('restore-confirm')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Restore default routine' }));
    await fireEvent.press(within(screen.getByTestId('restore-confirm')).getByRole('button', { name: 'Restore' }));
    expect(mockStore.get().steps).toHaveLength(6);
  });
});
