# jinvani — hand-saved source pages

`https://jainsamaj.world/jinvani.html/` sits behind a **Cloudflare interactive
CAPTCHA**, so the automated fetcher (`02-fetch.js`) cannot reach it, and the
`nikkyjain.github.io` mirror only carries the separate `jainDataBase` tree.

Pages here are therefore saved **by hand from a normal browser** and turned into
content by `../06-ingest-jinvani.js`.

## What to save

Save the fully-rendered page, not the raw network response (the raw response is
just the "Just a moment…" challenge).

Any of these work, best first:

1. **SingleFile** browser extension → one self-contained `.html`.
2. DevTools → **Elements** → right-click `<html>` → *Copy outerHTML* → paste into
   a new file.
3. **Ctrl+S** → *Webpage, HTML Only*.

## Which pages

For each section, save the index **and** every article it lists:

| Section URL | App category |
|---|---|
| `/jinvani.html/stuti-path/` | `stuti` |
| `/jinvani.html/aarti/` | `aarti` |
| `/jinvani.html/chalisa/` | `chalisa` |
| `/jinvani.html/strotra/` (site's spelling) | `stotra` |
| `/jinvani.html/bhakti/` | `bhakti` |
| `/jinvani.html/puja/` | `pooja` |

Index pages are worth saving even though they hold no prayer text: they enumerate
the article slugs, so nothing gets missed.

## Naming

```
<category>__index.html                  e.g. aarti__index.html
<category>__<slug>.html                 e.g. aarti__arti-baje-cham-cham-cham.html
```

Naming is a convenience, not a requirement — the ingester reads the section from
the page's own canonical/og:url and only falls back to the filename.

## Then run

```bash
node tools/scrape/06-ingest-jinvani.js --inspect   # show what it detected
node tools/scrape/06-ingest-jinvani.js --write     # emit jinvani.json
node tools/scrape/03-build.js                      # merge into content/
node tools/scrape/05-expand-granth.js
node tools/scrape/04-split.js
node test/run.js
```

`06-ingest-jinvani.js` is dry-run by default and never touches `content/` itself;
`03-build.js` merges `jinvani.json` the same way it merges `curated.json`.
