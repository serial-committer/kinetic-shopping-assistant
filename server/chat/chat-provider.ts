/* ---------------------------------------
    What every chat provider offers: send instructions plus input, get back JSON that matches a schema.
    Claude uses the Messages API with output_config.format; OpenAI and Offline (Ollama) share one adapter on the
    Responses API with text.format. Every failure becomes a ChatFailure with a kind, so the caller can fall back
    the same way whatever went wrong.
--------------------------------------- */

import type { ChatProviderId } from '../config/config.ts';

export type ChatPurpose = 'slip' | 'reply';

export type JsonRequest = Readonly<{
  purpose: ChatPurpose;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}>;

export type ChatProvider = Readonly<{
  id: ChatProviderId;
  label: string;
  model: string;
  /* -- The parsed JSON reply. Throws ChatFailure on a refusal, a cut-off, invalid JSON, a timeout or an abort -- */
  completeJson(request: JsonRequest): Promise<unknown>;
}>;

export type ChatFailureKind = 'refusal' | 'cut-off' | 'invalid-json' | 'timeout' | 'aborted' | 'provider-error';

export class ChatFailure extends Error {
  readonly kind: ChatFailureKind;

  constructor(kind: ChatFailureKind, message: string) {
    super(message);
    this.name = 'ChatFailure';
    this.kind = kind;
  }
}

/* -- Parses the model's text as JSON, or fails with kind invalid-json -- */
export function parseJsonReply(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ChatFailure('invalid-json', `the reply was not valid JSON: ${text.slice(0, 120)}`);
  }
}
