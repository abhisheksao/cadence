import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { backgroundHost } from '@/platform/background';

import { BatteryLink } from './BatteryLink';

jest.mock('@/platform/background', () => ({
  backgroundHost: { requestBatteryExemption: jest.fn(() => Promise.resolve()) },
}));

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

describe('BatteryLink', () => {
  const original = Platform.OS;
  afterEach(() => setOS(original));

  it('renders nothing outside Android', async () => {
    setOS('ios');
    await render(<BatteryLink />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers the battery exemption again and opens it on press', async () => {
    setOS('android');
    await render(<BatteryLink />);
    const link = screen.getByRole('link', {
      name: 'App stopping mid-session? Allow it to run in the background',
    });
    await fireEvent.press(link);
    expect(backgroundHost.requestBatteryExemption).toHaveBeenCalledTimes(1);
  });
});
