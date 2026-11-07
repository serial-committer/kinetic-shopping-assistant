/* ---------------------------------------
    The log entries of one chat message: time, level, where it came from, pipeline step and message, with the data
    folded away until opened, and a copy button per entry.
--------------------------------------- */

import type { LogEntry } from '../../api/api-types.ts';

export function LogGroup({ title, entries }: Readonly<{ title: string; entries: readonly LogEntry[] }>) {
  return (
    <section className="log-group">
      <h3 className="log-group-title">{title.length === 8 ? `Message ${title}` : title}</h3>
      <ol className="log-list">
        {entries.map((entry) => (
          <LogRow key={`${entry.source}-${entry.id}`} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function LogRow({ entry }: Readonly<{ entry: LogEntry }>) {
  const time = entry.time.slice(11, 23);
  const copy = () => void navigator.clipboard.writeText(JSON.stringify({ ...entry, data: entry.dataJson ? JSON.parse(entry.dataJson) : undefined, dataJson: undefined }, null, 2));
  return (
    <li className="log-row">
      <div className="log-line">
        <span className="log-time">{time}</span>
        <span className={`log-level level-${entry.level.toLowerCase()}`}>{entry.level}</span>
        {entry.source !== 'server' && <span className="log-source">{entry.source}</span>}
        <span className="log-step">{entry.step}</span>
        <span className="log-message">{entry.message}</span>
        <button type="button" className="log-copy" onClick={copy} aria-label="Copy this entry">Copy</button>
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
