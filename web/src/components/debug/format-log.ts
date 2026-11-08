/* ---------------------------------------
    Turns log entries into plain text for copying: one line per entry (time, level, source, step, message, then the
    data as one line of JSON), grouped under a heading per chat message. It reads like the server console, and can
    be pasted straight into a chat or an issue.
--------------------------------------- */

import type { LogEntry } from '../../api/api-types.ts';

export function formatEntry(entry: LogEntry): string {
  const source = entry.source === 'server' ? '' : `[${entry.source}] `;
  return `${entry.time.slice(11, 23)} ${entry.level.padEnd(5)} ${source}${entry.step} ${entry.message}${entry.dataJson ? ` ${entry.dataJson}` : ''}`;
}

export function groupTitle(messageId: string): string {
  return messageId.length === 8 ? `Message ${messageId}` : messageId;
}

export function formatGroup(messageId: string, entries: readonly LogEntry[]): string {
  return [`## ${groupTitle(messageId)}`, ...entries.map(formatEntry)].join('\n');
}

export function formatGroups(groups: ReadonlyArray<readonly [string, readonly LogEntry[]]>): string {
  return groups.map(([messageId, entries]) => formatGroup(messageId, entries)).join('\n\n');
}
