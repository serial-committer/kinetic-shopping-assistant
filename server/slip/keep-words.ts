/* ---------------------------------------
    Point 7b, the word-keeper: the chat model may rearrange the shopper's words, but not lose them.
    Any shopper word that appears in no box of the merged slip and isn't a filler word goes back into `text`.
    Words compare loosely: no apostrophes or hyphens, and a plural "s" trimmed. Numbers typed as prices or sizes
    count as present, and decimals like 9.5 stay whole. Comparing with the MERGED slip means a follow-up like
    "Only show blue ones" brings nothing back.
    It can only put words back, never remove words the model invented; temperature 0 on Offline is the defence there.
--------------------------------------- */

import type { Slip } from './slip-types.ts';

/* -- Words with no search meaning of their own, plus follow-up control words like size, sort, forget -- */
const FILLER = new Set([
  'a', 'an', 'the', 'i', 'im', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'is', 'are', 'am', 'be',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'some', 'something', 'anything', 'any',
  'show', 'find', 'get', 'want', 'need', 'looking', 'look', 'like', 'would', 'please', 'can', 'could',
  'help', 'buy', 'new', 'brand', 'under', 'below', 'less', 'than', 'over', 'above', 'around', 'about',
  'cheap', 'cheaper', 'cheapest', 'affordable', 'budget', 'only', 'just', 'also', 'too', 'very',
  'really', 'more', 'other', 'one', 'ones', 'that', 'this', 'these', 'those', 'what', 'which',
  'dollars', 'bucks',
  'price', 'prices', 'priced', 'size', 'sizes', 'color', 'colour', 'colors', 'colours', 'sort', 'sorted',
  'order', 'by', 'best', 'rated', 'rating', 'top', 'fine', 'limit', 'instead', 'actually', 'how', 'item', 'items',
  'forget', 'remove', 'ignore', 'drop', 'whatever', 'matter', 'doesnt',
]);

export type KeepWordsResult = Readonly<{ slip: Slip; putBack: string[] }>;

/* -- Splits into words, keeping decimals like 9.5 whole and dropping sentence dots -- */
function splitWords(text: string | null): string[] {
  return (text ?? '').toLowerCase().split(/[^a-z0-9.'’-]+/).map((word) => word.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

/* -- Loose compare key: no apostrophes or hyphens, and a plural s trimmed from words longer than three letters -- */
function looseKey(word: string): string {
  const plain = word.toLowerCase().replace(/['’-]/g, '');
  return plain.length > 3 && plain.endsWith('s') ? plain.slice(0, -1) : plain;
}

export function keepShopperWords(message: string, slip: Slip): KeepWordsResult {
  const boxText = [slip.text, slip.brand, slip.color, slip.size, slip.gender].filter(Boolean).join(' ');
  const inSlip = new Set(splitWords(boxText).map(looseKey));
  const prices = new Set([slip.minPrice, slip.maxPrice].filter((price) => price !== null).map(String));
  const dropped = splitWords(message).filter((word) => {
    const key = looseKey(word);
    return key && !FILLER.has(word.replace(/['’]/g, '')) && !inSlip.has(key) && !prices.has(key);
  });
  const putBack = [...new Set(dropped)];
  if (putBack.length === 0) return { slip, putBack };
  return { slip: { ...slip, text: [slip.text, ...putBack].filter(Boolean).join(' ') }, putBack };
}
