/* ---------------------------------------
    Turns the catalog's free-text sizes (3,958 spellings) into exact groups, so a size filter can compare them.
    Three kinds are recognised: letter sizes (S, M, XL), numbers (shoe sizes like 9.5) and one-size. Everything else
    has no group and fails a size filter, which is the honest result: we can't tell what that size means.
--------------------------------------- */

import { cleanValue } from './clean-value.ts';

export type SizeKind = 'letter' | 'number' | 'one-size' | 'other';

const LETTER_SIZE = /^(x{0,3}-?(small|large)|\d?x{1,3}-?(small|large)|medium|xs|s|m|l|xl|xxl|xxxl|\dxl)$/i;
const NUMBER_SIZE = /^\d{1,2}(\.5)?( [a-z(].*)?$/i;
const ONE_SIZE = /one[ _-]?size|standard|free size/i;
export const ONE_SIZE_GROUP = 'ONE SIZE';

const SHORT_LETTERS: Readonly<Record<string, string>> = { xs: 'XS', s: 'S', m: 'M', medium: 'M', l: 'L', xl: 'XL', xxl: 'XXL', xxxl: 'XXXL' };

export function sizeKindOf(rawSize: unknown): SizeKind {
  const text = cleanValue(rawSize);
  if (!text) return 'other';
  if (LETTER_SIZE.test(text)) return 'letter';
  if (NUMBER_SIZE.test(text)) return 'number';
  if (ONE_SIZE.test(text)) return 'one-size';
  return 'other';
}

/* -- The exact group for a size: "X-Large" is XL, "9.5 Wide" is 9.5, "One Size" is ONE SIZE, anything else null -- */
export function sizeGroupOf(rawSize: unknown): string | null {
  const text = cleanValue(rawSize);
  switch (sizeKindOf(text)) {
    case 'letter':
      return letterGroup(text);
    case 'number':
      return String(Number(/^\d{1,2}(\.5)?/.exec(text)![0]));
    case 'one-size':
      return ONE_SIZE_GROUP;
    default:
      return null;
  }
}

/* -- A size the shopper typed, through the same rules as the catalog, after dropping a leading "size" -- */
export function shopperSizeGroupOf(typed: string): string | null {
  return sizeGroupOf(typed.trim().replace(/^size\s+/i, ''));
}

/* -- Counts the X's: "xx-large" and "2x-large" are both XXL, and from four X's on the label is 4XL -- */
function letterGroup(text: string): string {
  const compact = text.toLowerCase().replace(/\s+/g, '');
  const short = SHORT_LETTERS[compact];
  if (short) return short;
  const numbered = /^(\d)xl$/.exec(compact);
  if (numbered) return xLabel(Number(numbered[1]), 'L');
  const [, digit = '', xs = '', base = ''] = /^(\d?)(x{0,3})-?(small|large)$/.exec(compact) ?? [];
  const count = digit ? Number(digit) : xs.length;
  return xLabel(count, base === 'small' ? 'S' : 'L');
}

function xLabel(count: number, letter: 'S' | 'L'): string {
  if (count <= 0) return letter;
  return count <= 3 ? `${'X'.repeat(count)}${letter}` : `${count}X${letter}`;
}
