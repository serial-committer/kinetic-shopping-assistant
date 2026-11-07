/* ---------------------------------------
    Claude through the official @anthropic-ai/sdk, Messages API, structured output (output_config.format).
    - The key and base URL are passed in, so the SDK never looks for keys, tokens or profiles elsewhere.
    - Thinking can't be turned off on Claude Opus 5.5, so effort is set explicitly: low for the slip (a short form),
      medium for the reply (a chat-style answer that still has to follow the honesty rules closely).
    - No temperature: Claude Opus 5.5 rejects it. No forced tool call: Claude Opus 5.5 rejects forced tool_choice.
    - Server-side refusal fallback: fallbacks "default" (beta server-side-fallback-2026-07-01). When a safety
      classifier declines, the API re-runs the request on a fallback model it picks by refusal category.
--------------------------------------- */

import Anthropic from '@anthropic-ai/sdk';
import type { ChatProviderSettings } from '../config/config.ts';
import { ChatFailure, type ChatProvider, type ChatPurpose, type JsonRequest, parseJsonReply } from './chat-provider.ts';

const BASE_URL = 'https://api.anthropic.com';
const MAX_TOKENS = 16_000;
const TIMEOUT_MS: Readonly<Record<ChatPurpose, number>> = { slip: 30_000, reply: 60_000 };
const EFFORT: Readonly<Record<ChatPurpose, 'low' | 'medium'>> = { slip: 'low', reply: 'medium' };

export function createClaudeProvider(settings: ChatProviderSettings): ChatProvider {
  const client = new Anthropic({ apiKey: settings.apiKey, baseURL: BASE_URL, maxRetries: 1 });

  async function completeJson(request: JsonRequest): Promise<unknown> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create(
        {
          model: settings.model,
          max_tokens: MAX_TOKENS,
          system: request.instructions,
          messages: [{ role: 'user', content: request.input }],
          output_config: { effort: EFFORT[request.purpose], format: { type: 'json_schema', schema: request.schema } },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal: request.signal, timeout: TIMEOUT_MS[request.purpose] },
      );
    } catch (error) {
      throw toChatFailure(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new ChatFailure('refusal', `Claude declined (${response.stop_details?.category ?? 'no category'})`);
    }
    if (response.stop_reason === 'max_tokens') throw new ChatFailure('cut-off', 'Claude ran out of output tokens');
    const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
    return parseJsonReply(text);
  }

  return Object.freeze({ id: settings.id, label: settings.label, model: settings.model, completeJson });
}

/* -- The SDK's typed errors, most specific first -- */
function toChatFailure(error: unknown): ChatFailure {
  if (error instanceof Anthropic.APIUserAbortError) return new ChatFailure('aborted', 'the request was cancelled');
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ChatFailure('timeout', 'Claude did not answer in time');
  if (error instanceof Anthropic.APIError) return new ChatFailure('provider-error', `Claude API error ${error.status ?? ''}: ${error.message}`);
  return new ChatFailure('provider-error', (error as Error)?.message ?? String(error));
}
