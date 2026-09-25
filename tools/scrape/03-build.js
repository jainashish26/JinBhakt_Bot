// tools/scrape/03-build.js — Parse the cached HTML pages into the app's content
// schema and write content/<cat>.json (FULL, includes hCont) + content_backup/.
//
// Categories produced here: pooja bhajan stotra aarti chalisa stuti bhakti misc
// (`granth` is owned by 05-expand-granth.js, so it is skipped here).
// Run order: 01-build-index -> 02-fetch -> 03-build -> 05-expand-granth -> 04-split
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const cacheDir = path.join(__dirname, 'cache');
const contentDir = path.join(ROOT, 'content');
const backupDir = path.join(ROOT, 'content_backup');

const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));
const curated = JSON.parse(fs.readFileSync(path.join(__dirname, 'curated.json'), 'utf8'));

// Hand-saved pages from jainsamaj.world/jinvani.html (Cloudflare-walled, so they
// can never be fetched by 02-fetch.js). Produced by 06-ingest-jinvani.js and
// optional — the build is unchanged when the file is absent.
const jinvaniPath = path.join(__dirname, 'jinvani.json');
const jinvani = fs.existsSync(jinvaniPath)
  ? JSON.parse(fs.readFileSync(jinvaniPath, 'utf8'))
  : [];

const TBC = 'TBC#';

// Categories owned by this script, in display order.
const CAT_META = {
  pooja:   { eCtg: 'Pooja',   hCtg: 'पूजा',      brief: 'A pooja vidhi or ritual text' },
  bhajan:  { eCtg: 'Bhajan',  hCtg: 'भजन',       brief: 'A Jain devotional song' },
  stotra:  { eCtg: 'Stotra',  hCtg: 'स्तोत्र',    brief: 'A stotra in praise of the Jinas' },
  aarti:   { eCtg: 'Aarti',   hCtg: 'आरती',       brief: 'An aarti sung before the Jinas' },
  chalisa: { eCtg: 'Chalisa', hCtg: 'चालीसा',     brief: 'A forty-verse devotional hymn' },
  stuti:   { eCtg: 'Stuti',   hCtg: 'स्तुति-पाठ', brief: 'A stuti or recitation path' },
  bhakti:  { eCtg: 'Bhakti',  hCtg: 'भक्ति',      brief: 'A bhakti or vandana recitation' },
  misc:    { eCtg: 'Misc',    hCtg: 'सन्दर्भ',    brief: 'A Jain reference table' }
};
const CAT_ORDER = Object.keys(CAT_META);

// ---------------------------------------------------------------- cache lookup
// 02-fetch.js flattens "./jainDataBase/a/b.html" to "._jainDataBase_a_b.html"
// (the "." comes from "./" and "_" from the first slash). Accept every variant.
function resolveCache(href) {
  const flat = href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
  for (const cand of ['._' + flat, '_' + flat, flat]) {
    const p = path.join(cacheDir, cand);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// --------------------------------------------------------------- html -> text
function decodeAndClean(s) {
  return s
    .replace(/<\/?(?:br)\s*\/?>/gi, '\n')   // <br> -> newline
    .replace(/<[^>]+>/g, '')                // strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\uFEFF/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Standard extractor: <div class=pooja> blocks, else the <div class=main> body. */
function extractPrayerContent(html) {
  let content = '';
  const poojaMatches = html.match(/<div class=pooja[^>]*>[\s\S]*?<\/div>/g);

  if (poojaMatches && poojaMatches.length > 0) {
    content = poojaMatches.map(div => {
      const inner = div.match(/<div class=pooja[^>]*>([\s\S]*?)<\/div>/);
      return inner ? inner[1] : '';
    }).join('\n');
  } else {
    const mainStart = html.indexOf('<div class=main>');
    if (mainStart >= 0) {
      const section = html.substring(mainStart);
      const endMarkers = ['<div data-role=footer>', '<div data-role=panel', '</body>'];
      let endIdx = section.length;
      for (const marker of endMarkers) {
        const idx = section.indexOf(marker);
        if (idx > 0 && idx < endIdx) endIdx = idx;
      }
      content = section.substring(0, endIdx);
    }
  }
  if (!content) return null;
  return decodeAndClean(content) || null;
}

/**
 * Table extractor for the misc/*.html reference pages (गुणस्थान, नवपद, …).
 * Each <tr> becomes one line; cells are joined with " | ".
 */
function extractTables(html) {
  const lines = [];
  for (const tbl of (html.match(/<table[\s\S]*?<\/table>/gi) || [])) {
    for (const tr of (tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [])) {
      const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [])
        .map(c => decodeAndClean(c).replace(/\s+/g, ' '));
      if (cells.some(Boolean)) lines.push(cells.filter(Boolean).join('  |  '));
    }
    lines.push('');
  }
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out || null;
}

/**
 * Some bhajan pages don't embed lyrics — their <div class=pooja> holds a path to
 * an external .txt file that 404s on the source server. Treat as unavailable.
 */
function isTxtPathReference(content) {
  const c = (content || '').trim();
  return /\.txt$/i.test(c) && c.includes('/') && !/\s/.test(c);
}

function extractContent(html, category) {
  if (category === 'misc') {
    return extractTables(html) || extractPrayerContent(html);
  }
  const prose = extractPrayerContent(html);
  // misc-style reference pages occasionally live outside the prayer sections.
  if (!prose) return extractTables(html);
  return prose;
}
// ------------------------------------------------------------------- naming
// Verbatim from the original builder so existing eName/_id values stay stable.
function transliterate(hindi) {
  const map = {
    '\u0905':'a','\u0906':'aa','\u0907':'i','\u0908':'ee','\u0909':'u','\u090a':'oo',
    '\u090b':'ri','\u090f':'e','\u0910':'ai','\u0913':'o','\u0914':'au',
    '\u0915':'k','\u0916':'kh','\u0917':'g','\u0918':'gh','\u0919':'ng',
    '\u091a':'ch','\u091b':'chh','\u091c':'j','\u091d':'jh','\u091e':'ny',
    '\u091f':'t','\u0920':'th','\u0921':'d','\u0922':'dh','\u0923':'n',
    '\u0924':'t','\u0925':'th','\u0926':'d','\u0927':'dh','\u0928':'n',
    '\u092a':'p','\u092b':'ph','\u092c':'b','\u092d':'bh','\u092e':'m',
    '\u092f':'y','\u0930':'r','\u0932':'l','\u0935':'v','\u0936':'sh',
    '\u0937':'sh','\u0938':'s','\u0939':'h',
    '\u093e':'aa','\u093f':'i','\u0940':'ee','\u0941':'u','\u0942':'oo',
    '\u0947':'e','\u0948':'ai','\u094b':'o','\u094c':'au',
    '\u0902':'n','\u0903':'h','\u0901':'n','\u093c':'',
    '\u094d':'','\u0965':'||','\u0964':'|','\u0950':'Om'
  };
  let result = '';
  for (let i = 0; i < hindi.length; i++) {
    result += map[hindi[i]] || hindi[i];
  }
  return result.replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function toId(title) {
  return title
    .replace(/[^\u0900-\u097Fa-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function generateBrief(title, category) {
  const desc = {
    bhajan: 'A devotional song',
    pooja: 'A prayer or worship text',
    granth: 'A sacred text or scripture',
    aarti: 'A prayer',
    stotra: 'A stotra in praise of the Jinas',
    chalisa: 'A forty-verse devotional hymn',
    stuti: 'A stuti or recitation path',
    bhakti: 'A bhakti or vandana recitation',
    misc: 'A Jain reference table'
  };
  return `${desc[category] || 'A prayer'}: ${title}`;
}

function cleanTitle(t) {
  return String(t).replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
}

// -------------------------------------------------------------------- build
function buildAll() {
  const byCategory = {};
  for (const cat of CAT_ORDER) byCategory[cat] = [];
  const usedIds = new Set();
  const stats = { cached: 0, readable: 0, noCache: 0, empty: 0, skippedGranth: 0 };
  const perCat = {};

  function uniqueId(title) {
    const base = toId(title) || 'Item';
    let id = base, n = 1;
    while (usedIds.has(id)) { id = `${base}_${n}`; n++; }
    usedIds.add(id);
    return id;
  }

  for (const item of index.items) {
    const cat = item.category;
    if (!CAT_META[cat]) { stats.skippedGranth++; continue; }   // granth -> 05-expand-granth.js

    const title = cleanTitle(item.title);
    const cachePath = resolveCache(item.href);
    let hCont = TBC;

    if (!cachePath) {
      stats.noCache++;
    } else {
      stats.cached++;
      let html = '';
      try { html = fs.readFileSync(cachePath, 'utf8').replace(/^\uFEFF/, ''); } catch (e) { html = ''; }
      const extracted = extractContent(html, cat);
      if (!extracted || isTxtPathReference(extracted)) {
        stats.empty++;
      } else {
        hCont = extracted;
        stats.readable++;
      }
    }

    const meta = CAT_META[cat];
    byCategory[cat].push({
      _id: uniqueId(title), _index: 0,
      eBrief: generateBrief(title, cat),
      eCtg: meta.eCtg,
      eName: transliterate(title),
      eNext: TBC, ePrev: TBC,
      hAuth: TBC, hBrief: TBC,
      hCont,
      hCtg: meta.hCtg,
      hName: title,
      sub: item.sub || '',
      isActive: true
    });
  }

  // Hand-authored items (rescued by 00-harvest-curated.js) and hand-saved
  // jinvani.html items go first in their home category so the mool-mantra /
  // chalisa stay pinned at the top.
  let curatedAdded = 0;
  let jinvaniAdded = 0;
  for (const c of curated.concat(jinvani)) {
    const fromJinvani = jinvani.includes(c);
    const cat = c.home;
    if (!byCategory[cat]) { console.warn(`  curated ${c._id}: unknown home "${cat}"`); continue; }
    if (usedIds.has(c._id)) { console.warn(`  curated ${c._id}: id collision, skipped`); continue; }
    usedIds.add(c._id);
    byCategory[cat].unshift({
      _id: c._id, _index: 0,
      eBrief: c.eBrief || generateBrief(cleanTitle(c.hName), cat),
      eCtg: CAT_META[cat].eCtg,
      eName: c.eName || transliterate(cleanTitle(c.hName)),
      eNext: TBC, ePrev: TBC,
      hAuth: c.hAuth || TBC,
      hBrief: c.hBrief || TBC,
      hCont: c.hCont,
      hCtg: CAT_META[cat].hCtg,
      hName: cleanTitle(c.hName),
      sub: c.sub || (cat === 'bhakti' ? 'मूल मंत्र' : CAT_META[cat].hCtg),
      isActive: true
    });
    if (fromJinvani) jinvaniAdded++; else curatedAdded++;
  }

  // sequential _index + sibling links
  for (const cat of CAT_ORDER) {
    const list = byCategory[cat];
    let readable = 0;
    list.forEach((it, idx) => {
      it._index = idx;
      it.ePrev = idx > 0 ? list[idx - 1]._id : TBC;
      it.eNext = idx < list.length - 1 ? list[idx + 1]._id : TBC;
      if (it.hCont !== TBC) readable++;
    });
    perCat[cat] = { total: list.length, readable };
  }

  return { byCategory, stats, perCat, curatedAdded, jinvaniAdded };
}
// -------------------------------------------------------------------- output
// Category list shown by the app (order = display order). `katha` is retired:
// the source site has no katha section, so it only ever held placeholder rows.
const CATEGORIES = [
  { id: 'pooja',   label: 'पूजा',    icon: '🙏' },
  { id: 'bhajan',  label: 'भजन',     icon: '🎵' },
  { id: 'granth',  label: 'ग्रन्थ',  icon: '📖' },
  { id: 'stotra',  label: 'स्तोत्र', icon: '📜' },
  { id: 'aarti',   label: 'आरती',    icon: '🪔' },
  { id: 'chalisa', label: 'चालीसा',  icon: '📖' },
  { id: 'stuti',   label: 'स्तुति',  icon: '🎵' },
  { id: 'bhakti',  label: 'भक्ति',   icon: '🙏' },
  { id: 'misc',    label: 'सन्दर्भ', icon: '📋' }
];
const RETIRED = ['katha'];

function writeContentFiles(byCategory) {
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  for (const { id: cat } of CATEGORIES) {
    // granth.json is produced by 05-expand-granth.js (verse-aware extractor).
    if (cat === 'granth') continue;
    const items = byCategory[cat] || [];
    const json = JSON.stringify(items, null, 2);
    fs.writeFileSync(path.join(contentDir, cat + '.json'), json, 'utf8');
    fs.writeFileSync(path.join(backupDir, cat + '.json'), json, 'utf8');
  }
}

function writeCategories() {
  const json = JSON.stringify(CATEGORIES, null, 2);
  fs.writeFileSync(path.join(contentDir, 'categories.json'), json, 'utf8');
  fs.writeFileSync(path.join(backupDir, 'categories.json'), json, 'utf8');
}

/** Delete manifests/text for categories that no longer exist. */
function removeRetired() {
  for (const cat of RETIRED) {
    for (const dir of [contentDir, backupDir]) {
      const f = path.join(dir, cat + '.json');
      if (fs.existsSync(f)) { fs.rmSync(f); console.log(`  removed ${path.relative(ROOT, f)}`); }
    }
    const td = path.join(contentDir, 'text', cat);
    if (fs.existsSync(td)) { fs.rmSync(td, { recursive: true, force: true }); console.log(`  removed content/text/${cat}/`); }
  }
}

// ---------------------------------------------------------------------- main
console.log('=== Parsing cached HTML pages...');
const { byCategory, stats, perCat, curatedAdded, jinvaniAdded } = buildAll();

console.log(`  cache files read : ${stats.cached}`);
console.log(`  no cache page    : ${stats.noCache}`);
console.log(`  cache but empty  : ${stats.empty}`);
console.log(`  granth deferred  : ${stats.skippedGranth} (built by 05-expand-granth.js)`);
console.log(`  curated merged   : ${curatedAdded}`);
console.log(`  jinvani merged   : ${jinvaniAdded}`);

console.log('\n=== Writing content files (FULL, with hCont)...');
writeContentFiles(byCategory);
writeCategories();
removeRetired();

console.log('\n=== Summary:');
let tot = 0, totR = 0;
for (const { id: cat } of CATEGORIES) {
  const p = perCat[cat];
  if (!p) { console.log(`  ${cat.padEnd(8)} (built by 05-expand-granth.js)`); continue; }
  tot += p.total; totR += p.readable;
  console.log(`  ${cat.padEnd(8)} ${String(p.total).padStart(5)} items | ${String(p.readable).padStart(5)} readable | ${String(p.total - p.readable).padStart(4)} coming-soon`);
}
console.log(`  ${'TOTAL'.padEnd(8)} ${String(tot).padStart(5)} items | ${String(totR).padStart(5)} readable`);
console.log('\n=== Next: node tools/scrape/05-expand-granth.js && node tools/scrape/04-split.js');


