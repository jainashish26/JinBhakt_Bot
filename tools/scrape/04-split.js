// tools/scrape/04-split.js
// Splits each content/<cat>.json (full items with hCont) into:
//   1. content/<cat>.json  -> lightweight METADATA MANIFEST (no hCont/hBrief)
//   2. content/text/<cat>/<cref>.json -> { hCont, hBrief } for items with real content
// This makes startup load only tiny manifests (~500KB total instead of ~52MB),
// fetching each prayer's body on demand when the reader opens it.
//
// Safe to re-run: reads the current content/<cat>.json. If it is already a
// manifest (items lack hCont), it rebuilds text files from content_backup/.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');
const BACKUP = path.join(ROOT, 'content_backup');
const TEXT_DIR = path.join(CONTENT, 'text');

const TBC = 'TBC#';
function isReal(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s !== TBC;
}

const cats = JSON.parse(fs.readFileSync(path.join(CONTENT, 'categories.json'), 'utf8')).map(c => c.id);

// Prefer the full-data backup as the source of truth if current files are already manifests.
function loadSource(cat) {
  const curPath = path.join(CONTENT, cat + '.json');
  const bakPath = path.join(BACKUP, cat + '.json');
  const cur = fs.existsSync(curPath) ? JSON.parse(fs.readFileSync(curPath, 'utf8')) : null;
  // If current already looks like a manifest (no hCont anywhere) and backup has hCont, use backup.
  const curHasCont = Array.isArray(cur) && cur.some(i => Object.prototype.hasOwnProperty.call(i, 'hCont'));
  if (!curHasCont && fs.existsSync(bakPath)) {
    const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
    if (Array.isArray(bak) && bak.some(i => Object.prototype.hasOwnProperty.call(i, 'hCont'))) {
      console.log(`  ${cat}: current is a manifest -> rebuilding text from content_backup/`);
      return bak;
    }
  }
  return cur;
}

let totalItems = 0, totalText = 0, totalReadable = 0;

// Clean the text dir for a fresh, consistent split
if (fs.existsSync(TEXT_DIR)) fs.rmSync(TEXT_DIR, { recursive: true, force: true });
fs.mkdirSync(TEXT_DIR, { recursive: true });

for (const cat of cats) {
  const items = loadSource(cat);
  if (!Array.isArray(items)) { console.log(`  ${cat}: SKIP (no source array)`); continue; }

  const catTextDir = path.join(TEXT_DIR, cat);
  fs.mkdirSync(catTextDir, { recursive: true });

  const manifest = [];
  let textCount = 0, readable = 0;

  items.forEach((item, pos) => {
    const cref = pos;                       // content reference = position in manifest
    const hasCont = isReal(item.hCont);
    if (hasCont) {
      // Write the lazy content file
      const payload = { hCont: item.hCont };
      if (isReal(item.hBrief)) payload.hBrief = item.hBrief;
      fs.writeFileSync(path.join(catTextDir, cref + '.json'), JSON.stringify(payload), 'utf8');
      textCount++; readable++;
    }

    // Manifest item = metadata only (strip the big content fields)
    const meta = {};
    for (const k of Object.keys(item)) {
      if (k === 'hCont' || k === 'hBrief') continue;
      meta[k] = item[k];
    }
    meta.cref = cref;
    meta.hasContent = hasCont;
    manifest.push(meta);
  });

  fs.writeFileSync(path.join(CONTENT, cat + '.json'), JSON.stringify(manifest, null, 1), 'utf8');
  const manKB = (fs.statSync(path.join(CONTENT, cat + '.json')).size / 1024).toFixed(1);
  console.log(`  ${cat}: ${items.length} items | ${readable} readable | ${textCount} text files | manifest ${manKB} KB`);
  totalItems += items.length; totalText += textCount; totalReadable += readable;
}

console.log('\n=== Split complete ===');
console.log('  total items:', totalItems, '| readable:', totalReadable, '| text files:', totalText);
