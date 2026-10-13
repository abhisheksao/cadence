import type { BackgroundHost } from './background';

/**
 * Placeholder until spec 008 (silent-audio keep-alive and Live Activities). Sessions run while
 * the app is in front; background execution is not guaranteed on iOS yet.
 */
export const backgroundHost: BackgroundHost = {
  async prepare() {},
  async start() {
    return true;
  },
  update() {},
  async stop() {},
  async requestBatteryExemption() {},
};
