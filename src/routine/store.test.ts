import { MemoryStore } from '@/test-utils/fakes';

import { defaultRoutine } from './defaults';
import { ROUTINE_KEY, RoutineStore, parseRoutine } from './store';
import type { Routine } from './types';

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

const routine: Routine = {
  version: 1,
  steps: [
    { id: 'a', title: 'Water', durationSec: 60 },
    { id: 'b', title: '', durationSec: null },
  ],
};

describe('parseRoutine', () => {
  it('reads back a stored routine', () => {
    expect(parseRoutine(JSON.stringify(routine))).toEqual(routine);
  });

  const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: 'x', durationSec: 60 }));
  it.each([
    ['nothing stored', null],
    ['bad JSON', '{oops'],
    ['another version', JSON.stringify({ ...routine, version: 2 })],
    ['no steps', JSON.stringify({ version: 1, steps: [] })],
    ['more than 30 steps', JSON.stringify({ version: 1, steps: steps(31) })],
    ['duplicate ids', JSON.stringify({ version: 1, steps: [routine.steps[0], routine.steps[0]] })],
    ['a non-string title', JSON.stringify({ version: 1, steps: [{ id: 'a', title: 3, durationSec: 60 }] })],
    ['a duration below 15 s', JSON.stringify({ version: 1, steps: [{ id: 'a', title: 'x', durationSec: 14 }] })],
    ['a duration above 60 min', JSON.stringify({ version: 1, steps: [{ id: 'a', title: 'x', durationSec: 3_601 }] })],
    ['a fractional duration', JSON.stringify({ version: 1, steps: [{ id: 'a', title: 'x', durationSec: 20.5 }] })],
    ['a missing duration', JSON.stringify({ version: 1, steps: [{ id: 'a', title: 'x' }] })],
  ])('rejects %s', (_name, raw) => {
    expect(parseRoutine(raw)).toBeNull();
  });

  it('accepts exactly 30 steps', () => {
    expect(parseRoutine(JSON.stringify({ version: 1, steps: steps(30) }))?.steps).toHaveLength(30);
  });
});

describe('RoutineStore', () => {
  it('RS1: with nothing stored, returns the default routine and saves it', () => {
    const store = new MemoryStore();
    const routines = new RoutineStore({ store, newId: ids() });
    expect(routines.get()).toEqual(defaultRoutine(ids()));
    expect(parseRoutine(store.getSync(ROUTINE_KEY))).toEqual(routines.get());
  });

  it('RS1: replaces an unreadable value with the default', () => {
    const store = new MemoryStore();
    store.data.set(ROUTINE_KEY, '{"version":9}');
    expect(new RoutineStore({ store, newId: ids() }).get().steps).toHaveLength(6);
    expect(parseRoutine(store.getSync(ROUTINE_KEY))?.steps).toHaveLength(6);
  });

  it('RS1: loads a saved routine without touching it', () => {
    const store = new MemoryStore();
    store.data.set(ROUTINE_KEY, JSON.stringify(routine));
    expect(new RoutineStore({ store, newId: ids() }).get()).toEqual(routine);
  });

  it('RS2: update notifies subscribers and saves the whole routine', () => {
    const store = new MemoryStore();
    const routines = new RoutineStore({ store, newId: ids() });
    const seen: Routine[] = [];
    const unsubscribe = routines.subscribe((r) => seen.push(r));

    routines.update((r) => ({ ...r, steps: r.steps.slice(0, 2) }));
    unsubscribe();
    routines.update((r) => ({ ...r, steps: r.steps.slice(0, 1) }));

    expect(seen).toHaveLength(1);
    expect(seen[0].steps).toHaveLength(2);
    expect(parseRoutine(store.getSync(ROUTINE_KEY))?.steps).toHaveLength(1);
  });

  it('RS3: a new store over the same data returns the last saved routine', () => {
    const store = new MemoryStore();
    new RoutineStore({ store, newId: ids() }).update(() => routine);
    expect(new RoutineStore({ store, newId: ids() }).get()).toEqual(routine);
  });

  it('RS4: restoreDefault saves the default routine with fresh ids', () => {
    const store = new MemoryStore();
    const routines = new RoutineStore({ store, newId: ids() });
    const firstIds = routines.get().steps.map((s) => s.id);
    routines.update(() => routine);

    routines.restoreDefault();

    const restored = routines.get();
    expect(restored.steps.map((s) => s.title)).toEqual(defaultRoutine(ids()).steps.map((s) => s.title));
    expect(restored.steps.map((s) => s.id).some((id) => firstIds.includes(id))).toBe(false);
    expect(parseRoutine(store.getSync(ROUTINE_KEY))).toEqual(restored);
  });
});
