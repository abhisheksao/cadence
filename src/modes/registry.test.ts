import { createModeRegistry } from './registry';
import type { ModeDefinition } from './types';

const mode = (id: string): ModeDefinition => ({
  id,
  route: `/${id}`,
  cueFor: () => ({ cueFor: () => null, completion: () => null }),
});

describe('mode registry', () => {
  it('returns a registered mode by id', () => {
    const registry = createModeRegistry();
    const sample = mode('sample');
    registry.register(sample);
    expect(registry.get('sample')).toBe(sample);
    expect(registry.has('sample')).toBe(true);
  });

  it('returns undefined for an unknown id', () => {
    const registry = createModeRegistry();
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
  });

  it('refuses to register the same id twice', () => {
    const registry = createModeRegistry();
    registry.register(mode('sample'));
    expect(() => registry.register(mode('sample'))).toThrow('Mode "sample" is already registered');
  });
});
