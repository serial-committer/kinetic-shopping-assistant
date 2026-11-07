/* ---------------------------------------
    Point 12's checks on the reply's words: dollar amounts, the shopper's own budget, unknown ids, the stock slot.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkReply, dollarAmounts, SAFE_REPLY } from '../server/chat/reply-checks.ts';
import { EMPTY_SLIP } from '../server/slip/slip-types.ts';

const shown = new Set(['A', 'B']);

test('dollar amounts are read with commas, decimals and a space after the sign', () => {
  assert.deepEqual(dollarAmounts('from $31.87 to $1,299.50, or $ 45 each'), [31.87, 1299.5, 45]);
  assert.deepEqual(dollarAmounts('no prices here'), []);
});

test('prices on screen and the slip\'s limits pass; anything else replaces the reply', () => {
  const slip = { ...EMPTY_SLIP, maxPrice: 120 };
  assert.equal(checkReply('Under $120: from $31.87 to $39.17.', [], shown, [31.87, 39.17], slip).text, 'Under $120: from $31.87 to $39.17.');
  const invented = checkReply('Only $29.99 today!', [], shown, [31.87], slip);
  assert.equal(invented.text, SAFE_REPLY);
  assert.deepEqual(invented.unknownAmounts, [29.99]);
});

test('ids not on screen are dropped; ids on screen become highlights', () => {
  const checked = checkReply('Two picks.', ['A', 'Z', 'A'], shown, [], EMPTY_SLIP);
  assert.deepEqual(checked.highlightIds, ['A']);
  assert.deepEqual(checked.droppedIds, ['Z']);
});

test('a reply that left the stock sentence\'s size slot empty is replaced', () => {
  assert.equal(checkReply("It's listed in size <listed size>, but I can't see which other sizes exist.", [], shown, [], EMPTY_SLIP).text, SAFE_REPLY);
});
