/* ---------------------------------------
    The two shapes a product takes: the raw catalog record, and the trimmed record the app works with.
    The row number links them to the vectors: vectors row 5 belongs to products[5].
--------------------------------------- */

import type { ColorFamily } from './color-rules.ts';
import type { Gender } from './gender-rules.ts';

/* -- Only the raw fields the app reads. The catalog has more, and many of these can be missing or junk. -- */
export type RawRecord = {
  parent_asin: string;
  title?: string | null;
  brand?: unknown;
  store?: unknown;
  details?: Record<string, unknown> | null;
  categories?: string[] | null;
  price?: number | null;
  average_rating?: number | null;
  rating_number?: number | null;
  color?: unknown;
  size?: unknown;
  department?: unknown;
  material?: unknown;
  features?: string[] | null;
  description?: string[] | null;
  images?: Array<{ large?: string | null; thumb?: string | null; hi_res?: string | null }> | null;
};

/* -- One listing, trimmed. Raw color and size text stay next to the mapped values, so a card can show what the store wrote. -- */
export type Product = {
  id: string;
  title: string;
  brand: string;
  store: string;
  categoryPath: string;
  price: number | null;
  rating: number | null;
  ratingCount: number;
  colorText: string;
  sizeText: string;
  colorFamily: ColorFamily | null;
  sizeGroup: string | null;
  gender: Gender;
  material: string;
  features: string[];
  description: string;
  imageUrl: string;
  groupKey: string;
};

/* -- Sheet A: brand name to product count. Sheet B: one-word brand name to how many other brands' titles use that word. -- */
export type BrandSheets = {
  brandCounts: Record<string, number>;
  otherTitleCounts: Record<string, number>;
};
