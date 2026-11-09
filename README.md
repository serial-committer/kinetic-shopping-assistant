# Kinetic Shopping Assistant

A small shopping assistant over a real product catalog: 39,834 Amazon Fashion listings (clothing, shoes, jewelry, luggage and outdoor gear). Shoppers chat with it, see the products it finds, and refine the results with follow-ups like "Anything cheaper?" or "Only show blue ones".

The idea in one line: **a chat model understands the words, and code does everything that must be exact.** The model only fills in a fixed search form (the *slip*). It never writes a query, never touches a product card, and can't invent a product, price or size.

---

## Contents

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Settings (.env)](#settings-env)
- [Commands](#commands)
- [Decisions and why](#decisions-and-why)
- [The API](#the-api)
- [The data files](#the-data-files)
- [Handling catalog updates](#handling-catalog-updates)
- [Known limits](#known-limits)
- [Unfinished work](#unfinished-work)
- [Project layout](#project-layout)

---

## Quick start

You need **Node 22.18 or newer** (it runs TypeScript files directly). Everything else ships in the repository: the cleaned catalog, the product vectors, the embedding model and its engine.

```bash
npm ci
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Open **http://localhost:9519**. The API runs on 127.0.0.1:9500. `Ctrl+C` stops both.

### Turn on chat

With no chat provider the app runs in **search-only mode**: your whole sentence is used as search words, filters stay off, and a note explains how to turn chat on. Set up any of these in `.env`; the dropdown lists only the ones you set up.

| Provider | In `.env` |
|---|---|
| Claude | `ANTHROPIC_API_KEY=...` (model `claude-opus-5-5`, change with `CLAUDE_MODEL`) |
| OpenAI | `OPENAI_API_KEY=...` (model `gpt-6-astra`, change with `OPENAI_MODEL`) |
| Offline, free | Install [Ollama](https://ollama.com), run `ollama pull qwen2.5:7b` (4.7 GB), then uncomment `OLLAMA_BASE_URL=http://localhost:11434/v1` |

### Rebuild the data yourself (optional)

Put the provided catalog at `catalog/products.json` (it is over GitHub's 100 MB file limit, so it isn't in the repository), then:

```bash
npm run clean-catalog
```

```bash
npm run embed-catalog
```

The second one takes about 30 minutes with 8 processes.

---

## How it works

```text
Fig A: the whole stack

BUILT ONCE (tools, run by hand)
Point 1   Cleaning tool   Catalog -> data/products.json + data/brands.json
Point 2   Embed tool      bge-small -> data/vectors.bin + data/manifest.json

AT SERVER START
Point 3   Load            Products and vectors into memory, check the manifest
Point 4   Build           Word index for BM25
Point 5   Start           Sealed child process: ONNX Runtime + bge-small

ON EACH MESSAGE
Point 6   Chat model      Fills the slip form (structured output)
Point 7a  Merge           The change goes into the saved slip
Point 7b  Keep words      Shopper words missing from the slip go back into text
Point 7c  Brand gate      Filter, back to words, or ask first
Point 8   Filter          Exact boxes on every record (keep or drop)
Point 9   Rank            BM25 and bge-small, on the survivors only
Point 10  Combine         RRF: points from positions in both lists
Point 11  Merge cards     Repeats fold into one card
Point 12  Chat model      Writes the reply from real records only
```

"Survivors" are the records that pass the filters at Point 8. Each part has its own flow chart in `docs/`:

| Doc | Covers |
|---|---|
| `docs/catalog-cleaning-flow-chart.md` | Point 1 |
| `docs/sealed-embedder-flow-chart.md` | Points 2 and 5 |
| `docs/search-pipeline-flow-chart.md` | Points 8 to 11 |
| `docs/slip-and-brand-gate-flow-chart.md` | Points 6 and 7 |
| `docs/debug-panel-flow-chart.md` | The logger and the debug panel |

---

## Settings (.env)

The server reads `.env` once at start. The file is never copied into `process.env`, so no library and no child process can find a key by looking there. For every setting **except API keys**, a real environment variable with the same name wins over the file (handy for `LOG_LEVEL=DEBUG` on one run). **API keys come from `.env` only**, so a key that happens to sit in your machine's environment is never picked up and billed by surprise. Keys never reach the browser and are masked in every log line.

| Name | Default | What it does |
|---|---|---|
| `SERVER_PORT` | `9500` | API server port |
| `WEB_PORT` | `9519` | Web page port |
| `ANTHROPIC_API_KEY` | empty | Turns on Claude |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Claude model |
| `OPENAI_API_KEY` | empty | Turns on OpenAI |
| `OPENAI_MODEL` | `gpt-6-astra` | OpenAI model |
| `OLLAMA_BASE_URL` | empty | Turns on Offline (for example `http://localhost:11434/v1`) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Offline model |
| `LOG_LEVEL` | `INFO` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` or `OFF` |
| `DEBUG_PANEL` | `false` | `true` shows a "Logs" button in the app with the server logs |
| `SHARED_NODE_MODULES` | empty | Optional shared install folder for `npm run deps` |

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | The API server and the web page together; `Ctrl+C` stops both |
| `npm start` | The API server alone |
| `npm test` | All tests (`node:test`) |
| `npm run typecheck` | Type-checks the server, tools, tests and web page |
| `npm run build:web` | Builds the web page into `web/dist` |
| `npm run clean-catalog` | Point 1, with its measurements printed next to the expected ones |
| `npm run embed-catalog` | Point 2 (`-- --limit=800` for a sample into a temp folder) |
| `npm run search-check` | The search core on the brief's examples with hand-written slips, no chat model |
| `npm run slip-test` | How well a chat model fills the slip (`-- --provider=offline\|claude\|openai`) |
| `npm run floor-check` | What the meaning floor removes and keeps on 31 searches (`-- --floor=0.6` to try another value) |
| `npm run deps` | Installs packages; with `SHARED_NODE_MODULES` set, into that folder with `node_modules` as a junction |

`tools/split-products.cjs` is a standalone utility that splits a catalog into one file per `main_category`. It is how the catalog was first studied (below). The app doesn't use it.

---

## Decisions and why

### Stack

- **Node + TypeScript** for the server and tools, run directly by Node's built-in type stripping, so there is no build step. **React + TypeScript + Vite** for the page, with plain CSS and no UI library.
- **Plain `node:http`** for the server.
- **Few dependencies:** the official chat SDKs (`@anthropic-ai/sdk`, `openai`), React, Vite and TypeScript, plus type packages and Vite's React plugin. Every version is pinned, install scripts are off, and when the lock file was made every package (including the ones underneath) was held to releases at least two weeks old.
- **Official SDKs** rather than hand-written HTTP calls: the exercise had a two-hour budget, so there was no reason to rebuild what the providers already maintain.

### One catalog file, one list

The catalog was first split into one file per `main_category` (21 files) to study it in smaller pieces. That split exposed the first problem: **`main_category` can't be trusted.** "Tools & Home Improvement" holds sneakers, and "Sports & Outdoors" holds bracelets. Searching file by file would mean guessing which file to open, and a wrong guess hides good products. Speed is no reason to split either: checking all 39,834 records against the filters takes 2 to 8 ms. So the app reads the original file as one list and works out what a product is from its `categories` path.

### What the catalog measurement found (Point 1)

All numbers are over the full catalog; `npm run clean-catalog` prints them every time.

| Finding | Number | What the app does |
|---|---|---|
| Every price is generated | `price_source` is `synthetic` on every record | Shows prices exactly as listed, and says so here |
| Products repeat | 31,785 unique products. 3,176 repeat groups cover 11,225 records | Groups by store + exact title into one card |
| Exact twins | 172 sets (on 167 cards) share store, title, color and size but have different prices. Prices inside one card differ up to 20.55 times | Shows every price with a warning. Never averages |
| No stock, no other sizes | No stock field, and `variant_coverage` says sizes and colors aren't listed | Says "listed in size Small", never "in stock" |
| Color is free text | 12,800 spellings | Maps to 14 families with a word list (81.2% mapped) |
| Size is free text | 6,034 spellings | Maps to letter sizes, numbers and one-size (75.3% recognised) |
| `department` is mostly empty | 73.1% say "nan" | Gender from the `categories` path first, then `department`, then the title (88.6% found) |
| Brand fields | 562 records have none anywhere | Brand = `brand`, else details `Brand Name`, else details `Brand`, else `store` (98.6% found, 10,394 names) |
| Missing values come in many forms | "nan", "None", "Unknown", "Generic", and a few symbol-only values like `\` | All count as missing |
| `original_price` | Filled on 12,931 records, equal to `price` on only 2 | Never shown. Cards show `price` |

Size groups: letter sizes fold to one spelling ("X-Large" and "XL" are both XL, "2x-large" is XXL), numbers keep only the number ("9.5 Wide" is 9.5), and "One Size" variants become ONE SIZE. A size that fits none of these has no group, so it fails a size filter: the app can't tell what that size means.

### The slip (Points 6 and 7)

The chat model's whole reply must be a fixed form: `action` (search, ask or answer), `question`, and a `change` with boxes for text, color, size, gender, prices, brand, sort, "cheaper than shown", boxes to clear, and "new search". It uses **structured output**: Claude's `output_config.format` and OpenAI's Responses `text.format`, both strict JSON schema. A forced tool call isn't used: Claude Opus 5.5 rejects forced `tool_choice`, and Ollama ignores it.

- **The model sends a change; code merges it.** "Anything cheaper?" once came back as only `{ cheaperThanShown: true }`. Because code keeps the saved slip, the color and size survive without the model repeating them.
- **A change of topic is caught twice.** The model decides first (its `newSearch` box). Code is the safety net: when the change brings search words and none of them appear in the saved ones, it starts a new search too. The model understands meaning, code checks words, so "Polo brand shirts" after "running shoes under $120" no longer keeps the $120 limit. Words that only name the change's own brand, color or size don't count, so "What about Columbia?" stays a refinement.
- **"Cheaper" is code's job:** the price becomes just under the cheapest card on screen, and the cards already shown are hidden. Because that is drastic, the model's "cheaper" box only counts when cards are on screen, the message isn't a new search, the shopper typed no price the model put in the form, and the message has a price word (cheaper, less, budget, expensive...). Otherwise it is set aside with a DEBUG line saying why. The local model once marked "Under Armour shoes under $120" as cheaper, which capped the price at $12.17.
- **A sort needs an order word.** A sort reorders every card and the saved slip keeps it, so the model's sort only counts when the message has a word for that order (cheapest, priciest, best rated, or just "sort"). The local model once added "lowest price first" to "Under Armour shoes under $120", and it stuck to the next search.
- **A brand left in the words moves to the brand box.** "Can you show me only the Nike shoes" came back as text "Nike running shoes" with no brand, so later pages drifted to other brands. Code moves a brand the shopper typed into the brand box when the model kept it in the item words, it isn't after "not", "except", "other than" and the like, only one brand is named, and it is clear-cut: at least 5 products and 5 times more than titles of other brands using the word (Nike 995 to 32). Puma (129 to 52) and Polo stay with the model and the brand gate. Requiring the model's own words keeps everyday words that happen to be brands ("keen", "elope") out.
- **An "ask" that names an item searches instead.** The instructions say a message that names an item is never too vague, but the local model sometimes asks the shopper's own question back ("Are there any Under Armour shoes under $120?") while filling the search form. When the form names an item or brand, code searches with it.
- **The word-keeper** puts back any shopper word the model dropped ("gore-tex", "waterproof", "merino wool"). It can't remove words the model invents; temperature 0 on Offline is the defence there.
- **The brand gate** checks a brand against two tally sheets. Nike (brand of 995 products, a word in 32 other titles) filters. Polo (brand of 1 product, a word in 392 other titles) **asks first**: two buttons, and no search runs until one is clicked. The click skips the slip model, because the button already says what changes, and the choice is remembered for the chat. A name that isn't a catalog brand ("merino") goes back into the search words.
- **A size the rules can't read** ("petite") searches as a word instead of filtering everything out.
- **The saved slip lives in the browser.** It is sent back with each message along with the cards on screen, the last 6 turns and the brand choices. The server keeps nothing per chat, so memory can't grow and a restart loses nothing. Every id the browser sends is looked up again.

### The search (Points 8 to 11)

- **Filters run on each listing on its own, before merging.** Merging first could combine orange from one listing, Small from another and a price from a third into a product that doesn't exist.
- **Two rankers.** Words (BM25, k1 1.2, b 0.75): rare words count more, so "merrell" outweighs "shoes". Meaning (bge-small vectors): a dot product with every survivor. Words alone found 10 of 10 Merrell and Nike in testing but 1 of 10 for "keep my hands warm on the slopes", where meaning found 10.
- **RRF** combines them by position only (1/(60 + place) from each list), so a BM25 score and a cosine never have to be compared.
- **The meaning floor.** The meaning ranker scores every product that passed the filters, so without a limit, unrelated products would fill the free card slots when only a few really match. A product that matches none of the search words must reach a meaning score of 0.62 to stay; a product that matches any search word always stays. 0.62 sits between the measured scores of real matches (0.64 to 0.80) and unrelated products (0.42 to 0.60). `npm run floor-check` re-measures it on 31 searches: it removed 18 cards from 5 of them, all unrelated (a bag and a sock from "orange running shorts", a T-shirt from "Calvin Klein boxers"), and nothing that fit the request.
- **Cards** fold listings by store + exact title. No fuzzy matching ever: a wrongly merged record is a product that doesn't exist. 8 cards per page; the page size is one constant in one function (`cardsPerPage()`).
- **Load more** shows only when the search has more than the cards on screen (the search fetches one card beyond the page to know). It runs the same search again with every card on screen excluded, the same way "cheaper" excludes them, so there is no offset or page number to keep, and no chat model call. Re-running costs little: filtering all 39,834 listings takes a few milliseconds. It stops at 200 cards with a note to narrow the search, because the page sends every id on screen with each request.
- **Sorting** reorders the 40 most relevant cards, so "cheapest running shoes" stays about running shoes.

### The reply (Point 12)

The model gets the shopper's message, the slip and the cards as data, and returns `{ message, productIds }`. Code draws every card from the records. Then code checks the words:

- **Unknown product ids** are dropped; the rest get a highlight ring on their cards.
- **Every `$` amount** must be a price on a card or a price limit the shopper gave ("under $120"). Anything else, such as a sum the model worked out, replaces the reply with "Here's what I found."
- **On "Anything cheaper?"** the reply is told the cheapest price shown before, and that price is allowed too, so it can say "nothing under $23.89" honestly. A price it works out itself is still replaced.
- **The stock sentence** has a slot for the real listed size; a reply that leaves the slot empty is replaced too.
- **A failed reply** keeps the cards with "Here's what I found.", or "Nothing in the catalog matched this search..." when there are no cards.

### Chat providers

| Choice | SDK | Call | Notes |
|---|---|---|---|
| Claude | `@anthropic-ai/sdk` 1.3.0 | Messages API, `output_config.format` | Thinking can't be turned off on Claude Opus 5.5, so effort is set: `low` for the slip, `medium` for the reply. Server-side refusal fallback on: `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`. No temperature (Opus 5.5 rejects it) |
| OpenAI | `openai` 7.43.0 | Responses API, `text.format` | No temperature (the model rejects it) |
| Offline | the same `openai` SDK | Ollama's `/v1/responses` | Temperature 0: at its default temperature the 7B model drifted |

OpenAI and Offline share one adapter: same SDK and call, different base URL and model. Keys and base URLs are passed to the SDKs explicitly, so they never look for keys, tokens or profiles elsewhere. A failed slip (refusal, cut-off, invalid JSON, timeout) runs search-only for that message. A new message aborts the old request, all the way to the provider call.

### The embedder: bge-small, sealed (Points 2 and 5)

- **The model:** `bge-small-en-v1.5`, quantized ONNX, 34 MB, in `vendor/` with its hashes. It turns a text into 384 numbers. It scored 89 of 120 on twelve test searches combined with words, against 88 for the three-times-slower bge-base.
- **The engine:** Microsoft's ONNX Runtime, WebAssembly build 1.30.0, in `vendor/onnxruntime/`. Not the native `onnxruntime-node` (telemetry, extra DLLs), and not Hugging Face's `transformers.js` (in Node it loads the native engine and `sharp`, and fetches models from huggingface.co by default).
- **Our own tokenizer**, about 90 lines; it matched Hugging Face's on 3,011 of 3,011 test texts.
- **Sealed.** The server needs the network to reach Claude and OpenAI; the embedder doesn't, so it runs as a separate Node process inside Node's permission sandbox. It can read only its own code and the two vendor folders, write nothing, start nothing, load no native code and turn no text into code. Three guards, loaded before its own code, close what the sandbox doesn't (network, DNS, listening, reaching other processes, `vm`, V8 flags). The test runs 20 escape attempts from inside the same sandbox: all 20 are refused, and two local listeners hear nothing.
- **Speed:** a shopper sentence takes about 11 ms. Building all vectors takes about 30 minutes with 8 sealed processes.
- **Same-model rule:** `data/manifest.json` records the SHA-256 of the model file and of `data/products.json`. The server refuses vectors on any mismatch and runs on filters and words, with an ERROR log. The embedder restarts once after a crash; after a second crash, search runs on words.
- **Memory:** about 450 MB with everything loaded (server 257 MB, embedder 192 MB).

### Logging and the debug panel

One logger, the only file that calls `console`; it wraps console instead of replacing it, so library logs stay untouched. Levels follow log4j (`TRACE < DEBUG < INFO < WARN < ERROR`, plus `OFF`). Every entry carries the time, level, pipeline step, chat message id and data, with keys masked. Each message's story reads in order at DEBUG: the shopper's words, the slip the model filled, the merge, the gate, the rankers, the cards (with product ids, the records are in `data/products.json`) and the reply. The full prompts sent to the model go to TRACE only. With `DEBUG_PANEL=true`, the last 500 entries are kept for the panel, `/api/debug/logs` exists, and the page shows a "Logs" button. The window polls about once a second while open and stops when it closes. "Copy all" (and "Copy" on each message) copies plain lines, oldest message first, ready to paste into a chat or an issue. **Export** opens a window with choices and a live preview: leave out the time, level, source or step of each line; indent the data or keep it on one line; pick levels; drop "Load more" messages; and for each kind of log line ("P11 cards", "P6 slip response"), leave it out or keep only some of its data fields, such as a card without `twins`. The kinds and fields come from the logs themselves. Copy or download the result as `November_8_18_43.log`; the file's header lists what was left out, and the choices are remembered in the browser.

### The web page

Frosted glass (a web approximation using `backdrop-filter`, not Apple's own Liquid Glass), light (#F9F9F9, sky blue #0095EC) and dark (#010000, amber #EC9500) themes that follow the system or a manual switch (a button with an icon and its name: a half circle for Auto, a sun, a moon; icon only on a phone), and popups that grow from what opened them. The product sheet grows out of its card; the logs window grows out of its button. A slip summary under "N products" shows what the search used, and "New search" starts over. The grid uses 4 columns, or 2 when narrow, so a page of 8 always fills its rows: a half-empty row means the search really has no more. The header logo has one version per theme (`web/assets/`): two bags in the theme's accent color with the Kinetic bolt cut out. The tab icon (`web/assets/favicon/favicon.svg`) is a cart that turns dark or light with the browser's own theme; browsers without SVG tab icons get a 32 px PNG per theme. Reduced motion keeps fades and drops movement.

---

## The API

| Route | What it does |
|---|---|
| `GET /api/config` | Providers set up (id, label, model; never a key), whether the debug panel is on, whether meaning search is running |
| `POST /api/chat` | `{ message, providerId, state }` -> the reply, the cards (or `null` to leave them), a brand question if any, a note if any, and the new `state` |
| `POST /api/brand-choice` | `{ choice: "brand" \| "word", providerId, state }` -> same shape |
| `POST /api/more` | `{ state }` -> the next cards for the search on screen (kind `more`: add them below), `hasMore`, and the new `state`. No chat model |
| `GET /api/debug/logs?after=N` | Log entries newer than N. Only exists with `DEBUG_PANEL=true` |

---

## The data files

| File | Size | What it holds |
|---|---|---|
| `data/products.json` | 61.7 MB | One trimmed record per listing, in catalog order. Row *i* here is row *i* in the vectors |
| `data/brands.json` | 0.2 MB | Sheet A, `brandCounts`: brand name to product count. Sheet B, `otherTitleCounts`: one-word brand to how many other brands' titles use the word |
| `data/vectors.bin` | 61 MB | 39,834 rows of 384 float32 numbers, no header |
| `data/manifest.json` | tiny | Model and products fingerprints, row count, dimension |

A trimmed record keeps: id (`parent_asin`), title, brand, store, category path, price, rating, rating count, the raw color and size text, the mapped color family, size group and gender, material, features, a 600-character description excerpt, the first large image URL, and the card group key.

---

## Handling catalog updates

Today the whole catalog is loaded into memory at start. Updates would work like this:

- **New products** go through the same cleaning and embedding and are appended as new rows.
- **An edit** replaces its row and re-embeds that one product.
- **A delete** marks the row as removed instead of shifting the rows after it, so every vector stays next to its product.
- **At millions of products**, move to a database with vector search and a real search index. Today a restart reloads everything into memory.

---

## Known limits

- **Prices are synthetic**, and twins can differ wildly (up to 20.55 times inside one card).
- **No stock data**, and other sizes and colors are unknown.
- **Nike's sub-brands are missed.** An exact Nike filter misses its 32 sub-brand listings (Jordan 28, Nike Golf 4). That follows from the no-fuzzy rule.
- **Near-duplicate titles stay separate:** about 1,100 listings whose titles differ slightly.
- **Unmapped colors and sizes:** about 19% of colors and 25% of sizes don't map, so those records fail a color or size filter.
- **Unknown gender:** 11.4% of records have no gender anywhere, so they fail a gender filter.
- **Number sizes are just numbers:** "10" from a men's shoe and "10" from a kids' shoe are the same group.
- **The meaning floor is a tuned number.** 0.62 comes from a small sample (7 searches, then checked on 31). A vague request could have a real match just under it, and one product can sit right on the line (the one Polo-brand boot scores 0.621 for "shirts").
- **The new-topic check compares words, not meaning.** A synonym ("trainers" after "running shoes") counts as a new topic and drops the earlier price or size. The slip summary on the page shows what was kept.
- **The local model's weak spots** (qwen2.5:7b):
  - It doesn't fix typos ("hikng" stays "hikng").
  - It ignored "any price is fine", so the price limit stays.
  - It sometimes leaves a follow-up size empty, though the word-keeper keeps "9.5" in the search words.
  - It sometimes misses a brand (North Face, Fox Racing), which then stays as a search word, so nothing false appears.
  - It rarely marks a change of topic as a new search. Code's new-topic check now catches that; "New search" on the page starts over by hand.
  - It sometimes adds the stock sentence when nobody asked, and sometimes adds a gender from the titles on screen ("Men's").
  - Claude and OpenAI probably do better, but that is untested.
- **Batch-sensitive vectors:** the quantized model scales numbers per batch, so the same product embedded with different neighbours differs very slightly (cosine about 0.998).
- **Load more with a sort:** the next page comes from the 40 most relevant cards not yet shown, re-sorted, so it is "the next cheapest of what's relevant", not a strict continuation of one sorted list.
- **Invented words can't be removed:** the word-keeper only puts words back. Temperature 0 is the defence.

---

## Unfinished work

- **Tuning for accuracy** is left for later, on purpose: the meaning floor (0.62), the RRF constant (60), the sort pool (40) and the color and size word lists are each one constant or one list in one file, with `npm run floor-check`, `npm run search-check` and `npm run slip-test` to measure a change. A larger set of judged searches would make those numbers firmer.
- **The new-topic check could compare meaning** (the shopper vectors are already there) instead of words, so synonyms stop counting as a new topic.
- **Claude and OpenAI are untested:** the adapters are built, but there were no keys. Run `npm run slip-test -- --provider=claude` once a key is in `.env`.
- **Serving the built page from the API server** isn't built; use `npm run dev`.
- Time spent: *(to be filled in)*

---

## Project layout

```text
server/
  config/      config.ts: the only place that reads settings
  logging/     logger, levels, ring buffer, secret masking
  data/        project-paths.ts and data-service.ts: every file read and write
  catalog/     cleaning rules (brand, color, size, gender, text), brand sheets, catalog store, word index, BM25
  embedder/    sandbox flags, child launcher, embedder service (restart once), IPC messages, vector manifest
    child/     the sealed process: entry, sandbox check, engine, tokenizer, vendor file reads, guards
  search/      filters, meaning rank, RRF, meaning floor, card merge, orders, the pipeline, the search engine
  slip/        the slip types and form, prompt, merge, new-topic check, word-keeper, shared word rules, brand gate, fill-slip
  chat/        providers (Claude, OpenAI-compatible), reply form, input and checks, conversation state, card views, chat service
  http/        routes, JSON in and out, the server
  main.ts      start and stop
tools/         install-deps, dev, clean-catalog, embed-catalog, search-check, slip-test, floor-check, split-products.cjs
tests/         node:test files, helpers, and the escape probe that runs inside the sandbox
web/           the React page: api, state, components (header, chat, results, sheet, debug), motion, styles
data/          products.json, brands.json, vectors.bin, manifest.json
vendor/        bge-small-en-v1.5 and onnxruntime (pinned, hashed)
docs/          flow-chart docs, one per feature
```
