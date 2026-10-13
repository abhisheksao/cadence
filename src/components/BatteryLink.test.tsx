import { fireEvent, render, screen } from '@testing-library/react-native';

import { backgroundHost } from '@/platform/background';

import { BatteryLink } from './BatteryLink';

jest.mock('@/platform/background', () => ({
  backgroundHost: { requestBatteryExemption: jest.fn(() => Promise.resolve()) },
}));

describe('BatteryLink', () => {
  it('offers the battery exemption again and opens it on press', async () => {
    await render(<BatteryLink />);
    const link = screen.getByRole('link', {
      name: 'App stopping mid-session? Allow it to run in the background',
    });
    await fireEvent.press(link);
    expect(backgroundHost.requestBatteryExemption).toHaveBeenCalledTimes(1);
  });
});
