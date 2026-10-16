import { MemoryStore } from '@/test-utils/fakes';

import { defaultSettings } from './settings';
import { RUN_WALK_KEY, RunWalkStore, parseRunWalk } from './store';
import type { RunWalkSettings } from './types';

const custom: RunWalkSettings = {
  version: 1,
  warmupSec: 0,
  runSec: 120,
  walkSec: 45,
  rounds: 5,
  cooldownSec: 600,
  announceRound: false,
  halfway: true,
  timeLeft: false,
  keepScreenOn: true,
};

describe('parseRunWalk', () => {
  it('reads back stored settings', () => {
    expect(parseRunWalk(JSON.stringify(custom))).toEqual(custom);
  });

  it.each([
    ['nothing stored', null],
    ['bad JSON', '{oops'],
    ['a non-object', '42'],
    ['null JSON', 'null'],
    ['another version', JSON.stringify({ ...custom, version: 2 })],
    ['no version', JSON.stringify({ ...custom, version: undefined })],
  ])('rejects %s', (_name, raw) => {
    expect(parseRunWalk(raw)).toBeNull();
  });

  it('WS5: repairs out-of-range, off-step, or missing fields while keeping valid fields', () => {
    const raw = JSON.stringify({
      version: 1,
      runSec: 5, // -> 15 (min)
      walkSec: 100, // -> 105 (snapped to step 15)
      rounds: 0, // -> 1 (min)
      warmupSec: 2_000, // -> 1800 (max)
      // cooldownSec missing -> 300 (default)
      announceRound: false, // valid -> false kept
      halfway: 'yes', // non-boolean -> true (default)
      timeLeft: false, // valid -> false kept
      keepScreenOn: true, // valid -> true kept
    });

    const parsed = parseRunWalk(raw);
    expect(parsed).toEqual({
      version: 1,
      warmupSec: 1_800,
      runSec: 15,
      walkSec: 105,
      rounds: 1,
      cooldownSec: 300,
      announceRound: false,
      halfway: true,
      timeLeft: false,
      keepScreenOn: true,
    });
  });

  it('WS5: repairs rounds 99 to 30 and run 100 to 105', () => {
    const raw = JSON.stringify({
      version: 1,
      runSec: 100,
      rounds: 99,
    });
    const parsed = parseRunWalk(raw);
    expect(parsed?.runSec).toBe(105);
    expect(parsed?.rounds).toBe(30);
  });
});

describe('RunWalkStore', () => {
  it('WS4: with nothing stored, returns the defaults and saves them', () => {
    const store = new MemoryStore();
    const settings = new RunWalkStore({ store });
    expect(settings.get()).toEqual(defaultSettings());
    expect(parseRunWalk(store.getSync(RUN_WALK_KEY))).toEqual(defaultSettings());
  });

  it.each([
    ['unreadable JSON', '{oops'],
    ['another version', JSON.stringify({ ...custom, version: 9 })],
  ])('WS4: replaces %s with the defaults', (_name, raw) => {
    const store = new MemoryStore();
    store.data.set(RUN_WALK_KEY, raw);
    expect(new RunWalkStore({ store }).get()).toEqual(defaultSettings());
    expect(parseRunWalk(store.getSync(RUN_WALK_KEY))).toEqual(defaultSettings());
  });

  it('loads saved settings without rewriting them', () => {
    const store = new MemoryStore();
    store.data.set(RUN_WALK_KEY, JSON.stringify(custom));
    const set = jest.spyOn(store, 'set');
    expect(new RunWalkStore({ store }).get()).toEqual(custom);
    expect(set).not.toHaveBeenCalled();
  });

  it('WS6: update notifies subscribers and saves the whole value', () => {
    const store = new MemoryStore();
    const settings = new RunWalkStore({ store });
    const seen: RunWalkSettings[] = [];
    const unsubscribe = settings.subscribe((s) => seen.push(s));

    settings.update((s) => ({ ...s, rounds: 3 }));
    expect(seen).toEqual([{ ...defaultSettings(), rounds: 3 }]);
    expect(settings.get().rounds).toBe(3);
    expect(parseRunWalk(store.getSync(RUN_WALK_KEY))).toEqual({ ...defaultSettings(), rounds: 3 });

    unsubscribe();
    settings.update((s) => ({ ...s, rounds: 4 }));
    expect(seen).toHaveLength(1);
  });

  it('WS6: a new store over the same data returns the saved settings', () => {
    const store = new MemoryStore();
    new RunWalkStore({ store }).update(() => custom);
    expect(new RunWalkStore({ store }).get()).toEqual(custom);
  });

  it('does not notify or save when update returns the same value', () => {
    const store = new MemoryStore();
    const settings = new RunWalkStore({ store });
    settings.get();
    const set = jest.spyOn(store, 'set');
    const fn = jest.fn();
    settings.subscribe(fn);
    settings.update((s) => s);
    expect(fn).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('warns and keeps the value in memory when saving fails', async () => {
    const store = new MemoryStore();
    jest.spyOn(store, 'set').mockRejectedValue(new Error('disk full'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const settings = new RunWalkStore({ store });
    settings.update((s) => ({ ...s, rounds: 2 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(settings.get().rounds).toBe(2);
    expect(warn).toHaveBeenCalledWith('Could not save the run / walk settings', expect.any(Error));
    warn.mockRestore();
  });
});
