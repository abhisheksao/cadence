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
