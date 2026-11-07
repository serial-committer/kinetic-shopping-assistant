/* ---------------------------------------
    Turns cards into the JSON the browser draws. Code builds every field straight from the records; nothing the
    chat model wrote ends up on a card except the highlight on the cards its reply mentions.
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';
import { type Card, hasTwinListings } from '../search/merge-cards.ts';
import { priceText } from './reply-input.ts';

export const TWIN_WARNING = 'Listed more than once at different prices.';

export type ListingView = Readonly<{ id: string; colorText: string; sizeText: string; price: number | null; isTwin: boolean }>;

export type CardView = Readonly<{
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  priceText: string;
  listingCount: number;
  colorText: string;
  sizeText: string;
  rating: number | null;
  ratingCount: number;
  twinWarning: string | null;
  highlighted: boolean;
  material: string;
  features: readonly string[];
  description: string;
  listings: readonly ListingView[];
  otherListings: readonly ListingView[];
}>;

export function toCardViews(store: CatalogStore, cards: readonly Card[], highlightIds: readonly string[] = []): CardView[] {
  const highlighted = new Set(highlightIds);
  return cards.map((card) => {
    const best = store.products[card.bestRow]!;
    return {
      id: best.id,
      title: best.title,
      brand: best.brand,
      imageUrl: best.imageUrl,
      priceText: priceText(card.minPrice, card.maxPrice, card.passingRows.length),
      listingCount: card.passingRows.length,
      colorText: best.colorText,
      sizeText: best.sizeText,
      rating: best.rating,
      ratingCount: best.ratingCount,
      twinWarning: card.hasTwins ? TWIN_WARNING : null,
      highlighted: highlighted.has(best.id),
      material: best.material,
      features: best.features,
      description: best.description,
      listings: listingViews(store, card.passingRows),
      otherListings: listingViews(store, card.otherRows),
    };
  });
}

/* -- Each listing with a flag when another listing of the same color and size has a different price -- */
function listingViews(store: CatalogStore, rows: readonly number[]): ListingView[] {
  return rows.map((row) => {
    const listing = store.products[row]!;
    const sameVariant = rows.filter((other) => {
      const product = store.products[other]!;
      return product.colorText.toLowerCase() === listing.colorText.toLowerCase() && product.sizeText.toLowerCase() === listing.sizeText.toLowerCase();
    });
    return { id: listing.id, colorText: listing.colorText, sizeText: listing.sizeText, price: listing.price, isTwin: hasTwinListings(sameVariant, store) };
  });
}
