/* ---------------------------------------
    The catalog writes "nan", "None" or "Unknown" where a value is missing, and a few values are only symbols
    ("\", "/", "..."). This turns all of them into empty text.
--------------------------------------- */

const JUNK_VALUE = /^(nan|none|null|n\/a|unknown|generic|unbranded)$/i;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/* -- A trimmed value, or empty text for anything missing, non-text, junk, or made only of symbols -- */
export function cleanValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed && !JUNK_VALUE.test(trimmed) && HAS_LETTER_OR_DIGIT.test(trimmed) ? trimmed : '';
}
