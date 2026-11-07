/* ---------------------------------------
    Point 12's checks on what the reply model wrote. The model can't change a card; these make sure its words can't
    mislead either:
    - unknown product ids are dropped (WARN); the rest become highlights on their cards;
    - every $ amount in the message must be a price on screen, or a price limit from the shopper's slip
      ("under $120"). Anything else, such as a sum the model worked out, replaces the whole message with
      "Here's what I found." (WARN).
--------------------------------------- */

import type { Slip } from '../slip/slip-types.ts';

export const SAFE_REPLY = "Here's what I found.";

/* -- The fixed sentence when there is nothing to show: "Here's what I found." above an empty grid would read as a bug -- */
export const NO_MATCH_REPLY = "Nothing in the catalog matched this search. Try loosening the price, color, size or brand.";

const DOLLAR_AMOUNT = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

export type CheckedReply = Readonly<{
  text: string;
  highlightIds: string[];
  droppedIds: string[];
  unknownAmounts: number[];
}>;

/* -- shownPrices: every price the shopper can see or just saw. fallback: what replaces a reply that fails a check -- */
export function checkReply(message: string, productIds: readonly string[], shownIds: ReadonlySet<string>, shownPrices: readonly number[], slip: Slip, fallback: string = SAFE_REPLY): CheckedReply {
  const highlightIds = [...new Set(productIds.filter((id) => shownIds.has(id)))];
  const droppedIds = productIds.filter((id) => !shownIds.has(id));
  const allowed = [...shownPrices, ...[slip.minPrice, slip.maxPrice].filter((price): price is number => price !== null)];
  const unknownAmounts = dollarAmounts(message).filter((amount) => !allowed.some((price) => Math.abs(price - amount) < 0.005));
  /* -- A reply that kept the stock sentence's empty slot would state a size it never looked up -- */
  const keptEmptySlot = message.includes('<listed size>');
  return { text: unknownAmounts.length || keptEmptySlot ? fallback : message.trim() || fallback, highlightIds, droppedIds, unknownAmounts };
}

/* -- "$1,299.50" and "$ 45" both count -- */
export function dollarAmounts(text: string): number[] {
  return [...text.matchAll(DOLLAR_AMOUNT)].map((match) => Number(match[1]!.replace(/,/g, '')));
}
