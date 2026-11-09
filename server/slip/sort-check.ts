/* ---------------------------------------
    Point 7a: whether the model's sort counts. A sort reorders every card, and the saved slip keeps it for later
    messages, so code keeps it only when the shopper's message has a word for that order (or asks to sort at all).
    Without one, the sort is set aside and the saved sort stays as it was.
--------------------------------------- */

import { splitWords } from './shopper-words.ts';
import type { SortOrder } from './slip-types.ts';

const ORDER_WORDS: Readonly<Record<SortOrder, ReadonlySet<string>>> = {
  price_low: new Set(['cheapest', 'cheap', 'cheaper', 'lowest', 'low', 'least', 'inexpensive', 'affordable', 'budget', 'ascending']),
  price_high: new Set(['priciest', 'pricey', 'pricier', 'expensive', 'highest', 'high', 'premium', 'luxury', 'descending']),
  rating: new Set(['best', 'top', 'rated', 'rating', 'ratings', 'review', 'reviews', 'reviewed', 'popular', 'highest', 'favorite', 'favourite', 'stars']),
};

/* -- Words that ask for an order without saying which -- */
const ANY_ORDER: ReadonlySet<string> = new Set(['sort', 'sorted', 'order', 'ordered', 'rank', 'ranked']);

export type SortCheck = Readonly<{ dropped: boolean; droppedBecause: string | null }>;

export function checkSort(sort: SortOrder | null, message: string): SortCheck {
  if (sort === null) return { dropped: false, droppedBecause: null };
  const words = splitWords(message);
  if (words.some((word) => ANY_ORDER.has(word) || ORDER_WORDS[sort].has(word))) return { dropped: false, droppedBecause: null };
  return { dropped: true, droppedBecause: `the message has no word for the order ${sort}` };
}
