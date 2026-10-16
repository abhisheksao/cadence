import { useSyncExternalStore } from 'react';

import { kvStore } from '@/storage/kv';

import { RunWalkStore } from './store';
import type { RunWalkSettings } from './types';

/** The app's single run / walk settings store, over the device key-value store. */
export const runWalkStore = new RunWalkStore({ store: kvStore });

/** The saved run / walk settings for screens, plus the store to change them. */
export function useRunWalk(): { settings: RunWalkSettings; store: RunWalkStore } {
  const settings = useSyncExternalStore(
    (onChange) => runWalkStore.subscribe(onChange),
    () => runWalkStore.get(),
  );
  return { settings, store: runWalkStore };
}
