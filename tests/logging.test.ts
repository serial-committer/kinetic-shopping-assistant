/* ---------------------------------------
    The logger's building blocks: level order, the fixed-size panel buffer and key masking.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLevelEnabled } from '../server/logging/log-levels.ts';
import { RingBuffer } from '../server/logging/ring-buffer.ts';
import { maskSecrets } from '../server/logging/secret-mask.ts';

test('a level prints itself and everything above it', () => {
  assert.equal(isLevelEnabled('TRACE', 'DEBUG'), false);
  assert.equal(isLevelEnabled('DEBUG', 'DEBUG'), true);
  assert.equal(isLevelEnabled('ERROR', 'DEBUG'), true);
  assert.equal(isLevelEnabled('INFO', 'WARN'), false);
  assert.equal(isLevelEnabled('ERROR', 'OFF'), false);
});

test('the ring buffer keeps only the newest entries and returns what is new', () => {
  const buffer = new RingBuffer<{ id: number }>(3);
  for (let id = 1; id <= 5; id += 1) buffer.push({ id });
  assert.deepEqual(buffer.itemsAfter(0).map((item) => item.id), [3, 4, 5]);
  assert.deepEqual(buffer.itemsAfter(4).map((item) => item.id), [5]);
  assert.deepEqual(buffer.itemsAfter(5), []);
});

test('configured keys are masked in text and nested data', () => {
  const secret = 'sk-test-123456';
  assert.equal(maskSecrets(`key ${secret} used`, [secret]), 'key *** used');
  assert.deepEqual(maskSecrets({ headers: { authorization: `Bearer ${secret}` }, list: [secret] }, [secret]), { headers: { authorization: 'Bearer ***' }, list: ['***'] });
  assert.deepEqual(maskSecrets({ value: 1 }, []), { value: 1 });
});
