/* ---------------------------------------
    Runs the search core on the brief's examples with hand-written slips, before any chat model exists.
    Usage: npm run search-check
    Each case prints the ranking mode, survivor count, timings and the cards, so a change to a filter or a ranker
    can be judged on real products. The follow-ups ("Anything cheaper?", "Only show blue ones") build on the case
    before them the way the chat step will.
--------------------------------------- */

import { normaliseBrand } from '../server/catalog/brand-rules.ts';
import { printLine } from '../server/logging/logger.ts';
import { type FilterSet, filtersFromSlip } from '../server/search/filter-set.ts';
import type { Card } from '../server/search/merge-cards.ts';
import { type SearchEngine, startSearchEngine } from '../server/search/search-engine.ts';
import type { SearchResult } from '../server/search/search-pipeline.ts';
import { EMPTY_SLIP, type Slip } from '../server/slip/slip-types.ts';

type Case = { label: string; slip: Partial<Slip>; brandFilter?: string };

const CASES: Case[] = [
  { label: 'Show me running shoes under $120', slip: { text: 'running shoes', maxPrice: 120 } },
  { label: "I'm looking for orange running shorts in size small", slip: { text: 'running shorts', color: 'orange', size: 'small' } },
  { label: 'merrell hiking shoes (brand filter)', slip: { text: 'hiking shoes', brand: 'merrell' }, brandFilter: 'merrell' },
  { label: 'something to keep my hands warm on the slopes', slip: { text: 'something to keep my hands warm on the slopes' } },
  { label: 'Polo brand shirts, "Polo, the brand" button', slip: { text: 'shirts', brand: 'polo' }, brandFilter: 'polo' },
  { label: 'Polo brand shirts, "polo as a word" button', slip: { text: 'polo shirts' } },
  { label: 'anything under $20 (no search text)', slip: { maxPrice: 20 } },
  { label: 'cheapest waterproof hiking boots (sort price_low)', slip: { text: 'waterproof hiking boots', sort: 'price_low' } },
  { label: 'something for a beach wedding', slip: { text: 'beach wedding' } },
];

const engine = await startSearchEngine();
try {
  for (const testCase of CASES) {
    const slip = { ...EMPTY_SLIP, ...testCase.slip };
    const result = await runCase(engine, testCase.label, slip, filtersFromSlip(slip, testCase.brandFilter ? normaliseBrand(testCase.brandFilter) : null));

    /* -- The brief's follow-ups, after the orange shorts -- */
    if (testCase.label.startsWith("I'm looking for orange")) {
      const lowest = Math.min(...result.cards.map((card) => card.minPrice ?? Infinity));
      const cheaper = { ...slip, maxPrice: Number.isFinite(lowest) ? Math.round((lowest - 0.01) * 100) / 100 : slip.maxPrice };
      const shown = new Set(result.cards.map((card) => card.groupKey));
      await runCase(engine, `  then "Anything cheaper?" (max $${cheaper.maxPrice}, ${shown.size} cards excluded)`, cheaper, filtersFromSlip(cheaper, null, shown));
      const blue = { ...slip, color: 'blue' as const };
      await runCase(engine, '  then "Only show blue ones"', blue, filtersFromSlip(blue, null));
    }
  }
  const memory = process.memoryUsage();
  printLine(`\nServer process memory: ${Math.round(memory.rss / 1e6)} MB resident, ${Math.round(memory.heapUsed / 1e6)} MB heap, ${Math.round(memory.arrayBuffers / 1e6)} MB typed arrays`);
} finally {
  await engine.close();
}

async function runCase(searchEngine: SearchEngine, label: string, slip: Slip, filters: FilterSet): Promise<SearchResult> {
  const result = await searchEngine.search({ text: slip.text, sort: slip.sort, filters });
  printLine(`\n${label}`);
  printLine(`  ${result.ranking}, ${result.survivorCount} survivors, filter ${result.timingsMs.filter} ms, rank ${result.timingsMs.rank} ms, total ${result.timingsMs.total} ms`);
  if (result.cards.length === 0) printLine('  no cards');
  result.cards.forEach((card, index) => printLine(`  ${index + 1}. ${describeCard(searchEngine, card)}`));
  return result;
}

function describeCard(searchEngine: SearchEngine, card: Card): string {
  const best = searchEngine.store.products[card.bestRow]!;
  const price = card.minPrice === card.maxPrice ? `$${card.minPrice}` : `$${card.minPrice} to $${card.maxPrice}`;
  const listings = card.passingRows.length > 1 ? ` (${card.passingRows.length} listings)` : '';
  const variant = [best.colorText, best.sizeText].filter(Boolean).join(' / ');
  return `${price}${listings} | ${best.title.slice(0, 70)} | ${best.brand} | ${variant || '-'} | ${best.rating ?? '-'} (${best.ratingCount})${card.hasTwins ? ' | TWINS' : ''}`;
}
