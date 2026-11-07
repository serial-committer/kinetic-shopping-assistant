/* ---------------------------------------
    Point 9, the meaning ranker. Every vector has length 1, so the dot product of the shopper's vector with a
    product's vector is their cosine similarity: 1 means the same meaning, around 0.3 means unrelated.
    Only filter survivors are scored. Unlike the word ranker, this one ranks every survivor.
--------------------------------------- */

import type { ProductVectors } from '../catalog/catalog-store.ts';
import type { ScoredRow } from '../catalog/bm25.ts';

export function rankByMeaning(vectors: ProductVectors, queryVector: Float32Array, survivorRows: readonly number[]): ScoredRow[] {
  const { values, dimension } = vectors;
  const scored: ScoredRow[] = new Array(survivorRows.length);
  for (let i = 0; i < survivorRows.length; i += 1) {
    const row = survivorRows[i]!;
    const offset = row * dimension;
    let dot = 0;
    for (let d = 0; d < dimension; d += 1) dot += values[offset + d]! * queryVector[d]!;
    scored[i] = { row, score: dot };
  }
  return scored.sort((a, b) => b.score - a.score);
}
