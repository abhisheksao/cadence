import { render, screen } from '@testing-library/react-native';

import type { Phase } from '@/engine/types';

import { StepList } from './StepList';

const steps: Phase[] = [
  { kind: 'step', title: 'Water', durationSec: 60 },
  { kind: 'step', title: 'Bed', durationSec: null },
  { kind: 'step', title: 'Stretch', durationSec: 300 },
];

describe('StepList (UI3)', () => {
  it('marks earlier steps done, the current one current, later ones upcoming', async () => {
    await render(<StepList steps={steps} currentIndex={1} finished={false} />);
    expect(screen.getByLabelText('Water, 1:00, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bed, untimed, current')).toBeOnTheScreen();
    expect(screen.getByLabelText('Stretch, 5:00, upcoming')).toBeOnTheScreen();
  });

  it('marks every step done when the routine has finished', async () => {
    await render(<StepList steps={steps} currentIndex={2} finished />);
    expect(screen.getAllByLabelText(/, done$/)).toHaveLength(3);
  });
});
