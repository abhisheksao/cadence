export interface AudioFocus {
  request(): boolean;
  abandon(): void;
  onLoss(fn: () => void): () => void;
}

// Metro loads audio.android.ts or audio.ios.ts instead of this file. This export is for the type
// checker and other platforms (web), which get the iOS fallback.
export { audioFocus, audioInterruptionMode, vibrate } from './audio.ios';
