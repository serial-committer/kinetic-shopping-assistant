/* ---------------------------------------
    The search core on small hand-made catalogs: filters (Point 8), BM25 (Point 9), RRF (Point 10),
    card merging (Point 11) and the non-relevance orders.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankByWords } from '../server/catalog/bm25.ts';
import { buildWordIndex } from '../server/catalog/word-index.ts';
import { combineByPosition, rrfPoints } from '../server/search/combine-rrf.ts';
import { type FilterSet, NO_FILTERS } from '../server/search/filter-set.ts';
import { applyFilters } from '../server/search/filters.ts';
import { cardsPerPage, mergeIntoCards } from '../server/search/merge-cards.ts';
import { rankByRating, sortCards } from '../server/search/order-results.ts';
import { fakeStore, product } from './helpers/fake-catalog.ts';

const filters = (fields: Partial<FilterSet>): FilterSet => ({ ...NO_FILTERS, ...fields });

test('filter before merge: an orange Medium listing under $30 never borrows Small from a sibling', () => {
  const shorts = { store: 'VIIOO', title: "Men's 2-in-1 Running Shorts" };
  const store = fakeStore([
    product({ ...shorts, colorFamily: 'orange', sizeGroup: 'M', price: 25 }),
    product({ ...shorts, colorFamily: 'blue', sizeGroup: 'S', price: 22 }),
    product({ ...shorts, colorFamily: 'orange', sizeGroup: 'S', price: 45 }),
  ]);
  const survivors = applyFilters(store.products, store.brandKeys, filters({ color: 'orange', sizeGroup: 'S', maxPrice: 30 }));
  assert.deepEqual(survivors.rows, []);
  assert.deepEqual(mergeIntoCards([0, 1, 2].filter((row) => survivors.mask[row]), store, survivors.mask, 8), []);
});

test('unisex passes a women\'s or men\'s filter but not a children\'s one; unknown gender fails', () => {
  const store = fakeStore([product({ gender: 'unisex' }), product({ gender: 'women' }), product({ gender: 'unknown' }), product({ gender: 'girls' })]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ gender: 'women' })).rows, [0, 1]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ gender: 'men' })).rows, [0]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ gender: 'girls' })).rows, [3]);
});

test('price limits are inclusive and a listing with no price fails them', () => {
  const store = fakeStore([product({ price: 20 }), product({ price: 120 }), product({ price: 120.01 }), product({ price: null })]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ minPrice: 20, maxPrice: 120 })).rows, [0, 1]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, NO_FILTERS).rows, [0, 1, 2, 3]);
});

test('brand, color, size and excluded cards all filter exactly', () => {
  const store = fakeStore([
    product({ brand: 'Merrell', colorFamily: 'brown', sizeGroup: '9.5', title: 'Moab' }),
    product({ brand: 'Nike', colorFamily: 'brown', sizeGroup: '9.5', title: 'Pegasus' }),
    product({ brand: 'Merrell', colorFamily: null, sizeGroup: '9.5', title: 'Siren' }),
    product({ brand: 'Merrell', colorFamily: 'brown', sizeGroup: null, title: 'Vertex' }),
  ]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ brandKey: 'merrell', color: 'brown', sizeGroup: '9.5' })).rows, [0]);
  const excluded = new Set([store.products[0]!.groupKey]);
  assert.deepEqual(applyFilters(store.products, store.brandKeys, filters({ excludedGroups: excluded })).rows, [1, 2, 3]);
});

test('BM25: a rare word outweighs a common one, and only survivors are scored', () => {
  const texts = ['merrell hiking boot', ...Array.from({ length: 20 }, (_, index) => `hiking shoes model ${index}`), 'merrell sandal'];
  const index = buildWordIndex(texts);
  const everyone = new Uint8Array(texts.length).fill(1);
  const ranked = rankByWords(index, 'merrell hiking shoes', everyone).map(({ row }) => row);
  assert.deepEqual(ranked.slice(0, 2).sort(), [0, texts.length - 1].sort());
  const onlyShoes = new Uint8Array(texts.length);
  onlyShoes[3] = 1;
  assert.deepEqual(rankByWords(index, 'merrell hiking shoes', onlyShoes).map(({ row }) => row), [3]);
});

test('RRF: each list gives 1/(60 + place) and only places count', () => {
  const points = rrfPoints([10, 20, 30], [30, 10]);
  assert.equal(points.get(10), 1 / 61 + 1 / 62);
  assert.equal(points.get(20), 1 / 62);
  assert.equal(points.get(30), 1 / 63 + 1 / 61);
  assert.deepEqual(combineByPosition([10, 20, 30], [30, 10]), [10, 30, 20]);
});

test('cards: repeats fold by store and exact title; the headline uses passing listings only; twins are flagged', () => {
  const boot = { store: 'Shop', title: 'Trail Boot' };
  const store = fakeStore([
    product({ ...boot, colorText: 'Brown', sizeText: '9', price: 31.87 }),
    product({ ...boot, colorText: 'Brown', sizeText: '9', price: 39.17 }),
    product({ ...boot, colorText: 'Black', sizeText: '10', price: 99 }),
    product({ store: 'Shop', title: 'Trail Boot ', price: 50 }),
    product({ store: 'Other', title: 'Trail Boot', price: 45 }),
  ]);
  const mask = Uint8Array.from([1, 1, 0, 1, 1]);
  const cards = mergeIntoCards([4, 1, 0, 3], store, mask, 8);
  assert.equal(cards.length, 2, 'a trailing space is trimmed, so rows 0, 1 and 3 share a card; another store is another card');
  const [first, second] = cards;
  assert.equal(first!.bestRow, 4);
  assert.deepEqual(second!.passingRows, [1, 0, 3]);
  assert.deepEqual(second!.otherRows, [2]);
  assert.deepEqual([second!.minPrice, second!.maxPrice], [31.87, 50]);
  assert.equal(second!.hasTwins, true);
  assert.equal(first!.hasTwins, false);
});

test('at most one page of cards', () => {
  const store = fakeStore(Array.from({ length: 20 }, (_, index) => product({ title: `Item ${index}` })));
  const mask = new Uint8Array(20).fill(1);
  assert.equal(mergeIntoCards(store.products.keys(), store, mask, cardsPerPage()).length, 8);
});

test('no search text: best rated first, then most rated, no rating last', () => {
  const products = [product({ rating: 4.5, ratingCount: 10 }), product({ rating: null, ratingCount: 0 }), product({ rating: 4.5, ratingCount: 300 }), product({ rating: 4.9, ratingCount: 2 })];
  assert.deepEqual(rankByRating([0, 1, 2, 3], products), [3, 2, 0, 1]);
});

test('a sort the shopper asked for overrides relevance', () => {
  const store = fakeStore([product({ title: 'A', price: 50 }), product({ title: 'B', price: 20 }), product({ title: 'C', price: 80 })]);
  const cards = mergeIntoCards([0, 1, 2], store, Uint8Array.from([1, 1, 1]), 8);
  assert.deepEqual(sortCards(cards, store.products, 'price_low').map((card) => card.bestRow), [1, 0, 2]);
  assert.deepEqual(sortCards(cards, store.products, 'price_high').map((card) => card.bestRow), [2, 0, 1]);
});
