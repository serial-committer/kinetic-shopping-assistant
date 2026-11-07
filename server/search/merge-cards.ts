/* ---------------------------------------
    Point 11: fold repeats into cards. Listings with the same store and exact title share one card; nothing fuzzy,
    ever, because a wrongly merged record is a product that doesn't exist. Cards come in the order of their best
    listing. A card's headline uses only the listings that passed the filters: a real price or a range, never an average.
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';

export type Card = Readonly<{
  groupKey: string;
  /* -- The highest-ranked passing listing: its image and title head the card -- */
  bestRow: number;
  /* -- Listings that passed the filters, best first -- */
  passingRows: readonly number[];
  /* -- Listings on the same card that didn't pass, shown under "Other listings" -- */
  otherRows: readonly number[];
  minPrice: number | null;
  maxPrice: number | null;
  /* -- Two passing listings share color and size but not price -- */
  hasTwins: boolean;
}>;

type CardSource = Pick<CatalogStore, 'products' | 'rowsByGroup'>;

/* -- How many cards one answer shows. The one place to change it, for example when paging is added -- */
export function cardsPerPage(): number {
  const CARDS_PER_PAGE = 8;
  return CARDS_PER_PAGE;
}

/* -- Walks ranked rows and opens a card at each new group, until `limit` cards exist -- */
export function mergeIntoCards(rankedRows: Iterable<number>, store: CardSource, survivorMask: Uint8Array, limit: number): Card[] {
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const row of rankedRows) {
    if (cards.length >= limit) break;
    const groupKey = store.products[row]!.groupKey;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    cards.push(cardForRow(row, store, (other) => survivorMask[other] === 1));
  }
  return cards;
}

/* -- The card headed by `bestRow`; `passes` says which of its sibling listings passed the filters -- */
export function cardForRow(bestRow: number, store: CardSource, passes: (row: number) => boolean): Card {
  const groupKey = store.products[bestRow]!.groupKey;
  const groupRows = store.rowsByGroup.get(groupKey) ?? [bestRow];
  const passingRows = [bestRow, ...groupRows.filter((row) => row !== bestRow && passes(row))];
  const otherRows = groupRows.filter((row) => row !== bestRow && !passes(row));
  const prices = passingRows.map((row) => store.products[row]!.price).filter((price): price is number => price !== null);
  return Object.freeze({
    groupKey,
    bestRow,
    passingRows,
    otherRows,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    hasTwins: hasTwinListings(passingRows, store),
  });
}

/* -- Twins: same color text and size text, different prices. Shown with a warning, never averaged -- */
export function hasTwinListings(rows: readonly number[], store: Pick<CatalogStore, 'products'>): boolean {
  const pricesByVariant = new Map<string, Set<number | null>>();
  for (const row of rows) {
    const product = store.products[row]!;
    const variant = `${product.colorText.toLowerCase()}|${product.sizeText.toLowerCase()}`;
    const prices = pricesByVariant.get(variant) ?? new Set<number | null>();
    prices.add(product.price);
    pricesByVariant.set(variant, prices);
  }
  return [...pricesByVariant.values()].some((prices) => prices.size > 1);
}
