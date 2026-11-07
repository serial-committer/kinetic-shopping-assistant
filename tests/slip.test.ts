/* ---------------------------------------
    The slip's code side (Point 7): the word-keeper's 20 recorded cases, the merge rules and the brand gate.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBrand } from '../server/slip/brand-gate.ts';
import { keepShopperWords } from '../server/slip/keep-words.ts';
import { mergeSlip } from '../server/slip/merge-slip.ts';
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
  assert.deepEqual(mergeSlip(current, changeOf({ newSearch: true, text: 'sandals' }), 3).slip, slipOf({ text: 'sandals' }));
  assert.deepEqual(mergeSlip(current, changeOf({ clear: ['maxPrice', 'brand'] }), 3).slip, slipOf({ text: 'hiking boots', size: '9.5' }));
  assert.deepEqual(mergeSlip(current, changeOf({ size: '' as string, color: 'blue' }), 3).slip, { ...current, color: 'blue' });
});

test('merge: "cheaper" ignores the model\'s prices only when products are on screen', () => {
  const current = slipOf({ text: 'running shoes', maxPrice: 120 });
  const copiedFromScreen = changeOf({ cheaperThanShown: true, minPrice: 89.95 });
  const onScreen = mergeSlip(current, copiedFromScreen, 3);
  assert.equal(onScreen.cheaperRequested, true);
  assert.equal(onScreen.slip.minPrice, null);
  const firstMessage = mergeSlip(EMPTY_SLIP, changeOf({ cheaperThanShown: true, maxPrice: 120, text: 'running shoes' }), 0);
  assert.equal(firstMessage.cheaperRequested, false);
  assert.equal(firstMessage.slip.maxPrice, 120);
});

test('merge: "Anything cheaper?" keeps color and size; "Only show blue ones" keeps the rest', () => {
  const current = slipOf({ text: 'running shorts', color: 'orange', size: 'small', maxPrice: 60 });
  assert.deepEqual(mergeSlip(current, changeOf({ cheaperThanShown: true }), 2).slip, current);
  assert.deepEqual(mergeSlip(current, changeOf({ color: 'blue' }), 2).slip, { ...current, color: 'blue' });
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
  const merged = mergeSlip(current, changeOf({ text: 'shirts', brand: 'Polo' }), 8);
  assert.deepEqual(merged.slip, slipOf({ text: 'shirts', brand: 'Polo' }));
  assert.equal(merged.startedOver, true);
  assert.equal(merged.newTopicByCode, true);
  const refined = mergeSlip(current, changeOf({ text: 'trail running shoes' }), 8);
  assert.equal(refined.slip.maxPrice, 120);
  assert.equal(refined.newTopicByCode, false);
});

test('merge: unisex from the model means no gender preference', () => {
  assert.equal(mergeSlip(EMPTY_SLIP, changeOf({ text: 'black leather belt for work', gender: 'unisex' }), 0).slip.gender, null);
  assert.equal(mergeSlip(EMPTY_SLIP, changeOf({ gender: 'women' }), 0).slip.gender, 'women');
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
