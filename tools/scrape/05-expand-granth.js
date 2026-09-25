// tools/scrape/05-expand-granth.js
// Surgical granth expansion: rebuilds content/granth.json (FULL, with hCont)
// from the flat cache using an improved verse-aware extractor, adding a `sub`
// (subcategory) field. Covers teeka / gatha / egranth pages that hold real text.
// `shastra` pages are commentary-selector stubs (no body) and are excluded.
// After running this, run 04-split.js to produce the manifest + lazy text files.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));
const cacheDir = path.join(__dirname, 'cache');
const contentDir = path.join(ROOT, 'content');

const SUB_LABEL = { teeka: 'टीका', gatha: 'गाथा', egranth: 'अंग्रेज़ी ग्रन्थ' };
const SUBS_KEEP = ['teeka', 'gatha', 'egranth'];   // shastra = selector stubs, excluded

function subOf(href) { const p = href.split('/'); return p[2] || ''; }

/**
 * Cache filenames are the href with every "/" replaced by "_"; because hrefs
 * start with "./" the result begins with "._". Accept all historical variants.
 */
function resolveCache(href) {
  const flat = href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
  for (const cand of ['._' + flat, '_' + flat, flat]) {
    const p = path.join(cacheDir, cand);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// --- helpers copied from 03-build.js (keep _id/transliteration stable) ---
function transliterate(hindi) {
  const map = { 'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
    'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
    'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
    'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
    'क्ष':'ksh','त्र':'tr','ज्ञ':'gy','श्र':'shr','।':'-','॥':'-','़':'','्':'','ा':'aa','ि':'ee','ी':'ii',
    'ु':'oo','ू':'u','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ं':'n','ः':'h','ँ':'n','ॉ':'o','ऽ':"'",
    '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };
  let r = '';
  for (const ch of hindi) r += (map[ch] !== undefined) ? map[ch] : ((/[a-zA-Z0-9 ,.'-]/.test(ch)) ? ch : '');
  return r.replace(/\s+/g, ' ').trim();
}
function toId(title) {
  let id = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\u0900-\u097F_-]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return id || transliterate(title).replace(/\s+/g, '_') || 'Item_' + Date.now();
}
function generateBrief(title, cat) {
  return `A sacred text or scripture: ${title.replace(/[।॥]/g, '').replace(/\s+/g, ' ').trim()}`;
}

// --- improved granth/gatha extractor (structure-agnostic, verse-aware) ---
// Collects content divs (adhikaar/title/gatha/commentary/prose) in document
// order, skipping the TOC (adhikaar id=index/home), page header (hdr1), and
// commentary-picker <select>. Works whether or not a <div class=main> wrapper
// is present, so it handles every granth page variant in the cache.
function extractGranth(html) {
  let s = html
    .replace(/<select[\s\S]*?<\/select>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const parts = [];
  const re = /<div class=(adhikaar|title|gatha|gadya|comment|teeka|paragraph|sutra|vad|paya|hdr1)([^>]*)>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const cls = m[1].toLowerCase();
    const attrs = m[2] || '';
    if (cls === 'hdr1') continue;                                  // page title (dup of hName)
    if (cls === 'adhikaar' && /id=(?:index|home|ind)\b/i.test(attrs)) continue;  // TOC block
    const text = m[3]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\uFEFF/g, '').replace(/\uFFFD/g, '')
      .replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    if (cls === 'adhikaar') parts.push('\n\n' + text + '\n');      // chapter heading
    else if (cls === 'title') parts.push('\n' + text);             // verse reference
    else parts.push(text);                                         // verse / commentary / prose
  }

  const out = parts.join('\n')
    .replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return out || null;
}

// --- build ---
const granthItems = index.items.filter(i => i.category === 'granth' && SUBS_KEEP.includes(subOf(i.href)));
console.log('granth items to process (teeka/gatha/egranth):', granthItems.length);

const usedIds = new Set();
const out = [];
let readable = 0, missing = 0;
const perSub = {};

for (const item of granthItems) {
  const sub = subOf(item.href);
  perSub[sub] = perSub[sub] || { total: 0, readable: 0 };
  perSub[sub].total++;

  const fp = resolveCache(item.href);
  let content = null;
  if (fp) {
    try {
      const html = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
      content = extractGranth(html);
    } catch (e) { content = null; }
  }
  const has = !!(content && content.trim());
  if (has) { readable++; perSub[sub].readable++; } else missing++;

  const cleanTitle = item.title.replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
  let id = toId(cleanTitle), uid = id, c = 1;
  while (usedIds.has(uid)) { uid = `${id}_${c}`; c++; }
  usedIds.add(uid);

  out.push({
    _id: uid, _index: 0,
    eBrief: generateBrief(cleanTitle, 'granth'),
    eCtg: 'Granth',
    eName: transliterate(cleanTitle),
    eNext: 'TBC#', ePrev: 'TBC#',
    hAuth: 'TBC#', hBrief: 'TBC#',
    hCont: has ? content : 'TBC#',
    hCtg: 'ग्रन्थ',
    hName: cleanTitle,
    sub: SUB_LABEL[sub] || sub,
    isActive: true
  });
}

// sequential _index + sibling links
out.forEach((it, idx) => {
  it._index = idx;
  if (idx > 0) it.ePrev = out[idx - 1]._id;
  if (idx < out.length - 1) it.eNext = out[idx + 1]._id;
});

const granthJson = JSON.stringify(out, null, 2);
fs.writeFileSync(path.join(contentDir, 'granth.json'), granthJson, 'utf8');
// keep content_backup/ in sync so 04-split.js never resurrects a stale granth
const backupDir = path.join(ROOT, 'content_backup');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'granth.json'), granthJson, 'utf8');
console.log('wrote content/granth.json (FULL):', out.length, 'items |', readable, 'readable |', missing, 'coming-soon');
console.log('per subcategory:', JSON.stringify(perSub));
console.log('sub labels:', JSON.stringify(SUB_LABEL));
