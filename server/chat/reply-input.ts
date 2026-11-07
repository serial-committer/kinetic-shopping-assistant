/* ---------------------------------------
    Point 12: the data the reply model sees. Only real records, trimmed to what a reply needs:
    after a search, the up-to-8 cards (id, title, brand, price or range, colors, sizes, rating, a few features);
    for an "answer", the full records of the cards on screen (every listing, material, all features, description).
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';
import type { Card } from '../search/merge-cards.ts';
import type { Slip } from '../slip/slip-types.ts';

const SHORT_FEATURES = 3;
const FEATURE_CHARS = 160;

export type ReplyMode = 'search' | 'answer';

export function buildReplyInput(store: CatalogStore, mode: ReplyMode, message: string, slip: Slip, cards: readonly Card[], survivorCount: number): string {
  const products = cards.map((card) => (mode === 'answer' ? fullRecord(store, card) : cardSummary(store, card)));
  const result = mode === 'answer' ? 'The shopper is asking about the products on screen.' : `${survivorCount} listings passed the filters; these are the best ${cards.length} products.`;
  return [
    `Shopper: ${message}`,
    `Search form: ${JSON.stringify(slip)}`,
    result,
    `Products: ${products.length ? JSON.stringify(products, null, 1) : 'none'}`,
  ].join('\n');
}

function cardSummary(store: CatalogStore, card: Card): Record<string, unknown> {
  const best = store.products[card.bestRow]!;
  const listings = card.passingRows.map((row) => store.products[row]!);
  return {
    id: best.id,
    title: best.title,
    brand: best.brand || 'not listed',
    price: priceText(card.minPrice, card.maxPrice, listings.length),
    colors: distinct(listings.map((listing) => listing.colorText)),
    sizes: distinct(listings.map((listing) => listing.sizeText)),
    rating: best.rating === null ? 'no rating' : `${best.rating} from ${best.ratingCount} ratings`,
    features: best.features.slice(0, SHORT_FEATURES).map((feature) => feature.slice(0, FEATURE_CHARS)),
  };
}

function fullRecord(store: CatalogStore, card: Card): Record<string, unknown> {
  const best = store.products[card.bestRow]!;
  const listingOf = (row: number) => {
    const listing = store.products[row]!;
    return { color: listing.colorText || 'not listed', size: listing.sizeText || 'not listed', price: listing.price === null ? 'not listed' : `$${listing.price}` };
  };
  return {
    ...cardSummary(store, card),
    material: best.material || 'not listed',
    features: best.features,
    description: best.description || 'not listed',
    category: best.categoryPath,
    listings: card.passingRows.map(listingOf),
    otherListings: card.otherRows.map(listingOf),
  };
}

/* -- One price, or a range with the number of listings; never an average -- */
export function priceText(minPrice: number | null, maxPrice: number | null, listings: number): string {
  if (minPrice === null || maxPrice === null) return 'price not listed';
  if (minPrice === maxPrice) return listings > 1 ? `$${minPrice} (${listings} listings)` : `$${minPrice}`;
  return `$${minPrice} to $${maxPrice} (${listings} listings)`;
}

function distinct(values: readonly string[]): string[] {
  const kept = [...new Set(values.filter(Boolean))];
  return kept.length ? kept : ['not listed'];
}
