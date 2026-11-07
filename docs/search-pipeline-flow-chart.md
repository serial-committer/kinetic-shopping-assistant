# Search pipeline: flow chart

**In one line:** exact filters decide which listings may appear, two rankers decide the order, and repeats fold into cards.

Think of a bookshop. First the clerk pulls every book that fits the hard rules: the right shelf, under the price limit, the right language (filters). Then two staff each line the pile up in their own order: one by matching words in the title, one by what the book is about (rankers). A judge gives points for places in both lines and makes one final line (RRF). Finally, copies of the same book from the same publisher go into one stack with all their prices on the label (cards).

```text
Fig A: one search

  slip  text "running shorts", color orange, size small                (from Point 7)
    |
    v
  Point 8   filters.ts         39,834 listings -> 32 survivors           ~2 ms
            every listing checked ON ITS OWN: brand, color family, size group, gender, price, excluded cards
    |
    v
  Point 9   bm25.ts            words: rows matching "running" or "shorts", rare words worth more     5 rows
            rank-by-meaning.ts meaning: shopper vector . product vector, for ALL 32 survivors         32 rows
    |
    v
  Point 10  combine-rrf.ts     each list gives 1/(60 + place); totals add; only places count
    |
    v
  Point 11  merge-cards.ts     same store + exact title -> one card; ordered by best listing; 8 cards
            headline = only listings that passed, as a price or a range; twins get a warning
```

## Example: why filters run before merging

```text
Fig B: three listings of one product, shopper wants orange, size Small, under $30

listing   color    size    price     passes?
1         orange   M       $25       no (size)
2         blue     S       $22       no (color)
3         orange   S       $45       no (price)

Filter first (what the app does):  0 survivors, no card. Correct: no listing is all three.
Merge first (what it must never do): the card "has" orange, Small and $22 to $45 -> a product that doesn't exist.
```

## Example: RRF points

```text
Fig C: two lists, three products

words list:    A (place 1), B (place 2), C (place 3)
meaning list:  C (place 1), A (place 2)

A = 1/61 + 1/62 = 0.03252     first
C = 1/63 + 1/61 = 0.03227     second
B = 1/62        = 0.01613     third   (on one list only, still in the running)
```

## Orders that aren't relevance

| Case | Order |
|---|---|
| No search text ("anything under $20") | Best rating, then most ratings |
| The shopper asked for a sort | The 40 most relevant cards, re-sorted by price or rating, then the first 8. Without the 40-card pool, "cheapest running shoes" would jump to the cheapest item in the shop |

## When parts are missing

| Missing | What the search does |
|---|---|
| `vectors.bin` or `manifest.json` | Filters + words (ERROR at start) |
| The manifest doesn't match the model or `products.json` | Filters + words (ERROR at start) |
| The embedder crashed once | It restarts. Twice: filters + words (ERROR) |
| One shopper sentence fails to embed or takes over 5 s | That search uses words (WARN) |

## Where to change things

| To change | Edit |
|---|---|
| Filter rules | `server/search/filters.ts` |
| BM25 settings (k1 1.2, b 0.75) | `server/catalog/bm25.ts` |
| RRF constant (60) | `server/search/combine-rrf.ts` |
| Cards per answer (8), paging | `cardsPerPage()` in `server/search/merge-cards.ts` |
| The sort pool (40) | `server/search/search-pipeline.ts` |
| Rating order, sorts | `server/search/order-results.ts` |

Run `npm run search-check` after a change: it prints the brief's examples with timings.
