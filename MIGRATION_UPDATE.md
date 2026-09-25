# Content Pipeline — Current State

> This is the authoritative record. `MIGRATION_SUMMARY.md` documents the original
> first pass and is kept for history only.

## Source

- **Live origin** `jainsamaj.world` returns **403** to this pipeline.
- **Working mirror** `https://nikkyjain.github.io/` is used for every fetch.
- Cached filenames are **flattened**: `_jainDataBase/bhajans/01_देव/html/अंतर.html`
  lands in `tools/scrape/cache/` as `._jainDataBase_bhajans_01_देव_html_अंतर.html`.
  Every cache lookup must resolve through that flattened key — getting this wrong
  is what made an earlier build report the whole catalogue as missing.

## Pipeline

Order matters. `content/granth.json` is owned by `05-expand-granth.js`, so it must
run **after** `03-build.js` and **before** `04-split.js`:

| # | Script | Purpose |
|---|--------|---------|
| 1 | `01-build-index.js` | Build `index.json` from the mirror's master list; assign each URL one category + a subcategory label |
| 2 | `02-fetch.js` | Download any missing pages into the cache (throttled, retried) |
| 3 | `03-build.js` | Parse cached HTML → `content/*.json`; merge `curated.json`; write `content_backup/` |
| 4 | `05-expand-granth.js` | Expand granth chapters → `content/granth.json` (+ backup) |
| 5 | `04-split.js` | Move `hCont` out of the manifests into `content/text/<cat>/<cref>.json` |

Hand-authored items live in `tools/scrape/curated.json` and are merged back in at
step 3, so a rebuild never loses them.

## Category mapping

`categorize(rel)` in `01-build-index.js` assigns exactly one category; first match
wins. Keyword promotion applies **only** to `poojas/` and `bhajans/`, so granth
folders (`teeka/`, `gatha/`, `egranth/`, `shastra/`) are never stolen by a title
such as "…स्तोत्र-टीका".

| Rule | Category | Subcategory label |
|------|----------|-------------------|
| `teeka/`, `gatha/`, `egranth/`, `shastra/` | granth | source folder |
| `misc/` | misc | सन्दर्भ-तालिका |
| title contains चालीसा | chalisa | चालीसा |
| `poojas/11_आरती/` | aarti | आरती (पूजा-क्रम) |
| title contains आरती | aarti | आरती (भजन) |
| `poojas/08_स्तोत्र/` | stotra | स्तोत्र (पूजा-क्रम) |
| `bhajans/21_स्तोत्र/` | stotra | स्तोत्र (भजन) |
| title contains भक्ति / वंदना / वन्दना / कीर्तन | bhakti | भक्ति-वंदना |
| `poojas/06_पाठ/` | stuti | पाठ |
| `poojas/07_छहढाला/` | stuti | छहढाला |
| any other `bhajans/…` | bhajan | source folder |
| any other `poojas/…` | pooja | source folder |

## Dataset

- **Total items**: 1,671
- **Readable items**: 1,643 (98.3%)
- **Categories**: 9
- **Lazy text files**: 1,643 (~88 MB under `content/text/`)

| Category | Hindi label | Items | Readable | Subcategories |
|----------|-------------|-------|----------|---------------|
| pooja | पूजा | 105 | 105 | 5 |
| bhajan | भजन | 1,333 | 1,318 | 28 |
| granth | ग्रन्थ | 135 | 127 | 3 |
| stotra | स्तोत्र | 18 | 18 | 1 |
| aarti | आरती | 11 | 10 | 2 |
| chalisa | चालीसा | 3 | 3 | 1 |
| stuti | स्तुति | 37 | 37 | 2 |
| bhakti | भक्ति | 12 | 12 | 2 |
| misc | सन्दर्भ | 17 | 13 | 1 |

## What changed in the repair pass

1. **Category mapping is now source-faithful.** `poojas/06_पाठ`, `poojas/07_छहढाला`,
   `poojas/08_स्तोत्र`, `poojas/11_आरती` and every चालीसा title were all being dumped
   into `pooja`. They are now promoted to their real categories — stuti (37),
   stotra (18), aarti (10), chalisa (3), bhakti (12). `pooja` drops from 167 to
   105 items, but nothing was lost: those items moved, and the readable total went
   *up* because the promoted pages were parsed properly this time.
2. **`stotra` is no longer empty** — 0 readable → 18/18, with real स्तोत्र text
   (भक्तामर, स्वयंभू, अकलंक, मंदालसा, …).
3. **`katha` is retired.** The source has no katha section; its 35 entries were
   content-free placeholders. Removed from `categories.json`, `service-worker.js`
   and the tests. No `content/katha.json` or `content/text/katha/` remains.
4. **`granth` expanded** from 69 to 135 items (127 readable) across 3
   subcategories — टीका (62), गाथा (62), अंग्रेज़ी ग्रन्थ (11).
5. **Subcategory labels** are carried on every item via `sub`, so the category
   view groups by them (e.g. आरती → "आरती (पूजा-क्रम)" + "आरती (भजन)").
6. **Service worker** bumped to `jinbhakt-v8`, precaching the 9 current manifests
   with no `katha` references.

## Tests

`node test/run.js` — **283 passing, 0 failing.**

Assertions that track the dataset were updated, and the brittle ones were made
data-driven rather than simply re-hardcoded:

- `run.js` — 9 accordions/cards; badges for aarti 10, bhakti 12, stotra 18,
  stuti 37, chalisa 3, pooja 105; 1,643 readable; aarti reader `1 / 10`;
  subcategory grouping; "every category has readable content" replaces the old
  "empty category" assertions (no category is empty any more).
- `part2.js` — search index covers 1,671 items; the "unavailable item" deep link
  now points at a genuinely pending title (`aarti/आरती_बाहुबली_भगवान`) instead of
  a `stotra` id that no longer exists, so it still exercises `renderUnavailable`
  rather than `renderNotFound`.
- `part3.js` — desktop nav 9 accordions, 10 aarti links, granth 3 subcategories.
- `part4.js` — 1,671 total / 1,643 readable.
- `part5.js` — the `MAX_RESULTS` cap is exercised with a broad query (`pooja`,
  134 hits) because `aarti` now returns only 18; the partial-match divider
  position is derived from `partialFrom` instead of a magic index.

## Notes

- 19 source URLs are genuine 404s on the mirror. Those items stay in the
  manifests as `hasContent: false` and render the "being prepared" state.
- `eName` is a heuristic transliteration, not a linguistically correct one.
- Source placeholders (`TBC#`) are preserved as-is in `hAuth` / `ePrev` / `eNext`.
- Manifests never inline `hCont`; the body always lives in `content/text/`.
