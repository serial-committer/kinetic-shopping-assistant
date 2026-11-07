# Catalog cleaning: flow chart

**In one line:** `npm run clean-catalog` reads the raw catalog once and writes two small files the server loads at start: the trimmed products and the brand tally sheets.

Think of it like a librarian receiving 39,834 donated books with handwritten labels. Before anything goes on a shelf, each book gets a clean index card: one spelling for its color, one for its size, who it's for, and which shelf group it belongs to. The handwritten label stays on the card too, so nothing is lost.

```text
Fig A: one run of the cleaning tool

  catalog/products.json  (157 MB, 39,834 raw records)
          |
          v
  Point 1  data-service.readRawCatalog()          one JSON.parse, about 0.8 s
          |
          v
  Point 2  clean-product.toProduct(record)        for every record, in catalog order
          |     brand-rules   pickBrand: brand > details "Brand Name" > details "Brand" > store
          |     color-rules   colorFamilyOf: free text -> one of 14 families, or null
          |     size-rules    sizeGroupOf: free text -> S / XL / 9.5 / ONE SIZE, or null
          |     gender-rules  genderOf: category path > department > title, or unknown
          |     record-text   categoryPathOf, groupKeyOf (store + exact title)
          v
  Point 3  brand-sheets.buildBrandSheets(products)
          |     Sheet A: brand -> how many products carry it
          |     Sheet B: one-word brand -> how many OTHER brands' titles use that word
          v
  Point 4  data-service.writeProducts / writeBrandSheets   (written to *.partial, then renamed)
          |
          v
  Point 5  catalog-stats.measureCatalog   prints every measurement next to its expected value
```

## Example: one record, before and after

```text
Fig B: what Point 2 does to one listing

RAW                                         CLEANED
title    "Vanlison Large Sling Bag ...     title        same text
          for Men Women"
brand    "Vanlison"                         brand        "Vanlison"           (Point 2, brand-rules)
color    "Dark Green"                       colorText    "Dark Green"         (kept as written)
                                            colorFamily  "green"              (color-rules: /green/)
size     "Large"                            sizeText     "Large"
                                            sizeGroup    "L"                  (size-rules: letter size)
department "nan"                            gender       "men"                (title says "Men" first)
categories ["Clothing, Shoes & Jewelry",    categoryPath "Luggage & Travel Gear > Backpacks
            "Luggage & Travel Gear", ...]                 > Casual Daypacks"  (root dropped)
store    "Vanlison"                         groupKey     "vanlison|vanlison large sling bag ..."
```

## Example: why Sheet B exists

```text
Fig C: Polo against Nike

          Sheet A (own products)   Sheet B (other brands' titles)   reading
nike      995                      32                                mostly a brand
polo      1                        392                               mostly a word ("polo shirt")
```

The brand gate (a later chunk) uses these two numbers to decide whether "Polo" filters by brand or gets a question first.

## Where to change things

| To change | Edit |
|---|---|
| Which values count as missing ("nan", "unknown") | `server/catalog/clean-value.ts` |
| The brand fallback order | `server/catalog/brand-rules.ts` |
| A color family's words | `server/catalog/color-rules.ts` |
| How a size becomes a group | `server/catalog/size-rules.ts` |
| Where gender comes from | `server/catalog/gender-rules.ts` |
| What goes into a trimmed record, description length | `server/catalog/clean-product.ts` |
| The expected numbers in the report | `tools/lib/catalog-stats.ts` |

After any change, run `npm run clean-catalog` and read the report. Changing `data/products.json` changes its fingerprint, so the vectors must be rebuilt too (`npm run embed-catalog`), or the server will refuse them.
