/* ---------------------------------------
    Who a product is for. The category path is the most reliable source, then the department, then the title.
    The department field says "nan" on 69.7% of records, so it cannot be the only source.
--------------------------------------- */

import { cleanValue } from './clean-value.ts';
import type { RawRecord } from './product-types.ts';
import { categoryPathOf } from './record-text.ts';

export const GENDERS = ['women', 'men', 'girls', 'boys', 'baby', 'unisex'] as const;
export type Gender = (typeof GENDERS)[number] | 'unknown';

const PATH_WORDS: ReadonlyArray<readonly [string, Gender]> = [
  ['Women', 'women'],
  ['Men', 'men'],
  ['Girls', 'girls'],
  ['Boys', 'boys'],
  ['Baby', 'baby'],
];
const PATH_PATTERNS = PATH_WORDS.map(([word, gender]) => [new RegExp(`\\b${word}\\b`), gender] as const);
const TEXT_PATTERN = /\b(women|men|boys|girls|unisex)('s)?\b/i;

/* -- Category path first, then department plus title, else unknown -- */
export function genderOf(record: RawRecord): Gender {
  const path = categoryPathOf(record);
  for (const [pattern, gender] of PATH_PATTERNS) if (pattern.test(path)) return gender;
  const found = TEXT_PATTERN.exec(`${cleanValue(record.department).toLowerCase()} ${record.title ?? ''}`);
  return found ? (found[1]!.toLowerCase() as Gender) : 'unknown';
}

export function isGender(value: unknown): value is Exclude<Gender, 'unknown'> {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}
