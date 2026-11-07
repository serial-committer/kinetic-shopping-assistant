/* ---------------------------------------
    Point 7b, the word-keeper: the chat model may rearrange the shopper's words, but not lose them.
    Any shopper word that appears in no box of the merged slip and isn't a filler word goes back into `text`.
    Words compare loosely (shopper-words.ts). Numbers typed as prices or sizes count as present, and decimals like
    9.5 stay whole. Comparing with the MERGED slip means a follow-up like "Only show blue ones" brings nothing back.
    It can only put words back, never remove words the model invented; temperature 0 on Offline is the defence there.
--------------------------------------- */

import { isFiller, looseKey, splitWords } from './shopper-words.ts';
import type { Slip } from './slip-types.ts';

export type KeepWordsResult = Readonly<{ slip: Slip; putBack: string[] }>;

export function keepShopperWords(message: string, slip: Slip): KeepWordsResult {
  const boxText = [slip.text, slip.brand, slip.color, slip.size, slip.gender].filter(Boolean).join(' ');
  const inSlip = new Set(splitWords(boxText).map(looseKey));
  const prices = new Set([slip.minPrice, slip.maxPrice].filter((price) => price !== null).map(String));
  const dropped = splitWords(message).filter((word) => {
    const key = looseKey(word);
    return key && !isFiller(word) && !inSlip.has(key) && !prices.has(key);
  });
  const putBack = [...new Set(dropped)];
  if (putBack.length === 0) return { slip, putBack };
  return { slip: { ...slip, text: [slip.text, ...putBack].filter(Boolean).join(' ') }, putBack };
}
