import type { BackgroundHost, SessionAction } from './background';

/**
 * Placeholder until spec 008 (silent-audio keep-alive and Live Activities). Sessions run while
 * the app is in front; background execution is not guaranteed on iOS yet.
 */
export const backgroundHost: BackgroundHost = {
  canRequestBatteryExemption: false,
  async prepare() {},
  async start() {
    return true;
  },
  update() {},
  heartbeat() {},
  onAction(_fn: (action: SessionAction) => void) {
    return () => {};
  },
  onTaskRemoved(_fn: () => void) {
    return () => {};
  },
  async stop() {},
  async requestBatteryExemption() {},
};
