/* ---------------------------------------
    Point 7a: whether "cheaper than what's on screen" counts. The model's cheaperThanShown box is a claim that code
    checks against the shopper's own words, because a wrong "cheaper" caps the price just under the cheapest card on
    screen and hides every card shown. It counts only when all of these hold:
    - cards are on screen, so there is something to be cheaper than;
    - the message isn't a new search, since cheaper than the old item says nothing about a new one;
    - the shopper typed no price the model put in the form ("under $120" is the shopper's own limit);
    - the message has a price word such as cheaper, less, budget or expensive.
--------------------------------------- */

import type { SlipChange } from './slip-form.ts';
import { splitWords } from './shopper-words.ts';

const PRICE_WORDS: ReadonlySet<string> = new Set([
  'cheap', 'cheaper', 'cheapest', 'less', 'lower', 'lowest', 'budget', 'affordable', 'inexpensive',
  'expensive', 'pricey', 'pricy', 'bargain', 'discount', 'discounted', 'deal', 'deals', 'save', 'saving',
]);

export type CheaperCheck = Readonly<{ requested: boolean; ignoredBecause: string | null }>;

export function checkCheaper(change: SlipChange, productsOnScreen: number, startedOver: boolean, message: string): CheaperCheck {
  if (!change.cheaperThanShown) return { requested: false, ignoredBecause: null };
  if (productsOnScreen === 0) return ignored('no cards are on screen');
  if (startedOver) return ignored('this is a new search');
  if (typedPrice(change, message)) return ignored('the shopper typed a price');
  if (!splitWords(message).some((word) => PRICE_WORDS.has(word))) return ignored('the message has no price word');
  return { requested: true, ignoredBecause: null };
}

/* -- A price in the form that also appears in the message as a number -- */
function typedPrice(change: SlipChange, message: string): boolean {
  const typed = new Set((message.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  return [change.minPrice, change.maxPrice].some((price) => price !== null && typed.has(price));
}

const ignored = (reason: string): CheaperCheck => ({ requested: false, ignoredBecause: reason });
