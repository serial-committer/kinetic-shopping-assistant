/* ---------------------------------------
    Point 7a: the model's change goes into the saved slip. The model sends only what changed, code merges it:
    - a new search starts from an empty slip. Two things can call it: the model (its newSearch box) and code, when
      the change's search words share nothing with the saved ones (new-topic.ts). The model understands meaning,
      code checks words, so between them a change of item is rarely missed;
    - clear empties the named boxes;
    - a value that isn't null or empty text overwrites its box (the local model once sent size "");
    - "cheaper" is code's job: when it counts (cheaper-check.ts), code ignores the model's prices (it once copied
      $89.95 from the screen into minPrice) and the caller sets the price from the cards;
    - a sort counts only when the message has a word for that order (sort-check.ts); otherwise the saved one stays;
    - unisex from the model means no gender preference, because a unisex filter would hide every men's and women's item.
--------------------------------------- */

import { checkCheaper } from './cheaper-check.ts';
import { isNewTopic } from './new-topic.ts';
import { checkSort } from './sort-check.ts';
import type { SlipChange } from './slip-form.ts';
import { EMPTY_SLIP, SLIP_BOXES, type Slip } from './slip-types.ts';

export type MergeResult = Readonly<{
  slip: Slip;
  cheaperRequested: boolean;
  /* -- Why the model's "cheaper" was set aside, or null when it wasn't sent or counts -- */
  cheaperIgnoredBecause: string | null;
  /* -- Why the model's sort was set aside, or null when it wasn't sent or counts -- */
  sortDroppedBecause: string | null;
  /* -- True when the merge started from an empty slip, whoever called the new search -- */
  startedOver: boolean;
  /* -- True when code called it because the model didn't -- */
  newTopicByCode: boolean;
}>;

export function mergeSlip(current: Slip, change: SlipChange, productsOnScreen: number, message: string): MergeResult {
  const newTopicByCode = isNewTopic(current.text, change);
  const startedOver = change.newSearch || newTopicByCode;
  const next: Record<string, unknown> = startedOver ? { ...EMPTY_SLIP } : { ...current };
  for (const box of change.clear ?? []) next[box] = null;
  const cheaper = checkCheaper(change, productsOnScreen, startedOver, message);
  const sort = checkSort(change.sort, message);
  for (const box of SLIP_BOXES) {
    if (cheaper.requested && (box === 'minPrice' || box === 'maxPrice')) continue;
    if (sort.dropped && box === 'sort') continue;
    const value = change[box];
    if (value !== null && value !== undefined && value !== '') next[box] = value;
  }
  if (next['gender'] === 'unisex') next['gender'] = null;
  return { slip: next as Slip, cheaperRequested: cheaper.requested, cheaperIgnoredBecause: cheaper.ignoredBecause, sortDroppedBecause: sort.droppedBecause, startedOver, newTopicByCode };
}
