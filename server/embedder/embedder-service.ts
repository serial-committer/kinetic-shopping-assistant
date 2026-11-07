/* ---------------------------------------
    Point 5 on the server side: keeps one sealed embedder child running and turns shopper text into a vector.
    - The child crashes once: it is restarted (ERROR log). It crashes again: meaning search stays off and search
      runs on words alone (ERROR log). A child that fails to start at all is not retried: a missing or broken
      model won't fix itself.
    - embedQuery never throws. It returns null when the embedder is off, slow or failing, and the search carries on
      with words (WARN log).
--------------------------------------- */

import { logger } from '../logging/logger.ts';
import { type EmbedderProcess, startEmbedderProcess } from './embedder-process.ts';

const MAX_RESTARTS = 1;
const QUERY_TIMEOUT_MS = 5_000;

export type EmbedderState = 'starting' | 'ready' | 'off';

export type EmbedderService = Readonly<{
  /* -- Resolves once the child is ready or has been given up on -- */
  start(): Promise<void>;
  embedQuery(text: string): Promise<Float32Array | null>;
  state(): EmbedderState;
  close(): Promise<void>;
}>;

export type EmbedderServiceOptions = Readonly<{
  expectedDimension: number;
  /* -- Swapped for a fake in tests -- */
  startProcess?: () => EmbedderProcess;
  maxRestarts?: number;
}>;

export function createEmbedderService({ expectedDimension, startProcess = startEmbedderProcess, maxRestarts = MAX_RESTARTS }: EmbedderServiceOptions): EmbedderService {
  let current: EmbedderProcess | null = null;
  let state: EmbedderState = 'starting';
  let restarts = 0;
  let closed = false;

  async function launch(): Promise<void> {
    const child = startProcess();
    current = child;
    try {
      const { dimension, loadMs } = await child.ready;
      if (dimension !== expectedDimension) throw new Error(`the model makes ${dimension} numbers per text, the vectors hold ${expectedDimension}`);
      state = 'ready';
      logger.info('P5', 'embedder ready', { pid: child.pid, loadMs, restarts });
    } catch (error) {
      state = 'off';
      logger.error('P5', 'embedder could not start, so search runs on filters and words only', { reason: (error as Error).message });
      await child.close();
      return;
    }
    void child.exited.then((exit) => onExit(child, exit.requested, exit.code));
  }

  async function onExit(child: EmbedderProcess, requested: boolean, code: number | null): Promise<void> {
    if (requested || closed || child !== current) return;
    if (restarts < maxRestarts) {
      restarts += 1;
      state = 'starting';
      logger.error('P5', 'embedder crashed, restarting it once', { exitCode: code });
      await launch();
      return;
    }
    state = 'off';
    logger.error('P5', 'embedder crashed again, so search runs on filters and words only', { exitCode: code });
  }

  async function embedQuery(text: string): Promise<Float32Array | null> {
    if (state !== 'ready' || !current) return null;
    try {
      return await current.embed([text], 'query', { messageId: logger.currentMessageId(), timeoutMs: QUERY_TIMEOUT_MS });
    } catch (error) {
      logger.warn('P9', 'shopper text could not be embedded, so this search uses words only', { reason: (error as Error).message });
      return null;
    }
  }

  async function close(): Promise<void> {
    closed = true;
    state = 'off';
    await current?.close();
  }

  return Object.freeze({ start: launch, embedQuery, state: () => state, close });
}
