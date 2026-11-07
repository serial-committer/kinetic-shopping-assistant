/* ---------------------------------------
    The meaning floor. The meaning ranker scores every product that passed the filters, so when only a few really
    match, unrelated ones would fill the free card slots. A product that matches none of the search words must
    therefore reach a meaning score (cosine similarity) of at least 0.62 to stay. A product that matches any search
    word always stays: the floor only judges products the meaning ranker picked on its own.
    0.62 sits between the scores measured on 7 searches: real matches 0.64 to 0.80, unrelated products 0.42 to 0.60.
    It runs after RRF, so the places (and points) of the products that stay are exactly what they were.
--------------------------------------- */

export const MEANING_FLOOR = 0.62;

export type FloorResult = Readonly<{ keptRows: number[]; hiddenRows: number[] }>;

export function applyMeaningFloor(rankedRows: readonly number[], wordMatchRows: ReadonlySet<number>, meaningScores: ReadonlyMap<number, number>, floor: number = MEANING_FLOOR): FloorResult {
  const keptRows: number[] = [];
  const hiddenRows: number[] = [];
  for (const row of rankedRows) {
    if (wordMatchRows.has(row) || (meaningScores.get(row) ?? 0) >= floor) keptRows.push(row);
    else hiddenRows.push(row);
  }
  return { keptRows, hiddenRows };
}
