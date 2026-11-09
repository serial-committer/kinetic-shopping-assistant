# HANDOFF: Kinetic Shopping Assistant

Read this first when resuming, then README.md for the full decision list and TEST-PLAN.md for what is verified. The design source of truth is the workspace-only `design/KICKOFF-PROMPT.md` (never synced, never shipped); `design/reference/*.mjs` holds the final-decision code that was ported.

## Status

| Chunk | What | State |
|---|---|---|
| 1 | Skeleton: package.json, .npmrc, .gitattributes, .env.example, config, logger, data service, install-deps | done |
| 2 | Cleaning tool, stats match the full catalog | done |
| 3 | Sealed embedder child, escape probes as a test, embed tool, full vectors | done |
| 4 | Search core, catalog store, manifest check, embedder service (restart once), search-check tool | done |
| 5 | Slip form, prompt, merge, keep words, brand gate, Claude + OpenAI-compatible adapters, chat service, HTTP API, slip-test tool | done |
| 6 | Reply step and checks (ids, prices incl. slip limits, stock slot) | done |
| 7 | Web page: chat, cards, sheet, brand buttons, slip summary, New search, debug panel, themes | done, verified in the browser |
| 8 | Docs and tests | done (54 tests); walkthrough and assessment for Kapil still to come |

**Decided 2026-11-08 (Kapil):**
- **Meaning floor 0.62** (`server/search/meaning-floor.ts`): a product that matches no search word needs a cosine of 0.62 to stay. `npm run floor-check` on 31 searches removed 18 cards, all unrelated, none that fit. His framing: the exercise is about architecture and implementation quality; accuracy tuning is a later task, so keep every tunable number one constant with a tool to measure it.
- **New-topic check, model plus code** (`server/slip/new-topic.ts`, used by `merge-slip.ts`): the model's `newSearch`, or code when the change's search words share none with the saved ones (brand, color and size words of the change don't count). His words: one works with possibility, the other with plausibility. Slip-test follow-ups unchanged at 11 of 13.
- Follow-on fix: a "cheaper" turn tells the reply the cheapest price shown before (allowed by the price check), and a replaced reply with no cards says "Nothing in the catalog matched...".

**Data:** rebuilt 2026-11-08 after the symbol-only junk rule (26.1 minutes); the manifest matches `data/products.json`. Sync `data/products.json`, `data/brands.json`, `data/vectors.bin` and `data/manifest.json` together, never one without the others.

## Run facts

- Node 22.21.1 runs `.ts` directly (type stripping). Imports carry `.ts`; no enums or parameter properties (`erasableSyntaxOnly`). `npm run typecheck` runs TypeScript 7.0.2 (native) on both `tsconfig.json` and `web/tsconfig.json`.
- Packages live in `D:/Common Lib/node modules/kinetic-shopping-assistant` via `npm run deps`; `node_modules` is a junction. Never plain `npm install`. A new lock is made with `--prefer-online --before=<today - 14 days>`.
- Workspace `.env`: `OLLAMA_MODEL=kinetic:thinker` (his renamed `qwen2.5:7b`), `LOG_LEVEL=DEBUG`, `DEBUG_PANEL=true`. Never sync `.env`.
- Kapil's Windows user environment has `OPENAI_API_KEY` set. Keys are `.env`-only by design, so it is ignored. Never call OpenAI or Claude without his say-so: there are no keys in `.env` and each call costs money.
- Preview: `kinetic-shopping-dev` (npm run dev) and `kinetic-shopping-api` are in `D:/Claude Office/.claude/launch.json`.
- Offline slip about 3.3 s (middle), a full message 5 to 11 s on the 7B model.

## Decisions taken during the build (not in the kickoff prompt)

- Product id = `parent_asin`. `material` kept, `details` dropped, description excerpt 600 chars, image = `images[0].large`.
- Values made only of symbols (`\`, `/`, `...`, a star) count as missing, like "nan" (7 values in the catalog).
- Point 12's price check allows card prices plus the slip's minPrice/maxPrice; computed amounts fail. The stock sentence has a `<listed size>` slot (models copied the example "Small"); an unfilled slot fails the check.
- Brand ask-first: no search until a button click; the choice is remembered in `state.brandChoices`. A click skips the slip model; Point 12 still runs.
- The saved slip, cards on screen (`screenIds`), cheaper exclusions, last 6 turns, brand choices and a pending brand all live in the browser (`ConversationState`); the server re-reads every id.
- Cheaper exclusions reset on a new search or a new or cleared max price.
- A failed reply keeps the cards with "Here's what I found."; only a failed slip drops to search-only.
- Unknown gender fails a gender filter. Shopper sizes use `shopperSizeGroupOf`; an unreadable size searches as a word.
- API keys come from `.env` only; other settings may be overridden by the environment.
- Nullable slip boxes use `anyOf` with null (Claude's documented subset); the Offline baseline held (11 of 13 follow-ups).
- A sort reorders the 40 most relevant cards, not every survivor.
- "New search" in the page clears chat, cards and slip (client-side).
- UI logs stay in the browser and merge in the panel. One `npm run dev` starts both ports.
- Guards ported to TypeScript from `kinetic-markdown/security/*.mjs` (same logic, tags renamed, unused counters dropped). The child gets the vendor folders as arguments and has its own `package.json` (`"type": "module"`).
- Claude: effort `low` for the slip and `medium` for the reply, `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`, no temperature, `maxRetries: 1`, timeouts 30 s / 60 s. Offline: temperature 0, 120 s, no retries.
- No icon library: text labels and typographic glyphs (★, the select chevron from borders) instead of hand-drawn SVG icons.

## Facts measured during the build

- Section 3's 10,352 / 3,958 / 69.7% were sample numbers; full catalog 12,800 / 6,034 / 73.1%. Twins: 172 sets on 167 cards; 20.55 is the largest ratio inside a card.
- Full vector build: 30.1 minutes, 22.1 a second, 61,185,024 bytes.
- Start: products 330 ms, word index 205 ms (30,576 words), vectors checked 145 ms, embedder 316 ms. Memory: server 257 MB + embedder 192 MB.
- Search: filter 1 to 8 ms, whole search 10 to 85 ms. Shopper sentence 11 to 14 ms.
- Vectors are batch-sensitive (cosine about 0.998 between batchings), in the reference engine too.

## Gotchas

- **Vite's watcher can miss a quick edit** and keep serving the old module, even after a reload. Check with `curl -s http://localhost:9519/src/<file> | grep <new code>` and `touch` the file.
- `--allow-fs-read` of a folder that doesn't exist at start is granted by name only. All granted folders exist in the repo.
- On Windows a spawned child always gets about 10 basic environment variables even with `env: {}`.
- `readVectors` copies when the buffer is unaligned.
- Lightning CSS (Vite 8) drops `backdrop-filter` when a `-webkit-` copy with `var()` sits beside it: write only the standard property.
- A blur next to scrolling content re-renders every frame: the chat panel uses `saturate()` only.
- The page's `::backdrop` fades, not the dialog's parent, so the dialog's blur survives.

## Chunk log

- **2026-11-08, chunks 1 to 3.** Skeleton, cleaning, sealed embedder, vectors. Synced by Kapil.
- **2026-11-08, chunks 4 to 7.** Search core, slip, providers, reply checks, HTTP API, web page, debug panel. Verified: 54 tests, slip test on Offline, the brief's conversations through the API and in the browser (dark, light, narrow, wide). Walkthrough and assessment deferred to the end by Kapil.
- **2026-11-08, decisions round.** Meaning floor, new-topic check, cheaper reply price, no-match sentence, `npm run floor-check`, data rebuilt. 58 tests.
- **2026-11-08, Kapil's regression round 1.** Load more (`POST /api/more`, `handleLoadMore`: same search with the cards on screen excluded, `hasMore` from one extra card, no chat model; `ConversationState.screenSlip` remembers which slip produced the cards, so search-only turns load more correctly). Grid of 4 or 2 columns (container query) so 8 always fills rows. Logs: shopper message at INFO, compact DEBUG with product ids, full prompts at TRACE, "Copy all" as plain lines oldest first. Favicons (7 PNG sizes, `24z24.png` renamed to `24x24.png` at his request) and per-theme header logo from `web/assets/`, uppercase title. 60 tests. His app was running on 9500/9519, so my preview used 9600/9619 (`kinetic-shopping-dev-alt-ports` in the workspace launch.json; env overrides work for every setting except keys).
- **2026-11-08, assets.** Logos redrawn on his geometry (his originals had 3 of 4 invalid hex fills): back bag deeper, front bag brighter, gap and sparkle cut out with masks so any background shows through. Originals in `D:/Claude Office/Kinetic Shopping Assistant archive/`. Favicon: `favicon.svg`, a vector copy of his cart that switches #010000 / #F9F9F9 with `prefers-color-scheme` (the browser's theme, not the page's switch); his PNG sets (`favicon/` dark, `favicon/light/`) stay as the 32 px fallback per theme, and the touch icon uses the light 128 (iOS fills transparency with black). Headless Chrome 156 fetches only the SVG. The other PNG sizes stay in the folder, unused. `.env.example` keeps `OLLAMA_BASE_URL` commented (Kapil reverted his twin edit).
- **2026-11-08, Kapil's regression round 2** (his log `logs/November_8_18_43.log`, git-ignored by `*.log`). Logo: the sparkle read as a plus sign (health store), so it is now the Kinetic bolt (Kinetic Journal's `BOLT_POINTS`, scaled 3.5x). Found in his log: (1) Load more past 200 cards repeated the same 8, because `readConversationState` keeps only 200 ids; now it stops with `SCREEN_FULL_NOTE`. (2) "Under Armour shoes under $120" came back with `cheaperThanShown` true, so the cap became $12.17; `server/slip/cheaper-check.ts` now needs cards on screen, no new search, no typed price and a price word. (3) The model answered "There are no Under Armour shoes at all?" with an ask that repeats the question while filling the form; an ask that names an item now searches. Also seen, not fixed (offered to Kapil): a sort `price_low` nobody asked for, which then stuck to the saved slip; gender "men" from nowhere; "only the Nike shoes" left Nike in the words, so later Load more pages drifted to other brands. Reply sizes and prices in his log were all real. Export (`export-log.ts`, `ExportDialog.tsx`): line parts, data indented or one line, levels, headings, Load more messages, and per-kind fields read from the data; file named like his. Phone width: the page was 545 px at 375 because the page grid's `1fr` grew to fit content; now `minmax(0, 1fr)`. 67 tests.
- **2026-11-08, round 2 follow-up (Kapil: "Add both checks").** `server/slip/sort-check.ts`: a sort counts only with an order word in the message (dropped in the merge, saved sort stays). `server/slip/named-brand.ts`: a brand the model left in its text moves to the brand box when typed by the shopper, not negated, the only one, and clear-cut (5+ products, 5x the other-brand titles; a remembered button choice wins). Bar measured on `data/brands.json`: 852 one-word brands pass, a few are everyday words (keen, elope, habit, stance), which the model-text rule keeps out. 71 tests.
- **2026-11-09, two UI touches (Kapil).** The "Products the assistant finds..." note had `max-width: 52ch` (a reading-width habit), so it wrapped into two lines on a wide screen; it now fills the column, with `text-wrap: pretty`. The theme button had only the word "Auto", which doesn't say what it switches; it now has an icon per choice (`web/src/components/header/ThemeIcon.tsx`), a tooltip naming the next choice, one width for all three, and icon only on a phone. Gotcha: `base.css` loads after `header.css`, so a `.theme-button` rule loses to `.pill-button`; the header rules use `.header-controls .theme-button`.
