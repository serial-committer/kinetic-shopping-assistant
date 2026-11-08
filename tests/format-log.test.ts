/* ---------------------------------------
    The debug panel's copy format: plain lines grouped by message, with the data as one line of JSON.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogEntry } from '../server/logging/logger.ts';
import { formatGroups } from '../web/src/components/debug/format-log.ts';

const entry = (fields: Partial<LogEntry>): LogEntry => ({ id: 1, time: '2026-11-08T10:15:30.123Z', level: 'DEBUG', source: 'server', step: 'P6', messageId: 'abcd1234', message: 'slip response', ...fields });

test('copied logs read as plain lines under one heading per message', () => {
  const text = formatGroups([
    ['abcd1234', [entry({ level: 'INFO', step: 'turn', message: 'shopper message', dataJson: '{"message":"running shoes"}' }), entry({ source: 'embedder', step: 'P9', message: 'shopper text embedded' })]],
    ['outside a chat message', [entry({ messageId: null, step: 'start', message: 'listening' })]],
  ]);
  assert.equal(text, [
    '## Message abcd1234',
    '10:15:30.123 INFO  turn shopper message {"message":"running shoes"}',
    '10:15:30.123 DEBUG [embedder] P9 shopper text embedded',
    '',
    '## outside a chat message',
    '10:15:30.123 DEBUG start listening',
  ].join('\n'));
});
