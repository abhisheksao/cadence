import { MemoryStore } from '@/test-utils/fakes';

import { defaultSettings } from './settings';
import { BREATHE_KEY, BreatheStore, parseBreathe } from './store';
import type { BreatheSettings } from './types';

const custom: BreatheSettings = {
  version: 1,
  inhaleSec: 5,
  holdSec: 2,
  exhaleSec: 6,
  postHoldSec: 1,
  targetMinutes: 4,
  prepEnabled: false,
  cueStyle: 'tones',
  keepScreenOn: true,
};

describe('parseBreathe', () => {
  it('reads back stored settings', () => {
    expect(parseBreathe(JSON.stringify(custom))).toEqual(custom);
  });

  it.each([
    ['nothing stored', null],
    ['bad JSON', '{oops'],
    ['a non-object', '42'],
    ['null JSON', 'null'],
    ['another version', JSON.stringify({ ...custom, version: 2 })],
    ['no version', JSON.stringify({ ...custom, version: undefined })],
  ])('rejects %s', (_name, raw) => {
    expect(parseBreathe(raw)).toBeNull();
  });
});

describe('BreatheStore', () => {
  it('BS4: starts with the defaults when nothing is stored, and saves them', () => {
    const store = new MemoryStore();
    const settings = new BreatheStore({ store });

    expect(settings.get()).toEqual(defaultSettings());
    expect(parseBreathe(store.getSync(BREATHE_KEY))).toEqual(defaultSettings());
  });

  it.each([
    ['unreadable JSON', '{oops'],
    ['another version', JSON.stringify({ ...custom, version: 9 })],
  ])('BS4: falls back to defaults when stored data is %s, overwriting it', (_name, raw) => {
    const store = new MemoryStore();
    store.data.set(BREATHE_KEY, raw);
    const settings = new BreatheStore({ store });

    expect(settings.get()).toEqual(defaultSettings());
    expect(parseBreathe(store.getSync(BREATHE_KEY))).toEqual(defaultSettings());
  });

  it('BS6: update notifies subscribers and saves the full value', async () => {
    const store = new MemoryStore();
    const settings = new BreatheStore({ store });
    const seen: BreatheSettings[] = [];
    const unsubscribe = settings.subscribe((s) => seen.push(s));

    settings.update((s) => ({ ...s, targetMinutes: 5, cueStyle: 'count' }));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ targetMinutes: 5, cueStyle: 'count' });
    expect(settings.get()).toMatchObject({ targetMinutes: 5, cueStyle: 'count' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = JSON.parse(store.getSync(BREATHE_KEY)!);
    expect(saved).toMatchObject({ targetMinutes: 5, cueStyle: 'count' });

    const fresh = new BreatheStore({ store });
    expect(fresh.get()).toMatchObject({ targetMinutes: 5, cueStyle: 'count' });

    unsubscribe();
  });
});
