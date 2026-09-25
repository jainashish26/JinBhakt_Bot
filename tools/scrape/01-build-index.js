// tools/scrape/01-build-index.js — Extract every item from source.html and
// assign it to exactly ONE app category using the source site's own folder
// structure (authoritative) plus a few title/path keyword promotions for
// categories the source has no dedicated folder for (chalisa / bhakti).
//
// IMPORTANT: links in source.html are UNQUOTED, e.g.
//   <li data-theme=b><a data-ajax=false href=./jainDataBase/bhajans/01_देव/html/अंतर.html>2) अंतर</a></li>
// and some entries are percent-encoded, so every href is decoded here.
//
// Output: tools/scrape/index.json = { items:[{num,title,href,rel,category,sub,sortKey,source}], byCategory:{} }
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'source.html'), 'utf8');

const BAD_EXT = /\.(jpg|jpeg|png|gif|mp3|mp4|pdf|css|js|zip)$/i;
// Non-content sections of the source site (videos, quizzes, downloads, exams).
const SKIP_DIRS = ['youtube/', 'youtube-animation/', 'downloads/', 'crosswords/',
                   'wordSearch/', 'jainExam/', 'genBooks/', 'search/', 'images/'];

function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

// ---------------------------------------------------------------- link harvest
const hrefs = [];
const seen = new Set();
const linkRe = /href=["']?\.\/jainDataBase\/([^"'\s>]+)["']?/gi;
let m;
while ((m = linkRe.exec(html)) !== null) {
  const raw = m[1];
  if (BAD_EXT.test(raw)) continue;
  const rel = safeDecode(raw);
  if (rel.includes('\uFFFD')) continue;                 // mojibake duplicate entry
  const href = './jainDataBase/' + rel;
  if (seen.has(href)) continue;
  seen.add(href);
  hrefs.push({ href, rel });
}
console.log(`Found ${hrefs.length} unique jainDataBase links`);

// ------------------------------------------------------------------- title map
// The searchTitle <ul> carries human-readable titles: "N) TITLE".
const titleMap = new Map();
const searchBlock = (html.match(/id=searchTitle[^>]*>([\s\S]*?)<\/ul>/) || [])[1] || '';
const liRe = /<li[^>]*><a[^>]*href=([^\s>]+)[^>]*>(\d+)\)\s*([^<]+)<\/a><\/li>/g;
let t;
while ((t = liRe.exec(searchBlock)) !== null) {
  const href = safeDecode(t[1].replace(/["']/g, ''));
  titleMap.set(href, { num: parseInt(t[2], 10), title: t[3].replace(/\uFFFD/g, '').trim() });
}
console.log(`Found ${titleMap.size} titles in searchTitle list`);

/** Derive a readable title from a path segment, e.g. "07_भगवान-महावीर-चालीसा". */
function titleFromPath(rel) {
  const parts = rel.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    let p = parts[i];
    if (p === 'html' || p === 'index.html') continue;
    p = p.replace(/\.html$/i, '');
    const num = p.match(/^\d+_(.+)$/);
    if (num) p = num[1];
    if (!p || /^\d+$/.test(p)) continue;
    return p.replace(/--/g, ' — ').replace(/-/g, ' ').replace(/_/g, ' ')
            .replace(/\s+/g, ' ').trim();
  }
  return 'Unknown';
}
// ---------------------------------------------------------------- subcat labels
function folderLabel(rel, depth) {
  const seg = rel.split('/')[depth];
  if (!seg) return '';
  return seg.replace(/^\d+_/, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

const SUB = {
  stotraPooja: 'स्तोत्र (पूजा-क्रम)',
  stotraBhajan: 'स्तोत्र (भजन)',
  aartiPooja: 'आरती (पूजा-क्रम)',
  aartiBhajan: 'आरती (भजन)',
  paath: 'पाठ',
  chhahdhala: 'छहढाला',
  chalisa: 'चालीसा',
  bhakti: 'भक्ति-वंदना',
  misc: 'सन्दर्भ-तालिका'
};

const CHALISA = 'चालीसा';
const AARTI = 'आरती';
const BHAKTI_KW = ['भक्ति', 'वंदना', 'वन्दना', 'कीर्तन'];

/**
 * Assign exactly one category. Order matters — first match wins.
 * Keyword promotions apply ONLY to bhajans/poojas so granth (teeka/gatha/
 * egranth/shastra) is never stolen by a title such as "…स्तोत्र-टीका".
 */
function categorize(rel) {
  if (SKIP_DIRS.some(d => rel.startsWith(d))) return { category: 'skip', sub: '' };

  if (/^(teeka|gatha|egranth|shastra)\//.test(rel)) {
    return { category: 'granth', sub: rel.split('/')[0] };
  }
  if (rel.startsWith('misc/')) return { category: 'misc', sub: SUB.misc };

  const isPooja = rel.startsWith('poojas/');
  const isBhajan = rel.startsWith('bhajans/');
  if (!isPooja && !isBhajan) return { category: 'skip', sub: '' };

  // 1. चालीसा — no dedicated source folder; promote by name.
  if (rel.includes(CHALISA)) return { category: 'chalisa', sub: SUB.chalisa };

  // 2. आरती — dedicated pooja folder, plus aarti-style bhajans.
  if (rel.startsWith('poojas/11_आरती/')) return { category: 'aarti', sub: SUB.aartiPooja };
  if (rel.includes(AARTI)) return { category: 'aarti', sub: SUB.aartiBhajan };

  // 3. स्तोत्र — dedicated pooja folder + the bhajans/21_स्तोत्र collection.
  if (rel.startsWith('poojas/08_स्तोत्र/')) return { category: 'stotra', sub: SUB.stotraPooja };
  if (rel.startsWith('bhajans/21_स्तोत्र/')) return { category: 'stotra', sub: SUB.stotraBhajan };

  // 4. भक्ति — vandana / bhakti / kirtan recitations.
  if (BHAKTI_KW.some(k => rel.includes(k))) return { category: 'bhakti', sub: SUB.bhakti };

  // 5. स्तुति-पाठ — the source's पाठ + छहढाला collections.
  if (rel.startsWith('poojas/06_पाठ/')) return { category: 'stuti', sub: SUB.paath };
  if (rel.startsWith('poojas/07_छहढाला/')) return { category: 'stuti', sub: SUB.chhahdhala };

  // 6. Everything else keeps its source section.
  if (isBhajan) return { category: 'bhajan', sub: folderLabel(rel, 1) };
  return { category: 'pooja', sub: folderLabel(rel, 1) };
}

// ----------------------------------------------------------------- build items
const items = [];
for (const { href, rel } of hrefs) {
  const { category, sub } = categorize(rel);
  if (category === 'skip') continue;
  const meta = titleMap.get(href);
  items.push({
    num: meta ? meta.num : 0,
    title: meta ? meta.title : titleFromPath(rel),
    href,
    rel,
    category,
    sub,
    // pooja-section entries sort before bhajan entries inside a merged category
    sortKey: (rel.startsWith('poojas/') ? '0' : '1') + '|' + rel,
    source: meta ? 'searchTitle' : 'path'
  });
}

// Deterministic order: source section, then path.
items.sort((a, b) => a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
items.forEach((it, i) => { if (!it.num) it.num = i + 1; });

const byCategory = {};
for (const it of items) (byCategory[it.category] = byCategory[it.category] || []).push(it);

console.log(`\nTotal content items: ${items.length}`);
console.log('\n=== Items by category:');
for (const [cat, list] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
  const subs = {};
  list.forEach(i => { subs[i.sub || '(none)'] = (subs[i.sub || '(none)'] || 0) + 1; });
  console.log(`  ${cat.padEnd(8)} ${String(list.length).padStart(5)}   ` +
    Object.entries(subs).map(([k, v]) => `${k}:${v}`).join('  '));
}

fs.writeFileSync(path.join(__dirname, 'index.json'),
  JSON.stringify({ items, byCategory }, null, 2), 'utf8');
console.log('\n=== Saved tools/scrape/index.json');

