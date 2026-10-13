import { createCuePlayer } from '@/audio/cuePlayer';
import { systemClock, systemScheduler } from '@/engine/clock';
import { modes } from '@/modes';
import { backgroundHost } from '@/platform/background';
import { kvStore } from '@/storage/kv';

import { SessionController } from './controller';

/** The app's single session controller, wired to the real adapters. */
export const sessionController = new SessionController({
  clock: systemClock,
  scheduler: systemScheduler,
  player: createCuePlayer(),
  background: backgroundHost,
  store: kvStore,
  modes,
});
