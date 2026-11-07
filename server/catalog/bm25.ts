/* ---------------------------------------
    Point 9, the word ranker: BM25 over the word index, scoring only the rows that survived the filters.
    Two ideas make it work:
    - Rare words count more. "merrell" is in 146 rows and "shoes" in thousands, so a Merrell match outweighs a shoe match.
    - A word repeated in a short title counts more than once in a long one, but with diminishing returns.
    k1 = 1.2 caps how much repeats help; b = 0.75 sets how much a long row is penalised.
--------------------------------------- */

import { tokenize, type WordIndex } from './word-index.ts';

const BM25_K1 = 1.2;
const BM25_B = 0.75;

export type ScoredRow = Readonly<{ row: number; score: number }>;

/* -- Rows that match at least one query word, best first. Rows outside `survivors` are skipped -- */
export function rankByWords(index: WordIndex, query: string, survivors: Uint8Array): ScoredRow[] {
  const scores = new Map<number, number>();
  for (const word of new Set(tokenize(query))) {
    const postings = index.postings.get(word);
    if (!postings) continue;
    const rowsWithWord = postings.rows.length;
    const rarity = Math.log(1 + (index.rowCount - rowsWithWord + 0.5) / (rowsWithWord + 0.5));
    for (let i = 0; i < rowsWithWord; i += 1) {
      const row = postings.rows[i]!;
      if (!survivors[row]) continue;
      const repeats = postings.counts[i]!;
      const lengthPart = 1 - BM25_B + (BM25_B * index.rowLengths[row]!) / index.averageRowLength;
      const score = (rarity * repeats * (BM25_K1 + 1)) / (repeats + BM25_K1 * lengthPart);
      scores.set(row, (scores.get(row) ?? 0) + score);
    }
  }
  return [...scores].map(([row, score]) => ({ row, score })).sort((a, b) => b.score - a.score);
}
