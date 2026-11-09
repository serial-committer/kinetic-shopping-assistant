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
| TRACE | Per-record detail: the top 50 BM25 scores, and the whole prompt input sent to the chat model |
| DEBUG | The slip request (message, saved slip) and the slip the model filled, the slip before and after the merge, a "cheaper" or sort set aside and why, a brand moved from the words to the brand box, words put back, a new topic found by code, gate decisions, survivor counts, the top 10 of each ranker, RRF totals, the meaning floor, the cards (with product ids), the reply request (product ids) and the reply (no keys) |
| INFO | The shopper's message, then one line when it is handled: provider, action, the reply, the card ids, time. "Load more" too. Start-up steps |
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

## Copying logs

"Copy all" copies the entries at the levels shown, as plain lines, oldest message first; "Copy" on a message heading copies that message alone. Each line is time, level, source (when not the server), step, message, and the data as one line of JSON:

```text
## Message 12d3f8ba
11:01:17.957 INFO  turn shopper message {"message":"Show me running shoes under $120","provider":"Offline (kinetic:thinker)","cardsOnScreen":0}
11:01:24.486 DEBUG P6 slip response {"form":{"action":"search","question":null,"change":{"text":"running shoes","maxPrice":120,...}}}
11:01:24.486 DEBUG P7c brand gate {"kind":"none"}
11:01:24.534 DEBUG [embedder] P9 shopper text embedded {"tookMs":37}
11:01:24.580 DEBUG P11 cards {"hasMore":true,"cards":[{"id":"B0B4VDQTNM","title":"LALO Men's Running Cross-Trainer-Shoes",...}]}
```

The product ids lead to the full records in `data/products.json`, so a log stays short without losing which products it was about.

## Exporting logs

"Export" opens a second window over the logs window, with a snapshot of every entry the panel holds (all levels, so the export can pick its own). Choices on the left change the preview on the right as they are made.

```text
Fig D: what each choice removes, on one line of P11

  13:04:36.859 DEBUG P11 cards {"hasMore":true,"cards":[{"id":"B01MT1JYDF","title":"ALTRA ...","listings":9,"minPrice":68.19,"maxPrice":112.12,"twins":false}]}
  |            |     |   |     |
  Point 1      2     3   4     Point 5: the data, minus the fields left out for this kind of line

  Point 1-4  "Each line shows": time, level, source ([embedder]), step. The message always stays
  Point 5    "Log lines and their fields": P11 cards, Fields: untick cards > twins and cards > listings
             -> {"hasMore":true,"cards":[{"id":"B01MT1JYDF","title":"ALTRA ...","minPrice":68.19,"maxPrice":112.12}]}
```

- **A kind of log line** is its step plus its message with the numbers blanked, so "top 10 of 6377" and "top 10 of 6893" are one kind. Fields are every leaf path seen in that kind's data (`cards[].title` shows as "cards > title").
- **Whole messages:** levels, and "Load more messages" (a message whose `turn` line is "load more").
- **The file** starts with a header (when, how many messages, levels, and a "Left out" line), then one block per message, oldest first, headed with the shopper's words (`## Message f56ac42a · "Show me running shoes under $120"`).
- Choices are saved in the browser's local storage; "Reset" goes back to everything on.
- Closing Export (Close, Escape, a click outside) leaves the logs window open: the Export window stops those events from reaching it.

## Where to change things

| To change | Edit |
|---|---|
| What a level means, the order | `server/logging/log-levels.ts` |
| Line format, masking, the buffer size (500) | `server/logging/logger.ts` |
| The endpoint | `server/http/routes.ts` |
| The window, grouping, polling interval | `web/src/components/debug/DebugPanel.tsx` |
| One entry's look | `web/src/components/debug/LogGroup.tsx` |
| The copied text format | `web/src/components/debug/format-log.ts` |
| Export's choices and file format | `web/src/components/debug/export-log.ts` |
| The Export window | `web/src/components/debug/ExportDialog.tsx` |
| The page's own logger | `web/src/logging/ui-logger.ts` |
