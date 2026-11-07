/* ---------------------------------------
    Point 7c, the brand gate: decides what a brand from the chat model may do, using the two tally sheets.
        not a catalog brand          -> words   it goes back into the search text ("merino", "Ordinary")
        used more as a word elsewhere -> ask    Polo: brand of 1 product, a word in 392 other titles
        otherwise                     -> filter Nike: brand of 995 products, a word in 32 other titles
    Names with no Sheet B entry (multi-word names like "under armour") count 0 elsewhere, so they filter.
    The shopper's own choice from an earlier "ask" wins, so the same question is never asked twice in one chat.
--------------------------------------- */

import { brandSpellings } from '../catalog/brand-rules.ts';

export type BrandChoice = 'brand' | 'word';

export type BrandDecision =
  | { kind: 'none' }
  | { kind: 'words'; word: string }
  | { kind: 'ask'; name: string; own: number; elsewhere: number; asTyped: string }
  | { kind: 'filter'; name: string };

export type BrandSheetsInMemory = Readonly<{ brandCounts: ReadonlyMap<string, number>; otherTitleCounts: ReadonlyMap<string, number> }>;

export function checkBrand(proposed: string | null, sheets: BrandSheetsInMemory, choices: Readonly<Record<string, BrandChoice>> = {}): BrandDecision {
  if (!proposed?.trim()) return { kind: 'none' };
  const name = brandSpellings(proposed).find((spelling) => sheets.brandCounts.has(spelling));
  if (name === undefined) return { kind: 'words', word: proposed.trim() };
  const remembered = choices[name];
  if (remembered === 'brand') return { kind: 'filter', name };
  if (remembered === 'word') return { kind: 'words', word: proposed.trim() };
  const own = sheets.brandCounts.get(name) ?? 0;
  const elsewhere = sheets.otherTitleCounts.get(name) ?? 0;
  if (elsewhere > own) return { kind: 'ask', name, own, elsewhere, asTyped: proposed.trim() };
  return { kind: 'filter', name };
}
