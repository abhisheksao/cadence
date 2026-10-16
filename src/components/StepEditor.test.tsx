import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Step } from '@/routine/types';

import { StepEditor } from './StepEditor';

const timed: Step = { id: 'a', title: 'Stretch', durationSec: 150 };

function setup(step: Step, over: Partial<Parameters<typeof StepEditor>[0]> = {}) {
  const props = {
    step,
    position: 2,
    canMoveUp: true,
    canMoveDown: true,
    canDelete: true,
    onChange: jest.fn(),
    onMove: jest.fn(),
    onDelete: jest.fn(),
    ...over,
  };
  return { props, view: render(<StepEditor {...props} />) };
}

describe('StepEditor (UI6)', () => {
  it('edits the title, limited to 60 characters', async () => {
    const { props, view } = setup(timed);
    await view;
    const input = screen.getByLabelText('Step 2 title');
    expect(input.props.maxLength).toBe(60);
    await fireEvent.changeText(input, 'Stretch well');
    expect(props.onChange).toHaveBeenCalledWith({ title: 'Stretch well' });
  });

  it('shows the duration as minutes and seconds and saves it on blur, raised to 15 s', async () => {
    const { props, view } = setup(timed);
    await view;
    const minutes = screen.getByLabelText('Step 2 minutes');
    const seconds = screen.getByLabelText('Step 2 seconds');
    expect([minutes.props.value, seconds.props.value]).toEqual(['2', '30']);

    await fireEvent.changeText(minutes, '0');
    await fireEvent.changeText(seconds, '5');
    await fireEvent(seconds, 'blur');
    expect(props.onChange).toHaveBeenLastCalledWith({ durationSec: 15 });
    // The fields show the corrected value.
    expect([minutes.props.value, seconds.props.value]).toEqual(['0', '15']);

    await fireEvent.changeText(minutes, '12');
    await fireEvent(minutes, 'blur');
    expect(props.onChange).toHaveBeenLastCalledWith({ durationSec: 735 });
  });

  it('switches a timed step to untimed and back to its last duration', async () => {
    const { props, view } = setup(timed);
    await view;
    await fireEvent(screen.getByLabelText('Step 2 untimed'), 'valueChange', true);
    expect(props.onChange).toHaveBeenLastCalledWith({ durationSec: null });
  });

  it('gives an untimed step 2 minutes when it becomes timed, and hides the duration while untimed', async () => {
    const { props, view } = setup({ ...timed, durationSec: null });
    await view;
    expect(screen.queryByLabelText('Step 2 minutes')).toBeNull();
    await fireEvent(screen.getByLabelText('Step 2 untimed'), 'valueChange', false);
    expect(props.onChange).toHaveBeenLastCalledWith({ durationSec: 120 });
  });

  it('moves and deletes, with buttons disabled where they do not apply', async () => {
    const { props, view } = setup(timed, { canMoveUp: false, canDelete: false });
    await view;
    expect(screen.getByRole('button', { name: 'Move step 2 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete step 2' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Move step 2 down' }));
    expect(props.onMove).toHaveBeenCalledWith(1);
  });

  it('deletes when allowed', async () => {
    const { props, view } = setup(timed);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Delete step 2' }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });
});
