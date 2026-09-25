// tools/scrape/00-harvest-curated.js
// One-off migration: rescues hand-authored items (real hCont) that live in the
// placeholder manifests (stotra/chalisa/stuti/bhakti/katha/misc) BEFORE those
// files are regenerated from the scrape cache. Writes tools/scrape/curated.json,
// which 03-build.js merges back in so no hand-written content is ever lost.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');
const TEXT = path.join(CONTENT, 'text');
const TBC = 'TBC#';

const PLACEHOLDER_CATS = ['stotra', 'chalisa', 'stuti', 'bhakti', 'katha', 'misc'];
// Where each rescued item should live in the new taxonomy.
const HOME = {
  'Namokar-Mahamantra': 'bhakti',
  'Prabhu_Patit_Paavan': 'bhakti',
  'Prabhu_Shri_Aadinath_Ji_Chalisa': 'chalisa'
};

function isReal(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s !== TBC;
}

const found = new Map();
const log = [];

for (const cat of PLACEHOLDER_CATS) {
  const mf = path.join(CONTENT, cat + '.json');
  if (!fs.existsSync(mf)) continue;
  const arr = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (!Array.isArray(arr)) continue;
  arr.forEach(item => {
    if (item.hasContent !== true) return;
    if (found.has(item._id)) { log.push(`  dup  ${cat}/${item._id} (already kept)`); return; }
    const tf = path.join(TEXT, cat, item.cref + '.json');
    if (!fs.existsSync(tf)) { log.push(`  MISS ${cat}/${item._id} -> no text file ${item.cref}.json`); return; }
    const body = JSON.parse(fs.readFileSync(tf, 'utf8'));
    if (!isReal(body.hCont)) { log.push(`  empty ${cat}/${item._id}`); return; }
    found.set(item._id, {
      _id: item._id,
      hName: item.hName,
      eName: item.eName,
      eCtg: item.eCtg,
      hCtg: item.hCtg,
      eBrief: item.eBrief,
      hAuth: item.hAuth,
      hBrief: body.hBrief || TBC,
      hCont: body.hCont,
      foundIn: cat,
      home: HOME[item._id] || null
    });
    log.push(`  KEEP ${cat}/${item._id} | ${item.hName} | ${body.hCont.length} chars -> ${HOME[item._id] || '?'}`);
  });
}

const curated = Array.from(found.values());
const unplaced = curated.filter(c => !c.home).map(c => c._id);
if (unplaced.length) {
  console.error('ERROR: no target category for: ' + unplaced.join(', '));
  console.error('Add them to the HOME map above and re-run.');
  process.exit(1);
}

fs.writeFileSync(path.join(__dirname, 'curated.json'), JSON.stringify(curated, null, 2), 'utf8');
console.log(log.join('\n'));
console.log(`\nwrote tools/scrape/curated.json with ${curated.length} hand-authored items`);
