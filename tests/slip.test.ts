/* ---------------------------------------
    The slip's code side (Point 7): the word-keeper's 20 recorded cases, the merge rules and the brand gate.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBrand } from '../server/slip/brand-gate.ts';
import { keepShopperWords } from '../server/slip/keep-words.ts';
import { mergeSlip } from '../server/slip/merge-slip.ts';
import { findNamedBrand, moveNamedBrand } from '../server/slip/named-brand.ts';
import { checkSort } from '../server/slip/sort-check.ts';
import { isNewTopic } from '../server/slip/new-topic.ts';
import type { SlipChange } from '../server/slip/slip-form.ts';
import { EMPTY_SLIP, type Slip } from '../server/slip/slip-types.ts';

const slipOf = (fields: Partial<Slip>): Slip => ({ ...EMPTY_SLIP, ...fields });
const changeOf = (fields: Partial<SlipChange>): SlipChange => ({
  text: null, color: null, size: null, gender: null, minPrice: null, maxPrice: null, brand: null, sort: null,
  cheaperThanShown: false, clear: [], newSearch: false, ...fields,
});

const KEEP_WORDS_CASES: Array<[string, Partial<Slip>, string]> = [
  ['gore-tex boots for men', { text: 'boots for men' }, 'boots for men gore-tex'],
  ['waterproof hiking boots in brown', { text: 'hiking boots', color: 'brown' }, 'hiking boots waterproof'],
  ['warm gloves for skiing', { text: 'gloves for skiing' }, 'gloves for skiing warm'],
  ['an orange dress I can wear to a party and at work', { text: 'orange dress', color: 'orange' }, 'orange dress wear party work'],
  ['merino wool socks', { text: 'socks' }, 'socks merino wool'],
  ['Show me Nike shoes', { text: 'Nike shoes', brand: 'Nike' }, 'Nike shoes'],
  ['merrell hiking shoes under $100', { text: 'hiking shoes', brand: 'Merrell', maxPrice: 100 }, 'hiking shoes'],
  ['Under Armour shorts in blue', { text: 'shorts', brand: 'Under Armour', color: 'blue' }, 'shorts'],
  ['Polo brand shirts', { text: 'shirts', brand: 'Polo' }, 'shirts'],
  ['Ordinary brand t-shirts', { text: 't-shirts', brand: 'ordinary' }, 't-shirts'],
  ["Levi's jeans under $50", { text: 'jeans', brand: "Levi's", maxPrice: 50 }, 'jeans'],
  ['cheap running socks', { text: 'running socks' }, 'running socks'],
  ['something warm for my dad', { text: 'warm for dad' }, 'warm for dad'],
  ['north face fleece', { text: 'fleece', brand: 'North Face' }, 'fleece'],
  ['In size 9.5', { text: 'hiking boots', size: '9.5' }, 'hiking boots'],
  ['Show me running shoes under $120.', { text: 'running shoes', maxPrice: 120 }, 'running shoes'],
  ['Sort by best rated', { text: 'hiking boots', sort: 'rating' }, 'hiking boots'],
  ['Forget the brand', { text: 'hiking boots' }, 'hiking boots'],
  ['Only show blue ones', { text: 'hiking boots', color: 'blue' }, 'hiking boots'],
  ['Anything cheaper?', { text: 'hiking boots', color: 'blue' }, 'hiking boots'],
];

test('the word-keeper passes all 20 recorded cases', () => {
  for (const [message, slip, expected] of KEEP_WORDS_CASES) {
    assert.equal(keepShopperWords(message, slipOf(slip)).slip.text, expected, message);
  }
});

test('merge: newSearch starts empty, clear empties boxes, null and empty text keep a box', () => {
  const current = slipOf({ text: 'hiking boots', brand: 'Merrell', maxPrice: 150, size: '9.5' });
  assert.deepEqual(mergeSlip(current, changeOf({ newSearch: true, text: 'sandals' }), 3, 'sandals instead').slip, slipOf({ text: 'sandals' }));
  assert.deepEqual(mergeSlip(current, changeOf({ clear: ['maxPrice', 'brand'] }), 3, 'any price, any brand').slip, slipOf({ text: 'hiking boots', size: '9.5' }));
  assert.deepEqual(mergeSlip(current, changeOf({ size: '' as string, color: 'blue' }), 3, 'in blue').slip, { ...current, color: 'blue' });
});

test('merge: "cheaper" ignores the model\'s prices only when products are on screen', () => {
  const current = slipOf({ text: 'running shoes', maxPrice: 120 });
  const copiedFromScreen = changeOf({ cheaperThanShown: true, minPrice: 89.95 });
  const onScreen = mergeSlip(current, copiedFromScreen, 3, 'Anything cheaper?');
  assert.equal(onScreen.cheaperRequested, true);
  assert.equal(onScreen.slip.minPrice, null);
  const firstMessage = mergeSlip(EMPTY_SLIP, changeOf({ cheaperThanShown: true, maxPrice: 120, text: 'running shoes' }), 0, 'Show me running shoes under $120');
  assert.equal(firstMessage.cheaperRequested, false);
  assert.equal(firstMessage.slip.maxPrice, 120);
});

test('cheaper counts only with cards on screen, the same search, no typed price and a price word', () => {
  const current = slipOf({ text: 'running shoes', maxPrice: 120 });
  const cheaper = changeOf({ cheaperThanShown: true });
  assert.equal(mergeSlip(current, cheaper, 8, 'Anything cheaper?').cheaperRequested, true);
  assert.equal(mergeSlip(current, cheaper, 8, 'something less expensive').cheaperRequested, true);
  const typed = mergeSlip(current, changeOf({ cheaperThanShown: true, maxPrice: 120, brand: 'Under Armour', text: 'shoes' }), 200, 'Under Armour shoes under $120');
  assert.equal(typed.cheaperRequested, false, 'the 2026-11-08 log: this became a $12.17 cap');
  assert.equal(typed.cheaperIgnoredBecause, 'the shopper typed a price');
  assert.equal(typed.slip.maxPrice, 120);
  const fresh = mergeSlip(current, changeOf({ cheaperThanShown: true, newSearch: true, text: 'jackets' }), 8, 'cheaper jackets instead');
  assert.equal(fresh.cheaperIgnoredBecause, 'this is a new search');
  const noWord = mergeSlip(current, changeOf({ cheaperThanShown: true, text: 'shoes' }), 8, 'I am asking you that');
  assert.equal(noWord.cheaperIgnoredBecause, 'the message has no price word');
  assert.equal(mergeSlip(current, changeOf({ text: 'shoes' }), 8, 'cheaper').cheaperIgnoredBecause, null, 'the model never said cheaper');
});

test('merge: "Anything cheaper?" keeps color and size; "Only show blue ones" keeps the rest', () => {
  const current = slipOf({ text: 'running shorts', color: 'orange', size: 'small', maxPrice: 60 });
  assert.deepEqual(mergeSlip(current, changeOf({ cheaperThanShown: true }), 2, 'Anything cheaper?').slip, current);
  assert.deepEqual(mergeSlip(current, changeOf({ color: 'blue' }), 2, 'Only show blue ones').slip, { ...current, color: 'blue' });
});

test('new topic: code starts a new search when the new search words share nothing with the saved ones', () => {
  const saved = 'running shoes';
  assert.equal(isNewTopic(saved, changeOf({ text: 'shirts', brand: 'Polo' })), true);
  assert.equal(isNewTopic(saved, changeOf({ text: 'barefoot sandals for a beach wedding' })), true);
  assert.equal(isNewTopic(saved, changeOf({ text: 'trail running shoes' })), false, 'shared words: a refinement');
  assert.equal(isNewTopic(saved, changeOf({ text: 'running shoe' })), false, 'plural s compares loosely');
  assert.equal(isNewTopic(saved, changeOf({ text: null, color: 'blue' })), false, 'no new words: a refinement');
  assert.equal(isNewTopic('hiking boots', changeOf({ text: 'Columbia', brand: 'Columbia' })), false, 'only the brand named: a refinement');
  assert.equal(isNewTopic(null, changeOf({ text: 'shirts' })), false, 'nothing saved yet');
});

test('merge: a new topic found by code starts from an empty slip and says so', () => {
  const current = slipOf({ text: 'running shoes', maxPrice: 120 });
  const merged = mergeSlip(current, changeOf({ text: 'shirts', brand: 'Polo' }), 8, 'Polo shirts');
  assert.deepEqual(merged.slip, slipOf({ text: 'shirts', brand: 'Polo' }));
  assert.equal(merged.startedOver, true);
  assert.equal(merged.newTopicByCode, true);
  const refined = mergeSlip(current, changeOf({ text: 'trail running shoes' }), 8, 'for trail running');
  assert.equal(refined.slip.maxPrice, 120);
  assert.equal(refined.newTopicByCode, false);
});

test('merge: unisex from the model means no gender preference', () => {
  assert.equal(mergeSlip(EMPTY_SLIP, changeOf({ text: 'black leather belt for work', gender: 'unisex' }), 0, 'black leather belt for work').slip.gender, null);
  assert.equal(mergeSlip(EMPTY_SLIP, changeOf({ gender: 'women' }), 0, 'for women').slip.gender, 'women');
});

const SHEETS = {
  brandCounts: new Map([['nike', 995], ['polo', 1], ['the north face', 120], ['under armour', 300], ['merrell', 146]]),
  otherTitleCounts: new Map([['nike', 32], ['polo', 392], ['merrell', 0]]),
};

test('brand gate: Nike filters, Polo asks first, unknown names go back to words, North Face resolves, multi-word names filter', () => {
  assert.deepEqual(checkBrand('Nike', SHEETS), { kind: 'filter', name: 'nike' });
  assert.deepEqual(checkBrand('Polo', SHEETS), { kind: 'ask', name: 'polo', own: 1, elsewhere: 392, asTyped: 'Polo' });
  assert.deepEqual(checkBrand('merino', SHEETS), { kind: 'words', word: 'merino' });
  assert.deepEqual(checkBrand('Ordinary', SHEETS), { kind: 'words', word: 'Ordinary' });
  assert.deepEqual(checkBrand('North Face', SHEETS), { kind: 'filter', name: 'the north face' });
  assert.deepEqual(checkBrand('Under Armour', SHEETS), { kind: 'filter', name: 'under armour' });
  assert.deepEqual(checkBrand(null, SHEETS), { kind: 'none' });
});

test('brand gate: a remembered choice is never asked again', () => {
  assert.deepEqual(checkBrand('Polo', SHEETS, { polo: 'brand' }), { kind: 'filter', name: 'polo' });
  assert.deepEqual(checkBrand('polo', SHEETS, { polo: 'word' }), { kind: 'words', word: 'polo' });
});

test('sort: kept only when the message has a word for that order', () => {
  assert.equal(checkSort('price_low', 'Under Armour shoes under $120').dropped, true, 'the 2026-11-08 log: a sort nobody asked for');
  assert.equal(checkSort('price_low', 'cheapest running shoes').dropped, false);
  assert.equal(checkSort('rating', 'best rated hiking boots').dropped, false);
  assert.equal(checkSort('price_high', 'show the most expensive watches').dropped, false);
  assert.equal(checkSort('price_low', 'sort them by price').dropped, false, 'asking for any order counts');
  assert.equal(checkSort('price_low', 'show me the best ones').dropped, true, 'a rating word does not back a price order');
  assert.equal(checkSort(null, 'anything').dropped, false);
  const merged = mergeSlip(slipOf({ text: 'shoes', sort: 'rating' }), changeOf({ text: 'shoes', sort: 'price_low' }), 8, 'Under Armour shoes under $120');
  assert.equal(merged.slip.sort, 'rating', 'a dropped sort leaves the saved one');
  assert.match(merged.sortDroppedBecause!, /no word for the order price_low/);
});

/* -- Real counts from data/brands.json (own products, titles of other brands using the word) -- */
const CATALOG_SHEETS = {
  brandCounts: new Map([['nike', 995], ['adidas', 666], ['under armour', 683], ['the north face', 304], ['puma', 129], ['guess', 3], ['keen', 50], ['polo', 1], ['2020', 2]]),
  otherTitleCounts: new Map([['nike', 32], ['adidas', 10], ['puma', 52], ['guess', 1], ['polo', 392], ['2020', 51]]),
};

test('named brand: "only the Nike shoes" moves Nike from the words to the brand box', () => {
  const merged = slipOf({ text: 'Nike running shoes', maxPrice: 120 });
  const moved = moveNamedBrand(merged, changeOf({ text: 'Nike running shoes' }), 'Can you show me only the Nike shoes', CATALOG_SHEETS);
  assert.deepEqual(moved.moved, { name: 'nike', asTyped: 'Nike' });
  assert.equal(moved.slip.brand, 'Nike');
  assert.equal(moved.slip.text, 'running shoes');
  assert.equal(moved.slip.maxPrice, 120);
  const twoWords = findNamedBrand('north face fleece please', 'north face fleece', CATALOG_SHEETS);
  assert.deepEqual(twoWords, { name: 'the north face', asTyped: 'north face' });
  assert.equal(findNamedBrand('Under Armour shorts', 'Under Armour shorts', CATALOG_SHEETS)!.asTyped, 'Under Armour');
});

test("named brand: left alone when negated, ambiguous, not clear-cut, not in the model's words, or already set", () => {
  const none = (message: string, text: string) => findNamedBrand(message, text, CATALOG_SHEETS);
  assert.equal(none('anything but Nike', 'shoes Nike'), null, 'negated');
  assert.equal(none('running shoes, not Nike', 'running shoes Nike'), null, 'negated');
  assert.equal(none('other than adidas sneakers', 'adidas sneakers'), null, 'negated');
  assert.equal(none('Nike or Adidas running shoes', 'Nike Adidas running shoes'), null, 'two brands');
  assert.equal(none('Puma sneakers', 'Puma sneakers'), null, 'Puma is 2.5 to 1: left to the model and the gate');
  assert.equal(none('I guess I want boots', 'guess boots'), null, 'Guess has too few products');
  assert.equal(none('polo shirts', 'polo shirts'), null, 'Polo is a word more than a brand');
  assert.equal(none("I'm keen on hiking boots", 'hiking boots'), null, 'the model left "keen" out of the item words');
  assert.equal(none('2020 running shoes', '2020 running shoes'), null, 'a number is not a brand name');
  const set = moveNamedBrand(slipOf({ text: 'Nike shoes', brand: 'Adidas' }), changeOf({ text: 'Nike shoes', brand: 'Adidas' }), 'Adidas, not Nike', CATALOG_SHEETS);
  assert.equal(set.moved, null, 'the model already filled the brand box');
});

test('named brand: a brand button clicked earlier in the chat wins either way', () => {
  assert.deepEqual(findNamedBrand('polo boots', 'polo boots', CATALOG_SHEETS, { polo: 'brand' }), { name: 'polo', asTyped: 'polo' });
  assert.equal(findNamedBrand('Nike shoes', 'Nike shoes', CATALOG_SHEETS, { nike: 'word' }), null);
});
