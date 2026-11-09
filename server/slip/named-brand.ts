/* ---------------------------------------
    Point 7a: a brand the shopper named that the model left among the item words ("only the Nike shoes" came back
    as text "Nike running shoes" with no brand). Code moves it into the brand box when all of these hold:
    - the model sent no brand, and its text has the brand's words;
    - the shopper typed those words, and not just after "not", "no", "except", "without", "other than" and the like;
    - it is a clear-cut brand: at least 5 products, and at least 5 times as many as the titles of other brands
      using the word (Nike 995 to 32). Puma (2.5 times) and Guess (3) stay words. A brand button the shopper
      clicked earlier in the chat wins either way;
    - exactly one brand is named.
    Requiring the model's own text keeps everyday words that happen to be brands ("keen", "elope") out: the model
    leaves those out of the item words. The brand gate (P7c) then decides as usual.
--------------------------------------- */

import { brandSpellings } from '../catalog/brand-rules.ts';
import type { BrandChoice, BrandSheetsInMemory } from './brand-gate.ts';
import { isFiller, looseKey, splitWords } from './shopper-words.ts';
import type { SlipChange } from './slip-form.ts';
import type { Slip } from './slip-types.ts';

const MIN_PRODUCTS = 5;
const BRAND_TO_WORD_RATIO = 5;
/* -- The longest brand name tried, in words ("the north face") -- */
const LONGEST_NAME = 4;
const NEGATIONS: ReadonlySet<string> = new Set(['not', 'no', 'except', 'without', 'besides', 'excluding', 'other', 'than', 'instead', 'avoid', 'never', 'but', 'dont', 'hate']);
/* -- How many words before the brand a negation still counts -- */
const NEGATION_REACH = 3;

export type NamedBrand = Readonly<{ name: string; asTyped: string }>;

export type MoveResult = Readonly<{ slip: Slip; moved: NamedBrand | null }>;

export function moveNamedBrand(slip: Slip, change: SlipChange, message: string, sheets: BrandSheetsInMemory, choices: Readonly<Record<string, BrandChoice>> = {}): MoveResult {
  if (change.brand) return { slip, moved: null };
  const named = findNamedBrand(message, change.text, sheets, choices);
  if (!named) return { slip, moved: null };
  return { slip: { ...slip, brand: named.asTyped, text: withoutWords(slip.text, named.asTyped) }, moved: named };
}

export function findNamedBrand(message: string, modelText: string | null, sheets: BrandSheetsInMemory, choices: Readonly<Record<string, BrandChoice>> = {}): NamedBrand | null {
  const words = splitWords(message);
  const inModelText = new Set(splitWords(modelText).map(looseKey));
  const found = new Map<string, string>();
  const taken = new Set<number>();
  for (let size = LONGEST_NAME; size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const span = words.slice(start, start + size);
      if (span.some((_, offset) => taken.has(start + offset))) continue;
      if (size === 1 && !usableWord(span[0]!)) continue;
      if (!span.every((word) => inModelText.has(looseKey(word)))) continue;
      const name = brandSpellings(span.join(' ')).find((spelling) => sheets.brandCounts.has(spelling));
      if (name === undefined || !clearCut(name, sheets, choices) || negated(words, start)) continue;
      found.set(name, asTypedIn(message, span) ?? name);
      span.forEach((_, offset) => taken.add(start + offset));
    }
  }
  if (found.size !== 1) return null;
  const [name, asTyped] = [...found][0]!;
  return { name, asTyped };
}

function clearCut(name: string, sheets: BrandSheetsInMemory, choices: Readonly<Record<string, BrandChoice>>): boolean {
  if (choices[name] === 'word') return false;
  if (choices[name] === 'brand') return true;
  const own = sheets.brandCounts.get(name) ?? 0;
  const elsewhere = sheets.otherTitleCounts.get(name) ?? 0;
  return own >= MIN_PRODUCTS && elsewhere * BRAND_TO_WORD_RATIO <= own;
}

/* -- A one-word name needs letters, three of them at least, and must not be a filler word ("find" is a brand too) -- */
function usableWord(word: string): boolean {
  return /[a-z]/.test(word) && word.length >= 3 && !isFiller(word);
}

function negated(words: readonly string[], start: number): boolean {
  return words.slice(Math.max(0, start - NEGATION_REACH), start).some((word) => NEGATIONS.has(word.replace(/['’]/g, '')));
}

/* -- The brand as the shopper wrote it ("Under Armour"), found again in the message -- */
function asTypedIn(message: string, span: readonly string[]): string | null {
  const escaped = span.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b${escaped.join('[^a-z0-9]+')}\\b`, 'i');
  return message.match(pattern)?.[0] ?? null;
}

/* -- The text without the brand's words; null when nothing is left -- */
function withoutWords(text: string | null, brand: string): string | null {
  const brandKeys = new Set(splitWords(brand).map(looseKey));
  const kept = (text ?? '').split(/\s+/).filter((word) => word && !brandKeys.has(looseKey(word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))));
  return kept.length ? kept.join(' ') : null;
}
