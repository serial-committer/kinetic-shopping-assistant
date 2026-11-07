/* ---------------------------------------
    Where a product's brand comes from, and how brand names are compared.
--------------------------------------- */

import { cleanValue } from './clean-value.ts';
import type { RawRecord } from './product-types.ts';

/* -- brand, else details "Brand Name", else details "Brand", else the store -- */
export function pickBrand(record: RawRecord): string {
  return cleanValue(record.brand) || cleanValue(record.details?.['Brand Name']) || cleanValue(record.details?.['Brand']) || cleanValue(record.store);
}

/* -- Lowercase with single spaces, so "The  North Face" and "the north face" are the same name -- */
export function normaliseBrand(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/* -- The spellings to try for a shopper's brand: as typed, then with "the " removed, or added when it wasn't there -- */
export function brandSpellings(name: string): string[] {
  const normalised = normaliseBrand(name);
  return [normalised, normalised.startsWith('the ') ? normalised.slice(4) : `the ${normalised}`];
}
