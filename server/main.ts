/* ---------------------------------------
    Server start (Points 3 to 5), then the API on 127.0.0.1:SERVER_PORT.
    Usage: npm start (API only) or npm run dev (API plus the web page).
    On Ctrl+C or a stop signal it closes the HTTP server and the sealed embedder, so no process is left behind.
--------------------------------------- */

import { createChatService } from './chat/chat-service.ts';
import { createProviderRegistry } from './chat/provider-registry.ts';
import { getConfig } from './config/config.ts';
import { createHttpServer, listen } from './http/http-server.ts';
import { buildRoutes } from './http/routes.ts';
import { logger } from './logging/logger.ts';
import { startSearchEngine } from './search/search-engine.ts';

const FORCED_EXIT_MS = 5_000;

const config = getConfig();
const started = performance.now();
const engine = await startSearchEngine();
const providers = createProviderRegistry(config);
const chat = createChatService(engine, providers);
const server = createHttpServer(buildRoutes({ config, engine, providers, chat }));
await listen(server, config.serverPort);

const memory = process.memoryUsage();
logger.info('start', `listening on http://127.0.0.1:${config.serverPort}`, {
  providers: providers.list().map((provider) => `${provider.label} (${provider.model})`),
  mode: providers.list().length ? 'chat' : 'search-only',
  meaningSearch: engine.meaningSearchAvailable(),
  debugPanel: config.debugPanel,
  startMs: Math.round(performance.now() - started),
  memoryMb: Math.round(memory.rss / 1e6),
});

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info('stop', `stopping (${signal})`);
  setTimeout(() => process.exit(1), FORCED_EXIT_MS).unref();
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
  await engine.close();
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, () => void stop(signal));
