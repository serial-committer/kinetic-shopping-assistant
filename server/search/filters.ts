/* ---------------------------------------
    Point 8: keep or drop every listing on the exact boxes. Each listing is checked on its own, BEFORE repeats are
    folded into cards (Point 11). Folding first could combine orange from one listing, Small from another and a price
    from a third into a product that doesn't exist.
    Rules: unisex passes a women's or men's filter; unknown gender fails any gender filter; a listing with no price
    fails a price filter; a color or size that didn't map fails that filter.
--------------------------------------- */

import type { Gender } from '../catalog/gender-rules.ts';
import type { Product } from '../catalog/product-types.ts';
import type { ShopperGender } from '../slip/slip-types.ts';
import type { FilterSet } from './filter-set.ts';

/* -- The surviving rows twice over: a list to walk, and a 0/1 mask for "is row N a survivor?" in one step -- */
export type Survivors = Readonly<{ rows: number[]; mask: Uint8Array }>;

export function applyFilters(products: readonly Product[], brandKeys: readonly string[], filters: FilterSet): Survivors {
  const mask = new Uint8Array(products.length);
  const rows: number[] = [];
  for (let row = 0; row < products.length; row += 1) {
    if (!passesFilters(products[row]!, brandKeys[row]!, filters)) continue;
    mask[row] = 1;
    rows.push(row);
  }
  return { rows, mask };
}

export function passesFilters(product: Product, brandKey: string, filters: FilterSet): boolean {
  if (filters.brandKey !== null && brandKey !== filters.brandKey) return false;
  if (filters.color !== null && product.colorFamily !== filters.color) return false;
  if (filters.sizeGroup !== null && product.sizeGroup !== filters.sizeGroup) return false;
  if (filters.gender !== null && !genderMatches(product.gender, filters.gender)) return false;
  if (filters.minPrice !== null && (product.price === null || product.price < filters.minPrice)) return false;
  if (filters.maxPrice !== null && (product.price === null || product.price > filters.maxPrice)) return false;
  if (filters.excludedGroups.has(product.groupKey)) return false;
  return true;
}

/* -- Unisex items are for adults of any gender, so they pass a women's or men's filter but not a children's one -- */
export function genderMatches(productGender: Gender, wanted: ShopperGender): boolean {
  if (productGender === wanted) return true;
  return productGender === 'unisex' && (wanted === 'women' || wanted === 'men');
}
