import Storage from 'expo-sqlite/kv-store';

import { kvStore } from './kv';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: jest.fn(),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const mocked = jest.mocked(Storage);

describe('kvStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads a stored value synchronously', () => {
    mocked.getItemSync.mockReturnValue('{"a":1}');
    expect(kvStore.getSync('session-record:v1')).toBe('{"a":1}');
    expect(mocked.getItemSync).toHaveBeenCalledWith('session-record:v1');
  });

  it('returns null when nothing is stored', () => {
    mocked.getItemSync.mockReturnValue(null);
    expect(kvStore.getSync('missing')).toBeNull();
  });

  it('writes and removes values', async () => {
    await kvStore.set('k', 'v');
    await kvStore.remove('k');
    expect(mocked.setItem).toHaveBeenCalledWith('k', 'v');
    expect(mocked.removeItem).toHaveBeenCalledWith('k');
  });
});
