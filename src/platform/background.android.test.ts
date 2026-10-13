import * as IntentLauncher from 'expo-intent-launcher';
import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';

import { MemoryStore } from '@/test-utils/fakes';

import { BATTERY_ASKED_KEY, createBackgroundHost } from './background.android';

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    updateNotification: jest.fn(() => Promise.resolve()),
    isRunning: jest.fn(() => false),
  },
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(() => Promise.resolve({ resultCode: 0 })),
  ActivityAction: {
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'io.github.abhisheksao.cadence' } } },
}));

const service = jest.mocked(BackgroundService);
const startActivity = jest.mocked(IntentLauncher.startActivityAsync);
const backgroundHost = createBackgroundHost(new MemoryStore());

const REQUEST = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
const SETTINGS = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';

function setApiLevel(version: number) {
  Object.defineProperty(Platform, 'Version', { get: () => version, configurable: true });
}

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

describe('Android background host: permissions', () => {
  let requestPermission: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    requestPermission = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
  });

  afterEach(() => requestPermission.mockRestore());

  it('asks for notification permission on Android 13+ (API 33)', async () => {
    setApiLevel(33);
    await createBackgroundHost(new MemoryStore()).prepare();
    expect(requestPermission).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  });

  it('does not ask for notification permission below API 33', async () => {
    setApiLevel(32);
    await createBackgroundHost(new MemoryStore()).prepare();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('carries on when notification permission is denied or the request fails', async () => {
    setApiLevel(34);
    requestPermission.mockResolvedValueOnce('denied');
    await expect(createBackgroundHost(new MemoryStore()).prepare()).resolves.toBeUndefined();
    requestPermission.mockRejectedValueOnce(new Error('no activity'));
    await expect(createBackgroundHost(new MemoryStore()).prepare()).resolves.toBeUndefined();
  });

  it('asks for the battery exemption once, then remembers it asked', async () => {
    setApiLevel(34);
    const store = new MemoryStore();
    const host = createBackgroundHost(store);

    await host.prepare();
    expect(startActivity).toHaveBeenCalledTimes(1);
    expect(startActivity).toHaveBeenCalledWith(REQUEST, { data: 'package:io.github.abhisheksao.cadence' });
    expect(store.getSync(BATTERY_ASKED_KEY)).toBe('1');

    await host.prepare();
    await createBackgroundHost(store).prepare();
    expect(startActivity).toHaveBeenCalledTimes(1);
  });

  it('marks the exemption as asked even if the request cannot be shown', async () => {
    setApiLevel(34);
    const store = new MemoryStore();
    startActivity.mockRejectedValue(new Error('ActivityNotFoundException'));
    await expect(createBackgroundHost(store).prepare()).resolves.toBeUndefined();
    expect(store.getSync(BATTERY_ASKED_KEY)).toBe('1');
    startActivity.mockReset();
  });

  it('requestBatteryExemption opens the request for this app', async () => {
    await createBackgroundHost(new MemoryStore()).requestBatteryExemption();
    expect(startActivity).toHaveBeenCalledWith(REQUEST, { data: 'package:io.github.abhisheksao.cadence' });
  });

  it('requestBatteryExemption falls back to the settings screen when the request throws', async () => {
    startActivity.mockRejectedValueOnce(new Error('ActivityNotFoundException'));
    await createBackgroundHost(new MemoryStore()).requestBatteryExemption();
    expect(startActivity).toHaveBeenLastCalledWith(SETTINGS);
  });
});
