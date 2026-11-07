/* ---------------------------------------
    What the current search is using, read from the slip: the words, then each exact filter as a small chip.
    It makes the assistant's understanding visible, so a wrong filter is easy to spot and correct in the chat.
--------------------------------------- */

import type { Slip } from '../../api/api-types.ts';

const SORT_LABEL = { price_low: 'Cheapest first', price_high: 'Most expensive first', rating: 'Best rated first' } as const;

export function SlipSummary({ slip, excludedCards }: Readonly<{ slip: Slip; excludedCards: number }>) {
  const chips = [
    slip.brand && `Brand: ${slip.brand}`,
    slip.color && `Color: ${slip.color}`,
    slip.size && `Size: ${slip.size}`,
    slip.gender && `For: ${slip.gender}`,
    slip.minPrice !== null && slip.maxPrice !== null ? `$${slip.minPrice} to $${slip.maxPrice}` : slip.maxPrice !== null ? `Up to $${slip.maxPrice}` : slip.minPrice !== null ? `From $${slip.minPrice}` : null,
    slip.sort && SORT_LABEL[slip.sort],
    excludedCards > 0 && `${excludedCards} shown before, hidden`,
  ].filter((chip): chip is string => Boolean(chip));

  if (!slip.text && chips.length === 0) return null;
  return (
    <div className="slip-summary">
      {slip.text && <span className="slip-words">"{slip.text}"</span>}
      {chips.map((chip) => (
        <span key={chip} className="slip-chip">{chip}</span>
      ))}
    </div>
  );
}
