import type { SessionDefinition } from './types';

/** Returns every problem with a definition; an empty list means it can be started. */
export function validateDefinition(definition: SessionDefinition, isKnownMode: (id: string) => boolean): string[] {
  const errors: string[] = [];
  if (!isKnownMode(definition.modeId)) errors.push(`modeId: unknown mode "${definition.modeId}"`);
  if (definition.title.trim() === '') errors.push('title: must not be blank');
  if (definition.phases.length === 0) errors.push('phases: must not be empty');
  definition.phases.forEach((phase, i) => {
    if (phase.title.trim() === '') errors.push(`phases[${i}].title: must not be blank`);
    const d = phase.durationSec;
    if (d !== null && !(Number.isInteger(d) && d >= 1)) {
      errors.push(`phases[${i}].durationSec: must be a whole number of seconds ≥ 1, or null`);
    }
  });
  return errors;
}
