import type { ModeDefinition, ModeRegistry } from './types';

export function createModeRegistry(): ModeRegistry {
  const modes = new Map<string, ModeDefinition>();
  return {
    register(mode) {
      if (modes.has(mode.id)) throw new Error(`Mode "${mode.id}" is already registered`);
      modes.set(mode.id, mode);
    },
    get: (id) => modes.get(id),
    has: (id) => modes.has(id),
  };
}
