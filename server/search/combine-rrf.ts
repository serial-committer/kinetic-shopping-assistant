/* ---------------------------------------
    Point 10: Reciprocal Rank Fusion. Like two judges ranking the same contestants: each contestant gets points
    from their place on each judge's list, 1 / (60 + place), and the points add up. Only places count, never the
    judges' raw scores, so a BM25 score of 14 and a cosine of 0.71 never have to be compared.
    A product near the top of either list stays in the running; one high on both lists wins.
--------------------------------------- */

const RRF_K = 60;

/* -- Each list is rows, best first. Place 1 earns 1/61, place 2 earns 1/62, and so on -- */
export function combineByPosition(...lists: ReadonlyArray<readonly number[]>): number[] {
  return [...rrfPoints(...lists)].sort((a, b) => b[1] - a[1]).map(([row]) => row);
}

export function rrfPoints(...lists: ReadonlyArray<readonly number[]>): Map<number, number> {
  const points = new Map<number, number>();
  for (const list of lists) {
    list.forEach((row, index) => points.set(row, (points.get(row) ?? 0) + 1 / (RRF_K + index + 1)));
  }
  return points;
}
