import { fireEvent, render, screen } from '@testing-library/react-native';

import { Stepper } from './Stepper';

describe('Stepper (US2)', () => {
  it('shows the label and the formatted value', async () => {
    await render(
      <Stepper
        label="Run"
        value="1:00"
        onChange={jest.fn()}
        canDecrease={true}
        canIncrease={true}
      />,
    );
    expect(screen.getByText('Run')).toBeOnTheScreen();
    expect(screen.getByText('1:00')).toBeOnTheScreen();
  });

  it('− and + call onChange(-1) and onChange(1)', async () => {
    const onChange = jest.fn();
    await render(
      <Stepper
        label="Run"
        value="1:00"
        onChange={onChange}
        canDecrease={true}
        canIncrease={true}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Run' }));
    expect(onChange).toHaveBeenCalledWith(-1);

    await fireEvent.press(screen.getByRole('button', { name: 'Increase Run' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('each is disabled (and announced as disabled) when its can… prop is false', async () => {
    const onChange = jest.fn();
    await render(
      <Stepper
        label="Rounds"
        value="1"
        onChange={onChange}
        canDecrease={false}
        canIncrease={false}
      />,
    );
    const decrease = screen.getByRole('button', { name: 'Decrease Rounds' });
    const increase = screen.getByRole('button', { name: 'Increase Rounds' });

    expect(decrease).toBeDisabled();
    expect(increase).toBeDisabled();

    await fireEvent.press(decrease);
    await fireEvent.press(increase);
    expect(onChange).not.toHaveBeenCalled();
  });
});
