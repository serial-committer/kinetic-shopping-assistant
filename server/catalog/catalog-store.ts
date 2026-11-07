/* ---------------------------------------
    Points 3 and 4: everything the search needs, loaded into memory once at server start.
    Products, brand sheets and the word index always load. The vectors load only when the manifest proves they
    belong to this products.json and this model file; otherwise search runs on filters and words alone (ERROR log).
--------------------------------------- */

import { fileExists, readBrandSheets, readManifest, readModelDimension, readProducts, readVectors } from '../data/data-service.ts';
import { dataFilesIn } from '../data/project-paths.ts';
import { findManifestMismatches } from '../embedder/vector-manifest.ts';
import { logger } from '../logging/logger.ts';
import { normaliseBrand } from './brand-rules.ts';
import type { Product } from './product-types.ts';
import { wordIndexTextOf } from './record-text.ts';
import { buildWordIndex, type WordIndex } from './word-index.ts';

export type ProductVectors = Readonly<{ values: Float32Array; dimension: number }>;

export type CatalogStore = Readonly<{
  products: readonly Product[];
  rowById: ReadonlyMap<string, number>;
  /* -- Every row that shares a card group key, in catalog order -- */
  rowsByGroup: ReadonlyMap<string, readonly number[]>;
  /* -- Each row's brand, normalised once, so the brand filter compares plain strings -- */
  brandKeys: readonly string[];
  brandCounts: ReadonlyMap<string, number>;
  otherTitleCounts: ReadonlyMap<string, number>;
  wordIndex: WordIndex;
  vectors: ProductVectors | null;
}>;

export async function loadCatalogStore(): Promise<CatalogStore> {
  const started = performance.now();
  const products = readProducts();
  const sheets = readBrandSheets();
  const rowById = new Map(products.map((product, row) => [product.id, row]));
  const rowsByGroup = new Map<string, number[]>();
  products.forEach((product, row) => {
    const rows = rowsByGroup.get(product.groupKey);
    if (rows) rows.push(row);
    else rowsByGroup.set(product.groupKey, [row]);
  });
  logger.info('P3', 'products loaded', { products: products.length, cards: rowsByGroup.size, ms: Math.round(performance.now() - started) });

  const indexStarted = performance.now();
  const wordIndex = buildWordIndex(products.map(wordIndexTextOf));
  logger.info('P4', 'word index built', { words: wordIndex.postings.size, ms: Math.round(performance.now() - indexStarted) });

  return Object.freeze({
    products,
    rowById,
    rowsByGroup,
    brandKeys: products.map((product) => normaliseBrand(product.brand)),
    brandCounts: new Map(Object.entries(sheets.brandCounts)),
    otherTitleCounts: new Map(Object.entries(sheets.otherTitleCounts)),
    wordIndex,
    vectors: await loadTrustedVectors(products.length),
  });
}

/* -- The vectors, or null with an ERROR log when they are missing or don't match -- */
async function loadTrustedVectors(rowCount: number): Promise<ProductVectors | null> {
  const files = dataFilesIn();
  if (!fileExists(files.vectors) || !fileExists(files.manifest)) {
    logger.error('P3', 'vectors are missing, so search runs on filters and words only', { expected: [files.vectors, files.manifest] });
    return null;
  }
  const started = performance.now();
  const manifest = readManifest();
  const values = readVectors();
  const problems = await findManifestMismatches(manifest, { rows: rowCount, dimension: readModelDimension(), vectorCount: values.length });
  if (problems.length > 0) {
    logger.error('P3', 'vectors refused, so search runs on filters and words only', { problems });
    return null;
  }
  logger.info('P3', 'vectors loaded and checked against the manifest', { rows: manifest.rows, dimension: manifest.dimension, ms: Math.round(performance.now() - started) });
  return Object.freeze({ values, dimension: manifest.dimension });
}
