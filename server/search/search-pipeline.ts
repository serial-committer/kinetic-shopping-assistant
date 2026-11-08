/* ---------------------------------------
    Points 8 to 11 in order: filter every listing, rank the survivors, combine the two rankings, fold into cards.
        P8   filters.ts         exact boxes, every listing on its own
        P9   bm25.ts            words, survivors only
             rank-by-meaning.ts bge-small, survivors only (skipped when vectors or the embedder are off)
        P10  combine-rrf.ts     points from places on both lists
             meaning-floor.ts   a product matching no search word needs a meaning score of 0.62 to stay
        P11  merge-cards.ts     repeats fold into one card, one page of cards
    No search text means best rated first. A sort the shopper asked for reorders the most relevant cards
    (the top 40), so "cheapest running shoes" stays about running shoes instead of jumping to the cheapest item in stock.
--------------------------------------- */

import type { ScoredRow } from '../catalog/bm25.ts';
import { rankByWords } from '../catalog/bm25.ts';
import type { CatalogStore } from '../catalog/catalog-store.ts';
import { logger } from '../logging/logger.ts';
import type { SortOrder } from '../slip/slip-types.ts';
import { rrfPoints } from './combine-rrf.ts';
import type { FilterSet } from './filter-set.ts';
import { applyFilters, type Survivors } from './filters.ts';
import { type Card, cardsPerPage, mergeIntoCards } from './merge-cards.ts';
import { applyMeaningFloor, MEANING_FLOOR } from './meaning-floor.ts';
import { rankByRating, sortCards } from './order-results.ts';
import { rankByMeaning } from './rank-by-meaning.ts';

const SORT_POOL_CARDS = 40;
const LOGGED_TOP = 10;
const TRACED_TOP = 50;

export type QueryEmbedder = (text: string) => Promise<Float32Array | null>;

export type SearchRequest = Readonly<{ text: string | null; sort: SortOrder | null; filters: FilterSet }>;

export type RankingMode = 'words+meaning' | 'words' | 'rating';

export type SearchResult = Readonly<{
  cards: readonly Card[];
  /* -- True when at least one more card exists after this page: the page shows "Load more" only then -- */
  hasMore: boolean;
  survivorCount: number;
  ranking: RankingMode;
  timingsMs: Readonly<{ filter: number; rank: number; total: number }>;
}>;

export async function runSearch(store: CatalogStore, embedQuery: QueryEmbedder | null, request: SearchRequest): Promise<SearchResult> {
  const started = performance.now();
  const survivors = applyFilters(store.products, store.brandKeys, request.filters);
  const filterMs = performance.now() - started;
  logger.debug('P8', 'filters applied', { filters: { ...request.filters, excludedGroups: request.filters.excludedGroups.size }, survivors: survivors.rows.length, ms: round(filterMs) });

  const text = request.text?.trim() ?? '';
  const rankStarted = performance.now();
  const { rankedRows, ranking } = text ? await rankByRelevance(store, embedQuery, text, survivors) : { rankedRows: rankByRating(survivors.rows, store.products), ranking: 'rating' as const };
  const rankMs = performance.now() - rankStarted;

  /* -- One card more than a page is enough to know whether "Load more" has anything to load -- */
  const poolSize = request.sort ? (text ? SORT_POOL_CARDS : Infinity) : cardsPerPage() + 1;
  const pool = mergeIntoCards(rankedRows, store, survivors.mask, poolSize);
  const ordered = request.sort ? sortCards(pool, store.products, request.sort) : pool;
  const cards = ordered.slice(0, cardsPerPage());
  const hasMore = ordered.length > cards.length;
  logger.debug('P11', 'cards', { hasMore, cards: cards.map((card) => ({ id: store.products[card.bestRow]!.id, title: shortTitle(store, card.bestRow), listings: card.passingRows.length, minPrice: card.minPrice, maxPrice: card.maxPrice, twins: card.hasTwins })) });

  return {
    cards,
    hasMore,
    survivorCount: survivors.rows.length,
    ranking,
    timingsMs: { filter: round(filterMs), rank: round(rankMs), total: round(performance.now() - started) },
  };
}

/* -- Words always; meaning too when vectors and the embedder are both available; then RRF over the two lists -- */
async function rankByRelevance(store: CatalogStore, embedQuery: QueryEmbedder | null, text: string, survivors: Survivors): Promise<{ rankedRows: number[]; ranking: RankingMode }> {
  const byWords = rankByWords(store.wordIndex, text, survivors.mask);
  logTop('word ranker (BM25)', byWords, store);
  if (logger.isEnabled('TRACE')) logger.trace('P9', `word ranker top ${TRACED_TOP} scores`, byWords.slice(0, TRACED_TOP).map(({ row, score }) => ({ id: store.products[row]!.id, score: round(score) })));

  const queryVector = store.vectors && embedQuery ? await embedQuery(text) : null;
  if (!store.vectors || !queryVector || queryVector.length !== store.vectors.dimension) {
    return { rankedRows: byWords.map(({ row }) => row), ranking: 'words' };
  }
  const byMeaning = rankByMeaning(store.vectors, queryVector, survivors.rows);
  logTop('meaning ranker (bge-small)', byMeaning, store);

  const points = [...rrfPoints(byWords.map(({ row }) => row), byMeaning.map(({ row }) => row))].sort((a, b) => b[1] - a[1]);
  logger.debug('P10', 'RRF totals, top 10', points.slice(0, LOGGED_TOP).map(([row, total]) => ({ title: shortTitle(store, row), points: Number(total.toFixed(5)) })));

  const wordMatchRows = new Set(byWords.map(({ row }) => row));
  const meaningScores = new Map(byMeaning.map(({ row, score }) => [row, score]));
  const { keptRows, hiddenRows } = applyMeaningFloor(points.map(([row]) => row), wordMatchRows, meaningScores);
  if (hiddenRows.length) logger.debug('P10', `meaning floor ${MEANING_FLOOR}: hid ${hiddenRows.length} products that match no search word`, { kept: keptRows.length });
  return { rankedRows: keptRows, ranking: 'words+meaning' };
}

function logTop(ranker: string, scored: readonly ScoredRow[], store: CatalogStore): void {
  if (!logger.isEnabled('DEBUG')) return;
  logger.debug('P9', `${ranker}, top 10 of ${scored.length}`, scored.slice(0, LOGGED_TOP).map(({ row, score }) => ({ title: shortTitle(store, row), score: Number(score.toFixed(3)) })));
}

function shortTitle(store: CatalogStore, row: number): string {
  return store.products[row]!.title.slice(0, 70);
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}
