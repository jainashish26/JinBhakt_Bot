// tools/scrape/00-report.js — inventory of source.html links vs. cache
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const src = fs.readFileSync(path.join(DIR, '..', '..', 'source.html'), 'utf8');
const cacheFiles = new Set(fs.readdirSync(path.join(DIR, 'cache')));

// hrefs in source.html are UNQUOTED: href=./jainDataBase/...
const all = [];
const seen = new Set();
const re = /href=["']?\.\/jainDataBase\/([^"'\s>]+)["']?/gi;
let m;
while ((m = re.exec(src))) {
  let href = m[1];
  if (/\.(jpg|jpeg|png|gif|mp3|mp4|pdf|css|js)$/i.test(href)) continue;
  try { href = decodeURIComponent(href); } catch (e) { /* leave as-is */ }
  if (href.includes('\uFFFD')) continue;   // mojibake duplicate entries
  if (seen.has(href)) continue;
  seen.add(href);
  all.push(href);
}

// titles from the searchTitle <ul>
const titles = new Map();
const sm = src.match(/id=searchTitle[^>]*>([\s\S]*?)<\/ul>/);
if (sm) {
  const li = /<li[^>]*><a[^>]*href=([^\s>]+)[^>]*>(\d+)\)\s*([^<]+)<\/a><\/li>/g;
  let t;
  while ((t = li.exec(sm[1])) !== null) {
    titles.set(decodeURIComponent(t[1].replace(/["']/g, '')), t[3].trim());
  }
}

function cached(href) {
  const flat = 'jainDataBase_' + href.replace(/\//g, '_');
  return cacheFiles.has(flat) || cacheFiles.has('._' + flat);
}

const out = [];
out.push('total jainDataBase links: ' + all.length);
out.push('titles from searchTitle: ' + titles.size);
out.push('cached: ' + all.filter(cached).length + ' | missing: ' + all.filter(h => !cached(h)).length);
out.push('cache files (unique basenames): ' + cacheFiles.size);

const sec = {};
all.forEach(h => {
  const parts = h.split('/');
  const key = parts.length > 2 && parts[1].match(/^\d+_/) ? parts[0] + '/' + parts[1] : parts[0];
  sec[key] = (sec[key] || 0) + 1;
});
out.push('\nBY SECTION:');
Object.keys(sec).sort().forEach(k => out.push('   ' + k + ' = ' + sec[k]));

const bj = {};
all.filter(h => h.startsWith('bhajans/')).forEach(h => { const d = h.split('/')[1] || '(root)'; bj[d] = (bj[d] || 0) + 1; });
out.push('\nBHAJAN FOLDERS (' + Object.keys(bj).length + '):');
Object.keys(bj).sort().forEach(k => out.push('   ' + k + ' = ' + bj[k] + '  cached=' + all.filter(h => h.startsWith('bhajans/' + k + '/')).filter(cached).length));

out.push('\nMISSING from cache (' + all.filter(h => !cached(h)).length + '):');
all.filter(h => !cached(h)).slice(0, 250).forEach(h => out.push('   ' + h));

const KW = ['आरती', 'चालीसा', 'स्तोत्र', 'स्तुति', 'स्तवन', 'वंदना', 'भक्ति', 'कीर्तन', 'मंत्र', 'कथा', 'कहानी', 'पाठ'];
out.push('\nKEYWORD HITS (poojas + bhajans):');
KW.forEach(k => {
  const hits = all.filter(h => (h.startsWith('poojas/') || h.startsWith('bhajans/')) && h.includes(k));
  out.push('\n   ' + k + ' = ' + hits.length);
  hits.slice(0, 60).forEach(h => out.push('       ' + h));
});

out.push('\nPOOJAS full list:');
all.filter(h => h.startsWith('poojas/')).forEach(h => out.push('   ' + (cached(h) ? '[C] ' : '[ ] ') + h));

fs.writeFileSync(path.join(DIR, '..', '..', '_report.txt'), out.join('\n'), 'utf8');
console.log('wrote _report.txt (' + out.length + ' lines)');
