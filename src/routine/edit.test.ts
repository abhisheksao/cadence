import { addStep, deleteStep, moveStep, normaliseDuration, restoreStep, updateStep } from './edit';
import type { Routine } from './types';

const routine = (n: number): Routine => ({
  version: 1,
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `T${i}`, durationSec: 60 })),
});
const ids = (r: Routine) => r.steps.map((s) => s.id);

describe('normaliseDuration', () => {
  it.each([
    [0, 15],
    [5, 15],
    [14, 15],
    [15, 15],
    [90.4, 90],
    [90.6, 91],
    [3_600, 3_600],
    [3_601, 3_600],
    [NaN, 15],
  ])('%p → %p', (input, output) => {
    expect(normaliseDuration(input)).toBe(output);
  });
});

describe('updateStep', () => {
  it('clamps the title to 60 characters', () => {
    const next = updateStep(routine(2), 's1', { title: 'x'.repeat(80) });
    expect(next.steps[1].title).toHaveLength(60);
  });

  it('normalises a duration and accepts null for untimed', () => {
    expect(updateStep(routine(1), 's0', { durationSec: 5 }).steps[0].durationSec).toBe(15);
    expect(updateStep(routine(1), 's0', { durationSec: null }).steps[0].durationSec).toBeNull();
  });

  it('leaves other steps alone and ignores unknown ids', () => {
    const r = routine(2);
    expect(updateStep(r, 's0', { title: 'New' }).steps[1]).toBe(r.steps[1]);
    expect(updateStep(r, 'nope', { title: 'New' })).toBe(r);
  });
});

describe('addStep', () => {
  it('appends a 2-minute step with an empty title', () => {
    const next = addStep(routine(2), 'new');
    expect(next.steps[2]).toEqual({ id: 'new', title: '', durationSec: 120 });
  });

  it('does nothing at 30 steps', () => {
    const r = routine(30);
    expect(addStep(r, 'new')).toBe(r);
  });
});

describe('moveStep', () => {
  it('moves a step up or down', () => {
    expect(ids(moveStep(routine(3), 's1', -1))).toEqual(['s1', 's0', 's2']);
    expect(ids(moveStep(routine(3), 's1', 1))).toEqual(['s0', 's2', 's1']);
  });

  it('does nothing at either end', () => {
    const r = routine(3);
    expect(moveStep(r, 's0', -1)).toBe(r);
    expect(moveStep(r, 's2', 1)).toBe(r);
  });
});

describe('deleteStep / restoreStep', () => {
  it('removes a step and reports it with its index', () => {
    const r = routine(3);
    const { routine: next, removed } = deleteStep(r, 's1');
    expect(ids(next)).toEqual(['s0', 's2']);
    expect(removed).toEqual({ step: r.steps[1], index: 1 });
  });

  it('never deletes the only step', () => {
    const r = routine(1);
    expect(deleteStep(r, 's0')).toEqual({ routine: r, removed: null });
  });

  it('restores a step in its old place', () => {
    const { routine: next, removed } = deleteStep(routine(3), 's1');
    expect(ids(restoreStep(next, removed!))).toEqual(['s0', 's1', 's2']);
  });

  it('restores at the end if the list has shrunk since', () => {
    const { routine: next, removed } = deleteStep(routine(3), 's2');
    const shorter = deleteStep(next, 's1').routine;
    expect(ids(restoreStep(shorter, removed!))).toEqual(['s0', 's2']);
  });

  it('does not restore a step that is already there, or past 30 steps', () => {
    const r = routine(3);
    expect(restoreStep(r, { step: r.steps[0], index: 0 })).toBe(r);
    const full = routine(30);
    expect(restoreStep(full, { step: { id: 'x', title: '', durationSec: 60 }, index: 0 })).toBe(full);
  });
});
