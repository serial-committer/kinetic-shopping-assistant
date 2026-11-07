/* ---------------------------------------
    Orders that don't come from relevance:
    - with no search text ("anything under $20"), listings go best rated first, then most rated;
    - when the shopper asks for an order, it overrides relevance (price low, price high, best rated).
    Array sort is stable, so ties keep their relevance order.
--------------------------------------- */

import type { Product } from '../catalog/product-types.ts';
import type { SortOrder } from '../slip/slip-types.ts';
import type { Card } from './merge-cards.ts';

/* -- Best rating first, then the most ratings; listings with no rating go last -- */
export function rankByRating(rows: readonly number[], products: readonly Product[]): number[] {
  return [...rows].sort((a, b) => compareRating(products[a]!, products[b]!));
}

export function sortCards(cards: readonly Card[], products: readonly Product[], order: SortOrder): Card[] {
  const sorted = [...cards];
  switch (order) {
    case 'price_low':
      return sorted.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    case 'price_high':
      return sorted.sort((a, b) => (b.maxPrice ?? -Infinity) - (a.maxPrice ?? -Infinity));
    case 'rating':
      return sorted.sort((a, b) => compareRating(products[a.bestRow]!, products[b.bestRow]!));
  }
}

function compareRating(a: Product, b: Product): number {
  return (b.rating ?? -1) - (a.rating ?? -1) || b.ratingCount - a.ratingCount;
}
