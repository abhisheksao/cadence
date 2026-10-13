import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import HomeScreen from './HomeScreen';

jest.mock('@/components/BatteryLink', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BatteryLink: () => <MockText>Battery link</MockText> };
});

function SampleStub() {
  return <Text>Sample screen</Text>;
}

describe('Home screen (FR-019)', () => {
  it.each([
    ['Morning routine'],
    ['Run / walk'],
    ['Breathe'],
  ])('lists %s with a description, marked coming soon', async (name) => {
    await renderRouter({ index: HomeScreen, sample: SampleStub });
    const tile = screen.getByLabelText(new RegExp(`^${name.replace('/', '\\/')}, coming soon`));
    expect(tile).toBeOnTheScreen();
    expect(screen.getByText(name)).toBeOnTheScreen();
  });

  it('shows a description and "Coming soon" for each of the three modes', async () => {
    await renderRouter({ index: HomeScreen, sample: SampleStub });
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
    expect(screen.getAllByTestId('mode-description')).toHaveLength(3);
  });

  it('opens the sample session', async () => {
    // RNTL 14's render is async; renderRouter adds getPathname() to the returned promise.
    const router = renderRouter({ index: HomeScreen, sample: SampleStub });
    await router;
    await fireEvent.press(screen.getByRole('button', { name: /Sample session/ }));
    expect(router.getPathname()).toBe('/sample');
    expect(screen.getByText('Sample screen')).toBeOnTheScreen();
  });

  it('shows the battery link', async () => {
    await renderRouter({ index: HomeScreen, sample: SampleStub });
    expect(screen.getByText('Battery link')).toBeOnTheScreen();
  });
});
