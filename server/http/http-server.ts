/* ---------------------------------------
    The HTTP server: plain node:http, listening on 127.0.0.1 only. It looks a route up by "METHOD /path",
    turns thrown errors into JSON responses, and ends quietly when a request was aborted.
--------------------------------------- */

import { createServer, type Server } from 'node:http';
import { ChatFailure } from '../chat/chat-provider.ts';
import { logger } from '../logging/logger.ts';
import { HttpError, sendJson } from './json-io.ts';
import type { RouteHandler } from './routes.ts';

export function createHttpServer(routes: ReadonlyMap<string, RouteHandler>, fallback?: RouteHandler): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const handler = routes.get(`${request.method} ${url.pathname}`) ?? (url.pathname.startsWith('/api/') ? undefined : fallback);
    if (!handler) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }
    handler(request, response, url).catch((error: unknown) => {
      if (error instanceof ChatFailure && error.kind === 'aborted') {
        logger.debug('http', 'request aborted by the browser', { path: url.pathname });
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      logger.error('http', 'request failed', { path: url.pathname, error });
      sendJson(response, 500, { error: 'something went wrong on the server' });
    });
  });
}

export function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
}
