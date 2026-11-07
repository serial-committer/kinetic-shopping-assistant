/* ---------------------------------------
    The two tally sheets the brand gate reads (Point 7c).
    Sheet A, brandCounts: brand name to how many products list it as their brand (nike 995, polo 1).
    Sheet B, otherTitleCounts: one-word brand name to how many products of OTHER brands use that word in their
    title (nike 32, polo 392). A name used far more as a word than as a brand gets a question before it filters.
--------------------------------------- */

import { normaliseBrand } from './brand-rules.ts';
import type { BrandSheets, Product } from './product-types.ts';

const titleWords = (title: string): Set<string> => new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1));
const isOneWordName = (name: string): boolean => /^[a-z0-9]{2,}$/.test(name);

export function buildBrandSheets(products: readonly Product[]): BrandSheets {
  const brandCounts = new Map<string, number>();
  for (const product of products) {
    if (!product.brand) continue;
    const name = normaliseBrand(product.brand);
    brandCounts.set(name, (brandCounts.get(name) ?? 0) + 1);
  }

  /* -- A title word counts for every product except those whose own brand is that word -- */
  const wordCounts = new Map<string, number>();
  for (const product of products) {
    const ownBrand = normaliseBrand(product.brand);
    for (const word of titleWords(product.title)) {
      if (word !== ownBrand) wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  const otherTitleCounts: Record<string, number> = {};
  for (const name of brandCounts.keys()) {
    if (isOneWordName(name)) otherTitleCounts[name] = wordCounts.get(name) ?? 0;
  }
  return { brandCounts: Object.fromEntries(brandCounts), otherTitleCounts };
}
