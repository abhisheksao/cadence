/** Small on-device key-value store (contracts/platform.md). */
export interface KeyValueStore {
  getSync(key: string): string | null;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
