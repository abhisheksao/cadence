import type { SessionDefinition } from './types';
import { validateDefinition } from './validate';

const known = (id: string) => id === 'sample';

const valid = (): SessionDefinition => ({
  modeId: 'sample',
  title: 'Sample',
  phases: [
    { kind: 'step', title: 'Get ready', durationSec: 10 },
    { kind: 'step', title: 'Tap Skip when ready', durationSec: null },
  ],
  settings: {},
  keepScreenOn: true,
});

describe('validateDefinition', () => {
  it('accepts a valid definition', () => {
    expect(validateDefinition(valid(), known)).toEqual([]);
  });

  it('rejects an empty phase list', () => {
    expect(validateDefinition({ ...valid(), phases: [] }, known)).toContain('phases: must not be empty');
  });

  it('rejects a blank title', () => {
    expect(validateDefinition({ ...valid(), title: '  ' }, known)).toContain('title: must not be blank');
  });

  it('rejects a blank phase title', () => {
    const def = valid();
    def.phases[0] = { ...def.phases[0], title: '' };
    expect(validateDefinition(def, known)).toContain('phases[0].title: must not be blank');
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects a phase duration of %p', (durationSec) => {
    const def = valid();
    def.phases[0] = { ...def.phases[0], durationSec };
    expect(validateDefinition(def, known)).toContain(
      'phases[0].durationSec: must be a whole number of seconds ≥ 1, or null',
    );
  });

  it('rejects an unknown mode', () => {
    expect(validateDefinition({ ...valid(), modeId: 'nope' }, known)).toContain('modeId: unknown mode "nope"');
  });

  it('reports every problem at once', () => {
    expect(validateDefinition({ ...valid(), title: '', phases: [], modeId: 'nope' }, known)).toHaveLength(3);
  });
});
