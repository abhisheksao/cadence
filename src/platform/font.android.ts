/**
 * OEM skins such as OxygenOS replace the default system font (OnePlus Slate) after React Native
 * has measured text with Roboto, so the wider glyphs clip the last characters ("DONE" → "DON").
 * Naming a family explicitly makes measuring and drawing use the same font.
 */
export const fontFamily: string | undefined = 'Roboto';
