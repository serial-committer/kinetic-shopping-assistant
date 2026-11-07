/* ---------------------------------------
    Points 3 to 5 wired together: load the catalog, build the word index, start the sealed embedder,
    then serve searches. The embedder only starts when the vectors passed the manifest check, since a shopper
    vector is useless without product vectors from the same model.
--------------------------------------- */

import { type CatalogStore, loadCatalogStore } from '../catalog/catalog-store.ts';
import { createEmbedderService, type EmbedderService } from '../embedder/embedder-service.ts';
import { logger } from '../logging/logger.ts';
import { runSearch, type SearchRequest, type SearchResult } from './search-pipeline.ts';

export type SearchEngine = Readonly<{
  store: CatalogStore;
  search(request: SearchRequest): Promise<SearchResult>;
  meaningSearchAvailable(): boolean;
  close(): Promise<void>;
}>;

export async function startSearchEngine(): Promise<SearchEngine> {
  const store = await loadCatalogStore();
  let embedder: EmbedderService | null = null;
  if (store.vectors) {
    embedder = createEmbedderService({ expectedDimension: store.vectors.dimension });
    await embedder.start();
  } else {
    logger.warn('P5', 'embedder not started, because there are no trusted product vectors');
  }
  const embedQuery = embedder ? (text: string) => embedder.embedQuery(text) : null;

  return Object.freeze({
    store,
    search: (request: SearchRequest) => runSearch(store, embedQuery, request),
    meaningSearchAvailable: () => embedder?.state() === 'ready',
    close: async () => {
      await embedder?.close();
    },
  });
}
