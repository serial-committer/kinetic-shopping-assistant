/* ---------------------------------------
    Point 7a: the model's change goes into the saved slip. The model sends only what changed, code merges it:
    - newSearch starts from an empty slip; clear empties the named boxes;
    - a value that isn't null or empty text overwrites its box (the local model once sent size "");
    - "cheaper" is code's job: when products are on screen, code ignores the model's prices (it once copied $89.95 from
      the screen into minPrice) and the caller sets the price from the cards. With nothing on screen it is ignored,
      so a stray "cheaper" on a first message can't wipe out the shopper's real budget;
    - unisex from the model means no gender preference, because a unisex filter would hide every men's and women's item.
--------------------------------------- */

import type { SlipChange } from './slip-form.ts';
import { EMPTY_SLIP, SLIP_BOXES, type Slip } from './slip-types.ts';

export type MergeResult = Readonly<{ slip: Slip; cheaperRequested: boolean }>;

export function mergeSlip(current: Slip, change: SlipChange, productsOnScreen: number): MergeResult {
  const next: Record<string, unknown> = change.newSearch ? { ...EMPTY_SLIP } : { ...current };
  for (const box of change.clear ?? []) next[box] = null;
  const cheaperRequested = change.cheaperThanShown === true && productsOnScreen > 0;
  for (const box of SLIP_BOXES) {
    if (cheaperRequested && (box === 'minPrice' || box === 'maxPrice')) continue;
    const value = change[box];
    if (value !== null && value !== undefined && value !== '') next[box] = value;
  }
  if (next['gender'] === 'unisex') next['gender'] = null;
  return { slip: next as Slip, cheaperRequested };
}
