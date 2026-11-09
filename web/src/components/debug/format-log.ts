/* ---------------------------------------
    Turns log entries into plain text for copying: one line per entry (time, level, source, step, message, then the
    data as one line of JSON), grouped under a heading per chat message. It reads like the server console, and can
    be pasted straight into a chat or an issue. Export (export-log.ts) uses the same line with parts left out.
--------------------------------------- */

import type { LogEntry } from '../../api/api-types.ts';

/* -- The optional pieces in front of the message; the message itself always stays -- */
export type LineParts = Readonly<{ time: boolean; level: boolean; source: boolean; step: boolean }>;

export const EVERY_PART: LineParts = Object.freeze({ time: true, level: true, source: true, step: true });

/* -- data replaces the entry's own JSON; null leaves the data out -- */
export function formatEntry(entry: LogEntry, parts: LineParts = EVERY_PART, data: string | null = entry.dataJson ?? null): string {
  return [
    parts.time ? entry.time.slice(11, 23) : null,
    parts.level ? entry.level.padEnd(5) : null,
    parts.source && entry.source !== 'server' ? `[${entry.source}]` : null,
    parts.step ? entry.step : null,
    entry.message,
    data,
  ].filter(Boolean).join(' ');
}

export function groupTitle(messageId: string): string {
  return messageId.length === 8 ? `Message ${messageId}` : messageId;
}

export function formatGroup(messageId: string, entries: readonly LogEntry[]): string {
  return [`## ${groupTitle(messageId)}`, ...entries.map((entry) => formatEntry(entry))].join('\n');
}

export function formatGroups(groups: ReadonlyArray<readonly [string, readonly LogEntry[]]>): string {
  return groups.map(([messageId, entries]) => formatGroup(messageId, entries)).join('\n\n');
}
