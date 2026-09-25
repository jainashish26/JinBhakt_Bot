// tools/scrape/00-inspect.js — quick ad-hoc inspection of index.json
// usage: node tools/scrape/00-inspect.js [category] [substring]
const path = require('path');
const idx = require(path.join(__dirname, 'index.json'));
const cat = process.argv[2];
const needle = process.argv[3];

let items = idx.items;
if (cat && cat !== '*') items = items.filter(i => i.category === cat);
if (needle) items = items.filter(i => i.rel.includes(needle) || i.title.includes(needle));

console.log(`matched ${items.length} items`);
items.slice(0, 200).forEach(i => console.log(`  ${i.category.padEnd(7)} ${i.sub.padEnd(22)} ${i.title}`));

// how many have a cached page?
const fs = require('fs');
const cacheDir = path.join(__dirname, 'cache');
let hit = 0, miss = 0;
const missing = [];
for (const i of items) {
  const flat = i.href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
  const a = path.join(cacheDir, flat);
  const b = path.join(cacheDir, '_' + flat);
  if (fs.existsSync(a) || fs.existsSync(b)) hit++;
  else { miss++; missing.push(i.rel); }
}
console.log(`cache: hit=${hit} miss=${miss}`);
missing.slice(0, 40).forEach(m => console.log('  MISSING ' + m));
