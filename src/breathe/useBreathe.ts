import { useSyncExternalStore } from 'react';

import { kvStore } from '@/storage/kv';

import { BreatheStore } from './store';
import type { BreatheSettings } from './types';

/** The app's single guided breathing settings store, over the on-device key-value store. */
export const breatheStore = new BreatheStore({ store: kvStore });

/** The saved breathing settings for screens, plus the store to update them. */
export function useBreathe(): { settings: BreatheSettings; store: BreatheStore } {
  const settings = useSyncExternalStore(
    (onChange) => breatheStore.subscribe(onChange),
    () => breatheStore.get(),
  );
  return { settings, store: breatheStore };
}
