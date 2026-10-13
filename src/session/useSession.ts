import { useSyncExternalStore } from 'react';

import type { SessionController, SessionState } from './controller';
import { sessionController } from './index';

/** The live session state for screens, plus the controller to act on it. */
export function useSession(): { state: SessionState | null; controller: SessionController } {
  const state = useSyncExternalStore(
    (onChange) => sessionController.subscribe(onChange),
    () => sessionController.getState(),
  );
  return { state, controller: sessionController };
}
