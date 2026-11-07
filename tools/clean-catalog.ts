/* ---------------------------------------
    Point 1, the cleaning tool. Run by hand once: npm run clean-catalog [-- --out=<folder>]
    Reads catalog/products.json and writes data/products.json (one trimmed record per listing, same order as the
    catalog) and data/brands.json (the two brand tally sheets). Then prints its measurements next to the design's.
--------------------------------------- */

import { parseArgs } from 'node:util';
import { buildBrandSheets } from '../server/catalog/brand-sheets.ts';
import { toProduct } from '../server/catalog/clean-product.ts';
import { fileExists, readRawCatalog, writeBrandSheets, writeProducts } from '../server/data/data-service.ts';
import { dataFilesIn, PATHS } from '../server/data/project-paths.ts';
import { printLine } from '../server/logging/logger.ts';
import { formatStatTable, measureCatalog } from './lib/catalog-stats.ts';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const outFolder = values.out ?? PATHS.dataFolder;

if (!fileExists(PATHS.rawCatalog)) {
  printLine(`The catalog is missing. Put the provided products.json at ${PATHS.rawCatalog} and run this again.`);
  process.exit(1);
}

const started = performance.now();
const raw = readRawCatalog();
const parsedMs = performance.now() - started;

const products = raw.map(toProduct);
const sheets = buildBrandSheets(products);
writeProducts(products, outFolder);
writeBrandSheets(sheets, outFolder);
const totalMs = performance.now() - started;

const files = dataFilesIn(outFolder);
printLine(`Read ${raw.length} records in ${Math.round(parsedMs)} ms, cleaned and wrote them in ${Math.round(totalMs - parsedMs)} ms.`);
printLine(`Wrote ${files.products}`);
printLine(`Wrote ${files.brands}\n`);
printLine(formatStatTable(measureCatalog(raw, products, sheets)));
