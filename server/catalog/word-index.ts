/* ---------------------------------------
    Point 4: the word index, built once at server start. Like the index at the back of a book: for every word,
    the rows that contain it and how often. Built from title, brand, store, category path and raw color.
    Rows and counts sit in typed arrays, so 30,000-odd words cost a few megabytes instead of millions of small arrays.
--------------------------------------- */

export type Postings = Readonly<{ rows: Uint32Array; counts: Uint16Array }>;

export type WordIndex = Readonly<{
  postings: ReadonlyMap<string, Postings>;
  /* -- How many words each row has, for BM25's length adjustment -- */
  rowLengths: Uint16Array;
  averageRowLength: number;
  rowCount: number;
}>;

/* -- Lowercase words of two or more letters or digits; the same split is used for shopper text -- */
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

export function buildWordIndex(rowTexts: readonly string[]): WordIndex {
  const building = new Map<string, { rows: number[]; counts: number[] }>();
  const rowLengths = new Uint16Array(rowTexts.length);

  rowTexts.forEach((text, row) => {
    const words = tokenize(text);
    rowLengths[row] = Math.min(words.length, 65_535);
    const countsInRow = new Map<string, number>();
    for (const word of words) countsInRow.set(word, (countsInRow.get(word) ?? 0) + 1);
    for (const [word, count] of countsInRow) {
      let entry = building.get(word);
      if (!entry) building.set(word, (entry = { rows: [], counts: [] }));
      entry.rows.push(row);
      entry.counts.push(count);
    }
  });

  const postings = new Map<string, Postings>();
  for (const [word, entry] of building) postings.set(word, { rows: Uint32Array.from(entry.rows), counts: Uint16Array.from(entry.counts) });
  const totalLength = rowLengths.reduce((sum, length) => sum + length, 0);
  return { postings, rowLengths, averageRowLength: totalLength / Math.max(rowTexts.length, 1), rowCount: rowTexts.length };
}
