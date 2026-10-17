import type { NotificationState } from './notification';

export type SessionAction = 'pause' | 'resume' | 'skip';

/**
 * Keeps a session running with the screen off. Metro picks
 * background.android.ts or background.ios.ts; shared code imports this interface only.
 */
export interface BackgroundHost {
  /** Whether the platform has a battery exemption to ask for (Android only). */
  readonly canRequestBatteryExemption: boolean;
  /** Ask for notification permission (Android 13+) and, once ever, the battery exemption. */
  prepare(): Promise<void>;
  /** Start the foreground service. Resolves false if the OS refused. */
  start(info: {
    sessionId: string;
    route: string;
    notification: NotificationState;
    keepAliveUntil: Promise<void>;
  }): Promise<boolean>;
  /** Update the notification state. Phase changes and pause/resume only, never per second. */
  update(notification: NotificationState): void;
  /** Keep-alive pulse for the native watchdog (FR-026). */
  heartbeat(): void;
  /** Subscribes to notification button actions (pause, resume, skip). */
  onAction(fn: (action: SessionAction) => void): () => void;
  /** Subscribes to swipe-away notifications from the native service (FR-025). */
  onTaskRemoved(fn: () => void): () => void;
  stop(): Promise<void>;
  /** Open the battery-optimisation request, or its settings screen. */
  requestBatteryExemption(): Promise<void>;
}

// Metro loads background.android.ts or background.ios.ts instead of this file. This export is for
// the type checker and other platforms (web), which get the no-op iOS placeholder.
export { backgroundHost } from './background.ios';
