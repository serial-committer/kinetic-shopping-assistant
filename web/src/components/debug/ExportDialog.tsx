/* ---------------------------------------
    The Export window, grown from the Export button over the logs window: choices on the left, a live preview of
    the file on the right, then Copy or Download. The logs are a snapshot taken when the window opens, so the
    preview holds still while the panel keeps polling. Choices are remembered in this browser.
--------------------------------------- */

import { type MouseEvent, type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { LogLevel } from '../../api/api-types.ts';
import { useAnchoredDialog } from '../../motion/use-anchored-dialog.ts';
import { buildExport, DEFAULT_CHOICES, type ExportChoices, exportFileName, fieldLabel, isLoadMoreGroup, lineKinds, type LineKind, type LogGroups } from './export-log.ts';
import type { LineParts } from './format-log.ts';

const LEVELS: readonly LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const PARTS: ReadonlyArray<readonly [keyof LineParts, string]> = [['time', 'Time'], ['level', 'Level'], ['source', 'Source'], ['step', 'Step']];
const PREVIEW_LINES = 400;
const SAVED_KEY = 'kinetic-shopping.log-export';

type ExportDialogProps = Readonly<{ open: boolean; anchor: DOMRect | null; groups: LogGroups; onClosed: () => void }>;

export function ExportDialog({ open, anchor, groups, onClosed }: ExportDialogProps) {
  const { dialogRef, requestClose, onCancel, onBackdropClick } = useAnchoredDialog(open, anchor, onClosed);
  /* -- This window sits inside the logs window: Escape and clicks stop here, or both windows would close -- */
  const cancel = (event: SyntheticEvent) => {
    event.stopPropagation();
    onCancel(event);
  };
  const click = (event: MouseEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    onBackdropClick(event);
  };
  return (
    <dialog ref={dialogRef} className="glass-dialog export-window" aria-label="Export logs" onCancel={cancel} onClick={click}>
      {open && <ExportContent groups={groups} onClose={requestClose} />}
    </dialog>
  );
}

function ExportContent({ groups, onClose }: Readonly<{ groups: LogGroups; onClose: () => void }>) {
  const [choices, setChoices] = useState<ExportChoices>(readSavedChoices);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const kinds = useMemo(() => lineKinds(groups.flatMap(([, entries]) => entries)), [groups]);
  const loadMoreCount = useMemo(() => groups.filter(([, entries]) => isLoadMoreGroup(entries)).length, [groups]);
  const result = useMemo(() => buildExport(groups, choices, new Date()), [groups, choices]);
  const preview = useMemo(() => previewOf(result.text), [result.text]);

  useEffect(() => saveChoices(choices), [choices]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const update = (change: Partial<ExportChoices>) => setChoices((current) => ({ ...current, ...change }));
  const toggleIn = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
  const toggleField = (kind: string, path: string) => setChoices((current) => ({ ...current, skippedFields: { ...current.skippedFields, [kind]: toggleIn(current.skippedFields[kind] ?? [], path) } }));
  const setAllFields = (kind: LineKind, keep: boolean) => setChoices((current) => ({ ...current, skippedFields: { ...current.skippedFields, [kind.key]: keep ? [] : [...kind.fields] } }));

  const copy = () => void navigator.clipboard.writeText(result.text).then(() => setCopied(true));
  const download = () => {
    /* -- The link goes inside this window: everything outside an open modal dialog is inert -- */
    const url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(new Date());
    contentRef.current?.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  return (
    <div ref={contentRef} className="export-content">
      <div className="debug-toolbar">
        <h2 className="debug-title">Export logs</h2>
        <div className="debug-actions">
          <button type="button" className="pill-button" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="export-body">
        <div className="export-choices">
          <fieldset className="export-section">
            <legend>Each line shows</legend>
            <div className="export-checks">
              {PARTS.map(([part, label]) => (
                <label key={part} className="export-check">
                  <input type="checkbox" checked={choices.parts[part]} onChange={() => update({ parts: { ...choices.parts, [part]: !choices.parts[part] } })} />
                  {label}
                </label>
              ))}
              <label className="export-check is-fixed">
                <input type="checkbox" checked disabled />
                Message
              </label>
            </div>
          </fieldset>

          <fieldset className="export-section">
            <legend>Data</legend>
            <div className="export-checks">
              <label className="export-check">
                <input type="radio" name="export-data" checked={choices.indentData} onChange={() => update({ indentData: true })} />
                Indented, under its line
              </label>
              <label className="export-check">
                <input type="radio" name="export-data" checked={!choices.indentData} onChange={() => update({ indentData: false })} />
                One line, at the end
              </label>
            </div>
          </fieldset>

          <fieldset className="export-section">
            <legend>Include</legend>
            <div className="debug-levels" role="group" aria-label="Levels exported">
              {LEVELS.map((level) => (
                <button key={level} type="button" className={`level-chip level-${level.toLowerCase()}${choices.levels.includes(level) ? ' is-on' : ''}`} aria-pressed={choices.levels.includes(level)} onClick={() => update({ levels: LEVELS.filter((item) => (item === level ? !choices.levels.includes(level) : choices.levels.includes(item))) })}>
                  {level}
                </button>
              ))}
            </div>
            <div className="export-checks">
              <label className="export-check">
                <input type="checkbox" checked={choices.headings} onChange={() => update({ headings: !choices.headings })} />
                A heading per message
              </label>
              <label className="export-check">
                <input type="checkbox" checked={choices.loadMore} onChange={() => update({ loadMore: !choices.loadMore })} />
                Load more messages ({loadMoreCount})
              </label>
            </div>
          </fieldset>

          <fieldset className="export-section">
            <legend>Log lines and their fields</legend>
            <ul className="export-kinds">
              {kinds.map((kind) => {
                const skipped = choices.skippedFields[kind.key] ?? [];
                const included = !choices.skippedKinds.includes(kind.key);
                return (
                  <li key={kind.key} className={`export-kind${included ? '' : ' is-off'}`}>
                    <label className="export-check">
                      <input type="checkbox" checked={included} onChange={() => update({ skippedKinds: toggleIn(choices.skippedKinds, kind.key) })} />
                      <span className="export-kind-step">{kind.step}</span>
                      <span className="export-kind-label">{kind.label}</span>
                      <span className="export-kind-count">{kind.count}</span>
                    </label>
                    {kind.fields.length > 0 && included && (
                      <details className="export-fields">
                        <summary>Fields: {kind.fields.length - skipped.length} of {kind.fields.length}</summary>
                        <div className="export-field-tools">
                          <button type="button" className="log-copy" onClick={() => setAllFields(kind, true)}>All</button>
                          <button type="button" className="log-copy" onClick={() => setAllFields(kind, false)}>None</button>
                        </div>
                        <div className="export-checks">
                          {kind.fields.map((path) => (
                            <label key={path} className="export-check is-field">
                              <input type="checkbox" checked={!skipped.includes(path)} onChange={() => toggleField(kind.key, path)} />
                              {fieldLabel(path)}
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>

        <div className="export-preview" aria-label="Preview of the file">
          <pre>{preview.text}</pre>
          {preview.hidden > 0 && <p className="export-preview-more">and {preview.hidden.toLocaleString()} more lines in the file</p>}
        </div>
      </div>

      <div className="export-footer">
        <p className="export-summary">{result.messages} {result.messages === 1 ? 'message' : 'messages'}, {result.lines} log lines</p>
        <button type="button" className="pill-button" onClick={() => setChoices(DEFAULT_CHOICES)}>Reset</button>
        <button type="button" className="pill-button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="pill-button is-accent" onClick={download}>Download .log</button>
      </div>
    </div>
  );
}

function previewOf(text: string): { text: string; hidden: number } {
  const lines = text.split('\n');
  return { text: lines.slice(0, PREVIEW_LINES).join('\n'), hidden: Math.max(0, lines.length - PREVIEW_LINES) };
}

/* -- Saved choices, checked box by box over the defaults, so a damaged or older entry can't break the window -- */
function readSavedChoices(): ExportChoices {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null');
    if (!isRecord(saved)) return DEFAULT_CHOICES;
    const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
    const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
    const parts = isRecord(saved['parts']) ? saved['parts'] : {};
    const fields = isRecord(saved['skippedFields']) ? saved['skippedFields'] : {};
    return {
      parts: { time: flag(parts['time'], true), level: flag(parts['level'], true), source: flag(parts['source'], true), step: flag(parts['step'], true) },
      levels: Array.isArray(saved['levels']) ? LEVELS.filter((level) => (saved['levels'] as unknown[]).includes(level)) : DEFAULT_CHOICES.levels,
      loadMore: flag(saved['loadMore'], DEFAULT_CHOICES.loadMore),
      headings: flag(saved['headings'], DEFAULT_CHOICES.headings),
      indentData: flag(saved['indentData'], DEFAULT_CHOICES.indentData),
      skippedKinds: texts(saved['skippedKinds']),
      skippedFields: Object.fromEntries(Object.entries(fields).map(([kind, paths]) => [kind, texts(paths)])),
    };
  } catch {
    return DEFAULT_CHOICES;
  }
}

function saveChoices(choices: ExportChoices): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(choices));
  } catch {
    /* -- Storage blocked: the choices just aren't remembered -- */
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
