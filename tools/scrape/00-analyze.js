// tools/scrape/00-analyze.js — Audit source.html structure vs. cache availability.
// Read-only. Dumps the jainDataBase directory tree found in the saved jinvani.html
// page and reports how many of those pages are present in tools/scrape/cache.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'source.html'), 'utf8');
const CACHE = path.join(__dirname, 'cache');

// --- collect every ./jainDataBase/... link in the page ---------------------
const hrefRe = /href=["']?(\.\/jainDataBase\/[^"'\s>]+)/g;
const hrefs = new Set();
let m;
while ((m = hrefRe.exec(html)) !== null) hrefs.add(m[1]);

console.log('=== unique jainDataBase hrefs in source.html:', hrefs.length);

// --- group by top-level section, then by sub-directory --------------------
const sections = new Map();
for (const href of hrefs) {
  const rel = decodeURIComponent(href.replace(/^\.\/jainDataBase\//, ''));
  const parts = rel.split('/');
  const section = parts[0];
  const sub = parts.length > 2 ? parts[1] : '(root)';
  if (!sections.has(section)) sections.set(section, new Map());
  const subs = sections.get(section);
  subs.set(sub, (subs.get(sub) || 0) + 1);
}

for (const [section, subs] of [...sections.entries()].sort()) {
  const total = [...subs.values()].reduce((a, b) => a + b, 0);
  console.log(`\n### ${section}  (${total} links, ${subs.size} sub-dirs)`);
  for (const [sub, n] of [...subs.entries()].sort()) {
    console.log(`    ${String(n).padStart(4)}  ${sub}`);
  }
}

// --- cache availability ---------------------------------------------------
// The cache is written by 02-fetch.js as href.replace(/[\/\\]/g,'_').
// On this checkout every cache file carries a macOS AppleDouble "._" prefix,
// so we accept both spellings.
let cacheFiles = [];
try { cacheFiles = fs.readdirSync(CACHE); } catch (e) { /* no cache yet */ }
const cacheSet = new Set(cacheFiles);
const bare = s => (s.startsWith('._') ? s.slice(2) : s);
const cacheBare = new Set(cacheFiles.map(bare));

function cacheKey(href) {
  return href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
}
let hit = 0, miss = 0;
const missing = [];
for (const href of hrefs) {
  const k = cacheKey(href);
  if (cacheSet.has(k) || cacheBare.has(k)) hit++;
  else { miss++; if (missing.length < 15) missing.push(k); }
}
console.log(`\n=== cache: ${cacheFiles.length} files | hrefs resolved: ${hit} | missing: ${miss}`);
if (missing.length) {
  console.log('    sample missing:');
  missing.forEach(x => console.log('      ' + x));
}

// --- how many links does the master #searchTitle list contain? ------------
const stMatch = html.match(/id=searchTitle[^>]*>([\s\S]*?)<\/ul>/);
const stCount = stMatch ? (stMatch[1].match(/<li/g) || []).length : 0;
console.log(`\n=== #searchTitle <li> entries: ${stCount}`);

// --- popup sections in the left panel ------------------------------------
const popRe = /id=(popup[A-Za-z]+)[\s\S]*?<\/div>/g;
const pops = new Set();
while ((m = popRe.exec(html)) !== null) pops.add(m[1]);
console.log('=== popups:', [...pops].join(', '));
