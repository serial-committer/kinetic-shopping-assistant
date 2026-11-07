/* ---------------------------------------
    OpenAI and Offline (Ollama) through the official openai SDK, Responses API, structured output (text.format,
    strict JSON schema). Same SDK, same call, different base URL and model: Ollama serves a stateless
    /v1/responses, so the whole context goes with every request anyway.
    - Offline sends temperature 0: at its default temperature the 7B model drifted. OpenAI's model rejects it.
    - The key and base URL are passed in, so the SDK never looks for them in the environment.
--------------------------------------- */

import OpenAI from 'openai';
import type { ChatProviderSettings } from '../config/config.ts';
import { ChatFailure, type ChatProvider, type ChatPurpose, type JsonRequest, parseJsonReply } from './chat-provider.ts';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const CLOUD_TIMEOUT_MS: Readonly<Record<ChatPurpose, number>> = { slip: 30_000, reply: 60_000 };
/* -- A local model may first have to load into memory, so Offline gets longer -- */
const OFFLINE_TIMEOUT_MS = 120_000;

export function createOpenAiCompatibleProvider(settings: ChatProviderSettings): ChatProvider {
  const offline = settings.id === 'offline';
  const client = new OpenAI({ apiKey: settings.apiKey, baseURL: settings.baseUrl ?? OPENAI_BASE_URL, maxRetries: offline ? 0 : 1 });

  async function completeJson(request: JsonRequest): Promise<unknown> {
    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create(
        {
          model: settings.model,
          instructions: request.instructions,
          input: request.input,
          text: { format: { type: 'json_schema', name: request.schemaName, schema: request.schema, strict: true } },
          ...(offline ? { temperature: 0 } : {}),
        },
        { signal: request.signal, timeout: offline ? OFFLINE_TIMEOUT_MS : CLOUD_TIMEOUT_MS[request.purpose] },
      );
    } catch (error) {
      throw toChatFailure(error, settings.label);
    }

    const refusal = response.output.flatMap((item) => (item.type === 'message' ? item.content : [])).find((part) => part.type === 'refusal');
    if (refusal) throw new ChatFailure('refusal', `${settings.label} declined: ${refusal.refusal}`);
    if (response.status === 'incomplete') throw new ChatFailure('cut-off', `${settings.label} stopped early (${response.incomplete_details?.reason ?? 'no reason given'})`);
    return parseJsonReply(response.output_text);
  }

  return Object.freeze({ id: settings.id, label: settings.label, model: settings.model, completeJson });
}

/* -- The SDK's typed errors, most specific first -- */
function toChatFailure(error: unknown, label: string): ChatFailure {
  if (error instanceof OpenAI.APIUserAbortError) return new ChatFailure('aborted', 'the request was cancelled');
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new ChatFailure('timeout', `${label} did not answer in time`);
  if (error instanceof OpenAI.APIError) return new ChatFailure('provider-error', `${label} API error ${error.status ?? ''}: ${error.message}`);
  return new ChatFailure('provider-error', (error as Error)?.message ?? String(error));
}
