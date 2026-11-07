/* ---------------------------------------
    The slip: the fixed search form the chat model fills in (Point 6). Code merges each change into the saved slip
    and does everything exact with it. A null box means "no wish": no filter, no sort.
--------------------------------------- */

import type { ColorFamily } from '../catalog/color-rules.ts';
import type { Gender } from '../catalog/gender-rules.ts';

export type SortOrder = 'price_low' | 'price_high' | 'rating';
export const SORT_ORDERS: readonly SortOrder[] = ['price_low', 'price_high', 'rating'];

export type ShopperGender = Exclude<Gender, 'unknown'>;

export type Slip = {
  /* -- The item and every word that describes it; the word index and the embedder both read it -- */
  text: string | null;
  color: ColorFamily | null;
  /* -- As the shopper said it ("small", "9.5"); the filter turns it into a size group -- */
  size: string | null;
  gender: ShopperGender | null;
  minPrice: number | null;
  maxPrice: number | null;
  /* -- As the shopper said it; the brand gate decides whether it filters, goes back to words, or asks first -- */
  brand: string | null;
  sort: SortOrder | null;
};

export const SLIP_BOXES = ['text', 'color', 'size', 'gender', 'minPrice', 'maxPrice', 'brand', 'sort'] as const;
export type SlipBox = (typeof SLIP_BOXES)[number];

export const EMPTY_SLIP: Readonly<Slip> = Object.freeze({
  text: null,
  color: null,
  size: null,
  gender: null,
  minPrice: null,
  maxPrice: null,
  brand: null,
  sort: null,
});
