# Test plan

Every test case for the project, grouped by feature. Add new cases at the end of the matching group (or in **Added by Kapil** at the bottom).

**Claude's result** says what happened when Claude ran it, and how:
- **PASS** with the evidence: *(unit)* is a `node:test` case in `tests/`, *(tool)* is a project command's output (`npm run search-check`, `npm run slip-test`, `npm run clean-catalog`), *(API)* is a run through the real HTTP server with the local model, *(manual)* is a one-off check during the build.
- **FAIL** with what went wrong.
- **Not run: chunk N** means the feature isn't built yet.
- **Skipped** with the reason.

**Your result** is yours to fill in.

Last full run: 2026-11-08, `npm test` 54 of 54, `npm run typecheck` clean.

---

## A. Setup and install

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| A1 | `npm run deps` with `SHARED_NODE_MODULES` set installs into the shared folder and makes `node_modules` a junction to it | PASS (manual, workspace copy) | |
| A2 | `npm run deps` in the twin points the twin's `node_modules` at the same shared folder | Not run: needs the twin's own `.env` | |
| A3 | Plain `npm ci` with `SHARED_NODE_MODULES` empty installs a normal `node_modules` (the reviewer's path) | Skipped: would replace the workspace junction | |
| A4 | Running `npm run deps` when `node_modules` is a real folder stops with a clear message and deletes nothing | Not run | |
| A5 | A new lock file only holds package versions at least 14 days old | PASS (manual: `--before` = today minus 14 days, 35 packages) | |
| A6 | No package runs an install script (`ignore-scripts=true`) | PASS (manual: `.npmrc`, install log) | |
| A7 | A fresh `git clone` gives byte-identical files with no CRLF (hashes in `vendor/*/SOURCE.md` still match) | PASS (manual: 247 of 247 files identical) | |
| A8 | `.gitignore` hides `catalog/products.json`, `Individual Catalog/`, `node_modules`, `.env`, `Build Notes/`, `web/dist`, and keeps `vendor/onnxruntime/node_modules`, `.env.example`, `data/` | PASS (manual: throwaway repo + `git check-ignore`) | |
| A9 | `npm run typecheck` shows zero errors and zero warnings | PASS (tool) | |
| A10 | `npm test` passes in full | PASS (tool: 54 of 54) | |

## B. Settings and logging

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| B1 | Values in `.env` are read; a real environment variable with the same name wins (except API keys, B11) | PASS (unit) | |
| B2 | `.env` values never appear in `process.env` | PASS (unit) | |
| B3 | A bad `LOG_LEVEL` or port falls back to the default and logs one WARN | PASS (unit) | |
| B4 | The provider list holds only providers set up in `.env`; none means search-only | PASS (unit; API: `/api/config` lists only Offline). Dropdown: chunk 7 | |
| B5 | Level order: `LOG_LEVEL=DEBUG` prints DEBUG to ERROR and skips TRACE; `OFF` prints nothing | PASS (unit) | |
| B6 | A configured key is masked as `***` in log text and nested log data | PASS (unit) | |
| B7 | The panel buffer keeps only the newest entries and returns only entries newer than an id | PASS (unit) | |
| B8 | Only `server/logging/logger.ts` calls `console` | PASS (manual: search over `server`, `tools`, `tests`) | |
| B9 | Every log line made while handling a chat message carries that message's id | PASS (API: `/api/debug/logs` entries grouped under 3 message ids) | |
| B10 | Embedder log lines arrive tagged `[embedder]` | PASS (manual: build output) | |
| B11 | API keys come from `.env` only: a key in the machine's environment is ignored | PASS (unit; API: an `OPENAI_API_KEY` in the Windows user environment no longer shows OpenAI) | |

## C. Cleaning tool (Point 1)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| C1 | `npm run clean-catalog` writes 39,834 trimmed records in catalog order | PASS (tool) | |
| C2 | Its report matches the full-catalog measurements (31,785 cards, 3,176 repeat groups, 172 twin sets on 167 cards, color 81.2%, size 75.3%, gender 88.6%, brand 98.6%) | PASS (tool: 22 of 22 rows) | |
| C3 | "nan", "None", "unknown", "Generic", symbol-only values (`\`, `/`, `...`) and non-text values count as missing | PASS (unit). The symbol rule was added after the browser showed a color of `\` | |
| C4 | Brand falls back from `brand` to details "Brand Name" to details "Brand" to `store` | PASS (unit) | |
| C5 | Colors map to the first matching family ("Navy Blue" blue, "Rose Gold" pink, "Style 4" none) | PASS (unit) | |
| C6 | Sizes fold into groups ("X-Large" XL, "2x-large" XXL, "9.5 Wide" 9.5, "One Size" ONE SIZE, "32W x 30L" none) | PASS (unit) | |
| C7 | Gender comes from the category path, then department, then title, else unknown | PASS (unit) | |
| C8 | The card group key is store plus exact title, lowercased and trimmed | PASS (unit) | |
| C9 | Brand sheets: nike 995 own / 32 elsewhere, polo 1 / 392 | PASS (tool) | |
| C10 | `data/products.json` stays under GitHub's 100 MB file limit | PASS (tool: 61.7 MB) | |
| C11 | A missing `catalog/products.json` stops the tool with a clear message | Not run | |

## D. Sealed embedder (Points 2 and 5)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| D1 | 20 escape attempts from inside the sandbox are all refused (network, DNS, listen, programs, workers, native code, files, eval, vm, kill, sqlite) | PASS (unit: 20 of 20) | |
| D2 | A local TCP and UDP listener hear nothing during the escape attempts | PASS (unit) | |
| D3 | No file is written outside the sandbox or into the model folder | PASS (unit) | |
| D4 | The child refuses to start when a lock is missing (for example started without `--permission`) | Not run | |
| D5 | A shopper sentence embeds in under 100 ms after warm-up | PASS (unit: about 11 ms) | |
| D6 | A vector has 384 numbers and length 1 | PASS (unit) | |
| D7 | After `close()` the child process is gone | PASS (unit) | |
| D8 | When the parent is force-killed, the child ends on its own | Not run | |
| D9 | The embed tool puts each vector on its product's row (sample of 800 compared with the reference engine) | PASS (manual: cosine 0.997 to 0.998) | |
| D10 | The full build finishes and writes `vectors.bin` (61 MB) and `manifest.json` | PASS (tool: 39,834 in 30.1 minutes, 22.1 a second, 61,185,024 bytes) | |
| D11 | No `node.exe` is left running after the embed tool ends | PASS (manual: sample and full run) | |

## E. Server start (Points 3 to 5)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| E1 | Products, brand sheets and the word index load at start (word index about 215 ms, about 30,000 words) | PASS (tool: products 329 ms, index 209 ms, 30,576 words) | |
| E2 | Vectors load when the manifest matches | PASS (unit + tool: checked in 141 ms) | |
| E3 | Vectors are refused (ERROR log, words only) when `products.json` changed since they were built | PASS (unit) | |
| E4 | Vectors are refused when the model file changed | PASS (unit) | |
| E5 | Missing vectors: search runs on filters and words, with an ERROR log | PASS (tool: before the build finished) | |
| E6 | The embedder crashes once: it restarts. Twice: words only, ERROR log | PASS (unit, fake child) | |
| E7 | Server memory with everything loaded stays around 500 MB | PASS (API: server 257 MB + embedder 192 MB) | |
| E8 | Stopping the server leaves no child process | PASS (manual: 0 `node.exe` after stop) | |

## F. Search core (Points 8 to 11)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| F1 | Filter before merge: an orange Medium listing under $30 never borrows Small from a sibling listing on the same card | PASS (unit) | |
| F2 | RRF maths: each list gives 1/(60 + position), totals add, raw scores never count | PASS (unit) | |
| F3 | Unisex products pass a women's or men's filter, not a girls', boys' or baby filter | PASS (unit) | |
| F4 | Unknown-gender products fail any gender filter | PASS (unit) | |
| F5 | Products outside the price limits fail; limits are inclusive | PASS (unit) | |
| F6 | Products not listed in a mapped color or size fail that filter | PASS (unit) | |
| F7 | Groups excluded by "cheaper" never come back | PASS (unit) | |
| F8 | Filtering all 39,834 records takes a few milliseconds | PASS (tool: 1.2 to 7.8 ms) | |
| F9 | Rare words outweigh common ones ("merrell" over "shoes") | PASS (unit) | |
| F10 | Empty search text ("anything under $20") sorts by rating, then rating count | PASS (unit + tool) | |
| F11 | A sort (price low, price high, rating) overrides relevance, among the 40 most relevant cards | PASS (unit + tool) | |
| F12 | Repeats fold into one card; groups are ordered by their best listing; at most 8 cards | PASS (unit) | |
| F13 | A card's headline shows only listings that passed, as a price or a range with a listing count, never an average | PASS (unit) | |
| F14 | Twins (same color and size, different price) get "Listed more than once at different prices." | PASS (unit) | |
| F15 | Hand-made slip for "running shoes under $120" returns running shoes, all at or under $120 | PASS (tool) | |
| F16 | Hand-made slip for "orange running shorts in size small" finds the real matches (about 2) | PASS (tool: both on top) | |
| F17 | "keep my hands warm on the slopes" (meaning) finds gloves and mittens | PASS (tool: ski and heated gloves) | |
| F18 | Brand filter "merrell" plus "hiking shoes" returns only Merrell | PASS (tool) | |
| F19 | Shopper sizes go through the same rules as the catalog ("small" is S, "size 9.5" is 9.5) | PASS (unit) | |
| F20 | When few products really match, the free card slots don't fill with unrelated products | FAIL (tool: orange shorts cards 6 to 8 are a bag, a sock, cycling gloves; after "cheaper", 6 unrelated items). Fix proposed: meaning floor 0.62, waiting for Kapil | |
| F21 | A search takes well under a second | PASS (tool: 10 to 85 ms) | |

## G. Slip (Points 6 and 7)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| G1 | The word-keeper passes the 20 cases in `design/reference/keep-words-check.mjs` | PASS (unit: 20 of 20) | |
| G2 | Merge: `newSearch` starts from an empty slip, `clear` empties the named boxes | PASS (unit) | |
| G3 | Merge: a null or empty-string value keeps the box | PASS (unit) | |
| G4 | Merge: "cheaper" ignores the model's prices only when products are on screen | PASS (unit) | |
| G5 | Merge: a unisex gender from the model means no gender filter | PASS (unit) | |
| G6 | "Anything cheaper?" keeps color and size, sets the price just under the cheapest on screen and excludes the shown cards | PASS (unit + API) | |
| G7 | "Only show blue ones" keeps every other box | PASS (unit + API) | |
| G8 | Brand gate: Nike filters, Polo asks first, "merino" and "Ordinary" go back to words, "North Face" resolves to "the north face", "under armour" filters | PASS (unit) | |
| G9 | Ask first: no search runs until a button is clicked; the choice is remembered for the chat | PASS (unit + API) | |
| G10 | A brand button sends a slip change straight to the server, skips the slip model, and the reply is still written | PASS (unit + API) | |
| G11 | `ask` with an empty or "null" question shows the fixed question | PASS (unit) | |
| G12 | `answer` skips the search and answers from the cards on screen | PASS (unit + API) | |
| G13 | Slip test on Offline: 16 to 17 of 18 brand decisions, 8 of 8 unseen, 11 of 13 follow-ups | PASS (tool: 11 of 13 follow-ups, same two misses; North Face and Fox Racing missed as before) | |
| G14 | Slip test on Claude and OpenAI | Skipped: no keys in `.env` | |
| G15 | Offline sends temperature 0; Claude and OpenAI send none | Not run as a test (set in `openai-compatible-adapter.ts`) | |
| G16 | A failed slip (refusal, cut-off, invalid JSON, timeout) runs search-only for that message with a WARN | PASS (unit) | |
| G17 | No provider set up: search-only mode with the fixed note, filters off | PASS (unit) | |
| G18 | A new message aborts the old request | Not run as a test (page aborts its fetch; the server aborts the provider call when the connection closes) | |
| G19 | A size the rules can't read (for example "petite") searches as a word instead of filtering everything out | PASS (unit) | |
| G20 | The model never fills a box the shopper didn't ask for | Seen once (API): on "Anything cheaper?" the local model added gender "men" from the titles on screen. Known limit | |
| G21 | The nullable boxes use `anyOf` with null (accepted by Claude, OpenAI and Ollama) without lowering the Offline baseline | PASS (tool: same scores as the tested schema) | |

## H. Reply (Point 12)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| H1 | Every card is drawn by code from the records; the model can't change one | PASS (unit + API) | |
| H2 | Unknown product ids in the reply are dropped (WARN); mentioned ids get a highlight | PASS (unit) | |
| H3 | A `$` amount that isn't a card price or the slip's min/max price replaces the reply with "Here's what I found." (WARN) | PASS (unit) | |
| H4 | The shopper's own budget ("under $120") is allowed in the reply | PASS (unit + API) | |
| H5 | The reply never claims stock, delivery, returns, or other sizes and colors | PASS (API), with a note: the local model adds the stock sentence even when nobody asked | |
| H6 | Nothing matched: the reply says so and suggests which filter to loosen | PASS (API: "cheaper" with no running shorts left) | |
| H7 | A failed reply keeps the cards with "Here's what I found." (WARN) | PASS (unit) | |
| H8 | The stock sentence names the product's real listed size, never the example "Small" | PASS (API, after the fix: "9.5 B - Medium US"); an unfilled slot is replaced (unit) | |

## I. Web interface

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| I1 | Chat, brand buttons and clarifying questions show in the chat panel | PASS (browser) | |
| I2 | Up to 8 cards with image, title, brand, price or range, listing count, passing color and size, rating with count | PASS (browser) | |
| I3 | The card details sheet grows from the card: every listing, "Other listings", twin warning, features, description | PASS (browser: grows from the card, closes with Escape). Twin warning not seen on screen yet | |
| I4 | Light (#F9F9F9, sky blue) and dark (#010000, amber) modes switch smoothly | PASS (browser: Auto, Light, Dark; scrollbars follow the theme) | |
| I5 | Debug button only with `DEBUG_PANEL=true`; the modal grows from it; level chips, collapsible JSON, copy button | PASS (browser) | |
| I6 | `/api/debug/logs` doesn't exist when the panel is off; polling stops when the modal closes | Polling: PASS (browser: 3 polls in 3 s open, 0 in 4 s after closing). Route absent when off: by code, not run | |
| I7 | No API key ever reaches the browser (`/api/config` and every response) | PASS (API: id, label and model only; keys never enter the conversation state) | |
| I8 | Product images load from the catalog's image URLs | PASS (browser; white photo backgrounds blend into the tile) | |
| I9 | "New search" clears the chat, the cards and the saved slip | PASS (browser, after a stale-module reload) | |
| I10 | Two columns from 900 px wide, one column below | PASS (browser: 800 px and 1360 px) | |
| I11 | Reduced motion keeps fades and drops movement | Not run (by code: `prefers-reduced-motion` blocks in CSS and the grow animation) | |
| I12 | A phone-width layout (about 390 px) | Not run | |

## J. End to end (brief's examples)

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| J1 | "Show me running shoes under $120" | PASS (API, Offline) | |
| J2 | "I'm looking for orange running shorts in size small" | PASS (API: both real shorts first and highlighted) | |
| J3 | Then "Anything cheaper?" | PASS (API: reply says nothing cheaper matched); see F20 for the cards | |
| J4 | Then "Only show blue ones" | PASS (API: honest reply); see F20 for the cards | |
| J5 | "Polo brand shirts" shows the two brand buttons | PASS (API: "Polo, the brand (1 product)" and "polo as a word (392 products)") | |
| J6 | "something for a beach wedding" | PASS (API: barefoot sandals and wedding anklets) | |
| J7 | "help me find a gift" asks a clarifying question | PASS (API) | |
| J8 | "Is the first one waterproof?" answers from the cards on screen | PASS (API: says the catalog doesn't say) | |
| J9 | Every product in every reply is a real catalog record | PASS (API: cards are built from ids the server looked up) | |
| J10 | No stray processes after stopping `npm run dev`; the debug poller stops | Poller: PASS (browser). API server: PASS (0 `node.exe` after stop). `npm run dev` stop: checked at the end of the build | |
| J11 | Switching from one kind of item to another doesn't keep the old brand or price | FAIL with the local model ("Polo brand shirts" then sandals kept Brand: Polo and Up to $120). Visible in the slip summary; "New search" starts over. Code-side fix proposed | |

---

## Added by Kapil

| # | Test case | Claude's result | Your result |
|---|---|---|---|
| K1 | | | |
