# Debug panel and logger: flow chart

**In one line:** every step of every message writes a log line through one logger; with `DEBUG_PANEL=true` the page can show those lines, grouped by chat message, in a window that grows out of a small "Logs" button.

Think of a flight recorder. Every system on the plane writes to the same recorder, each line stamped with the time and which system wrote it. After a flight you play back one flight at a time. Here the "flight" is one chat message, and its id is stamped on every line written while it was being handled.

```text
Fig A: where log lines come from and where they go

  server code ---- logger.debug('P9', 'meaning ranker, top 10', data) ----+
  embedder child -- { kind: 'log', ... } over IPC -> logger.fromSource -----+
                                                                           v
                                     Point 1  logger.ts
                                              level check (LOG_LEVEL, read once)
                                              keys masked as ***
                                              message id added (AsyncLocalStorage)
                                              |                         |
                                              v                         v
                                     Point 2  console line     Point 3  ring buffer (last 500)
                                                                        only when DEBUG_PANEL=true
                                                                           |
                       GET /api/debug/logs?after=<last id>   <-------------+   route exists only when the panel is on
                                                                           |
  page code ------ uiLogger.info('turn', ...) --> page's own list (200) ---+
                                                                           v
                                     Point 4  DebugPanel.tsx: merge, filter by level, group by message id,
                                              newest message first, collapsible data, copy buttons
```

## Levels

```text
Fig B: what LOG_LEVEL lets through (log4j order)

            TRACE   DEBUG   INFO   WARN   ERROR
TRACE         x       x      x      x      x
DEBUG         -       x      x      x      x
INFO          -       -      x      x      x
WARN          -       -      -      x      x
ERROR         -       -      -      -      x
OFF           -       -      -      -      -
```

| Level | What is logged |
|---|---|
| TRACE | Per-record detail: the top 50 BM25 scores |
| DEBUG | The slip before and after the merge, words put back, gate decisions, survivor counts, the top 10 of each ranker, RRF totals, chat requests and responses (no keys) |
| INFO | One line per message: provider, action, cards, time. Start-up steps |
| WARN | Every fallback: search-only, a schema problem, a dropped id, a price mismatch, an empty question |
| ERROR | Provider failures, embedder crashes, a manifest mismatch |

## Polling, and how it stops

```text
Fig C: the logs window's life

click "Logs"   -> window grows from the button -> poll now, then every 1 s (one request at a time)
               -> each poll asks only for entries after the last id it has
click "Close", press Escape or click outside
               -> window shrinks back into the button -> timer cleared, request in flight aborted,
                  page-log listener removed. Measured: 3 polls in 3 s while open, 0 in 4 s after closing.
```

## Where to change things

| To change | Edit |
|---|---|
| What a level means, the order | `server/logging/log-levels.ts` |
| Line format, masking, the buffer size (500) | `server/logging/logger.ts` |
| The endpoint | `server/http/routes.ts` |
| The window, grouping, polling interval | `web/src/components/debug/DebugPanel.tsx` |
| One entry's look | `web/src/components/debug/LogGroup.tsx` |
| The page's own logger | `web/src/logging/ui-logger.ts` |
