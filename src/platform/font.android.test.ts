import { fontFamily } from './font.android';

describe('font (Android)', () => {
  it('names Roboto, so OEM system fonts (e.g. OnePlus Slate) cannot clip measured text', () => {
    expect(fontFamily).toBe('Roboto');
  });
});
