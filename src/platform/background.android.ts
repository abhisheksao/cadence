import Constants from 'expo-constants';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';

import { kvStore } from '@/storage/kv';
import type { KeyValueStore } from '@/storage/types';

import type { BackgroundHost } from './background';

/** Set once the battery exemption has been asked for, so it is asked only once (FR-017). */
export const BATTERY_ASKED_KEY = 'battery-exemption-asked:v1';

/** Notification permission exists from Android 13 (API 33). */
const NOTIFICATION_PERMISSION_API = 33;

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
 * Runs the session inside an Android foreground service (research R5), which keeps the JS
 * timers and audio going with the screen off. The service's task simply waits for the session.
 */
export function createBackgroundHost(store: KeyValueStore): BackgroundHost {
  return {
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

    async start({ title, text, keepAliveUntil }) {
      try {
        if (BackgroundService.isRunning()) await BackgroundService.stop();
        await BackgroundService.start(() => keepAliveUntil, {
          taskName: 'CadenceSession',
          taskTitle: title,
          taskDesc: text,
          taskIcon: { name: 'ic_launcher', type: 'mipmap' },
          color: '#FF7A45',
          foregroundServiceType: ['mediaPlayback'],
        });
        return true;
      } catch (e) {
        console.warn('Background service failed to start; cues may stop when the screen is off.', e);
        return false;
      }
    },

    update(text) {
      if (BackgroundService.isRunning()) BackgroundService.updateNotification({ taskDesc: text }).catch(() => {});
    },

    async stop() {
      if (BackgroundService.isRunning()) await BackgroundService.stop();
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
