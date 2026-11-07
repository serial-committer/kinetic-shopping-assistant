/* ---------------------------------------
    The cards the shopper is looking at, rebuilt on the server from the product ids the browser sends back.
    Nothing about them is taken from the browser except the ids: titles, prices and listings come from the records,
    with the current slip's filters deciding which listings count as passing.
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';
import { checkBrand, type BrandChoice } from '../slip/brand-gate.ts';
import type { ScreenLine } from '../slip/slip-prompt.ts';
import type { Slip } from '../slip/slip-types.ts';
import { filtersFromSlip } from '../search/filter-set.ts';
import { passesFilters } from '../search/filters.ts';
import { type Card, cardForRow } from '../search/merge-cards.ts';
import { priceText } from './reply-input.ts';

export function rebuildScreenCards(store: CatalogStore, screenIds: readonly string[], slip: Slip, brandChoices: Readonly<Record<string, BrandChoice>>): Card[] {
  const decision = checkBrand(slip.brand, store, brandChoices);
  const filters = filtersFromSlip(slip, decision.kind === 'filter' ? decision.name : null);
  return screenIds.flatMap((id) => {
    const row = store.rowById.get(id);
    if (row === undefined) return [];
    return [cardForRow(row, store, (other) => passesFilters(store.products[other]!, store.brandKeys[other]!, filters))];
  });
}

/* -- What the slip model sees of each card: title, color and price -- */
export function screenLines(store: CatalogStore, cards: readonly Card[]): ScreenLine[] {
  return cards.map((card) => {
    const best = store.products[card.bestRow]!;
    return { title: best.title, color: best.colorText, price: priceText(card.minPrice, card.maxPrice, card.passingRows.length) };
  });
}

/* -- "Anything cheaper?": just under the lowest price showing on any card, or null when no card has a price -- */
export function priceJustUnderScreen(cards: readonly Card[]): number | null {
  const lowest = Math.min(...cards.map((card) => card.minPrice ?? Infinity));
  return Number.isFinite(lowest) ? Math.max(0, Math.round((lowest - 0.01) * 100) / 100) : null;
}
