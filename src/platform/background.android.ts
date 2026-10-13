import BackgroundService from 'react-native-background-actions';

import type { BackgroundHost } from './background';

/**
 * Runs the session inside an Android foreground service (research R5), which keeps the JS
 * timers and audio going with the screen off. The service's task simply waits for the session.
 */
export const backgroundHost: BackgroundHost = {
  async prepare() {
    // Notification permission and battery exemption: User Story 4.
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
    // User Story 4.
  },
};
