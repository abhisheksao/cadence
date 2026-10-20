import type { AudioFocus } from './audio';

export const audioFocus: AudioFocus = {
  request: () => true,
  abandon: () => {},
  onLoss: () => () => {},
};

export function vibrate(_ms: number) {
  // No-op off Android (FR-021 Q4)
}

export const audioInterruptionMode = 'duckOthers' as const;
