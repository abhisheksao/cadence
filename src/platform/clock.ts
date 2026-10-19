import type { Clock } from '@/engine/clock';

export interface SessionClock extends Clock {
  /** Wall time in ms, anchored to elapsed time where available. */
  now(): number;
  /** Raw elapsedRealtime in ms (including sleep), or null off Android. */
  elapsed(): number | null;
  /** Boot count of the device, or null off Android or if unavailable. */
  bootCount(): number | null;
}

// Metro loads clock.android.ts or clock.ios.ts instead of this file. This export is for the type
// checker and other platforms (web), which get the iOS fallback.
export { sessionClock } from './clock.ios';
