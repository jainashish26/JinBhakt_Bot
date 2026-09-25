// TEMPORARY survey — structural audit of tools/scrape/jainsamaj.world/*.html
// Prints per-file: commentContent count, h1 count/title, og:url, body length,
// and locates the junk widgets (announcement bar / share links) inside <main>.
// Delete after the ingest work is done.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'scrape', 'jainsamaj.world');
const out = [];

function walk(dir) {
  const res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) res.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.html')) res.push(p);
  }
  return res;
}

function domToText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('script,style,iframe,form,button,nav,select,input,svg,time,' +
    '.ipsComment,.ipsComments,.ipsPager,.ipsPagination,.ipsWidget_tabs,' +
    '.ipsReactList,.ipsPageHeader,.ipsBox_section--secondary,.cShareLinks,' +
    '[data-role="commentMeta"],[data-role="commentTools"],[data-role="shareLinks"],' +
    '.ipsList_reset--spaced,.cAuthorCarousel,.cAuthorTooltip,[data-role="authorCarousel"]')
    .forEach(n => n.remove());
  let text = clone.textContent || '';
  text = text.replace(/\u00a0/g, ' ').replace(/[\u2018\u2019]/g, "'");
  text = text.replace(/[\u201c\u201d]/g, '"').replace(/\u2013/g, '-').replace(/\u2014/g, '--');
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[ \t]+/g, ' ').replace(/^ | $/g, '');
    lines.push(line);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n{2,}/g, '\n').trim();
}

const files = walk(SRC);
out.push('TOTAL FILES: ' + files.length);
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const { window } = new JSDOM(html).window;
  const document = window.document;
  const rel = path.relative(SRC, f);
  const h1 = document.querySelector('h1');
  const h1t = h1 ? (h1.textContent || '').replace(/\s+/g, ' ').trim() : '(none)';
  const og = document.querySelector('meta[property="og:url"]');
  const ogc = og ? og.getAttribute('content') : '(none)';
  const times = document.querySelectorAll('time');
  const t0 = times.length ? (times[0].getAttribute('datetime') || '?') : '-';
  // is the first <time> inside the comment/record header?
  const inComment = times.length && times[0].closest('[data-controller="core.front.core.comment"]') ? 'Y' : 'N';
  const cc = document.querySelector('div[data-role="commentContent"]');
  const len = cc ? domToText(cc).length : 0;
  out.push([rel, '| h1=' + h1t, '| og=' + ogc.replace('https://jainsamaj.world/jinvani.html', ''),
    '| times=' + times.length, '| t0=' + t0, '| inComment=' + inComment, '| len=' + len].join(' '));
  window.close();
}
fs.writeFileSync(path.join(ROOT, '_survey_out.txt'), out.join('\n'), 'utf8');
console.log('wrote _survey_out.txt (' + files.length + ' files)');

