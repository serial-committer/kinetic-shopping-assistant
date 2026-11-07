/* ---------------------------------------
    The pieces of text built from a record: its category path, its card group key, the text the embedder reads
    and the text the word index reads.
--------------------------------------- */

import type { Product, RawRecord } from './product-types.ts';

const EMBEDDING_TEXT_MAX_CHARS = 1800;

/* -- The categories list without its root ("Clothing, Shoes & Jewelry"), joined with " > " -- */
export function categoryPathOf(record: RawRecord): string {
  return (record.categories ?? []).slice(1).join(' > ');
}

/* -- Store plus exact title, lowercased and trimmed: the only rule that puts two listings on one card -- */
export function groupKeyOf(record: RawRecord): string {
  return `${String(record.store ?? '').toLowerCase()}|${String(record.title ?? '').toLowerCase().trim()}`;
}

/* -- Title, category path, features, then description, cut at about 512 tokens so the most useful text comes first -- */
export function embeddingTextOf(record: RawRecord): string {
  return [record.title, categoryPathOf(record), (record.features ?? []).join(' '), (record.description ?? []).join(' ')]
    .filter(Boolean)
    .join('\n')
    .slice(0, EMBEDDING_TEXT_MAX_CHARS);
}

/* -- What the word index sees: title, brand, store, category path and the raw color -- */
export function wordIndexTextOf(product: Product): string {
  return [product.title, product.brand, product.store, product.categoryPath, product.colorText].filter(Boolean).join(' ');
}
