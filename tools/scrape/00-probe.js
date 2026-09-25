// tools/scrape/00-probe.js — Read-only: verify cache lookup + content extraction
// for one representative page of each target category.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(__dirname, 'cache');

// Cache files may carry a macOS AppleDouble "._" prefix on this checkout.
const names = fs.existsSync(CACHE) ? fs.readdirSync(CACHE) : [];
const byBare = new Map();
for (const n of names) byBare.set(n.startsWith('._') ? n.slice(2) : n, n);

function resolveCache(href) {
  const key = href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
  const real = byBare.get(key);
  return real ? path.join(CACHE, real) : null;
}

function extract(html) {
  let content = '';
  const poojaMatches = html.match(/<div class=pooja[^>]*>[\s\S]*?<\/div>/g);
  if (poojaMatches && poojaMatches.length) {
    content = poojaMatches.map(div => {
      const m = div.match(/<div class=pooja[^>]*>([\s\S]*?)<\/div>/);
      return m ? m[1] : '';
    }).join('\n');
  } else {
    const s = html.indexOf('<div class=main>');
    if (s >= 0) {
      const sec = html.substring(s);
      let end = sec.length;
      for (const marker of ['<div data-role=footer>', '<div data-role=panel', '</body>']) {
        const i = sec.indexOf(marker);
        if (i > 0 && i < end) end = i;
      }
      content = sec.substring(0, end);
    }
  }
  if (!content) return null;
  return content
    .replace(/<\/?(br|p|div|tr|li|h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\uFEFF/g, '').replace(/\uFFFD/g, '')
    .replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

const probes = [
  ['STOTRA', './jainDataBase/poojas/08_स्तोत्र/15_भक्तामर--आचार्य-मानतुंग/html/index.html'],
  ['STOTRA2', './jainDataBase/poojas/08_स्तोत्र/06_महावीराष्टक-स्तोत्र--पण्डित-भागचन्द्र/html/index.html'],
  ['STUTI/PAATH', './jainDataBase/poojas/06_पाठ/10_जिनवाणी-स्तुति/html/index.html'],
  ['PAATH2', './jainDataBase/poojas/06_पाठ/17_सामायिक-पाठ--आचार्य-अमितगति/html/index.html'],
  ['CHALISA', './jainDataBase/poojas/05_विसर्जन/08_भगवान-महावीर-चालीसा/html/index.html'],
  ['CHALISA2', './jainDataBase/poojas/05_विसर्जन/07_भगवान-आदिनाथ-चालीसा/html/index.html'],
  ['BHAKTI', './jainDataBase/poojas/06_पाठ/56_सिद्ध-श्रुत-आचार्य-भक्ति/html/index.html'],
  ['AARTI', './jainDataBase/poojas/11_आरती/05_भगवान-महावीर-आरती/html/index.html'],
  ['POOJA', './jainDataBase/poojas/02_नित्य-पूजा/08_समुच्च-पूजा--ब्रह्मचारी-सरदारमल/html/index.html'],
  ['BHAJAN', './jainDataBase/bhajans/01_देव/html/अंतर-में-आनंद-आयो.html'],
  ['MISC-TABLE', './jainDataBase/misc/GunsthanTable.html'],
  ['COMICS', './jainDataBase/jainComics/'],
];

for (const [label, href] of probes) {
  const p = resolveCache(href);
  if (!p) { console.log(`\n### ${label}: NO CACHE  (${href})`); continue; }
  const html = fs.readFileSync(p, 'utf8');
  const txt = extract(html);
  console.log(`\n### ${label}: ${path.basename(p)}`);
  console.log(`    html=${(html.length / 1024).toFixed(0)}KB  text=${txt ? txt.length : 0} chars  lines=${txt ? txt.split('\n').length : 0}`);
  if (txt) console.log('    preview: ' + JSON.stringify(txt.slice(0, 260)));
}
