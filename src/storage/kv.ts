import Storage from 'expo-sqlite/kv-store';

import type { KeyValueStore } from './types';

/** KeyValueStore backed by expo-sqlite's kv-store (research R7). */
export const kvStore: KeyValueStore = {
  getSync: (key) => Storage.getItemSync(key),
  set: (key, value) => Storage.setItem(key, value),
  remove: (key) => Storage.removeItem(key),
};
