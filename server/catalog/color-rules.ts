/* ---------------------------------------
    Maps the catalog's free-text colors (10,352 spellings) to 14 families with a word list.
    The first family whose words match wins, so "navy blue" is blue and "rose gold" is pink.
--------------------------------------- */

import { cleanValue } from './clean-value.ts';

const COLOR_WORDS = {
  black: /black|onyx|jet|ebony/,
  white: /white|ivory|cream|pearl/,
  grey: /gr[ae]y|charcoal|heather|graphite|slate/,
  blue: /blue|navy|teal|turquoise|aqua|cobalt|denim|indigo/,
  red: /red\b|burgundy|maroon|crimson|wine|scarlet/,
  green: /green|olive|lime|mint|khaki|forest|sage|camo/,
  yellow: /yellow|mustard|lemon/,
  orange: /orange|rust|tangerine|coral|apricot/,
  pink: /pink|rose|fuchsia|magenta|blush/,
  purple: /purple|violet|lavender|plum|lilac/,
  brown: /brown|tan\b|beige|taupe|camel|mocha|chocolate|coffee|bronze/,
  gold: /gold/,
  silver: /silver|steel/,
  multi: /multi|rainbow|assorted/,
} as const;

export type ColorFamily = keyof typeof COLOR_WORDS;
export const COLOR_FAMILIES = Object.keys(COLOR_WORDS) as ColorFamily[];

/* -- The first family whose word list matches the raw color, or null when none does -- */
export function colorFamilyOf(rawColor: unknown): ColorFamily | null {
  const text = cleanValue(rawColor).toLowerCase();
  if (!text) return null;
  return COLOR_FAMILIES.find((family) => COLOR_WORDS[family].test(text)) ?? null;
}

export function isColorFamily(value: unknown): value is ColorFamily {
  return typeof value === 'string' && Object.hasOwn(COLOR_WORDS, value);
}
