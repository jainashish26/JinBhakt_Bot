// tools/scrape/06-ingest-jinvani.js — Turn hand-saved jainsamaj.world pages into
// curated-schema records that 03-build.js merges alongside curated.json.
//
// Two source trees are ingested:
//   tools/scrape/jinvani/         — the jinvani.html/<section>/<slug> library
//                                   (see jinvani/README.md for what to save)
//   tools/scrape/jainsamaj.world/ — standalone article pages organised in
//                                   <Category>/ folders (Aarti, Bhakti, Chalisa,
//                                   Pooja, Stotra, Stuti); section + slug are
//                                   read from each page's canonical/og:url.
//
// That host is behind a Cloudflare interactive CAPTCHA and is NOT covered by the
// nikkyjain.github.io mirror, so 02-fetch.js can never retrieve it; the pages are
// saved from a real browser instead.
//
// Usage:
//   node tools/scrape/06-ingest-jinvani.js --inspect   # report what it detects
//   node tools/scrape/06-ingest-jinvani.js --write     # emit jinvani.json
//   (default is dry-run: prints the plan, writes nothing)
//
// Output: tools/scrape/jinvani.json = [{_id,hName,hAuth,hBrief,hCont,sub,foundIn,home}]
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIRS = [
  path.join(__dirname, 'jinvani'),          // jinvani.html/<section>/<slug> tree
  path.join(__dirname, 'jainsamaj.world')   // <Category>/ article pages
];
const OUT_PATH = path.join(__dirname, 'jinvani.json');
const CONTENT_DIR = path.join(ROOT, 'content');
const BACKUP_DIR = path.join(ROOT, 'content_backup');

const TBC = 'TBC#';
const SITE = 'jainsamaj.world';

// The site's own section slugs -> this app's 9 categories. Note the source
// misspells "stotra" as "strotra" in its URLs; accept both.
const CAT_MAP = {
  'stuti-path': 'stuti',
  'stuti': 'stuti',
  'paath': 'stuti',
  'aarti': 'aarti',
  'arti': 'aarti',
  'chalisa': 'chalisa',
  'strotra': 'stotra',
  'stotra': 'stotra',
  'bhakti': 'bhakti',
  'vandana': 'bhakti',
  'puja': 'pooja',
  'pooja': 'pooja'
};

// `sub` label, matching the existing "(पूजा-क्रम)" / "(भजन)" convention so these
// rows are visibly distinguishable from the jainDataBase-sourced ones.
const CAT_SUB = {
  stuti: 'पाठ (जिनवाणी)',
  aarti: 'आरती (जिनवाणी)',
  chalisa: 'चालीसा (जिनवाणी)',
  stotra: 'स्तोत्र (जिनवाणी)',
  bhakti: 'भक्ति-वंदना (जिनवाणी)',
  pooja: 'पूजा (जिनवाणी)'
};

// --------------------------------------------------------------------- text
/** Same cleanup contract as 03-build.js so merged rows render identically. */
function decodeAndClean(s) {
  return String(s)
    .replace(/<\/?(?:br)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
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

/** Prune site chrome from a cloned subtree, then serialise it to text lines. */
function domToText(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  const JUNK = 'script, style, noscript, iframe, form, nav, header, footer, ' +
    '.ipsCommentContainer, .cShareLinks, .cAuthorPane, .ipsPagination, ' +
    '.ipsPageHeader, [data-role="commentFeed"], [data-controller="core.front' +
    '.core.commentFeed"], .ipsReactips, .cWidgetContainer > .ipsWidget_header, ' +
    '.ipsShareLink, .ipsAnnouncement, i-announcement-banner, .ipsComment_meta, ' +
    '[data-role="commentToolbar"]';
  clone.querySelectorAll(JUNK).forEach(el => el.remove());
  // Block boundaries become newlines so verse structure survives.
  clone.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre')
    .forEach(el => { el.insertBefore(clone.ownerDocument.createTextNode('\n'), el.firstChild); });
  return decodeAndClean(clone.innerHTML)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Fold spacing/punctuation and Devanagari nukta variants for comparison. */
function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-–—_.,;:!'"()[\]{}।॥|]/g, '')
    .replace(/ज़/g, 'ज').replace(/क़/g, 'क').replace(/ख़/g, 'ख')
    .replace(/ग़/g, 'ग').replace(/ड़/g, 'ड').replace(/ढ़/g, 'ढ')
    .replace(/फ़/g, 'फ').replace(/य़/g, 'य');
}

/** "arti-baje-cham-cham-cham" -> "Jinvani_Aarti_ArtiBajeChamChamCham".
 *  Slugs with no ASCII at all (a few jainsamaj.world permalinks are encoded
 *  Devanagari) fall back to a stable FNV-1a hash so ids stay unique and
 *  reproducible across runs. */
function makeId(cat, slug) {
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const parts = String(slug).split(/[^a-zA-Z0-9]+/).filter(Boolean).map(cap);
  if (parts.length) return 'Jinvani_' + cap(cat) + '_' + parts.join('');
  let h = 0x811c9dc5;
  for (const ch of String(slug)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'Jinvani_' + cap(cat) + '_X' + h.toString(36).toUpperCase();
}

/** Tidy an extracted title: fold spacing, strip emoji decoration, and drop a
 *  trailing Latin transliteration tail ("…मुनि कृत - Abhishek paath"). */
function tidyTitle(t) {
  if (!t) return t;
  let s = String(t).replace(/\s+/g, ' ').trim();
  // emoji / pictographs / variation selectors / ZWJ / keycaps
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu, '');
  s = s.replace(/\s+/g, ' ').trim();
  const m = s.match(/^(.*[\u0900-\u097F].*?)\s+-\s+([A-Za-z][A-Za-z0-9 ,.'\-()]*)$/);
  if (m && m[1].trim().length >= 6) s = m[1].trim();
  return s;
}

/** Normalised body text for content-level dedupe: Devanagari + a-z + digits. */
function normText(s) {
  return String(s || '').toLowerCase().replace(/[^\u0900-\u097Fa-z0-9]/g, '');
}

/** True when two normalised bodies are effectively the same text (identical,
 *  or one contains the other and the lengths are within 15%). */
function sameContent(a, b) {
  if (!a || !b) return false;
  if (a === b) return a.length >= 200;
  if (a.length < 200 || b.length < 200) return false;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.length / l.length >= 0.85 && l.includes(s);
}

// ------------------------------------------------------------ page structure
// Ordered by specificity. Invision Community "Pages" markup varies by skin and
// version, so several candidates are tried; the most specific selector with a
// usable length wins (see pickBody).
const TITLE_SELECTORS = [
  'h1.ipsType_pageTitle',
  '[data-role="pageTitle"] h1',
  '.ipsPageHeader h1',
  '.cCmsRecordHeader h1',
  'h1.cCmsRecordTitle',
  'article h1',
  'h1'
];
const BODY_SELECTORS = [
  'div[data-role="commentContent"]',
  'div[data-role="pageContent"]',
  '.cCmsRecordContent',
  'div.cCmsRecord div.ipsType_richText',
  '.ipsType_richText',
  'article .ipsContained_container',
  'article',
  '[data-role="pageContent"]',
  'main',
  '#elPageContent'
];
const AUTHOR_SELECTORS = [
  '[data-role="author"] .ipsType_normal',
  '.cAuthorPane .ipsType_normal',
  '.cAuthorPane a',
  'a[data-role="author"]',
  '.ipsType_light a'
];

/** Section + slug, read from the page's own URL, falling back to the filename. */
function detectSection(doc, filename) {
  const cand = [];
  const canon = doc.querySelector('link[rel="canonical"]');
  if (canon) cand.push(canon.getAttribute('href'));
  const og = doc.querySelector('meta[property="og:url"]');
  if (og) cand.push(og.getAttribute('content'));
  cand.push(filename.replace(/\.html?$/i, ''));

  const ogUrl = og ? og.getAttribute('content') : null;
  const pageUrl = canon ? canon.getAttribute('href')
    : ogUrl ? (/^https?:/i.test(ogUrl) ? ogUrl : 'https://' + SITE + (ogUrl.startsWith('/') ? '' : '/') + ogUrl)
    : null;
  for (const c of cand) {
    if (!c) continue;
    let s;
    try { s = decodeURIComponent(c); } catch (e) { s = c; }
    // /jinvani.html/<section>/<slug>/  OR  <section>__<slug>  OR the plain
    // /<section>/<slug>/ article permalinks used on jainsamaj.world
    const m = s.match(/jinvani\.html\/([a-z\-]+)\/([^/?#]+)\/?/i) ||
              s.match(/^([a-z\-]+)__([^/?#]+)$/i) ||
              s.match(/^(?:https?:\/\/[^/]+)?\/([a-z\-]+)\/([^/?#]+)\/?$/i);
    if (m) {
      const cat = CAT_MAP[m[1].toLowerCase()];
      if (cat) return { cat, slug: m[2].replace(/[.,।\s]+$/, ''), url: pageUrl };
      // index page: /jinvani.html/aarti/ has no slug
      const i = s.match(/jinvani\.html\/([a-z\-]+)\/?$/i);
      if (i && CAT_MAP[i[1].toLowerCase()]) {
        return { cat: CAT_MAP[i[1].toLowerCase()], slug: null, url: pageUrl };
      }
    }
  }
  return { cat: null, slug: null, url: null };
}

function firstText(doc, selectors) {
  for (const sel of selectors) {
    const els = doc.querySelectorAll(sel);
    for (const el of els) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return { text: t, selector: sel };
    }
  }
  return { text: null, selector: null };
}

function extractTitle(doc) {
  const hit = firstText(doc, TITLE_SELECTORS);
  if (hit.text) return hit;
  const og = doc.querySelector('meta[property="og:title"]');
  if (og && og.getAttribute('content')) {
    return { text: og.getAttribute('content').trim(), selector: 'meta[og:title]' };
  }
  const t = doc.querySelector('title');
  if (t) {
    // Invision appends " - Site Name"; keep only the leading part.
    const raw = (t.textContent || '').split(/\s[-–|]\s/)[0].trim();
    if (raw) return { text: raw, selector: '<title>' };
  }
  return { text: null, selector: null };
}

/** Every body candidate with its cleaned length, longest first. */
function bodyCandidates(doc) {
  const seen = new Map();
  BODY_SELECTORS.forEach((sel, selIndex) => {
    doc.querySelectorAll(sel).forEach((el, i) => {
      const text = domToText(el);
      const key = sel + '#' + i;
      if (!seen.has(key)) seen.set(key, { selector: sel, selIndex, index: i, text, len: text.length });
    });
  });
  return [...seen.values()].sort((a, b) => b.len - a.len);
}

/**
 * Pick the body: the most specific selector (BODY_SELECTORS order) that yields
 * a usable candidate wins, longest match within that selector. This keeps the
 * pristine record body (commentContent) ahead of longer-but-dirtier wrappers
 * like <main>. Falls back to the overall longest candidate when nothing is
 * long enough to be real content.
 */
function pickBody(cands) {
  for (let si = 0; si < BODY_SELECTORS.length; si++) {
    const usable = cands.filter(c => c.selIndex === si && c.len >= MIN_BODY);
    if (usable.length) return usable.reduce((a, b) => (b.len > a.len ? b : a));
  }
  return cands.length ? cands[0] : null;
}

function extractAuthor(doc) {
  const hit = firstText(doc, AUTHOR_SELECTORS);
  if (!hit.text) return null;
  // Drop chrome words that leak in from the author pane.
  const t = hit.text.split(/\s{2,}|·|\|/)[0].trim();
  return /^(admin|administrator|moderator|guest|by)$/i.test(t) ? null : t;
}

function extractDate(doc) {
  const el = doc.querySelector('time[datetime], [data-role="date"] time');
  if (el) return (el.getAttribute('datetime') || el.textContent || '').trim().slice(0, 10);
  const m = doc.body && (doc.body.textContent || '').match(/(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Article links on a section index page: /jinvani.html/<cat>/<slug>/ */
function extractArticleLinks(doc, baseCat) {
  const found = new Map();
  doc.querySelectorAll('a[href]').forEach(a => {
    let href = a.getAttribute('href') || '';
    try { href = decodeURIComponent(href); } catch (e) { /* keep raw */ }
    const m = href.match(/jinvani\.html\/([a-z\-]+)\/([^/?#]+)\/?/i);
    if (!m) return;
    const cat = CAT_MAP[m[1].toLowerCase()];
    if (!cat) return;
    const slug = m[2].replace(/[.,।\s]+$/, '');
    if (!slug) return;
    const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!found.has(cat + '/' + slug)) found.set(cat + '/' + slug, { cat, slug, label, href });
  });
  return [...found.values()];
}

// ------------------------------------------------------------- dedupe vs app
/**
 * Corpus to dedupe against: every shipped title (normalised) plus every
 * shipped body (normalised) from content_backup — the full-text source
 * 03-build.js merges from — so identical texts published under different
 * titles are caught by content, not just by title.
 */
function loadExisting() {
  const titles = new Map();
  const bodies = [];
  const catPath = path.join(CONTENT_DIR, 'categories.json');
  if (!fs.existsSync(catPath)) return { titles, bodies };
  for (const c of JSON.parse(fs.readFileSync(catPath, 'utf8'))) {
    const bp = path.join(BACKUP_DIR, c.id + '.json');
    const p = path.join(CONTENT_DIR, c.id + '.json');
    const src = fs.existsSync(bp) ? bp : p;
    if (!fs.existsSync(src)) continue;
    for (const it of JSON.parse(fs.readFileSync(src, 'utf8'))) {
      const n = normTitle(it.hName);
      if (n && !titles.has(n)) titles.set(n, { cat: c.id, hName: it.hName });
      // Body-level dedupe only for article-sized texts: sameContent()'s 0.85
      // length-ratio rule can never match a short page against a megabyte-scale
      // granth chapter, and normalising those would dwarf the heap.
      if (it.hCont && it.hCont.length <= 120000) {
        const nt = normText(it.hCont);
        if (nt.length >= 200) bodies.push({ cat: c.id, hName: it.hName, ntext: nt });
      }
    }
  }
  return { titles, bodies };
}

function classify(title, bodyText, existing) {
  const n = normTitle(title);
  if (!n) return { state: 'NO_TITLE' };
  const nt = normText(bodyText);
  if (nt) {
    const hit = existing.bodies.find(b => sameContent(nt, b.ntext));
    if (hit) return { state: 'DUPLICATE', match: hit, why: 'identical body text' };
  }
  if (existing.titles.has(n)) return { state: 'DUPLICATE', match: existing.titles.get(n), why: 'identical title' };
  for (const [k, v] of existing.titles) {
    if (k.length > 6 && n.length > 6 && (n.includes(k) || k.includes(n))) {
      return { state: 'NEAR', match: v };
    }
  }
  return { state: 'NEW' };
}

// --------------------------------------------------------------------- main
const MIN_BODY = 60;   // anything shorter is almost certainly saved page chrome

function discover() {
  const out = [];
  for (const root of SRC_DIRS) {
    if (!fs.existsSync(root)) continue;
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.html?$/i.test(e.name)) continue;
        out.push(p);
      }
    })(root);
  }
  return out.sort();
}

function parseFile(file, silent) {
  const html = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const dom = new JSDOM(html, { virtualConsole: silent });
  try {
    const doc = dom.window.document;
    const name = path.basename(file);
    const sec = detectSection(doc, name);
    // jainsamaj.world saves are organised in <Category>/ folders; when the page
    // URL gave us nothing, fall back to the folder name + a filename slug.
    if (!sec.cat) {
      const cat = CAT_MAP[path.basename(path.dirname(file)).toLowerCase()];
      if (cat) {
        sec.cat = cat;
        sec.slug = name.replace(/\.html?$/i, '').split(/\s+-\s+/)[0].trim().replace(/\s+/g, '-') || 'item';
      }
    }
    const title = extractTitle(doc);
    if (title.text) title.text = tidyTitle(title.text);
    const cands = bodyCandidates(doc);
    const best = pickBody(cands);
    const links = sec.slug ? [] : extractArticleLinks(doc, sec.cat);
    return {
      file, name, sec, title, cands, best, links,
      author: extractAuthor(doc),
      date: extractDate(doc),
      bytes: html.length,
      isIndex: !sec.slug
    };
  } finally {
    // Release the jsdom window eagerly: 188 saved pages x ~1.4 MB each would
    // otherwise pile up and exhaust the heap before the walk finishes.
    dom.window.close();
  }
}

function main() {
  const argv = process.argv.slice(2);
  const INSPECT = argv.includes('--inspect');
  const WRITE = argv.includes('--write');
  const vc = new VirtualConsole();          // swallow jsdom CSS/parse noise
  const files = discover();

  console.log('=== 06-ingest-jinvani ===');
  console.log(`  source dirs: ${SRC_DIRS.map(d => path.relative(ROOT, d)).join(', ')}`);
  console.log(`  html files : ${files.length}`);
  console.log(`  mode       : ${INSPECT ? 'inspect' : WRITE ? 'WRITE' : 'dry-run'}`);

  if (!files.length) {
    console.log('\nNo saved pages yet. See tools/scrape/jinvani/README.md for what to save.');
    console.log('Nothing written.');
    return 0;
  }

  const existing = loadExisting();
  console.log(`  corpus loaded for dedupe: ${existing.titles.size} title(s), ${existing.bodies.length} body(ies)`);

  const records = [];
  const skipped = [];
  const acceptedBodies = [];   // intra-batch content dedupe
  const indexSlugs = new Set();

  for (const file of files) {
    let r;
    try { r = parseFile(file, vc); } catch (e) {
      console.log(`\n! ${path.basename(file)}: PARSE ERROR ${e.message}`);
      skipped.push({ file: path.basename(file), why: 'parse error' });
      continue;
    }

    console.log(`\n--- ${r.name}  (${r.bytes} B) ---`);
    console.log(`  section : ${r.sec.cat || 'UNKNOWN'}   slug: ${r.sec.slug || '(index)'}`);
    console.log(`  title   : ${r.title.text || 'NONE'}   [via ${r.title.selector || '-'}]`);

    if (!r.sec.cat) {
      console.log('  !! no jinvani section detected — rename to <section>__<slug>.html');
      skipped.push({ file: r.name, why: 'no section' });
      continue;
    }

    if (r.isIndex) {
      console.log(`  index page: ${r.links.length} article link(s)`);
      r.links.forEach(l => {
        console.log(`     - ${l.cat}/${l.slug}   "${l.label}"`);
        indexSlugs.add(l.cat + '/' + l.slug);
      });
      continue;
    }

    if (INSPECT) {
      console.log('  body candidates:');
      r.cands.slice(0, 6).forEach(c => console.log(`     ${String(c.len).padStart(6)}  ${c.selector}#${c.index}`));
      if (r.best) console.log(`  chosen body: ${r.best.len} chars`);
      console.log(`  author: ${r.author || '-'}   date: ${r.date || '-'}`);
    }

    if (!r.best || r.best.len < MIN_BODY) {
      console.log(`  !! body too short (${r.best ? r.best.len : 0} < ${MIN_BODY}) — page probably not fully saved`);
      skipped.push({ file: r.name, why: 'short body' });
      continue;
    }
    if (!r.title.text) {
      console.log('  !! no title found');
      skipped.push({ file: r.name, why: 'no title' });
      continue;
    }

    const cls = classify(r.title.text, r.best.text, existing);
    console.log(`  dedupe  : ${cls.state}${cls.match ? ` == [${cls.match.cat}] ${cls.match.hName}${cls.why ? ' (' + cls.why + ')' : ''}` : ''}`);
    if (cls.state === 'DUPLICATE') {
      skipped.push({ file: r.name, why: 'duplicate of ' + cls.match.hName + (cls.why ? ' (' + cls.why + ')' : '') });
      continue;
    }

    // Intra-batch dedupe: the same text saved twice under different titles.
    const ntext = normText(r.best.text);
    const twin = acceptedBodies.find(a => sameContent(ntext, a.ntext));
    if (twin) {
      console.log(`  dedupe  : DUPLICATE == new record "${twin.hName}"`);
      skipped.push({ file: r.name, why: 'same text as new record ' + twin.hName });
      continue;
    }

    const rec = {
      _id: makeId(r.sec.cat, r.sec.slug),
      hName: r.title.text,
      hAuth: r.author || TBC,
      hBrief: r.date ? `जिनवाणी से · ${r.date}` : TBC,
      hCont: r.best.text,
      sub: CAT_SUB[r.sec.cat],
      foundIn: r.sec.url || `https://${SITE}/jinvani.html/${r.sec.cat}/${r.sec.slug}/`,
      home: r.sec.cat
    };
    records.push(rec);
    acceptedBodies.push({ ntext, hName: rec.hName });
    if (cls.state === 'NEAR') console.log('  (NEAR match kept — review before shipping)');
  }

  // Stable, reproducible order: home category, then Hindi title (code-unit
  // order) — walk order across two source trees carries no meaning.
  records.sort((a, b) =>
    a.home < b.home ? -1 : a.home > b.home ? 1 :
    a.hName < b.hName ? -1 : a.hName > b.hName ? 1 : 0);

  const seen = new Set();
  for (const rec of records) {
    let id = rec._id, n = 1;
    while (seen.has(id)) { id = `${rec._id}_${n++}`; }
    seen.add(id); rec._id = id;
  }

  console.log('\n=== summary ===');
  const byCat = {};
  records.forEach(r => { byCat[r.home] = (byCat[r.home] || 0) + 1; });
  console.log(`  new records : ${records.length}` + (records.length ? '  ' + JSON.stringify(byCat) : ''));
  console.log(`  skipped     : ${skipped.length}`);
  skipped.forEach(s => console.log(`     - ${s.file}: ${s.why}`));

  const missing = [...indexSlugs].filter(s => {
    const [c, slug] = s.split('/');
    return !records.some(r => r.home === c && r._id === makeId(c, slug));
  });
  if (missing.length) {
    console.log(`\n  listed in an index but NOT saved yet (${missing.length}):`);
    missing.forEach(m => console.log('     - ' + m));
  }

  if (!records.length) { console.log('\nNothing to write.'); return 0; }

  if (WRITE) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2), 'utf8');
    console.log(`\n=== WROTE ${path.relative(ROOT, OUT_PATH)} (${records.length} records)`);
    console.log('Next: 03-build.js -> 05-expand-granth.js -> 04-split.js -> npm test');
  } else {
    console.log('\nDry-run only. Re-run with --write to emit jinvani.json.');
  }
  return 0;
}

process.exitCode = main();



