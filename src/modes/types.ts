import type { CueHandler } from '@/engine/types';
import type { Json, SessionDefinition } from '@/session/types';

/** A mode's code: builds the cue logic for a stored session definition. */
export interface ModeDefinition<S extends Json = Json> {
  id: string;
  /** Must be deterministic, so a recovered session gets the same cues. */
  cueFor(definition: SessionDefinition<S>): CueHandler;
}

export interface ModeRegistry {
  register(mode: ModeDefinition): void;
  get(id: string): ModeDefinition | undefined;
  has(id: string): boolean;
}
