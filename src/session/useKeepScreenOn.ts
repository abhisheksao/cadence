import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import type { Status } from '@/engine/types';

import type { SessionDefinition } from './types';

export const KEEP_AWAKE_TAG = 'cadence-session';

/**
 * Keeps the screen on while this screen is mounted and a session that asks for it is running
 * or paused (FR-021a, research R8). Cues play either way.
 */
export function useKeepScreenOn(definition: SessionDefinition | undefined, status: Status | undefined) {
  const active = definition?.keepScreenOn === true && (status === 'running' || status === 'paused');

  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active]);
}
