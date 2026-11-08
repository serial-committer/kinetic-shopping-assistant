/* ---------------------------------------
    The API, one handler per route:
        GET  /api/config              providers set up (id, label, model; never a key), debug panel on or off
        POST /api/chat                one shopper message
        POST /api/brand-choice        one brand button click
        POST /api/more                the next 8 cards for the search on screen ("Load more")
        GET  /api/debug/logs?after=N  log entries newer than N; this route only exists when DEBUG_PANEL=true
    A chat request is aborted when the browser goes away mid-reply (for example because the shopper sent a new
    message), so no provider call runs for nobody.
--------------------------------------- */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from '../config/config.ts';
import type { ChatService } from '../chat/chat-service.ts';
import { readConversationState } from '../chat/conversation-state.ts';
import type { ProviderRegistry } from '../chat/provider-registry.ts';
import { logger } from '../logging/logger.ts';
import type { SearchEngine } from '../search/search-engine.ts';
import { HttpError, readJsonBody, sendJson } from './json-io.ts';

const MAX_MESSAGE_CHARS = 500;

export type RouteDependencies = Readonly<{ config: AppConfig; engine: SearchEngine; providers: ProviderRegistry; chat: ChatService }>;

export type RouteHandler = (request: IncomingMessage, response: ServerResponse, url: URL) => Promise<void>;

export function buildRoutes({ config, engine, providers, chat }: RouteDependencies): Map<string, RouteHandler> {
  const routes = new Map<string, RouteHandler>();

  routes.set('GET /api/config', async (_request, response) => {
    sendJson(response, 200, {
      providers: providers.list().map(({ id, label, model }) => ({ id, label, model })),
      debugPanel: config.debugPanel,
      meaningSearch: engine.meaningSearchAvailable(),
    });
  });

  routes.set('POST /api/chat', async (request, response) => {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'].trim().slice(0, MAX_MESSAGE_CHARS) : '';
    if (!message) throw new HttpError(400, 'message is empty');
    const signal = abortWhenClientLeaves(response);
    const result = await chat.handleMessage({ message, providerId: providerIdOf(body), state: readConversationState(body['state'], engine.store), signal });
    sendJson(response, 200, result);
  });

  routes.set('POST /api/brand-choice', async (request, response) => {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const choice = body['choice'];
    if (choice !== 'brand' && choice !== 'word') throw new HttpError(400, 'choice must be "brand" or "word"');
    const state = readConversationState(body['state'], engine.store);
    if (!state.pendingBrand) throw new HttpError(409, 'there is no brand question waiting for an answer');
    const signal = abortWhenClientLeaves(response);
    sendJson(response, 200, await chat.handleBrandChoice({ choice, providerId: providerIdOf(body), state, signal }));
  });

  routes.set('POST /api/more', async (request, response) => {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const state = readConversationState(body['state'], engine.store);
    if (state.screenIds.length === 0) throw new HttpError(409, 'there are no cards on screen to load more of');
    if (state.pendingBrand) throw new HttpError(409, 'a brand question is waiting for an answer');
    sendJson(response, 200, await chat.handleLoadMore({ state }));
  });

  if (config.debugPanel) {
    routes.set('GET /api/debug/logs', async (_request, response, url) => {
      const after = Number(url.searchParams.get('after') ?? 0);
      sendJson(response, 200, { entries: logger.entriesAfter(Number.isFinite(after) ? after : 0) });
    });
  }

  return routes;
}

function providerIdOf(body: Record<string, unknown>): string | null {
  return typeof body['providerId'] === 'string' ? body['providerId'] : null;
}

/* -- 'close' fires when the response is done or the connection drops; only the second one aborts -- */
function abortWhenClientLeaves(response: ServerResponse): AbortSignal {
  const controller = new AbortController();
  response.once('close', () => {
    if (!response.writableFinished) controller.abort();
  });
  return controller.signal;
}
