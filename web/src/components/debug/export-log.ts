/* ---------------------------------------
    Export: the logs as a tidy text file, with choices. A line can leave out its time, level, source or step;
    "Load more" messages can be left out; and each kind of log line ("P11 cards", "P6 slip response") can be left
    out, or keep only some fields of its data, such as a card without its twins flag. Kinds and fields are read
    from the logs themselves, so a new log line appears in the choices with no list to update.
--------------------------------------- */

import type { LogEntry, LogLevel } from '../../api/api-types.ts';
import { EVERY_PART, formatEntry, groupTitle, type LineParts } from './format-log.ts';

export type LogGroups = ReadonlyArray<readonly [string, readonly LogEntry[]]>;

export type ExportChoices = Readonly<{
  parts: LineParts;
  levels: readonly LogLevel[];
  /* -- Keep messages that are only a "Load more" click -- */
  loadMore: boolean;
  headings: boolean;
  /* -- Data as indented JSON under its line, or as one line of JSON at its end -- */
  indentData: boolean;
  skippedKinds: readonly string[];
  /* -- Kind key -> field paths left out, like "cards[].twins" -- */
  skippedFields: Readonly<Record<string, readonly string[]>>;
}>;

export const DEFAULT_CHOICES: ExportChoices = Object.freeze<ExportChoices>({
  parts: EVERY_PART,
  levels: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
  loadMore: true,
  headings: true,
  indentData: true,
  skippedKinds: [],
  skippedFields: {},
});

/* -- One kind of log line, its data fields, and how often it appears -- */
export type LineKind = Readonly<{ key: string; step: string; label: string; count: number; fields: readonly string[] }>;

export type ExportResult = Readonly<{ text: string; messages: number; lines: number }>;

/* -- Step plus message with the numbers blanked, so "top 10 of 6377" and "top 10 of 6893" are one kind -- */
export function kindKey(entry: LogEntry): string {
  return `${entry.step} ${entry.message.replace(/\d[\d.,]*/g, '#')}`;
}

/* -- Every kind in the order first seen, with the union of its data fields -- */
export function lineKinds(entries: readonly LogEntry[]): LineKind[] {
  const kinds = new Map<string, { step: string; label: string; count: number; fields: Set<string> }>();
  for (const entry of entries) {
    const key = kindKey(entry);
    const kind = kinds.get(key) ?? { step: entry.step, label: entry.message, count: 0, fields: new Set<string>() };
    kind.count += 1;
    for (const path of fieldPaths(parseData(entry.dataJson))) kind.fields.add(path);
    kinds.set(key, kind);
  }
  return [...kinds].map(([key, kind]) => ({ key, step: kind.step, label: kind.label, count: kind.count, fields: [...kind.fields] }));
}

/* -- Leaf paths of a value: "form.change.text", "cards[].title", or "[].score" for a list at the top -- */
export function fieldPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    if (records.length === 0) return path ? [path] : [];
    return unique(records.flatMap((item) => fieldPaths(item, `${path}[]`)));
  }
  if (isRecord(value) && Object.keys(value).length > 0) {
    return unique(Object.entries(value).flatMap(([key, child]) => fieldPaths(child, path ? `${path}.${key}` : key)));
  }
  return path ? [path] : [];
}

/* -- "cards[].title" reads as "cards › title"; a list at the top drops its "[]" -- */
export function fieldLabel(path: string): string {
  return path.replace(/^\[\]\.?/, '').replace(/\[\]/g, '').split('.').join(' › ');
}

/* -- The value without the skipped paths. A list or object whose fields were all skipped goes too -- */
export function withoutFields(value: unknown, skipped: ReadonlySet<string>, path = ''): unknown {
  if (skipped.size === 0) return value;
  if (Array.isArray(value)) return value.map((item) => (isRecord(item) ? withoutFields(item, skipped, `${path}[]`) : item));
  if (!isRecord(value)) return value;
  const kept: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (skipped.has(childPath)) continue;
    const pruned = withoutFields(child, skipped, childPath);
    if (!emptied(child, pruned)) kept[key] = pruned;
  }
  return kept;
}

export function isLoadMoreGroup(entries: readonly LogEntry[]): boolean {
  return entries.some((entry) => entry.step === 'turn' && entry.message === 'load more');
}

/* -- What a message was about: the shopper's words, a Load more click or a brand button -- */
export function groupHeadline(entries: readonly LogEntry[]): string | null {
  for (const entry of entries) {
    const data = parseData(entry.dataJson);
    if (!isRecord(data)) continue;
    if (entry.step === 'turn' && entry.message === 'shopper message' && typeof data['message'] === 'string') return `"${data['message']}"`;
    if (entry.step === 'turn' && entry.message === 'load more') return `Load more (${String(data['cardsOnScreen'])} cards on screen)`;
    if (entry.step === 'P7c' && entry.message === 'brand button clicked') return `Brand button: ${String(data['brand'])} as ${String(data['choice'])}`;
  }
  return null;
}

/* -- The file: a short header, then one block per message, oldest first -- */
export function buildExport(groups: LogGroups, choices: ExportChoices, exportedAt: Date): ExportResult {
  const levels = new Set(choices.levels);
  const skippedKinds = new Set(choices.skippedKinds);
  const blocks: string[] = [];
  let lines = 0;
  for (const [messageId, entries] of groups) {
    if (!choices.loadMore && isLoadMoreGroup(entries)) continue;
    const kept = entries.filter((entry) => levels.has(entry.level) && !skippedKinds.has(kindKey(entry)));
    if (kept.length === 0) continue;
    lines += kept.length;
    const body = kept.map((entry) => exportLine(entry, choices));
    const headline = groupHeadline(entries);
    blocks.push((choices.headings ? [`## ${groupTitle(messageId)}${headline ? ` · ${headline}` : ''}`, ...body] : body).join('\n'));
  }
  const header = headerLines(groups, choices, exportedAt, blocks.length);
  return { text: `${[header.join('\n'), ...blocks].join('\n\n')}\n`, messages: blocks.length, lines };
}

/* -- "November_8_18_43.log", the way the logs folder names them -- */
export function exportFileName(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'long' });
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${month}_${date.getDate()}_${two(date.getHours())}_${two(date.getMinutes())}.log`;
}

function exportLine(entry: LogEntry, choices: ExportChoices): string {
  const data = dataText(entry, new Set(choices.skippedFields[kindKey(entry)] ?? []), choices.indentData);
  if (!choices.indentData || data === null) return formatEntry(entry, choices.parts, data);
  return `${formatEntry(entry, choices.parts, null)}\n${data.split('\n').map((line) => `    ${line}`).join('\n')}`;
}

/* -- The data with skipped fields removed, or null when there is none left -- */
function dataText(entry: LogEntry, skipped: ReadonlySet<string>, indent: boolean): string | null {
  if (!entry.dataJson) return null;
  const data = parseData(entry.dataJson);
  if (data === undefined) return entry.dataJson;
  const pruned = withoutFields(data, skipped);
  if (emptied(data, pruned)) return null;
  return indent ? JSON.stringify(pruned, null, 2) : JSON.stringify(pruned);
}

function headerLines(groups: LogGroups, choices: ExportChoices, exportedAt: Date, messages: number): string[] {
  const when = exportedAt.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const labels = new Map(lineKinds(groups.flatMap(([, entries]) => entries)).map((kind) => [kind.key, `${kind.step} ${kind.label}`]));
  const leftOut = [
    choices.loadMore ? null : 'Load more messages',
    ...choices.skippedKinds.map((key) => labels.get(key) ?? key),
    ...Object.entries(choices.skippedFields)
      .filter(([key, paths]) => paths.length > 0 && labels.has(key) && !choices.skippedKinds.includes(key))
      .map(([key, paths]) => `${labels.get(key)}: ${paths.map(fieldLabel).join(', ')}`),
  ].filter((item): item is string => item !== null);
  return [
    '# Kinetic Shopping Assistant logs',
    `# Exported ${when} · ${messages} ${messages === 1 ? 'message' : 'messages'} · levels ${choices.levels.join(', ') || 'none'}`,
    ...(leftOut.length ? [`# Left out: ${leftOut.join('; ')}`] : []),
  ];
}

/* -- True when pruning removed every field of a non-empty object, or of every object in a list -- */
function emptied(before: unknown, after: unknown): boolean {
  if (isRecord(before)) return Object.keys(before).length > 0 && isRecord(after) && Object.keys(after).length === 0;
  if (Array.isArray(before) && Array.isArray(after)) return before.some(isRecord) && after.every((item) => !isRecord(item) || Object.keys(item).length === 0);
  return false;
}

function parseData(json: string | undefined): unknown {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const unique = (items: string[]): string[] => [...new Set(items)];
