/* ---------------------------------------
    The log entries of one chat message: time, level, where it came from, pipeline step and message, with the data
    folded away until opened. "Copy" on the heading copies the whole message as plain lines; "Copy" on a row copies
    that one line.
--------------------------------------- */

import type { LogEntry } from '../../api/api-types.ts';
import { formatEntry, formatGroup, groupTitle } from './format-log.ts';

const copyText = (text: string): void => void navigator.clipboard.writeText(text);

export function LogGroup({ title, entries }: Readonly<{ title: string; entries: readonly LogEntry[] }>) {
  return (
    <section className="log-group">
      <div className="log-group-heading">
        <h3 className="log-group-title">{groupTitle(title)}</h3>
        <button type="button" className="log-copy" onClick={() => copyText(formatGroup(title, entries))} aria-label={`Copy every entry of ${groupTitle(title)}`}>
          Copy
        </button>
      </div>
      <ol className="log-list">
        {entries.map((entry) => (
          <LogRow key={`${entry.source}-${entry.id}`} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function LogRow({ entry }: Readonly<{ entry: LogEntry }>) {
  return (
    <li className="log-row">
      <div className="log-line">
        <span className="log-time">{entry.time.slice(11, 23)}</span>
        <span className={`log-level level-${entry.level.toLowerCase()}`}>{entry.level}</span>
        {entry.source !== 'server' && <span className="log-source">{entry.source}</span>}
        <span className="log-step">{entry.step}</span>
        <span className="log-message">{entry.message}</span>
        <button type="button" className="log-copy" onClick={() => copyText(formatEntry(entry))} aria-label="Copy this entry">Copy</button>
      </div>
      {entry.dataJson && (
        <details className="log-data">
          <summary>data</summary>
          <pre>{prettyJson(entry.dataJson)}</pre>
        </details>
      )}
    </li>
  );
}

function prettyJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
