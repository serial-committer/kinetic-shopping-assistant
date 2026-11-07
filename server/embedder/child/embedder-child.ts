/* ---------------------------------------
    The sealed embedder process. It starts inside Node's permission sandbox with the three guards loaded first,
    checks that sandbox, loads bge-small, then turns texts into numbers for as long as its parent stays connected.
    It reads only the two vendor folders, writes nothing, opens no connection and starts nothing.
    Usage (by the parent only): node <sandbox flags> embedder-child.ts <engine folder> <model folder>
--------------------------------------- */

import type { LogLevel } from '../../logging/log-levels.ts';
import type { ChildMessage, EmbedRequest, ParentMessage } from '../embedder-messages.ts';
import { type Engine, startEngine } from './engine.ts';
import { findSandboxViolations } from './sandbox-check.ts';
import type { VendorFolders } from './vendor-files.ts';

function send(message: ChildMessage): void {
  if (process.connected) process.send!(message);
}

/* -- Sending is asynchronous, so a last message must be on its way before the process ends -- */
function sendThenExit(message: ChildMessage, code: number): void {
  if (process.connected) process.send!(message, () => process.exit(code));
  else process.exit(code);
}

function log(level: LogLevel, step: string, message: string, data?: unknown, messageId: string | null = null): void {
  send({ kind: 'log', level, step, message, ...(data === undefined ? {} : { data }), messageId });
}

async function main(): Promise<void> {
  const [engineFolder = '', modelFolder = ''] = process.argv.slice(2);
  const folders: VendorFolders = Object.freeze({ engineFolder, modelFolder });

  /* -- The open channel keeps this process alive. When the parent goes away, even force-killed, it closes and this process ends -- */
  process.once('disconnect', () => process.exit(0));

  const violations = findSandboxViolations(folders);
  if (violations.length > 0) {
    sendThenExit({ kind: 'startup-failed', reason: `sandbox check failed: ${violations.join('; ')}` }, 1);
    return;
  }

  let engine: Engine;
  try {
    const started = performance.now();
    engine = await startEngine(folders);
    const loadMs = Math.round(performance.now() - started);
    log('DEBUG', 'P5', 'bge-small loaded inside the sandbox', { loadMs, dimension: engine.dimension });
    send({ kind: 'ready', dimension: engine.dimension, loadMs });
  } catch (error) {
    sendThenExit({ kind: 'startup-failed', reason: `model failed to load: ${(error as Error).message}` }, 1);
    return;
  }

  /* -- One request at a time: the engine has a single thread, so requests wait their turn in this chain -- */
  let queue: Promise<void> = Promise.resolve();
  process.on('message', (message: ParentMessage) => {
    if (message?.kind === 'embed') queue = queue.then(() => handleEmbed(engine, message));
  });
}

async function handleEmbed(engine: Engine, { requestId, texts, purpose, messageId }: EmbedRequest): Promise<void> {
  const started = performance.now();
  try {
    const vectors = purpose === 'query' ? await engine.embedQuery(texts[0] ?? '') : await engine.embed(texts);
    const tookMs = Math.round(performance.now() - started);
    if (purpose === 'query') log('DEBUG', 'P9', 'shopper text embedded', { tookMs }, messageId);
    send({ kind: 'vectors', requestId, vectors, tookMs });
  } catch (error) {
    send({ kind: 'embed-failed', requestId, reason: (error as Error).message });
  }
}

await main();
