import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';

export type NotificationTimer =
  | { kind: 'countdown'; remainingMs: number }
  | { kind: 'elapsed'; elapsedMs: number }
  | null;

export type NotificationPayload = {
  title: string;
  text: string;
  timer: NotificationTimer;
  paused: boolean;
};

export type SessionActionEvent = {
  sessionId: string;
  action: 'pause' | 'resume' | 'skip';
};

export type TaskRemovedEvent = {
  sessionId: string;
};

export type FocusLostEvent = Record<string, never>;

export type CadenceSessionModuleEvents = {
  onAction: (event: SessionActionEvent) => void;
  onTaskRemoved: (event: TaskRemovedEvent) => void;
  onFocusLost: (event: FocusLostEvent) => void;
};

export interface CadenceSessionModule {
  // Clock (sync, JSI)
  elapsedRealtime(): number;
  bootCount(): number | null;

  // Service
  startService(args: NotificationPayload & { sessionId: string; route: string }): Promise<boolean>;
  updateNotification(p: NotificationPayload): void;
  heartbeat(): void;
  stopService(): Promise<void>;

  // Focus and vibration (sync)
  requestFocus(): boolean;
  abandonFocus(): void;
  vibrate(ms: number): void;

  // Events
  addListener<EventName extends keyof CadenceSessionModuleEvents>(
    eventName: EventName,
    listener: CadenceSessionModuleEvents[EventName]
  ): EventSubscription;
}

export default requireOptionalNativeModule<CadenceSessionModule>('CadenceSession');
