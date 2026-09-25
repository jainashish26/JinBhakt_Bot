// tools/scrape/00-inspect-saved.js — throwaway probe for the hand-saved
// jainsamaj.world pages under tools/scrape/jainsamaj.world/<Cat>/.
// Reports structure so the real ingester can be written against it.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, 'jainsamaj.world');

const SELS = [
  'div[data-role="pageContent"]', '.cCmsRecordContent', 'div.cCmsRecord',
  '.ipsType_richText', 'article', '#elPageContent', 'main',
  '.ipsCommentContainer', '.cAuthorContent', '.cWidgetContainer',
  'div[data-controller*="core.front"]'
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.html?$/i.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC, []);
console.log('total html files:', files.length);

// --- replicate the cleaning logic of 06-ingest-jinvani.js for probing ---
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
function domToText(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  const JUNK = 'script, style, noscript, iframe, form, nav, header, footer, ' +
    '.ipsCommentContainer, .cShareLinks, .cAuthorPane, .ipsPagination, ' +
    '.ipsPageHeader, [data-role="commentFeed"], [data-controller="core.front' +
    '.core.commentFeed"], .ipsReactips, .cWidgetContainer > .ipsWidget_header';
  clone.querySelectorAll(JUNK).forEach(el => el.remove());
  clone.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre')
    .forEach(el => { el.insertBefore(clone.ownerDocument.createTextNode('\n'), el.firstChild); });
  return decodeAndClean(clone.innerHTML)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const probe = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (probe) {
  const html = fs.readFileSync(probe, 'utf8').replace(/^\uFEFF/, '');
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;
  const out = [];
  const art = doc.querySelector('article');
  out.push('=== article children structure ===');
  if (art) {
    (function dump(el, depth) {
      if (depth > 4) return;
      for (const c of el.children) {
        const cls = c.getAttribute('class') || '';
        const dr = c.getAttribute('data-role') || '';
        const dc = c.getAttribute('data-controller') || '';
        out.push('  '.repeat(depth) + `<${c.tagName.toLowerCase()} id=${c.id || '-'} class="${cls.slice(0, 80)}" data-role="${dr}" data-controller="${dc}"> len=${c.textContent.replace(/\s+/g, ' ').trim().length}`);
        dump(c, depth + 1);
      }
    })(art, 0);
  }
  out.push('\n=== h1 locations ===');
  doc.querySelectorAll('h1').forEach((h, i) => {
    let chain = [];
    for (let e = h; e && e.tagName !== 'BODY'; e = e.parentElement) chain.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
    out.push(`h1[${i}] "${h.textContent.replace(/\s+/g, ' ').trim()}"  chain: ${chain.join(' > ').slice(-160)}`);
  });
  out.push('\n=== domToText(article) FULL ===');
  out.push(domToText(art));
  out.push('\n=== domToText(main) FULL ===');
  out.push(domToText(doc.querySelector('main')));
  const cc = doc.querySelector('div[data-role="commentContent"]');
  out.push('\n=== domToText(commentContent) FULL, len=' + (cc ? domToText(cc).length : 0) + ' ===');
  out.push(domToText(cc));
  out.push('\n=== time elements ===');
  doc.querySelectorAll('time').forEach(t => out.push('  datetime=' + t.getAttribute('datetime') + ' text=' + t.textContent.trim().slice(0, 60)));
  out.push('\n=== author-ish elements ===');
  for (const sel of ['[data-role="author"] .ipsType_normal', '.cAuthorPane .ipsType_normal', '.cAuthorPane a', 'a[data-role="author"]', '.ipsType_light a']) {
    doc.querySelectorAll(sel).forEach(e => out.push(`  ${sel} -> "${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80)}"`));
  }
  fs.writeFileSync(path.join(ROOT, '_probe_out.txt'), out.join('\n'), 'utf8');
  console.log('wrote _probe_out.txt', out.join('\n').length, 'chars');
  process.exit(0);
}


// one sample per category folder + og:url survey of ALL files
const vc = new VirtualConsole();
const byCat = {};
const urlCounts = {};
for (const f of files) {
  const cat = path.basename(path.dirname(f));
  (byCat[cat] = byCat[cat] || []).push(f);
  try {
    const html = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
    const dom = new JSDOM(html, { virtualConsole: vc });
    const doc = dom.window.document;
    const canon = doc.querySelector('link[rel="canonical"]');
    const og = doc.querySelector('meta[property="og:url"]');
    const u = (canon && canon.getAttribute('href')) || (og && og.getAttribute('content')) || '(none)';
    const m = String(u).match(/jainsamaj\.world\/([a-z.\-]+)(?:\/([a-z\-]+))?/i);
    const key = m ? (m[2] ? m[1] + '/' + m[2] : m[1]) : u;
    urlCounts[key] = (urlCounts[key] || 0) + 1;
    if (m && m[1] !== 'jinvani.html') console.log('NON-JINVANI URL in', cat, ':', u);
    if (!m) console.log('ODD URL in', cat, ':', u);
  } catch (e) { console.log('PARSE FAIL', f, e.message); }
}
console.log('\n=== og:url section survey ===');
Object.entries(urlCounts).sort().forEach(([k, v]) => console.log(' ', k, '=', v));

console.log('\n=== per-folder sample detail ===');
for (const cat of Object.keys(byCat).sort()) {
  const f = byCat[cat][0];
  console.log('\n=====', cat, '(', byCat[cat].length, 'files ) e.g.', path.basename(f));
  const html = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
  const dom = new JSDOM(html, { virtualConsole: vc });
  const doc = dom.window.document;
  const canon = doc.querySelector('link[rel="canonical"]');
  const og = doc.querySelector('meta[property="og:url"]');
  console.log('  canon :', canon && canon.getAttribute('href'));
  console.log('  ogurl :', og && og.getAttribute('content'));
  const h1 = doc.querySelector('h1');
  console.log('  h1    :', h1 && JSON.stringify(h1.textContent.replace(/\s+/g, ' ').trim()));
  for (const s of SELS) {
    const els = doc.querySelectorAll(s);
    if (!els.length) continue;
    const lens = [...els].map(e => e.textContent.replace(/\s+/g, ' ').trim().length);
    console.log('  ', s, '->', els.length, 'first len', lens[0], 'max', Math.max(...lens));
  }
  const art = doc.querySelector('article');
  if (art) console.log('  article text preview:', JSON.stringify(art.textContent.replace(/\s+/g, ' ').trim().slice(0, 300)));
}
