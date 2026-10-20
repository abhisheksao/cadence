import Constants from 'expo-constants';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import { AppRegistry, PermissionsAndroid, Platform } from 'react-native';
import cadenceSession from 'modules/cadence-session';

import { kvStore } from '@/storage/kv';
import type { KeyValueStore } from '@/storage/types';

import type { BackgroundHost, SessionAction } from './background';

/** Set once the battery exemption has been asked for, so it is asked only once (FR-017). */
export const BATTERY_ASKED_KEY = 'battery-exemption-asked:v1';

/** Notification permission exists from Android 13 (API 33). */
const NOTIFICATION_PERMISSION_API = 33;

let activeKeepAlive: Promise<void> | null = null;
let taskRegistered = false;

export function registerCadenceSessionTask(force = false) {
  if (taskRegistered && !force) return;
  taskRegistered = true;
  AppRegistry.registerHeadlessTask('CadenceSession', () => async () => {
    if (activeKeepAlive) {
      await activeKeepAlive;
    }
  });
}

// Register headless task once at module load time (research R1)
registerCadenceSessionTask();

async function requestNotificationPermission() {
  if (Number(Platform.Version) < NOTIFICATION_PERMISSION_API) return;
  try {
    // Denied is fine: the session still runs, the notification is just hidden (FR-016).
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch (e) {
    console.warn('Could not request notification permission.', e);
  }
}

/** Opens the system's "let this app run in the background?" dialog, or its settings screen. */
async function openBatteryExemption() {
  const packageName = Constants.expoConfig?.android?.package;
  try {
    await startActivityAsync(ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${packageName}` });
  } catch {
    // Some OEM builds have no request dialog; the list screen lets the user find the app.
    await startActivityAsync(ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  }
}

/**
 * Runs the session inside Cadence's own Android foreground service, which keeps the JS
 * timers and audio going with the screen off.
 */
export function createBackgroundHost(store: KeyValueStore): BackgroundHost {
  return {
    canRequestBatteryExemption: true,

    async prepare() {
      await requestNotificationPermission();
      if (store.getSync(BATTERY_ASKED_KEY) !== null) return;
      try {
        await openBatteryExemption();
      } catch (e) {
        console.warn('Could not ask for the battery exemption.', e);
      }
      await store.set(BATTERY_ASKED_KEY, '1');
    },

    async start({ sessionId, route, notification, keepAliveUntil }) {
      activeKeepAlive = keepAliveUntil;
      try {
        const started = await cadenceSession?.startService({
          sessionId,
          route,
          ...notification,
        });
        return started ?? false;
      } catch (e) {
        console.warn('Background service failed to start; cues may stop when the screen is off.', e);
        return false;
      }
    },

    update(notification) {
      cadenceSession?.updateNotification(notification);
    },

    heartbeat() {
      cadenceSession?.heartbeat();
    },

    onAction(fn: (action: SessionAction) => void) {
      const subscription = cadenceSession?.addListener('onAction', (event) => {
        fn(event.action);
      });
      return () => {
        subscription?.remove();
      };
    },

    onTaskRemoved(fn: () => void) {
      const subscription = cadenceSession?.addListener('onTaskRemoved', () => {
        fn();
      });
      return () => {
        subscription?.remove();
      };
    },

    async stop() {
      await cadenceSession?.stopService();
    },

    async requestBatteryExemption() {
      try {
        await openBatteryExemption();
      } catch (e) {
        console.warn('Could not open the battery settings.', e);
      }
    },
  };
}

export const backgroundHost = createBackgroundHost(kvStore);
