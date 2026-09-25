// tools/scrape/00-dump-poojas.js — Read-only: list every poojas/* and misc/* entry
// in source.html with its title, so we can design the category mapping.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'source.html'), 'utf8');

// <li ...><a ... href=./jainDataBase/...>N) TITLE</a></li>
const liRe = /<li[^>]*><a[^>]*href=(\.[^\s>]+)[^>]*>(?:\d+\)\s*)?([^<]+)<\/a><\/li>/g;
const rows = [];
let m;
while ((m = liRe.exec(html)) !== null) {
  const href = decodeURIComponent(m[1].replace(/["']/g, ''));
  if (!href.startsWith('./jainDataBase/')) continue;
  rows.push({ href, title: m[2].trim() });
}

const seen = new Set();
const groups = new Map();
const out = [];
for (const r of rows) {
  const rel = r.href.replace('./jainDataBase/', '');
  const parts = rel.split('/');
  if (parts[0] !== 'poojas' && parts[0] !== 'misc') continue;
  const key = parts[0] + '/' + (parts.length > 2 ? parts[1] : '(root)');
  if (!groups.has(key)) groups.set(key, []);
  const dup = r.href;
  if (seen.has(dup)) continue;
  seen.add(dup);
  groups.get(key).push(r);
}

for (const [key, items] of [...groups.entries()].sort()) {
  out.push(`\n===== ${key}  (${items.length}) =====`);
  items.forEach((it, i) => {
    out.push(`  ${String(i + 1).padStart(3)}. ${it.title}`);
    out.push(`        ${it.href.replace('./jainDataBase/', '')}`);
  });
}

fs.writeFileSync(path.join(ROOT, '_poojas.txt'), out.join('\n'), 'utf8');
console.log('wrote _poojas.txt —', out.length, 'lines');
