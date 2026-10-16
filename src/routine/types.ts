/** One item of the morning routine. */
export type Step = {
  /** Unique within the routine; stable across edits and reordering. */
  id: string;
  /** May be blank; shown and spoken as "Step N" then (FR-006). */
  title: string;
  /** Whole seconds, 15–3600, or null for an untimed step that waits for Done. */
  durationSec: number | null;
};

/** The user's single morning routine, stored as JSON under `routine:v1`. */
export type Routine = {
  version: 1;
  steps: Step[];
};
