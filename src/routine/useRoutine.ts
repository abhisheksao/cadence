import { useSyncExternalStore } from 'react';

import { kvStore } from '@/storage/kv';

import { newStepId } from './ids';
import { RoutineStore } from './store';
import type { Routine } from './types';

/** The app's single routine store, over the device key-value store. */
export const routineStore = new RoutineStore({ store: kvStore, newId: newStepId });

/** The saved routine for screens, plus the store to change it. */
export function useRoutine(): { routine: Routine; store: RoutineStore } {
  const routine = useSyncExternalStore(
    (onChange) => routineStore.subscribe(onChange),
    () => routineStore.get(),
  );
  return { routine, store: routineStore };
}
