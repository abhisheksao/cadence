import * as IntentLauncher from 'expo-intent-launcher';
import { AppRegistry, PermissionsAndroid, Platform } from 'react-native';

import { MemoryStore } from '@/test-utils/fakes';

import { BATTERY_ASKED_KEY, createBackgroundHost } from './background.android';

const mockModule = {
  startService: jest.fn(() => Promise.resolve(true)),
  updateNotification: jest.fn(),
  heartbeat: jest.fn(),
  stopService: jest.fn(() => Promise.resolve()),
  addListener: jest.fn((_event: string, _fn: (...args: unknown[]) => void) => ({
    remove: jest.fn(),
  })),
};

jest.mock('modules/cadence-session', () => ({
  __esModule: true,
  default: mockModule,
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

const startActivity = jest.mocked(IntentLauncher.startActivityAsync);
const backgroundHost = createBackgroundHost(new MemoryStore());

const REQUEST = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
const SETTINGS = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';

function setApiLevel(version: number) {
  Object.defineProperty(Platform, 'Version', { get: () => version, configurable: true });
}

describe('Android background host: service (US1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('can ask for the battery exemption', () => {
    expect(backgroundHost.canRequestBatteryExemption).toBe(true);
  });

  it('start calls startService with sessionId, route, and notification payload and returns true', async () => {
    const keepAliveUntil = Promise.resolve();
    const result = await backgroundHost.start({
      sessionId: 'sess-123',
      route: '/routine',
      notification: {
        title: 'Morning Routine',
        text: 'Pushups',
        timer: { kind: 'countdown', remainingMs: 30_000 },
        paused: false,
      },
      keepAliveUntil,
    });

    expect(result).toBe(true);
    expect(mockModule.startService).toHaveBeenCalledTimes(1);
    expect(mockModule.startService).toHaveBeenCalledWith({
      sessionId: 'sess-123',
      route: '/routine',
      title: 'Morning Routine',
      text: 'Pushups',
      timer: { kind: 'countdown', remainingMs: 30_000 },
      paused: false,
    });
  });

  it('start resolves false and warns when startService rejects', async () => {
    mockModule.startService.mockRejectedValueOnce(new Error('ForegroundServiceStartNotAllowedException'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await backgroundHost.start({
      sessionId: 'sess-err',
      route: '/routine',
      notification: {
        title: 'Morning Routine',
        text: 'Pushups',
        timer: null,
        paused: false,
      },
      keepAliveUntil: Promise.resolve(),
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('update calls updateNotification with the notification payload', () => {
    const notification = {
      title: 'Morning Routine',
      text: 'Paused · Pushups · 0:25 left',
      timer: null,
      paused: true,
    };
    backgroundHost.update(notification);
    expect(mockModule.updateNotification).toHaveBeenCalledWith(notification);
  });

  it('heartbeat calls module heartbeat', () => {
    backgroundHost.heartbeat();
    expect(mockModule.heartbeat).toHaveBeenCalledTimes(1);
  });

  it('stop calls stopService', async () => {
    await backgroundHost.stop();
    expect(mockModule.stopService).toHaveBeenCalledTimes(1);
  });

  it('onAction subscribes to module onAction and returned function removes listener', () => {
    const removeFn = jest.fn();
    mockModule.addListener.mockReturnValueOnce({ remove: removeFn });
    const actionListener = jest.fn();

    const unsubscribe = backgroundHost.onAction(actionListener);
    expect(mockModule.addListener).toHaveBeenCalledWith('onAction', expect.any(Function));

    unsubscribe();
    expect(removeFn).toHaveBeenCalledTimes(1);
  });

  it('onTaskRemoved subscribes to module onTaskRemoved and returned function removes listener', () => {
    const removeFn = jest.fn();
    mockModule.addListener.mockReturnValueOnce({ remove: removeFn });
    const taskRemovedListener = jest.fn();

    const unsubscribe = backgroundHost.onTaskRemoved(taskRemovedListener);
    expect(mockModule.addListener).toHaveBeenCalledWith('onTaskRemoved', expect.any(Function));

    unsubscribe();
    expect(removeFn).toHaveBeenCalledTimes(1);
  });

  it('registers the headless task CadenceSession with AppRegistry and resolves on keepAliveUntil', async () => {
    const registerSpy = jest.spyOn(AppRegistry, 'registerHeadlessTask');
    // Re-create host or check registration
    expect(registerSpy).toHaveBeenCalledWith('CadenceSession', expect.any(Function));

    const taskFactory = registerSpy.mock.calls.find((call) => call[0] === 'CadenceSession')?.[1];
    expect(taskFactory).toBeDefined();

    let resolveKeepAlive!: () => void;
    const keepAliveUntil = new Promise<void>((resolve) => {
      resolveKeepAlive = resolve;
    });

    await backgroundHost.start({
      sessionId: 'sess-task',
      route: '/routine',
      notification: {
        title: 'Morning Routine',
        text: 'Pushups',
        timer: null,
        paused: false,
      },
      keepAliveUntil,
    });

    const task = taskFactory!();
    const taskPromise = task({});
    resolveKeepAlive();
    await expect(taskPromise).resolves.toBeUndefined();
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
