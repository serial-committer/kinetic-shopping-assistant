/* ---------------------------------------
    The debug panel's copy format (plain lines grouped by message, data as one line of JSON) and Export's choices.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogEntry } from '../server/logging/logger.ts';
import { buildExport, DEFAULT_CHOICES, type ExportChoices, exportFileName, fieldLabel, kindKey, lineKinds, withoutFields } from '../web/src/components/debug/export-log.ts';
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

/* -- Export: entries shaped like the 2026-11-08 log -- */
const shopper = entry({ id: 2, level: 'INFO', step: 'turn', messageId: 'f56ac42a', message: 'shopper message', dataJson: '{"message":"Show me running shoes under $120","cardsOnScreen":0}' });
const ranker = (total: number, id: number, messageId: string) => entry({ id, step: 'P9', messageId, message: `word ranker (BM25), top 10 of ${total}`, dataJson: '[{"title":"ALTRA Sneaker","score":7.9}]' });
const cards = entry({ id: 4, step: 'P11', messageId: 'f56ac42a', message: 'cards', dataJson: '{"hasMore":true,"cards":[{"id":"B01MT1JYDF","title":"ALTRA Sneaker","listings":9,"twins":false}]}' });
const loadMore = entry({ id: 5, level: 'INFO', step: 'turn', messageId: 'debedcab', message: 'load more', dataJson: '{"cardsOnScreen":8}' });
const GROUPS = [['f56ac42a', [shopper, ranker(6377, 3, 'f56ac42a'), cards]], ['debedcab', [loadMore, ranker(6893, 6, 'debedcab')]]] as const;

test('export: one kind per log line, numbers in the message ignored, fields read from the data', () => {
  const kinds = lineKinds(GROUPS.flatMap(([, entries]) => entries));
  const rankers = kinds.filter((kind) => kind.step === 'P9');
  assert.equal(rankers.length, 1);
  assert.equal(rankers[0]!.count, 2);
  assert.deepEqual(rankers[0]!.fields, ['[].title', '[].score']);
  assert.deepEqual(kinds.find((kind) => kind.step === 'P11')!.fields, ['hasMore', 'cards[].id', 'cards[].title', 'cards[].listings', 'cards[].twins']);
  assert.equal(fieldLabel('cards[].twins'), 'cards › twins');
  assert.equal(fieldLabel('[].score'), 'score');
});

test('export: skipped fields leave the data; a list whose fields are all skipped goes too', () => {
  const data = { hasMore: true, cards: [{ id: 'A', twins: false }, { id: 'B', twins: true }] };
  assert.deepEqual(withoutFields(data, new Set(['cards[].twins'])), { hasMore: true, cards: [{ id: 'A' }, { id: 'B' }] });
  assert.deepEqual(withoutFields(data, new Set(['cards[].twins', 'cards[].id'])), { hasMore: true });
});

test('export: line parts, Load more messages, skipped kinds and fields, and a header that says what was left out', () => {
  const cardsKind = kindKey(cards);
  const choices: ExportChoices = {
    ...DEFAULT_CHOICES,
    parts: { time: false, level: false, source: true, step: true },
    levels: ['DEBUG', 'INFO'],
    loadMore: false,
    skippedKinds: [kindKey(shopper)],
    skippedFields: { [cardsKind]: ['cards[].twins', 'cards[].listings'] },
  };
  const result = buildExport(GROUPS, choices, new Date(2026, 10, 8, 18, 43));
  assert.equal(result.messages, 1);
  assert.equal(result.lines, 2);
  const lines = result.text.split('\n');
  assert.equal(lines[0], '# Kinetic Shopping Assistant logs');
  assert.match(lines[2]!, /^# Left out: Load more messages; turn shopper message; P11 cards: cards › twins, cards › listings$/);
  assert.ok(result.text.includes('## Message f56ac42a · "Show me running shoes under $120"'), 'the heading names the message even when its line is left out');
  assert.ok(result.text.includes('P11 cards\n    {\n      "hasMore": true,'), 'indented data sits under its line');
  assert.ok(!result.text.slice(result.text.indexOf('## Message')).includes('"twins"'), 'no twins field after the header');
  assert.ok(!result.text.includes('debedcab'), 'Load more message left out');
  const oneLine = buildExport(GROUPS, { ...choices, indentData: false, loadMore: true }, new Date(2026, 10, 8, 18, 43));
  assert.ok(oneLine.text.includes('P11 cards {"hasMore":true,"cards":[{"id":"B01MT1JYDF","title":"ALTRA Sneaker"}]}'));
  assert.ok(oneLine.text.includes('## Message debedcab · Load more (8 cards on screen)'));
});

test('export: the file name follows the logs folder, like November_8_18_43.log', () => {
  assert.equal(exportFileName(new Date(2026, 10, 8, 18, 43)), 'November_8_18_43.log');
  assert.equal(exportFileName(new Date(2026, 0, 5, 9, 7)), 'January_5_09_07.log');
});
