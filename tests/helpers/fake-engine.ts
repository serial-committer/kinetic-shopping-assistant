/* ---------------------------------------
    A real search engine over a small hand-made catalog (words only, no vectors), plus a scripted chat provider.
    Lets the message handler run end to end in tests without the 39,834-record catalog or a model.
--------------------------------------- */

import { normaliseBrand } from '../../server/catalog/brand-rules.ts';
import type { CatalogStore } from '../../server/catalog/catalog-store.ts';
import type { Product } from '../../server/catalog/product-types.ts';
import { wordIndexTextOf } from '../../server/catalog/record-text.ts';
import { buildWordIndex } from '../../server/catalog/word-index.ts';
import { ChatFailure, type ChatProvider, type JsonRequest } from '../../server/chat/chat-provider.ts';
import type { ProviderRegistry } from '../../server/chat/provider-registry.ts';
import type { SearchEngine } from '../../server/search/search-engine.ts';
import { runSearch } from '../../server/search/search-pipeline.ts';

export function fakeEngine(products: Product[], sheets: { brandCounts?: Record<string, number>; otherTitleCounts?: Record<string, number> } = {}): SearchEngine {
  const rowsByGroup = new Map<string, number[]>();
  products.forEach((product, row) => rowsByGroup.set(product.groupKey, [...(rowsByGroup.get(product.groupKey) ?? []), row]));
  const brandCounts = new Map(Object.entries(sheets.brandCounts ?? {}));
  for (const product of products) if (product.brand && !sheets.brandCounts) brandCounts.set(normaliseBrand(product.brand), (brandCounts.get(normaliseBrand(product.brand)) ?? 0) + 1);
  const store: CatalogStore = {
    products,
    rowById: new Map(products.map((product, row) => [product.id, row])),
    rowsByGroup,
    brandKeys: products.map((product) => normaliseBrand(product.brand)),
    brandCounts,
    otherTitleCounts: new Map(Object.entries(sheets.otherTitleCounts ?? {})),
    wordIndex: buildWordIndex(products.map(wordIndexTextOf)),
    vectors: null,
  };
  return { store, search: (request) => runSearch(store, null, request), meaningSearchAvailable: () => false, close: async () => undefined };
}

export type ScriptedReply = unknown | ChatFailure;

/* -- Answers each call with the next scripted value for its purpose, and records every request -- */
export function scriptedProvider(script: { slip?: ScriptedReply[]; reply?: ScriptedReply[] }): ChatProvider & { calls: JsonRequest[] } {
  const queues = { slip: [...(script.slip ?? [])], reply: [...(script.reply ?? [])] };
  const calls: JsonRequest[] = [];
  return {
    id: 'offline',
    label: 'Scripted',
    model: 'scripted',
    calls,
    async completeJson(request) {
      calls.push(request);
      const next = queues[request.purpose].shift();
      if (next instanceof ChatFailure) throw next;
      if (next === undefined) throw new ChatFailure('provider-error', `no scripted ${request.purpose} left`);
      return next;
    },
  };
}

export function registryOf(...providers: ChatProvider[]): ProviderRegistry {
  return { list: () => providers, find: (id) => providers.find((provider) => provider.id === id) ?? null };
}
