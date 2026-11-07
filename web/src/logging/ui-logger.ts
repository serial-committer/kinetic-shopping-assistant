/* ---------------------------------------
    The page's logger, the same shape as the server's: level, step, message, data, chat message id, tagged "ui".
    Entries stay in the browser in a small fixed-size list and show in the debug panel next to the server's.
    The only file in the page that calls console, and only for warnings and errors.
--------------------------------------- */

import type { LogEntry, LogLevel } from '../api/api-types.ts';

const KEPT = 200;
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function write(level: LogLevel, step: string, message: string, data?: unknown, messageId: string | null = null): void {
  let dataJson: string | undefined;
  if (data !== undefined) {
    try {
      dataJson = JSON.stringify(data);
    } catch {
      dataJson = JSON.stringify(String(data));
    }
  }
  entries.push({ id: nextId++, time: new Date().toISOString(), level, source: 'ui', step, messageId, message, ...(dataJson ? { dataJson } : {}) });
  if (entries.length > KEPT) entries.shift();
  if (level === 'ERROR') console.error(`[ui] ${step} ${message}`, data ?? '');
  else if (level === 'WARN') console.warn(`[ui] ${step} ${message}`, data ?? '');
  for (const listener of listeners) listener();
}

export const uiLogger = Object.freeze({
  debug: (step: string, message: string, data?: unknown, messageId?: string | null) => write('DEBUG', step, message, data, messageId),
  info: (step: string, message: string, data?: unknown, messageId?: string | null) => write('INFO', step, message, data, messageId),
  warn: (step: string, message: string, data?: unknown, messageId?: string | null) => write('WARN', step, message, data, messageId),
  error: (step: string, message: string, data?: unknown, messageId?: string | null) => write('ERROR', step, message, data, messageId),
  entries: (): readonly LogEntry[] => entries,
  /* -- Returns the unsubscribe function, so a closed panel stops listening -- */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});
