# Deployment Guide — JinBhakt (जिनभक्त) PWA

**JinBhakt** is a pure static, offline-first Progressive Web App built with vanilla JavaScript. There is no server-side runtime, no database, and no build step — you deploy it by copying files to any web server that can serve static content over HTTPS.

This guide walks you through the exact requirements, file checklist, and server configuration needed to ship the app to production.

---

## 1. Server Requirements

### You do NOT need

| Commonly assumed requirement | Reason it's not needed |
|---|---|
| Node.js / Python / PHP / .NET runtime | All logic runs in the browser |
| Database (MySQL, MongoDB, PostgreSQL) | All data is served as static `.json` files |
| Build tools (Webpack, Vite, Rollup) | Source is vanilla ES6+, no transpilation required |
| npm / yarn on the server | Only needed locally for running tests |
| Server-side rendering engine | The app is a fully client-side SPA |

### You DO need

| Requirement | Why |
|---|---|
| **HTTPS** | Service Workers (offline / PWA installability) only work in secure contexts. HTTP is rejected by all modern browsers. |
| A web server capable of serving static files with correct MIME types | Apache, Nginx, Caddy, IIS, or any static host works. |
| Compression enabled (optional but recommended) | The `content/text/*` directory contains ~1,854 JSON files. Gzip or Brotli cuts total payload by ~70%. |
| Long `Cache-Control` headers (optional but recommended) | Assets are immutable or versioned by the service worker. Aggressive caching reduces repeat load time. |

---

## 2. File Manifest

### Upload these files

Copy the following files and directories from the project root:

```
index.html                  — SPA entry point
manifest.json               — PWA manifest (name, icons, theme colors)
service-worker.js           — Offline cache + app-shell engine

css/
  base.css                  — Base resets and typography
  variables.css             — Color / spacing tokens
  layout.css                — Layout rules
  components.css            — Component styles (incl. Panchang Patra)

js/
  app.js                    — Main application logic (routing, views, search)
  nav.js                    — Sidebar / drawer navigation
  kids.js                   — Kids Learning catalogue + shared leaderboard store
  speech.js                 — Text-to-speech (Web Speech API)
  translit.js               — Devanagari transliteration + fuzzy search
  panchang.js               — Lunar/astronomical engine (Meeus-based, pure JS)

games/
  index.html                — Standalone Kids Learning hub (works by double-clicking)
  sattvic-chef.html         — Food sorting game (97 items, 12 categories)
  myth-busters.html         — True/false quiz (72 bilingual statements)
  tirthankar-sort.html      — Arrange the 24 Tirthankaras (4 modes, 6–24 tiles)
  niyam-wheel.html          — Daily vow wheel (108 kids / 216 adults vows)
  niyam-lotus.html          — Daily vow lotus (identical corpus, breathing ritual)
  memory-match.html         — Tirthankara memory pairs (6 attributes, 4–12 pairs)

img/
  logo.png                  — Hero logo
  favicon.ico               — Browser tab icon
  icon-192.png              — PWA 192×192 icon
  icon-512.png              — PWA 512×512 icon
  icon-maskable-512.png     — Maskable icon (dark themes, Android)
  apple-touch-icon.png      — iOS Add to Home Screen icon

content/
  categories.json           — Category definitions (aarti, bhajan, stotra, …)
  pooja.json                — Pooja catalogue metadata
  bhajan.json               — Bhajan metadata
  granth.json               — Granth metadata
  stotra.json               — Stotra metadata
  aarti.json                — Aarti metadata
  chalisa.json              — Chalisa metadata
  stuti.json                — Stuti metadata
  bhakti.json               — Bhakti metadata
  misc.json                 — Misc metadata
  panchang.json             — Panchang data (parvs, 24 Tirthankara Kalyanaks)
  text/[category]/[id].json — ~1,854 individual prayer body files (one per item)
```

### Do NOT upload

These are local-only artifacts and will not be served:

```
node_modules/              — Dev dependencies (jsdom, pngjs)
test/                      — Local test suite only
tools/                     — Content + game generators (dev-time only)
prototypes/                — Original single-file prototypes, kept as reference
implementation_plan.md     — Planning document
package.json               — Only needed if running `npm test` or `npm run check`
package-lock.json          — Same as above
.gitignore                 — Git-specific
.git/                      — Git history
_orig03.js                 — Backup artifact
_orig_translit.txt         — Backup artifact
_poojas.txt                — Backup artifact
_probe.txt                 — Backup artifact
_report.txt                — Backup artifact
source.html                — Backup artifact
CONTENT_FIX.md             — Internal doc
MIGRATION_SUMMARY.md       — Internal doc
MIGRATION_UPDATE.md        — Internal doc
```

You can keep `Jinvaani.pdf` and `Jainism.docx` only if you want them as bundled downloadable content; they are not referenced by the app.

---

## 3. MIME Type Configuration

Your server must return the correct `Content-Type` for these file extensions. Most servers default correctly for `.html`, `.css`, `.png`, and `.ico`, but `.json` and service workers sometimes need explicit configuration.

### Apache (`.htaccess` or `httpd.conf`)

```apache
AddType application/javascript js mjs
AddType application/json json
AddType application/manifest+json webmanifest
AddType image/png png
AddType image/x-icon ico

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

# Long-lived cache for static assets (busted by service-worker version bump)
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/x-icon "access plus 1 year"
</IfModule>
```

### Nginx (`nginx.conf` or server block)

```nginx
types {
    text/html                  html htm;
    text/css                   css;
    application/javascript     js mjs;
    application/json           json;
    application/manifest+json  webmanifest json;
    image/png                  png;
    image/x-icon               ico;
}

# Compression
gzip on;
gzip_types text/css application/javascript application/json;

# Long-lived cache for static assets
location ~* \.(css|js|png|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### IIS (`web.config`)

```xml
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".js" />
      <mimeMap fileExtension=".js" mimeType="application/javascript" />
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
  </system.webServer>
</configuration>
```

---

## 4. HTTPS Is Mandatory

Service Workers, the Web App Manifest, and "Add to Home Screen" all require HTTPS. Deploy on a host that provides TLS for free:

| Platform | Free HTTPS | Sub-path support | Recommended use |
|---|---|---|---|
| **GitHub Pages** | ✅ Automatic | ⚠️ Custom domain only; repo root serves from `/` | Hobby / personal hosting |
| **Netlify** | ✅ Automatic | ✅ via `netlify.toml` redirects | Production-grade |
| **Vercel** | ✅ Automatic | ✅ Built-in | Production-grade |
| **Cloudflare Pages** | ✅ Automatic | ✅ Via redirect rules | Production-grade, generous free tier |
| **Firebase Hosting** | ✅ Automatic | ✅ via `firebase.json` | Google ecosystem |
| **Shared hosting (Hostinger, GoDaddy, Namecheap)** | Often paid add-on | ✅ Direct folder placement | If you already pay for it |
| **Self-hosted Apache/Nginx** | Free via [Let's Encrypt](https://letsencrypt.org/) | ✅ Via virtual host | Full control, $0 software cost |

---

## 5. Sub-path Hosting

If you deploy to a sub-directory (e.g., `https://example.com/jinbhakt/`), **the app is already configured for it**:

- All paths in `service-worker.js`, `manifest.json`, and `index.html` use **relative URLs** (`./index.html`, `./content/pooja.json`).
- Hash routing (`#/aarti/1`) works from any base path.
- `manifest.json` declares `"start_url": "./"` and `"scope": "./"`.

**One thing to check**: Make sure your server resolves `https://example.com/jinbhakt` (no trailing slash) to the same `index.html`. Some servers return a 404 or directory listing instead of redirecting to `jinbhakt/`. A simple redirect rule fixes this:

```nginx
# Nginx — redirect /jinbhakt -> /jinbhakt/
location = /jinbhakt {
    return 301 /jinbhakt/;
}
```

---

## 6. Verify Before Going Live

### Run the local server

From the project root, spin up a static server:

```bash
# Option A: Python 3
python -m http.server 8000

# Option B: npm script (same command, wrapped)
npm run serve

# Option C: Node.js (no install)
npx serve -l 8000
```

Then open **http://localhost:8000** and check:

- [ ] Home page loads (Panchang Patra section, category cards)
- [ ] Clicking any category lists items; opening an item shows prayer text
- [ ] Search returns results for Hindi and English queries
- [ ] Clicking a "Speak" button triggers speech synthesis
- [ ] Opening DevTools → Application → Service Workers shows `jinbhakt-v18` installed
- [ ] Application → Manifest shows the PWA metadata
- [ ] Disable network in DevTools → page still loads (offline proof)

### Run the automated test suite

```bash
npm install   # only needed once
npm test      # runs test/run.js — expects 426/426 passing
```

### Run the full check

```bash
npm run check
```

This lints every JS file (`node --check`), runs the test suite, and verifies all asset paths are sub-path safe.

---

## 7. Recommended Deployment Sequence

1. Run `npm run check` locally and confirm it passes.
2. Package only the "Upload these files" list (Section 2) into a `.zip` or deploy directly from Git.
3. Push to your static host's deploy branch / directory.
4. Verify HTTPS is active (visit `https://yourdomain/` and confirm padlock).
5. Bump the service-worker cache version in `service-worker.js` only if you want to force returning users to refresh cached assets (usually unnecessary on first deploy).
6. Spot-check the live URL on desktop and mobile.
7. *(Optional)* Submit to Lighthouse for a PWA audit — target 90+ on Performance, Accessibility, Best Practices, PWA.

---

## 8. Updating After Deployment

Because the app uses a service worker with explicit `CACHE_NAME = 'jinbhakt-v18'`, returning users will continue seeing cached content until one of these triggers a refresh:

- **Bump the cache version**: Edit line 10 of `service-worker.js` to `'jinbhakt-v19'`. On their next visit, browsers will activate the new service worker and purge the old cache.
- **Let natural expiry happen**: Service workers re-check the network every 24 hours by default.
- **Manual purge**: Users can clear site data from browser settings, or you can add a `skipWaiting()` call during the install phase.

For content-only updates (new prayers, corrected text), bumping the cache version is the cleanest approach.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Page loads blank on mobile | HTTPS not enabled | Install a TLS cert (Let's Encrypt is free) |
| "Add to Home Screen" missing | HTTPS or manifest issue | Check DevTools → Application → Manifest for errors |
| Service worker not activating | Served over HTTP, or `service-worker.js` is 404 | Confirm HTTPS; verify `service-worker.js` URL returns 200 |
| Category list shows but prayer bodies 404 | `content/text/*` files not uploaded | Re-upload the full `content/text/` directory |
| JSON files download instead of rendering | Wrong MIME type | Configure `application/json` for `.json` (Section 3) |
| Panchang Patra missing on homepage | `js/panchang.js` or `content/panchang.json` 404 | Confirm both files are deployed; app degrades gracefully |
| Old content after update | Cached by previous service worker | Bump `CACHE_NAME` in `service-worker.js` |

---

## Summary

JinBhakt is **zero-dependency static hosting**. Copy the files from Section 2 onto any HTTPS-capable static host, configure MIME types per Section 3, and you're live. There is no installation step, no configuration commands, no database setup, and no build pipeline to run on the server.

— End of deployment guide —