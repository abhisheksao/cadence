/**
 * Keeps a session running with the screen off (contracts/platform.md). Metro picks
 * background.android.ts or background.ios.ts; shared code imports this interface only.
 */
export interface BackgroundHost {
  /** Whether the platform has a battery exemption to ask for (Android only). */
  readonly canRequestBatteryExemption: boolean;
  /** Ask for notification permission (Android 13+) and, once ever, the battery exemption. */
  prepare(): Promise<void>;
  /** Start the foreground service. Resolves false if the OS refused. */
  start(info: { title: string; text: string; keepAliveUntil: Promise<void> }): Promise<boolean>;
  /** Update the notification text. Phase changes and pause/resume only, never per second. */
  update(text: string): void;
  stop(): Promise<void>;
  /** Open the battery-optimisation request, or its settings screen. */
  requestBatteryExemption(): Promise<void>;
}

// Metro loads background.android.ts or background.ios.ts instead of this file. This export is for
// the type checker and other platforms (web), which get the no-op iOS placeholder.
export { backgroundHost } from './background.ios';
