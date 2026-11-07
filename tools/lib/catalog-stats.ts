/* ---------------------------------------
    Measures a cleaned catalog and lines each number up against the design's measurements,
    so a change to a cleaning rule shows its effect straight away.
--------------------------------------- */

import { cleanValue } from '../../server/catalog/clean-value.ts';
import type { BrandSheets, Product, RawRecord } from '../../server/catalog/product-types.ts';

export type StatRow = { measure: string; expected: string; got: string };

const percent = (count: number, total: number): string => `${((count / total) * 100).toFixed(1)}%`;
const isMissing = (value: unknown): boolean => value === null || value === undefined || value === '' || value === 'nan';
const distinctSpellings = (raw: readonly RawRecord[], field: 'color' | 'size'): number =>
  new Set(raw.filter((record) => !isMissing(record[field])).map((record) => String(record[field]).toLowerCase())).size;

/* -- Expected values are full-catalog measurements; the design's 10,352, 3,958 and 69.7% came from a 30,001-record sample -- */
export function measureCatalog(raw: readonly RawRecord[], products: readonly Product[], sheets: BrandSheets): StatRow[] {
  const total = products.length;
  const groups = groupBy(products, (product) => product.groupKey);
  const repeatGroups = [...groups.values()].filter((group) => group.length > 1);
  const twins = findTwins(products);

  return [
    { measure: 'records', expected: '39834', got: String(total) },
    { measure: 'card groups (unique products)', expected: '31785', got: String(groups.size) },
    { measure: 'repeat groups', expected: '3176', got: String(repeatGroups.length) },
    { measure: 'records in repeat groups', expected: '11225', got: String(repeatGroups.reduce((sum, group) => sum + group.length, 0)) },
    { measure: 'largest price ratio inside one card', expected: '20.55', got: largestPriceRatio(repeatGroups).toFixed(2) },
    { measure: 'twin sets (same card, color, size; other price)', expected: '172', got: String(twins.sets) },
    { measure: 'cards holding a twin set', expected: '167', got: String(twins.cards) },
    { measure: 'largest price ratio between twins', expected: '-', got: twins.largestRatio.toFixed(2) },
    { measure: 'color spellings', expected: '12800', got: String(distinctSpellings(raw, 'color')) },
    { measure: 'color family mapped', expected: '81.2%', got: percent(products.filter((product) => product.colorFamily).length, total) },
    { measure: 'size spellings', expected: '6034', got: String(distinctSpellings(raw, 'size')) },
    { measure: 'size group recognised', expected: '75.3%', got: percent(products.filter((product) => product.sizeGroup).length, total) },
    { measure: 'department says nan', expected: '73.1%', got: percent(raw.filter((record) => isMissing(record.department)).length, total) },
    { measure: 'gender found', expected: '88.6%', got: percent(products.filter((product) => product.gender !== 'unknown').length, total) },
    { measure: 'brand found', expected: '98.6%', got: percent(products.filter((product) => product.brand).length, total) },
    { measure: 'records with no brand anywhere', expected: '562', got: String(products.filter((product) => !product.brand).length) },
    { measure: 'distinct brand names', expected: '10394', got: String(Object.keys(sheets.brandCounts).length) },
    { measure: 'nike: own / other titles', expected: '995 / 32', got: brandPair(sheets, 'nike') },
    { measure: 'merrell: own / other titles', expected: '146 / -', got: brandPair(sheets, 'merrell') },
    { measure: 'polo: own / other titles', expected: '1 / 392', got: brandPair(sheets, 'polo') },
    { measure: 'material filled', expected: '28837', got: String(products.filter((product) => product.material).length) },
    { measure: 'records with no price', expected: '0', got: String(products.filter((product) => product.price === null).length) },
    { measure: 'records with no image', expected: '0', got: String(products.filter((product) => !product.imageUrl).length) },
    { measure: 'records with a usable store name', expected: '-', got: percent(raw.filter((record) => cleanValue(record.store)).length, total) },
  ];
}

/* -- Twins: listings on the same card with the same color and size text, but more than one price -- */
function findTwins(products: readonly Product[]): { sets: number; cards: number; largestRatio: number } {
  const twinSets = [...groupBy(products, (product) => `${product.groupKey}|${product.colorText.toLowerCase()}|${product.sizeText.toLowerCase()}`).values()]
    .filter((set) => set.length > 1 && new Set(set.map((product) => product.price)).size > 1);
  return {
    sets: twinSets.length,
    cards: new Set(twinSets.map((set) => set[0]!.groupKey)).size,
    largestRatio: largestPriceRatio(twinSets),
  };
}

function largestPriceRatio(groups: ReadonlyArray<readonly Product[]>): number {
  let largest = 0;
  for (const group of groups) {
    const prices = group.map((product) => product.price).filter((price): price is number => price !== null);
    if (prices.length > 1) largest = Math.max(largest, Math.max(...prices) / Math.min(...prices));
  }
  return largest;
}

function brandPair(sheets: BrandSheets, name: string): string {
  return `${sheets.brandCounts[name] ?? 0} / ${sheets.otherTitleCounts[name] ?? 0}`;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/* -- A plain text table: measure, expected, got, and a mark where they differ -- */
export function formatStatTable(rows: readonly StatRow[]): string {
  const width = Math.max(...rows.map((row) => row.measure.length));
  const lines = rows.map((row) => {
    const differs = row.expected !== '-' && !row.expected.endsWith('-') && row.expected !== row.got;
    return `${row.measure.padEnd(width)}  expected ${row.expected.padEnd(9)} got ${row.got.padEnd(9)}${differs ? ' <- differs' : ''}`;
  });
  return lines.join('\n');
}
