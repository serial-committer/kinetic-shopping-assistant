/* ---------------------------------------
    The messages the server and the sealed embedder child send each other over IPC. Text goes in, numbers come out.
    Types only: the child imports them with `import type`, so nothing outside its sandbox is ever read at run time.
--------------------------------------- */

import type { LogLevel } from '../logging/log-levels.ts';

/* -- A shopper sentence gets the query prefix; product text is embedded as it is -- */
export type EmbedPurpose = 'query' | 'document';

export type EmbedRequest = {
  kind: 'embed';
  requestId: number;
  texts: string[];
  purpose: EmbedPurpose;
  messageId: string | null;
};

export type ParentMessage = EmbedRequest;

export type ChildMessage =
  | { kind: 'ready'; dimension: number; loadMs: number }
  | { kind: 'startup-failed'; reason: string }
  /* -- One flat array: row i is vectors[i * dimension ... (i + 1) * dimension] -- */
  | { kind: 'vectors'; requestId: number; vectors: Float32Array; tookMs: number }
  | { kind: 'embed-failed'; requestId: number; reason: string }
  | { kind: 'log'; level: LogLevel; step: string; message: string; data?: unknown; messageId: string | null };
