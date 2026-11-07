/* ---------------------------------------
    Measures the meaning floor (server/search/meaning-floor.ts) on the slip test's first messages, with the slips
    the local model produced for them, so no chat model is needed. Usage: npm run floor-check [-- --floor=0.62]
    For each search it prints which products the floor removed from the first page (with their meaning scores),
    and the kept product that matches no search word with the lowest score: the ones closest to the line.
    Read the titles: a removed product that fits the request means the floor is too high; a kept one that
    doesn't means it is too low.
--------------------------------------- */

import { parseArgs } from 'node:util';
import { rankByWords } from '../server/catalog/bm25.ts';
import { normaliseBrand } from '../server/catalog/brand-rules.ts';
import { type ColorFamily } from '../server/catalog/color-rules.ts';
import { createEmbedderService } from '../server/embedder/embedder-service.ts';
import { printLine } from '../server/logging/logger.ts';
import { rrfPoints } from '../server/search/combine-rrf.ts';
import { filtersFromSlip } from '../server/search/filter-set.ts';
import { applyFilters } from '../server/search/filters.ts';
import { applyMeaningFloor, MEANING_FLOOR } from '../server/search/meaning-floor.ts';
import { cardsPerPage, mergeIntoCards } from '../server/search/merge-cards.ts';
import { rankByMeaning } from '../server/search/rank-by-meaning.ts';
import { startSearchEngine } from '../server/search/search-engine.ts';
import { EMPTY_SLIP, type ShopperGender, type Slip } from '../server/slip/slip-types.ts';

type Probe = { message: string; text: string; brand?: string; color?: ColorFamily; size?: string; gender?: ShopperGender; maxPrice?: number };

/* -- The slips the local model filled for the slip test's first messages (after merge, keep-words and the gate) -- */
const PROBES: Probe[] = [
  { message: 'Show me Nike shoes', text: 'Nike shoes', brand: 'nike' },
  { message: 'merrell hiking shoes under $100', text: 'merrell hiking shoes', brand: 'merrell', maxPrice: 100 },
  { message: 'Columbia jackets under $80', text: 'jackets', brand: 'columbia', maxPrice: 80 },
  { message: 'north face fleece', text: 'north face fleece' },
  { message: 'Under Armour shorts in blue', text: 'shorts', brand: 'under armour', color: 'blue' },
  { message: 'Life is Good t-shirt', text: 'Life is Good t-shirt', brand: 'life is good' },
  { message: 'Oakley sunglasses (as words)', text: 'Oakley sunglasses' },
  { message: 'Fox racing gloves', text: 'Fox racing gloves' },
  { message: 'gore-tex boots for men', text: 'gore-tex boots', gender: 'men' },
  { message: 'merino wool socks', text: 'merino wool socks' },
  { message: 'warm gloves for skiing', text: 'warm gloves for skiing' },
  { message: 'an orange dress I can wear to a party and at work', text: 'dress wear party work', color: 'orange' },
  { message: 'something for a beach wedding', text: 'beach wedding' },
  { message: 'an ordinary white t-shirt', text: 'ordinary white t-shirt', color: 'white' },
  { message: 'Ordinary brand t-shirts', text: 't-shirts ordinary brand' },
  { message: 'a polo shirt', text: 'polo shirt' },
  { message: 'Polo brand shirts (the brand)', text: 'shirts', brand: 'polo' },
  { message: 'a new bracelet', text: 'bracelet' },
  { message: 'I need something for my sister', text: 'sister', gender: 'women' },
  { message: "Levi's jeans under $50", text: "Levi's jeans", brand: "levi's", maxPrice: 50 },
  { message: 'waterproof hiking boots in brown', text: 'waterproof hiking boots', color: 'brown' },
  { message: 'Calvin Klein boxers', text: 'boxers', brand: 'calvin klein', gender: 'men' },
  { message: 'a linen shirt for a summer wedding', text: 'linen shirt summer wedding' },
  { message: 'cheap running socks', text: 'running socks' },
  { message: 'Carhartt beanie', text: 'Carhartt beanie', brand: 'carhartt' },
  { message: 'something warm for my dad', text: 'warm dad', gender: 'men' },
  { message: 'black leather belt for work', text: 'black leather belt work', color: 'black' },
  { message: 'Show me running shoes under $120', text: 'running shoes', maxPrice: 120 },
  { message: 'orange running shorts in size small', text: 'running shorts', color: 'orange', size: 'small' },
  { message: '  then "Anything cheaper?"', text: 'running shorts', color: 'orange', size: 'small', maxPrice: 23.88 },
  { message: 'something to keep my hands warm on the slopes', text: 'something to keep my hands warm on the slopes' },
];

const { values } = parseArgs({ options: { floor: { type: 'string' } } });
const floor = values.floor ? Number(values.floor) : MEANING_FLOOR;

const engine = await startSearchEngine();
const store = engine.store;
if (!store.vectors) {
  printLine('The vectors were refused or are missing, so there is no meaning score to measure.');
  process.exit(1);
}
const embedder = createEmbedderService({ expectedDimension: store.vectors.dimension });
await embedder.start();

let removedTotal = 0;
try {
  printLine(`Meaning floor ${floor}, first page of ${cardsPerPage()} cards\n`);
  for (const probe of PROBES) {
    const slip: Slip = { ...EMPTY_SLIP, text: probe.text, color: probe.color ?? null, size: probe.size ?? null, gender: probe.gender ?? null, maxPrice: probe.maxPrice ?? null };
    const survivors = applyFilters(store.products, store.brandKeys, filtersFromSlip(slip, probe.brand ? normaliseBrand(probe.brand) : null));
    const byWords = rankByWords(store.wordIndex, probe.text, survivors.mask);
    const queryVector = await embedder.embedQuery(probe.text);
    const byMeaning = rankByMeaning(store.vectors, queryVector!, survivors.rows);
    const ranked = [...rrfPoints(byWords.map(({ row }) => row), byMeaning.map(({ row }) => row))].sort((a, b) => b[1] - a[1]).map(([row]) => row);
    const wordRows = new Set(byWords.map(({ row }) => row));
    const scores = new Map(byMeaning.map(({ row, score }) => [row, score]));
    const { keptRows } = applyMeaningFloor(ranked, wordRows, scores, floor);

    const pageBefore = mergeIntoCards(ranked, store, survivors.mask, cardsPerPage());
    const pageAfter = mergeIntoCards(keptRows, store, survivors.mask, cardsPerPage());
    const afterKeys = new Set(pageAfter.map((card) => card.groupKey));
    const removed = pageBefore.filter((card) => !afterKeys.has(card.groupKey));
    removedTotal += removed.length;
    const meaningOnlyKept = pageAfter.filter((card) => !wordRows.has(card.bestRow)).sort((a, b) => scores.get(a.bestRow)! - scores.get(b.bestRow)!);

    printLine(`${probe.message} | ${survivors.rows.length} survivors | page ${pageBefore.length} -> ${pageAfter.length}`);
    for (const card of removed) printLine(`    removed ${scores.get(card.bestRow)!.toFixed(3)}  ${store.products[card.bestRow]!.title.slice(0, 80)}`);
    const closest = meaningOnlyKept[0];
    if (closest) printLine(`    lowest kept without a word match ${scores.get(closest.bestRow)!.toFixed(3)}  ${store.products[closest.bestRow]!.title.slice(0, 80)}`);
  }
  printLine(`\n${removedTotal} cards removed from first pages across ${PROBES.length} searches`);
} finally {
  await embedder.close();
  await engine.close();
}
