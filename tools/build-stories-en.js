#!/usr/bin/env node
/**
 * build-stories-en.js — Generate the English stories manifest from katha.json.
 *
 * Creates content/stories-en.json with 114 entries derived from the Hindi
 * katha manifest. All stories 1-114 have hasContent:true (body files exist).
 *
 * Usage: node tools/build-stories-en.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const katha = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'katha.json'), 'utf8'));

// Transliterate Hindi name → English slug.
// We use the eName field already in katha.json as the base, then clean it up.
function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildEnglishName(item) {
  // katha.json hName pattern: "X की कथा" or "Xकी कथा"
  const hName = item.hName || '';
  const cleaned = hName.replace(/\s*की\s*कथा$/i, '').replace(/कीकथा$/i, '').trim();
  // Use the eName as a romanized base
  const eName = item.eName || '';
  const cleanedE = eName.replace(/\s*ki\s*katha$/i, '').replace(/kikatha$/i, '').trim();
  // Capitalize first letter of each word
  const title = cleanedE.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return 'The Story of ' + (title || cleaned);
}

// Only take the 114 active stories (skip pending 115-116)
const stories = katha.filter(item => item.hasContent === true && item.cref >= 1 && item.cref <= 114);

console.log('Building manifest for', stories.length, 'stories...');

const manifest = stories.map((item, idx) => {
  const cref = item.cref;
  const padNum = String(cref).padStart(3, '0');
  const eName = buildEnglishName(item);
  const slug = padNum + '-' + slugify(eName.replace(/^The Story of /, ''));

  return {
    _id: slug,
    _index: idx,
    eBrief: 'A Jain story from the Aradhana Katha Kosh (English): ' + eName,
    eCtg: 'Stories',
    eName: eName,
    eNext: 'TBC#',
    ePrev: 'TBC#',
    hAuth: 'TBC#',
    hCtg: 'Stories (EN)',
    hName: item.hName,
    sub: 'Aradhana Katha Kosh',
    isActive: true,
    cref: cref,
    hasContent: cref <= 114  // all 1-114 have English body files
  };
});

// Second pass: fix ePrev/eNext pointers
for (let i = 0; i < manifest.length; i++) {
  manifest[i].ePrev = i > 0 ? manifest[i - 1]._id : 'TBC#';
  manifest[i].eNext = i < manifest.length - 1 ? manifest[i + 1]._id : 'TBC#';
}

// Write the manifest
const outPath = path.join(ROOT, 'content', 'stories-en.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

console.log('Wrote', manifest.length, 'entries to', path.relative(ROOT, outPath));
console.log('All stories 1-' + manifest.length + ' have hasContent:true');
