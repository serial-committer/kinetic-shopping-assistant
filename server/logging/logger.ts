/* ---------------------------------------
    The one logger, and the only file that calls console. It wraps console instead of replacing it, so library
    logs stay untouched and every call shows its level where it is written:
        logger.debug('P7a', 'slip after merge', slip)
    Every entry carries the time, level, pipeline step, chat message id and data. The message id travels with the
    request on its own (AsyncLocalStorage), like a name badge, so no function has to pass it along.
    LOG_LEVEL is read once, the first time anything logs. Configured keys are masked in messages and data.
    With DEBUG_PANEL=true, entries also go into a 500-entry ring buffer that the debug panel reads.
--------------------------------------- */

import { AsyncLocalStorage } from 'node:async_hooks';
import { getConfig } from '../config/config.ts';
import { isLevelEnabled, type LogLevel, type LogLevelName } from './log-levels.ts';
import { RingBuffer } from './ring-buffer.ts';
import { maskSecrets } from './secret-mask.ts';

export type LogSource = 'server' | 'embedder' | 'ui';

export type LogEntry = Readonly<{
  id: number;
  time: string;
  level: LogLevel;
  source: LogSource;
  step: string;
  messageId: string | null;
  message: string;
  /* -- The data as JSON text, made once and shared by the console line and the panel -- */
  dataJson?: string;
}>;

const PANEL_BUFFER_SIZE = 500;

type LoggerState = { threshold: LogLevelName; secrets: readonly string[]; panelBuffer: RingBuffer<LogEntry> | null };

let state: LoggerState | null = null;
let nextEntryId = 1;
const messageContext = new AsyncLocalStorage<string>();

function currentState(): LoggerState {
  if (state) return state;
  const config = getConfig();
  state = { threshold: config.logLevel, secrets: config.secrets, panelBuffer: config.debugPanel ? new RingBuffer<LogEntry>(PANEL_BUFFER_SIZE) : null };
  for (const warning of config.warnings) write('WARN', 'server', 'config', warning, undefined, null);
  return state;
}

function write(level: LogLevel, source: LogSource, step: string, message: string, data: unknown, messageId: string | null): void {
  const { threshold, secrets, panelBuffer } = currentState();
  if (!isLevelEnabled(level, threshold)) return;
  const entry: LogEntry = {
    id: nextEntryId++,
    time: new Date().toISOString(),
    level,
    source,
    step,
    messageId,
    message: maskSecrets(message, secrets),
    ...(data === undefined ? {} : { dataJson: toJson(maskSecrets(data, secrets)) }),
  };
  panelBuffer?.push(entry);
  printEntry(entry);
}

function printEntry(entry: LogEntry): void {
  const origin = entry.source === 'server' ? '' : `[${entry.source}] `;
  const message = entry.messageId ? `#${entry.messageId} ` : '';
  const line = `${entry.time} ${entry.level.padEnd(5)} ${origin}${entry.step} ${message}${entry.message}${entry.dataJson ? ` ${entry.dataJson}` : ''}`;
  if (entry.level === 'ERROR') console.error(line);
  else if (entry.level === 'WARN') console.warn(line);
  else console.log(line);
}

/* -- JSON that never throws: typed arrays become a short label, errors keep their name and message -- */
function toJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'bigint') return item.toString();
      if (ArrayBuffer.isView(item)) return `[${item.constructor.name} of ${item.byteLength} bytes]`;
      if (item instanceof Error) return { name: item.name, message: item.message };
      return item;
    }) ?? 'null';
  } catch {
    return JSON.stringify(String(value));
  }
}

const atLevel = (level: LogLevel) => (step: string, message: string, data?: unknown): void => write(level, 'server', step, message, data, messageContext.getStore() ?? null);

export const logger = Object.freeze({
  trace: atLevel('TRACE'),
  debug: atLevel('DEBUG'),
  info: atLevel('INFO'),
  warn: atLevel('WARN'),
  error: atLevel('ERROR'),

  /* -- For lines that arrive from elsewhere, such as the embedder child over IPC -- */
  fromSource(source: LogSource, level: LogLevel, step: string, message: string, data?: unknown, messageId?: string | null): void {
    write(level, source, step, message, data, messageId ?? null);
  },

  /* -- Runs `work` with a chat message id that every log call inside it picks up -- */
  withMessageId<T>(messageId: string, work: () => T): T {
    return messageContext.run(messageId, work);
  },

  currentMessageId(): string | null {
    return messageContext.getStore() ?? null;
  },

  isEnabled(level: LogLevel): boolean {
    return isLevelEnabled(level, currentState().threshold);
  },

  /* -- Entries for the debug panel. Empty when the panel is off, because nothing is kept then -- */
  entriesAfter(afterId: number): LogEntry[] {
    return currentState().panelBuffer?.itemsAfter(afterId) ?? [];
  },
});

/* -- Plain output for command-line tools (reports and progress), still from the one file allowed to use console -- */
export function printLine(text: string): void {
  console.log(maskSecrets(text, state?.secrets ?? getConfig().secrets));
}
