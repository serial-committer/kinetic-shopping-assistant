/* ---------------------------------------
    Starts one sealed embedder child and talks to it. Used by the server (one child) and the embed tool (eight).
    The child is plain `node` from process.execPath with no shell and an empty environment. Messages go both ways
    over IPC with Node's structured-clone format, so a Float32Array crosses as numbers, not as text.
    The child ends on its own when this process goes away, because its IPC channel closes.
--------------------------------------- */

import { type ChildProcess, spawn } from 'node:child_process';
import { PATHS } from '../data/project-paths.ts';
import { logger } from '../logging/logger.ts';
import type { ChildMessage, EmbedPurpose, ParentMessage } from './embedder-messages.ts';
import { EMBEDDER_CHILD_SCRIPT, embedderChildArguments, embedderSandboxFlags } from './sandbox-flags.ts';

const CLOSE_GRACE_MS = 3_000;

export type EmbedderExit = Readonly<{ code: number | null; signal: NodeJS.Signals | null; requested: boolean }>;

export type EmbedderProcess = Readonly<{
  pid: number | undefined;
  /* -- Resolves once the model is loaded; rejects when the child can't start -- */
  ready: Promise<{ dimension: number; loadMs: number }>;
  /* -- Resolves when the child has ended for any reason -- */
  exited: Promise<EmbedderExit>;
  embed(texts: readonly string[], purpose: EmbedPurpose, options?: { messageId?: string | null; timeoutMs?: number }): Promise<Float32Array>;
  close(): Promise<void>;
}>;

type Pending = { resolve: (vectors: Float32Array) => void; reject: (error: Error) => void; timer: NodeJS.Timeout | null };

export function startEmbedderProcess(): EmbedderProcess {
  const child = spawn(process.execPath, [...embedderSandboxFlags(), EMBEDDER_CHILD_SCRIPT, ...embedderChildArguments()], {
    cwd: PATHS.embedderChildFolder,
    env: {},
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    serialization: 'advanced',
    windowsHide: true,
  });
  const pending = new Map<number, Pending>();
  let nextRequestId = 1;
  let closeRequested = false;

  forwardStderr(child);

  const ready = new Promise<{ dimension: number; loadMs: number }>((resolveReady, rejectReady) => {
    child.on('message', (message: ChildMessage) => {
      switch (message.kind) {
        case 'ready':
          resolveReady({ dimension: message.dimension, loadMs: message.loadMs });
          break;
        case 'startup-failed':
          rejectReady(new Error(message.reason));
          break;
        case 'vectors':
          settle(message.requestId, (entry) => entry.resolve(message.vectors));
          break;
        case 'embed-failed':
          settle(message.requestId, (entry) => entry.reject(new Error(message.reason)));
          break;
        case 'log':
          logger.fromSource('embedder', message.level, message.step, message.message, message.data, message.messageId);
          break;
      }
    });
    child.once('exit', (code) => rejectReady(new Error(`the embedder stopped before it was ready (exit ${code})`)));
    child.once('error', (error) => rejectReady(error));
  });
  /* -- A start failure is reported through `ready`; this stops it also surfacing as an unhandled rejection -- */
  ready.catch(() => undefined);

  const exited = new Promise<EmbedderExit>((resolveExit) => {
    child.once('exit', (code, signal) => {
      for (const [requestId, entry] of pending) settle(requestId, () => entry.reject(new Error('the embedder stopped')));
      resolveExit({ code, signal, requested: closeRequested });
    });
  });

  function settle(requestId: number, finish: (entry: Pending) => void): void {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    if (entry.timer) clearTimeout(entry.timer);
    finish(entry);
  }

  async function embed(texts: readonly string[], purpose: EmbedPurpose, options: { messageId?: string | null; timeoutMs?: number } = {}): Promise<Float32Array> {
    await ready;
    if (!child.connected) throw new Error('the embedder is not running');
    const requestId = nextRequestId++;
    return new Promise<Float32Array>((resolveVectors, rejectVectors) => {
      const timer = options.timeoutMs
        ? setTimeout(() => settle(requestId, (entry) => entry.reject(new Error(`the embedder took longer than ${options.timeoutMs} ms`))), options.timeoutMs)
        : null;
      pending.set(requestId, { resolve: resolveVectors, reject: rejectVectors, timer });
      const request: ParentMessage = { kind: 'embed', requestId, texts: [...texts], purpose, messageId: options.messageId ?? null };
      child.send(request);
    });
  }

  /* -- Disconnecting asks the child to end; if it hasn't within three seconds, it is killed -- */
  async function close(): Promise<void> {
    closeRequested = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (child.connected) child.disconnect();
    const forced = setTimeout(() => child.kill(), CLOSE_GRACE_MS);
    await exited;
    clearTimeout(forced);
  }

  return Object.freeze({ pid: child.pid, ready, exited, embed, close });
}

/* -- The guards write one stderr line per refused call; anything else on stderr is a crash report -- */
function forwardStderr(child: ChildProcess): void {
  let buffered = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    buffered += chunk;
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines.map((text) => text.trim()).filter(Boolean)) {
      if (/embedder sandbox:/.test(line)) logger.fromSource('embedder', 'WARN', 'sandbox', line);
      else if (/ExperimentalWarning|--trace-warnings/.test(line)) logger.fromSource('embedder', 'DEBUG', 'node', line);
      else logger.fromSource('embedder', 'ERROR', 'stderr', line);
    }
  });
}
