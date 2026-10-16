let counter = 0;

/** A step id unique on this device: the time plus a counter, in base 36 (research R5). */
export function newStepId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
