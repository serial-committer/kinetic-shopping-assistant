/* ---------------------------------------
    The exact boxes Point 8 checks on every listing. Built from the merged slip after the brand gate has decided
    whether the brand filters, plus the cards that "cheaper" excluded. Null means "no filter on this box".
--------------------------------------- */

import type { ColorFamily } from '../catalog/color-rules.ts';
import { shopperSizeGroupOf } from '../catalog/size-rules.ts';
import type { ShopperGender, Slip } from '../slip/slip-types.ts';

export type FilterSet = Readonly<{
  /* -- A normalised catalog brand name, set only when the brand gate said "filter" -- */
  brandKey: string | null;
  color: ColorFamily | null;
  sizeGroup: string | null;
  gender: ShopperGender | null;
  minPrice: number | null;
  maxPrice: number | null;
  /* -- Card group keys the shopper has already seen when asking for something cheaper -- */
  excludedGroups: ReadonlySet<string>;
}>;

export const NO_FILTERS: FilterSet = Object.freeze({
  brandKey: null,
  color: null,
  sizeGroup: null,
  gender: null,
  minPrice: null,
  maxPrice: null,
  excludedGroups: new Set<string>(),
});

/* -- The slip's exact boxes as filters. A size the rules can't read gives no size group, so the caller decides what to do with it -- */
export function filtersFromSlip(slip: Slip, brandKey: string | null, excludedGroups: ReadonlySet<string> = new Set()): FilterSet {
  return Object.freeze({
    brandKey,
    color: slip.color,
    sizeGroup: slip.size ? shopperSizeGroupOf(slip.size) : null,
    gender: slip.gender,
    minPrice: slip.minPrice,
    maxPrice: slip.maxPrice,
    excludedGroups,
  });
}
