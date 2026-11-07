/* ---------------------------------------
    How the slip steps compare words: split a message into words, drop filler, and compare loosely (no apostrophes
    or hyphens, a plural "s" trimmed). Shared by the word-keeper (Point 7b) and the new-topic check (Point 7a),
    so both agree on what counts as "the same word".
--------------------------------------- */

/* -- Words with no search meaning of their own, plus follow-up control words like size, sort, forget -- */
export const FILLER: ReadonlySet<string> = new Set([
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

/* -- Splits into lowercase words, keeping decimals like 9.5 whole and dropping sentence dots -- */
export function splitWords(text: string | null): string[] {
  return (text ?? '').toLowerCase().split(/[^a-z0-9.'’-]+/).map((word) => word.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

/* -- Loose compare key: no apostrophes or hyphens, and a plural s trimmed from words longer than three letters -- */
export function looseKey(word: string): string {
  const plain = word.toLowerCase().replace(/['’-]/g, '');
  return plain.length > 3 && plain.endsWith('s') ? plain.slice(0, -1) : plain;
}

export function isFiller(word: string): boolean {
  return FILLER.has(word.replace(/['’]/g, ''));
}

/* -- The loose keys of the words in a text that carry meaning -- */
export function contentKeys(text: string | null): Set<string> {
  return new Set(splitWords(text).filter((word) => !isFiller(word)).map(looseKey).filter(Boolean));
}
