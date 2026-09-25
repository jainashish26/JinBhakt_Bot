# Content & Rendering Fix — Complete

## Issues Fixed

### 1. ✅ Missing / truncated content (Bhaktamar, Mangalashtak, Bahubali Aarti, etc.)
**Problem**: Many prayers showed only the first few verses instead of the full text.

**Root Cause**: Source pages contain multiple `<div class=pooja>` sections (e.g. Bhaktamar
had 96). The old extraction regex was non-greedy and captured only the **first** div.

**Solution** (`tools/scrape/03-build.js` → `extractPrayerContent`):
- Find **ALL** `<div class=pooja>` elements
- Extract each div's inner content
- Concatenate them with newlines

**Results**:
| Item | Before | After |
|------|--------|-------|
| भक्तामर--पणडित-हेमराज | 188 chars | **18,526 chars** (302 line breaks) |
| महावीराष्टक-स्तोत्र--पण्डित-भागचन्द्र | 203 chars | **5,078 chars** (61 line breaks) |
| विषापहारस्तोत्र--पण्डित-शांतिदास | — | **6,576 chars** (211 line breaks) |
| श्री-मंगलाष्टक-स्तोत्र | — | **5,269 chars** (68 line breaks) |
| भगवान-बाहुबली-आरती | — | **744 chars** (22 line breaks) |

### 2. ✅ Line breaks rendering as a single paragraph
**Problem**: Content appeared as one continuous paragraph in the browser even though
the JSON contained newline characters.

**Root Cause (the real one)**: The **service worker** served `js/app.js` **cache-first**
under a cache name (`jinbhakt-v4`) that was never bumped. Browsers therefore kept running
the **old `app.js`** that did not convert `\n` → `<br>`, while the JSON content itself was
fresh (network-first). A plain hard-refresh does not bypass a service worker.

**Solution**:
1. **Bumped the service-worker cache version** `jinbhakt-v4` → `jinbhakt-v5`
   (`service-worker.js`). On next load the old cache is purged and the new `app.js`
   (with the `<br>` conversion) is fetched.
2. **Reordered `normalizeContent()`** (`js/app.js`) so cleanup runs on raw newlines
   *before* the `<br>` conversion (previously the cleanup steps were no-ops after
   conversion):
   ```javascript
   .replace(/\r\n?/g, '\n')      // CRLF/CR -> LF
   .replace(/[ \t]+\n/g, '\n')   // strip trailing whitespace per line
   .replace(/\n{3,}/g, '\n\n')   // collapse blank-line spam
   .trim()                       // drop leading/trailing blank lines
   .replace(/\n/g, '<br>\n');    // convert newlines to <br> LAST
   ```

**Verified end-to-end** (jsdom render of the भक्तामर reader):
- **302 `<br>` elements** present in `#prayer-body`
- **18,431 characters** of visible text
- Existing test `body keeps <br> breaks` passes

### 3. ✅ Bhajans that showed a raw `.txt` file path
**Problem**: ~10 bhajan pages don't embed lyrics — their `<div class=pooja>` holds a
relative path to an external `.txt` file (e.g. `../../09_पू-.../main/x.txt`). Those
`.txt` files **404 on the source server** (confirmed: the HTML page returns 200, the
referenced `.txt` returns 404), so the path was being shown as "content".

**Solution** (`tools/scrape/03-build.js`): added `isTxtPathReference()` — when the
extracted content is a bare `.txt` path, it is stored as the `TBC#` placeholder so the
app shows "Content coming soon" instead of a confusing file path.

## Test Results
✅ **All 192 tests passing**

## Content Statistics
- **Total items**: 1,842
- **Readable items**: 1,620
- **Pending / placeholder**: 222

## Files Modified
1. `tools/scrape/03-build.js` — capture all pooja divs; strip replacement chars;
   detect `.txt`-path references → placeholder
2. `js/app.js` — reordered `normalizeContent()` (`\n` → `<br>` as final step)
3. `service-worker.js` — cache version `v4` → `v5` (forces clients to pick up new app.js)
4. `content/*.json` — rebuilt with complete content
5. `test/run.js`, `test/part4.js` — updated readable-count expectation (1572 → 1562)

## Verification Steps
1. Serve locally (e.g. `python -m http.server 8000`) and open http://localhost:8000
2. **Important**: because a service worker is used, do one of:
   - DevTools → Application → Service Workers → "Unregister", then reload; or
   - DevTools → Network tab → check "Disable cache" and hard-reload twice
3. Open भक्तामर--पणडित-हेमराज → confirm full text with line breaks
4. Open any aarti/stotra → confirm content is complete, not a single paragraph

## Notes
- The extraction fix handles pages with many content divs correctly.
- Newlines are preserved in JSON and converted to `<br>` at render time.
- The service-worker cache bump is what actually delivers the fix to existing users;
  without it, browsers keep the old `app.js` and line breaks won't appear.

---

# Performance Refactor — Lazy Loading + Granth Expansion

## 4. ✅ Huge `granth.json` (44 MB) loaded eagerly at startup
**Problem**: `content/granth.json` alone was ~44 MB (69 scriptures, one up to 3.8 MB),
and `loadAllData()` fetched **every** category file on boot. Startup downloaded ~52 MB
even though a reader only ever views one prayer at a time.

**Solution — split metadata from content (manifest + lazy text files):**
- `content/<cat>.json` is now a lightweight **metadata manifest** (id, names, author,
  `hasContent`, `cref`, `sub`) — no `hCont`/`hBrief`.
- Each prayer's body lives in `content/text/<cat>/<cref>.json` and is fetched **only
  when the reader opens it**, then memoised in `state.contentCache`.
- `js/app.js`: `hasContent()` reads the manifest flag; `renderReaderView()` renders the
  shell instantly, shows "पाठ लोड हो रहा है…", then fills `#prayer-body` asynchronously
  (guarded by `readerToken` so stale navigations can't overwrite the view).
- `service-worker.js` (v6): manifests stay **network-first** (fresh metadata); lazy
  `content/text/*` bodies are **cache-first** (static/immutable, offline-ready).

**Result**: eager startup payload **~52 MB → ~996 KB** (≈52× smaller). The 88 MB of
scripture text is now spread across 1,620 on-demand files.

| File | Before | After |
|------|--------|-------|
| `content/granth.json` | 44 MB | **89.7 KB** manifest |
| `content/bhajan.json` | 3.6 MB | **721 KB** manifest |
| `content/pooja.json` | 3.0 MB | **113 KB** manifest |
| **Total eager load** | **~52 MB** | **~996 KB** |

Build pipeline: `tools/scrape/04-split.js` turns the full category JSONs into
manifests + `content/text/` files (re-runnable; falls back to `content_backup/`).

## 5. ✅ Granth / Gatha expansion (69 → 137 scriptures) with subcategories
**Problem**: the source index lists 199 Granth titles but only 69 had extractable
content. The rest use verse markup (`gatha`, `comment`, `teeka`, `gadya`, `paragraph`,
`adhikaar`, `title`) that the old extractor (which only handled `<div class=pooja>` and
`<div class=main>`) could not parse.

**Solution** (`tools/scrape/05-expand-granth.js`):
- Structure-agnostic, verse-aware extractor: collects content divs in document order,
  skipping the TOC (`adhikaar id=index/home`), page header (`hdr1`), and the
  commentary-picker `<select>`. Works with or without a `<div class=main>` wrapper.
- Reads the cache via its flat naming (`href.replace(/\//g,'_')`).
- Adds a `sub` field; the category view groups Granth into **टीका / गाथा / अंग्रेज़ी ग्रन्थ**.
- `shastra` pages are commentary-selector stubs (no body) and are intentionally excluded.

**Result**: Granth readable items **69 → 127** (टीका 58, गाथा 58, अंग्रेज़ी 11);
10 titles remain "शीघ्र आ रहे हैं" (source pages not in cache). Catalogue totals
**1,774 → 1,842 items**, **1,562 → 1,620 readable**.

## Files added / modified in this refactor
- `tools/scrape/04-split.js` (new) — manifest + lazy-text splitter
- `tools/scrape/05-expand-granth.js` (new) — Granth/Gatha expansion + subcategories
- `js/app.js` — lazy content loading, `hasContent` flag, subcategory grouping
- `service-worker.js` — v6, cache-first for `content/text/*`
- `css/components.css` — `.reader-loading`, `.reader-error`, `.subcat-title`
- `content/granth.json` + `content/text/**` — rebuilt
- `test/run.js`, `test/part2.js`, `test/part3.js`, `test/part4.js` — new totals (1842/1620),
  manifest/lazy-text integrity checks, Granth subcategory + lazy-render tests

## Regenerating content
```bash
node tools/scrape/05-expand-granth.js   # rebuild full content/granth.json from cache
node tools/scrape/04-split.js           # split all categories -> manifests + content/text/
npm test                                # 192 tests
```
> `content_backup/` holds the full (pre-split) category JSONs; `04-split.js` uses it as
> the source of truth for any category whose live file is already a manifest.

