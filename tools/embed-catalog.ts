/* ---------------------------------------
    Point 2, the embed tool. Run by hand after clean-catalog:
        npm run embed-catalog                       all 39,834 products into data/ (about 30 minutes)
        npm run embed-catalog -- --limit=800        a sample into a temp folder, to prove the setup first
    Options: --out=<folder>, --processes=<count> (default 8).
    Each product's text (title, category path, features, description, cut at 1,800 characters) is built from the raw
    catalog, so data/products.json can stay small. Row i of the vectors belongs to row i of data/products.json;
    the tool checks every id lines up before it starts. Work is shared between sealed child processes, one thread each.
--------------------------------------- */

import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { embeddingTextOf } from '../server/catalog/record-text.ts';
import { fileExists, readProducts, readRawCatalog, writeManifest, writeVectors } from '../server/data/data-service.ts';
import { dataFilesIn, PATHS } from '../server/data/project-paths.ts';
import { type EmbedderProcess, startEmbedderProcess } from '../server/embedder/embedder-process.ts';
import { buildManifest } from '../server/embedder/vector-manifest.ts';
import { printLine } from '../server/logging/logger.ts';

const ROWS_PER_REQUEST = 64;
const PROGRESS_EVERY_MS = 15_000;
const DEFAULT_PROCESSES = 8;

const { values } = parseArgs({ options: { limit: { type: 'string' }, out: { type: 'string' }, processes: { type: 'string' } } });
const limit = values.limit ? Number(values.limit) : null;
const outFolder = values.out ?? (limit ? join(tmpdir(), 'kinetic-shopping-assistant-sample') : PATHS.dataFolder);
const processCount = Math.max(1, Number(values.processes ?? Math.min(DEFAULT_PROCESSES, availableParallelism())));

if (!fileExists(dataFilesIn().products) || !fileExists(PATHS.rawCatalog)) {
  printLine('Run npm run clean-catalog first: this tool needs catalog/products.json and data/products.json.');
  process.exit(1);
}

const texts = loadEmbeddingTexts(limit);
const order = [...texts.keys()].sort((a, b) => texts[a]!.length - texts[b]!.length);
const requests: number[][] = [];
for (let start = 0; start < order.length; start += ROWS_PER_REQUEST) requests.push(order.slice(start, start + ROWS_PER_REQUEST));

printLine(`Embedding ${texts.length} products with ${processCount} sealed processes into ${outFolder}`);
const children = Array.from({ length: processCount }, () => startEmbedderProcess());
process.once('SIGINT', () => void closeAll(children).then(() => process.exit(130)));

try {
  const [{ dimension }] = await Promise.all(children.map((child) => child.ready));
  const vectors = new Float32Array(texts.length * dimension);
  const started = performance.now();
  let done = 0;
  const progress = setInterval(() => {
    const perSecond = done / ((performance.now() - started) / 1000);
    printLine(`  ${done} of ${texts.length} (${perSecond.toFixed(1)} a second, about ${Math.ceil((texts.length - done) / perSecond / 60)} minutes left)`);
  }, PROGRESS_EVERY_MS);

  /* -- Each child takes the next request as soon as it is free, so a slow batch never holds the others up -- */
  let nextRequest = 0;
  await Promise.all(children.map(async (child) => {
    while (nextRequest < requests.length) {
      const rows = requests[nextRequest++]!;
      const result = await child.embed(rows.map((row) => texts[row]!), 'document');
      rows.forEach((row, position) => vectors.set(result.subarray(position * dimension, (position + 1) * dimension), row * dimension));
      done += rows.length;
    }
  }));
  clearInterval(progress);

  const seconds = (performance.now() - started) / 1000;
  writeVectors(vectors, outFolder);
  writeManifest(await buildManifest(texts.length, dimension), outFolder);
  printLine(`Done: ${texts.length} products in ${(seconds / 60).toFixed(1)} minutes (${(texts.length / seconds).toFixed(1)} a second).`);
  printLine(`Wrote ${dataFilesIn(outFolder).vectors} and ${dataFilesIn(outFolder).manifest}`);
  if (limit) printLine('This was a sample: the server only accepts vectors for every product, so it will not use these.');
} finally {
  await closeAll(children);
}

/* -- Builds the text for each row from the raw catalog, after checking each raw record sits on the same row as its product -- */
function loadEmbeddingTexts(rowLimit: number | null): string[] {
  const products = readProducts();
  const raw = readRawCatalog();
  if (raw.length !== products.length) {
    printLine(`catalog/products.json has ${raw.length} records but data/products.json has ${products.length}. Run npm run clean-catalog again.`);
    process.exit(1);
  }
  const misplaced = products.findIndex((product, row) => product.id !== raw[row]!.parent_asin);
  if (misplaced !== -1) {
    printLine(`Row ${misplaced} holds different products in the two files. Run npm run clean-catalog again.`);
    process.exit(1);
  }
  return raw.slice(0, rowLimit ?? raw.length).map(embeddingTextOf);
}

async function closeAll(list: readonly EmbedderProcess[]): Promise<void> {
  await Promise.all(list.map((child) => child.close()));
}
