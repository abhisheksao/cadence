import { createCuePlayer } from '@/audio/cuePlayer';
import { systemScheduler } from '@/engine/clock';
import { modes } from '@/modes';
import { backgroundHost } from '@/platform/background';
import { sessionClock } from '@/platform/clock';
import { kvStore } from '@/storage/kv';

import { SessionController } from './controller';

/** The app's single session controller, wired to the real adapters. */
export const sessionController = new SessionController({
  clock: sessionClock,
  scheduler: systemScheduler,
  player: createCuePlayer({ clock: sessionClock }),
  background: backgroundHost,
  store: kvStore,
  modes,
});
