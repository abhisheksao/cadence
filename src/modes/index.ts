import { createModeRegistry } from './registry';
import { routineMode } from './routine';
import { sampleMode } from './sample';

/** Every mode the app knows. Specs 003–004 register theirs here. */
export const modes = createModeRegistry();
modes.register(sampleMode);
modes.register(routineMode);
