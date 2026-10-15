import { createModeRegistry } from './registry';
import { routineMode } from './routine';
import { runWalkMode } from './runWalk';
import { sampleMode } from './sample';

/** Every mode the app knows. Spec 004 registers its own here. */
export const modes = createModeRegistry();
modes.register(sampleMode);
modes.register(routineMode);
modes.register(runWalkMode);
