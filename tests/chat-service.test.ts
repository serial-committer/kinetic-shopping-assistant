/* ---------------------------------------
    The message handler end to end, on a small catalog with a scripted chat model:
    search-only modes, ask, answer, the brand gate's ask-first and buttons, "cheaper", and the reply checks.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatFailure } from '../server/chat/chat-provider.ts';
import { createChatService } from '../server/chat/chat-service.ts';
import { CHAT_FAILED_NOTE, CHAT_OFF_NOTE, FIXED_QUESTION, SCREEN_FULL_NOTE } from '../server/chat/chat-wording.ts';
import { NEW_CONVERSATION } from '../server/chat/conversation-state.ts';
import { SAFE_REPLY } from '../server/chat/reply-checks.ts';
import type { SlipChange } from '../server/slip/slip-form.ts';
import { fakeEngine, registryOf, scriptedProvider } from './helpers/fake-engine.ts';
import { product } from './helpers/fake-catalog.ts';

const CATALOG = [
  product({ id: 'SHOE1', title: 'Trail Running Shoes', brand: 'Nike', store: 'Nike', price: 90, colorFamily: 'blue', colorText: 'Blue' }),
  product({ id: 'SHOE2', title: 'Road Running Shoes', brand: 'Nike', store: 'Nike', price: 60, colorFamily: 'black', colorText: 'Black' }),
  product({ id: 'SHOE3', title: 'Cheap Running Shoes', brand: 'Acme', store: 'Acme', price: 25, colorFamily: 'blue', colorText: 'Blue' }),
  product({ id: 'POLO1', title: 'Polo Suede Boot', brand: 'Polo', store: 'Polo', price: 120 }),
  product({ id: 'POLO2', title: 'Cotton Polo Shirt', brand: 'Acme', store: 'Acme', price: 30 }),
];
const SHEETS = { brandCounts: { nike: 2, acme: 2, polo: 1 }, otherTitleCounts: { nike: 0, acme: 0, polo: 392 } };
const change = (fields: Partial<SlipChange>): SlipChange => ({
  text: null, color: null, size: null, gender: null, minPrice: null, maxPrice: null, brand: null, sort: null, cheaperThanShown: false, clear: [], newSearch: false, ...fields,
});
const search = (fields: Partial<SlipChange>) => ({ action: 'search', question: null, change: change(fields) });

test('no provider set up: search-only with the fixed note, filters off', async () => {
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf());
  const result = await chat.handleMessage({ message: 'blue running shoes under $30', providerId: null, state: NEW_CONVERSATION });
  assert.equal(result.kind, 'search-only');
  assert.equal(result.notice, CHAT_OFF_NOTE);
  assert.equal(result.cards!.length, 3, 'no price or color filter was applied');
});

test('a failed slip runs search-only for that message and keeps the slip', async () => {
  const provider = scriptedProvider({ slip: [new ChatFailure('timeout', 'slow')] });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const state = { ...NEW_CONVERSATION, slip: { ...NEW_CONVERSATION.slip, text: 'shoes' } };
  const result = await chat.handleMessage({ message: 'running shoes', providerId: 'offline', state });
  assert.equal(result.notice, CHAT_FAILED_NOTE);
  assert.equal(result.state.slip.text, 'shoes');
});

test('ask with an empty question shows the fixed question and leaves the cards alone', async () => {
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(scriptedProvider({ slip: [{ action: 'ask', question: 'null', change: null }] })));
  const result = await chat.handleMessage({ message: 'help me find a gift', providerId: null, state: NEW_CONVERSATION });
  assert.equal(result.kind, 'question');
  assert.equal(result.reply.text, FIXED_QUESTION);
  assert.equal(result.cards, null);
});

test('search: filters apply, the reply is checked, unknown ids are dropped, the shopper\'s budget is allowed', async () => {
  const provider = scriptedProvider({
    slip: [search({ text: 'running shoes', maxPrice: 100, color: 'blue' })],
    reply: [{ message: 'Here are blue running shoes under $100, from $25 to $90.', productIds: ['SHOE1', 'NOT-REAL'] }],
  });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const result = await chat.handleMessage({ message: 'blue running shoes under $100', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(result.kind, 'results');
  assert.deepEqual(result.cards!.map((card) => card.id).sort(), ['SHOE1', 'SHOE3']);
  assert.equal(result.reply.text, 'Here are blue running shoes under $100, from $25 to $90.');
  assert.deepEqual(result.reply.highlightIds, ['SHOE1']);
  assert.ok(result.cards!.find((card) => card.id === 'SHOE1')!.highlighted);
});

test('a price that is neither on screen nor in the slip replaces the reply', async () => {
  const provider = scriptedProvider({ slip: [search({ text: 'running shoes' })], reply: [{ message: 'Save $35 with the second pair!', productIds: [] }] });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const result = await chat.handleMessage({ message: 'running shoes', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(result.reply.text, SAFE_REPLY);
  assert.ok(result.cards!.length > 0);
});

test('a failed reply keeps the cards with the fixed sentence', async () => {
  const provider = scriptedProvider({ slip: [search({ text: 'running shoes' })], reply: [new ChatFailure('refusal', 'declined')] });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const result = await chat.handleMessage({ message: 'running shoes', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(result.reply.text, SAFE_REPLY);
  assert.equal(result.cards!.length, 3);
});

test('"Anything cheaper?" keeps the color, sets the price just under the screen and hides the shown cards', async () => {
  const provider = scriptedProvider({
    slip: [search({ text: 'running shoes', color: 'blue' }), search({ cheaperThanShown: true, minPrice: 90 })],
    reply: [{ message: 'Two blue pairs.', productIds: [] }, { message: 'Nothing cheaper matched.', productIds: [] }],
  });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const first = await chat.handleMessage({ message: 'blue running shoes', providerId: 'offline', state: NEW_CONVERSATION });
  const cheaper = await chat.handleMessage({ message: 'Anything cheaper?', providerId: 'offline', state: first.state });
  assert.equal(cheaper.state.slip.color, 'blue');
  assert.equal(cheaper.state.slip.minPrice, null, 'the model copied a screen price into minPrice; code ignored it');
  assert.equal(cheaper.state.slip.maxPrice, 24.99);
  assert.equal(cheaper.state.excludedGroups.length, 2);
  assert.deepEqual(cheaper.cards, []);
});

test('ask first: Polo asks before any search; a button skips the slip model; the choice is remembered', async () => {
  const provider = scriptedProvider({
    slip: [search({ text: 'suede boot', brand: 'Polo' }), search({ brand: 'Polo', text: 'boot' })],
    reply: [{ message: 'The only Polo item is a suede boot.', productIds: ['POLO1'] }, { message: 'Still the boot.', productIds: [] }],
  });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const asked = await chat.handleMessage({ message: 'Polo brand suede boot', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(asked.kind, 'brand-question');
  assert.equal(asked.cards, null);
  assert.match(asked.brandQuestion!.brand.label, /^Polo, the brand \(1 product\)$/);
  assert.match(asked.brandQuestion!.word.label, /^polo as a word \(392 products\)$/);

  const slipCallsBefore = provider.calls.filter((call) => call.purpose === 'slip').length;
  const clicked = await chat.handleBrandChoice({ choice: 'brand', providerId: 'offline', state: asked.state });
  assert.equal(provider.calls.filter((call) => call.purpose === 'slip').length, slipCallsBefore, 'the button did not call the slip model');
  assert.deepEqual(clicked.cards!.map((card) => card.id), ['POLO1']);
  assert.equal(clicked.state.brandChoices['polo'], 'brand');

  const again = await chat.handleMessage({ message: 'Polo boots', providerId: 'offline', state: clicked.state });
  assert.equal(again.kind, 'results', 'the remembered choice is not asked again');
});

test('answer: questions about the cards on screen answer from their records and keep the cards', async () => {
  const provider = scriptedProvider({
    slip: [search({ text: 'running shoes' }), { action: 'answer', question: null, change: null }],
    reply: [{ message: 'Three pairs.', productIds: [] }, { message: 'The catalog does not say whether it is waterproof.', productIds: ['SHOE1'] }],
  });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const first = await chat.handleMessage({ message: 'running shoes', providerId: 'offline', state: NEW_CONVERSATION });
  const answer = await chat.handleMessage({ message: 'Is the first one waterproof?', providerId: 'offline', state: first.state });
  assert.equal(answer.kind, 'answer');
  assert.deepEqual(answer.cards!.map((card) => card.id), first.cards!.map((card) => card.id));
  assert.match(provider.calls.at(-1)!.input, /asking about the products on screen/);
});

test('load more: the next cards come without repeats, and hasMore turns false at the end', async () => {
  const shoes = Array.from({ length: 12 }, (_, index) => product({ id: `RUN${index}`, title: `Running Shoes Model ${index}`, store: `Store ${index}`, price: 40 + index }));
  const provider = scriptedProvider({ slip: [search({ text: 'running shoes', maxPrice: 100 })], reply: [{ message: 'Twelve pairs.', productIds: [] }] });
  const chat = createChatService(fakeEngine(shoes), registryOf(provider));
  const first = await chat.handleMessage({ message: 'running shoes under $100', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(first.cards!.length, 8);
  assert.equal(first.hasMore, true);

  const callsBefore = provider.calls.length;
  const more = await chat.handleLoadMore({ state: first.state });
  assert.equal(provider.calls.length, callsBefore, 'load more never calls the chat model');
  assert.equal(more.kind, 'more');
  assert.equal(more.cards!.length, 4);
  assert.equal(more.hasMore, false);
  const firstIds = new Set(first.cards!.map((card) => card.id));
  assert.ok(more.cards!.every((card) => !firstIds.has(card.id)), 'no card repeats');
  assert.equal(more.state.screenIds.length, 12);
  assert.deepEqual(more.state.history, first.state.history, 'load more adds nothing to the chat');
});

test('load more stops at 200 cards with a note, instead of repeating the same page', async () => {
  const shoes = Array.from({ length: 210 }, (_, index) => product({ id: `RUN${index}`, title: `Running Shoes Model ${index}`, store: `Store ${index}`, price: 40 + index }));
  const provider = scriptedProvider({ slip: [search({ text: 'running shoes' })], reply: [{ message: 'Many pairs.', productIds: [] }] });
  const chat = createChatService(fakeEngine(shoes), registryOf(provider));
  const first = await chat.handleMessage({ message: 'running shoes', providerId: 'offline', state: NEW_CONVERSATION });
  const nearlyFull = { ...first.state, screenIds: shoes.slice(0, 192).map((shoe) => shoe.id) };
  const last = await chat.handleLoadMore({ state: nearlyFull });
  assert.equal(last.cards!.length, 8);
  assert.equal(last.state.screenIds.length, 200);
  assert.equal(last.hasMore, false, '18 shoes were left, but the screen is full');
  assert.equal(last.notice, SCREEN_FULL_NOTE);
  const beyond = await chat.handleLoadMore({ state: last.state });
  assert.deepEqual(beyond.cards, []);
  assert.equal(beyond.hasMore, false);
});

test('an ask that names an item in the form searches instead; an ask without one still asks', async () => {
  const provider = scriptedProvider({
    slip: [
      { action: 'ask', question: 'Are there any Nike running shoes?', change: change({ text: 'running shoes', brand: 'Nike' }) },
      { action: 'ask', question: 'Who is it for?', change: change({ gender: 'men' }) },
    ],
    reply: [{ message: 'Two Nike pairs.', productIds: [] }],
  });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const searched = await chat.handleMessage({ message: 'There are no Nike shoes at all?', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(searched.kind, 'results');
  assert.deepEqual(searched.cards!.map((card) => card.id).sort(), ['SHOE1', 'SHOE2']);
  const asked = await chat.handleMessage({ message: 'a gift', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(asked.kind, 'question');
  assert.equal(asked.reply.text, 'Who is it for?');
});

test('a size the rules cannot read searches as a word instead of vanishing', async () => {
  const provider = scriptedProvider({ slip: [search({ text: 'dress', size: 'petite' })], reply: [{ message: 'ok', productIds: [] }] });
  const chat = createChatService(fakeEngine(CATALOG, SHEETS), registryOf(provider));
  const result = await chat.handleMessage({ message: 'petite dress', providerId: 'offline', state: NEW_CONVERSATION });
  assert.equal(result.state.slip.size, null);
  assert.equal(result.state.slip.text, 'dress petite');
});
