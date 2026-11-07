/* ---------------------------------------
    The chat providers set up in .env, built once at start. The dropdown lists exactly these; with none, the app
    runs in search-only mode.
--------------------------------------- */

import type { AppConfig, ChatProviderId } from '../config/config.ts';
import type { ChatProvider } from './chat-provider.ts';
import { createClaudeProvider } from './claude-adapter.ts';
import { createOpenAiCompatibleProvider } from './openai-compatible-adapter.ts';

export type ProviderRegistry = Readonly<{
  list(): readonly ChatProvider[];
  find(id: string | null | undefined): ChatProvider | null;
}>;

export function createProviderRegistry(config: AppConfig): ProviderRegistry {
  const providers = config.providers.map((settings) => (settings.id === 'claude' ? createClaudeProvider(settings) : createOpenAiCompatibleProvider(settings)));
  const byId = new Map<ChatProviderId, ChatProvider>(providers.map((provider) => [provider.id, provider]));
  return Object.freeze({
    list: () => providers,
    find: (id) => (id ? byId.get(id as ChatProviderId) ?? null : null),
  });
}
