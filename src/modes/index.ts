import { createModeRegistry } from './registry';
import { sampleMode } from './sample';

/** Every mode the app knows. Specs 002–004 register theirs here. */
export const modes = createModeRegistry();
modes.register(sampleMode);
