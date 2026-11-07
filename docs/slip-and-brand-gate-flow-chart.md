# The slip and the brand gate: flow chart

**In one line:** the chat model only fills in a fixed search form (the slip); code merges it, puts back any words the model dropped, and decides what a brand may do.

Think of a waiter taking an order on a printed order pad. The waiter (the chat model) understands "something light, no onions, and the cheaper wine", but can only tick the boxes the pad has. The kitchen (code) cooks exactly what the ticked boxes say. The waiter can't invent a dish, because there's no box for one.

```text
Fig A: one shopper message

  Shopper: "show me red Adidas trainers for trail running under $60"
     |
     v
  Point 6   fill-slip.ts           the chat model answers ONLY with this form (structured output)
            { action: "search", question: null,
              change: { brand: "Adidas", color: "red", maxPrice: 60, text: "trainers for trail running", ... } }
     |
     |-- action "ask"    -> show the question (or the fixed one if it's empty); slip unchanged; no search
     |-- action "answer" -> skip the search; Point 12 answers from the full records of the cards on screen
     v
  Point 7a  merge-slip.ts          the change goes into the saved slip
            newSearch -> start empty | clear -> empty those boxes | null or "" -> keep | unisex -> no preference
            cheaperThanShown (with cards on screen) -> code sets maxPrice just under the cheapest card
                                                       and hides the cards already shown
     v
  Point 7b  keep-words.ts          shopper words in no box, and not filler, go back into text
     v
  Point 7c  brand-gate.ts          what may the brand do?
            not a catalog brand ............ back into text       ("merino", "Ordinary")
            used more as a word elsewhere .. ASK FIRST, no search ("Polo": brand of 1, a word in 392 titles)
            otherwise ...................... filter                ("Nike": brand of 995, a word in 32 titles)
     v
  Points 8 to 12: the search and the reply (see search-pipeline-flow-chart.md)
```

## Example: follow-ups build on the saved slip

```text
Fig B: three messages, one slip

                                 text              color   size    maxPrice  excluded cards
"orange running shorts, small"   running shorts    orange  small   -         -
"Anything cheaper?"              running shorts    orange  small   23.88     the 5 on screen
"Only show blue ones"            running shorts    blue    small   23.88     the 5 on screen
```

"Anything cheaper?" came back from the model as just `{ cheaperThanShown: true }`. That is why the model sends a *change* and code merges it: the color and size survive because the model never has to repeat them.

## Example: the brand gate asks first

```text
Fig C: "Polo brand shirts"

Point 1  slip            brand "Polo", text "shirts"
Point 2  gate            polo: 1 product as a brand, 392 other titles use the word -> ask
Point 3  screen          "Did you mean Polo, the brand, or "polo" as a word?"
                         [Polo, the brand (1 product)]   [polo as a word (392 products)]
                         the cards on screen stay as they are; no search has run
Point 4  button          the browser sends only the choice. The slip model is skipped, the search runs,
                         Point 12 still writes the reply. The choice is remembered for the rest of the chat.
```

## When the model isn't available

| Situation | What happens |
|---|---|
| No provider in `.env` | Search-only mode: the whole sentence is the search text, no filters, plus a note pointing to the README |
| The slip fails (refusal, cut-off, invalid JSON, timeout) | Search-only for that message, WARN log; the saved slip is kept |
| A box breaks the schema | That box is dropped and stays as it was, WARN log |
| A size the rules can't read ("petite") | It searches as a word instead of filtering everything out |

## Where to change things

| To change | Edit |
|---|---|
| The model's instructions | `server/slip/slip-prompt.ts` (then run `npm run slip-test`) |
| The form's boxes | `server/slip/slip-form.ts` and `server/slip/slip-types.ts` |
| Merge rules | `server/slip/merge-slip.ts` |
| Filler words | `server/slip/keep-words.ts` |
| When a brand asks first | `server/slip/brand-gate.ts` |
| Fixed sentences | `server/chat/chat-wording.ts` |
| The order of the steps | `server/chat/chat-service.ts` |
