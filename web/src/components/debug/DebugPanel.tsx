/* ---------------------------------------
    The debug panel (DEBUG_PANEL=true only): a small "Logs" button at the bottom of the page that opens an almost
    full-screen window grown from the button. It shows server, embedder and page logs grouped by chat message,
    with level chips, collapsible data and copy buttons. Logs are polled about once a second while the window is
    open; closing it stops the polling and cancels any request in flight.
--------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLogsAfter, isAbort } from '../../api/api-client.ts';
import type { LogEntry, LogLevel } from '../../api/api-types.ts';
import { uiLogger } from '../../logging/ui-logger.ts';
import { useAnchoredDialog } from '../../motion/use-anchored-dialog.ts';
import { formatGroups } from './format-log.ts';
import { LogGroup } from './LogGroup.tsx';
import '../sheet/sheet.css';
import './debug.css';

const POLL_MS = 1_000;
const KEPT = 500;
const LEVELS: readonly LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const NO_MESSAGE = 'outside a chat message';

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const onClosed = useCallback(() => setOpen(false), []);
  const { dialogRef, requestClose, onCancel, onBackdropClick } = useAnchoredDialog(open, anchor, onClosed);

  const openPanel = () => {
    setAnchor(buttonRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  return (
    <>
      <button ref={buttonRef} type="button" className="pill-button debug-button" onClick={openPanel} aria-haspopup="dialog">
        Logs
      </button>
      <dialog ref={dialogRef} className="glass-dialog debug-window" aria-label="Logs" onCancel={onCancel} onClick={onBackdropClick}>
        {open && <DebugContent onClose={requestClose} />}
      </dialog>
    </>
  );
}

function DebugContent({ onClose }: Readonly<{ onClose: () => void }>) {
  const [serverEntries, setServerEntries] = useState<LogEntry[]>([]);
  const [uiVersion, setUiVersion] = useState(0);
  const [shown, setShown] = useState<ReadonlySet<LogLevel>>(new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']));
  const [problem, setProblem] = useState<string | null>(null);

  /* -- Poll while open: one request at a time, everything stopped and cancelled on close -- */
  useEffect(() => {
    let lastId = 0;
    let controller: AbortController | null = null;
    const poll = () => {
      if (controller) return;
      controller = new AbortController();
      fetchLogsAfter(lastId, controller.signal)
        .then(({ entries }) => {
          setProblem(null);
          if (entries.length === 0) return;
          lastId = entries[entries.length - 1]!.id;
          setServerEntries((current) => [...current, ...entries].slice(-KEPT));
        })
        .catch((error: unknown) => {
          if (!isAbort(error)) setProblem(`Logs could not be loaded: ${(error as Error).message}`);
        })
        .finally(() => {
          controller = null;
        });
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const unsubscribe = uiLogger.subscribe(() => setUiVersion((version) => version + 1));
    return () => {
      window.clearInterval(timer);
      controller?.abort();
      unsubscribe();
    };
  }, []);

  /* -- Server and page entries together, newest message first, entries in time order inside each message -- */
  const groups = useMemo(() => {
    void uiVersion;
    const all = [...serverEntries, ...uiLogger.entries()].filter((entry) => shown.has(entry.level)).sort((a, b) => a.time.localeCompare(b.time));
    const byMessage = new Map<string, LogEntry[]>();
    for (const entry of all) {
      const key = entry.messageId ?? NO_MESSAGE;
      const list = byMessage.get(key);
      if (list) list.push(entry);
      else byMessage.set(key, [entry]);
    }
    return [...byMessage.entries()].sort((a, b) => b[1].at(-1)!.time.localeCompare(a[1].at(-1)!.time));
  }, [serverEntries, shown, uiVersion]);

  const toggleLevel = (level: LogLevel) => {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  /* -- Plain lines grouped by message, oldest message first so a pasted log reads in order; shown levels only -- */
  const copyAll = () => void navigator.clipboard.writeText(formatGroups([...groups].reverse()));

  return (
    <div className="debug-content">
      <div className="debug-toolbar">
        <h2 className="debug-title">Logs</h2>
        <div className="debug-levels" role="group" aria-label="Levels shown">
          {LEVELS.map((level) => (
            <button key={level} type="button" className={`level-chip level-${level.toLowerCase()}${shown.has(level) ? ' is-on' : ''}`} aria-pressed={shown.has(level)} onClick={() => toggleLevel(level)}>
              {level}
            </button>
          ))}
        </div>
        <div className="debug-actions">
          <button type="button" className="pill-button" onClick={copyAll}>Copy all</button>
          <button type="button" className="pill-button" onClick={onClose}>Close</button>
        </div>
      </div>
      {problem && <p className="debug-problem">{problem}</p>}
      <div className="debug-groups">
        {groups.length === 0 ? <p className="debug-empty">No log entries at these levels yet. Send a message and they appear here.</p> : groups.map(([messageId, entries]) => <LogGroup key={messageId} title={messageId} entries={entries} />)}
      </div>
    </div>
  );
}
