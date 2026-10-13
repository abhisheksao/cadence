import BackgroundService from 'react-native-background-actions';

import { backgroundHost } from './background.android';

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    updateNotification: jest.fn(() => Promise.resolve()),
    isRunning: jest.fn(() => false),
  },
}));

const service = jest.mocked(BackgroundService);

describe('Android background host: service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts a media-playback foreground service with the session title and phase', async () => {
    const keepAliveUntil = Promise.resolve();
    await expect(backgroundHost.start({ title: 'Sample session', text: 'Get ready', keepAliveUntil })).resolves.toBe(
      true,
    );

    expect(service.start).toHaveBeenCalledTimes(1);
    const [task, options] = service.start.mock.calls[0];
    expect(options).toMatchObject({
      taskTitle: 'Sample session',
      taskDesc: 'Get ready',
      foregroundServiceType: ['mediaPlayback'],
    });
    // The service task lives exactly as long as the session needs it.
    await expect(task(undefined)).resolves.toBeUndefined();
  });

  it('stops a service that is still running before starting a new one', async () => {
    service.isRunning.mockReturnValueOnce(true);
    await backgroundHost.start({ title: 'Run', text: 'Warm up', keepAliveUntil: Promise.resolve() });
    expect(service.stop.mock.invocationCallOrder[0]).toBeLessThan(service.start.mock.invocationCallOrder[0]);
  });

  it('resolves false when the OS refuses to start the service', async () => {
    service.start.mockRejectedValueOnce(new Error('ForegroundServiceStartNotAllowedException'));
    await expect(
      backgroundHost.start({ title: 'Run', text: 'Warm up', keepAliveUntil: Promise.resolve() }),
    ).resolves.toBe(false);
  });

  it('updates the notification text', () => {
    service.isRunning.mockReturnValue(true);
    backgroundHost.update('Paused · Interval');
    expect(service.updateNotification).toHaveBeenCalledWith({ taskDesc: 'Paused · Interval' });
  });

  it('stops the service', async () => {
    service.isRunning.mockReturnValue(true);
    await backgroundHost.stop();
    expect(service.stop).toHaveBeenCalledTimes(1);
  });
});
