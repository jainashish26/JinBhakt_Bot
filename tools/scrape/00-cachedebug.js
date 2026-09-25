// tools/scrape/00-cachedebug.js — diagnose why cache lookups miss
const fs = require('fs');
const path = require('path');
const cacheDir = path.join(__dirname, 'cache');
const files = fs.readdirSync(cacheDir);
console.log('cacheDir:', cacheDir, 'files:', files.length);

const aarti = files.filter(f => f.includes('आरती'));
console.log('\n-- files containing आरती (' + aarti.length + '):');
aarti.slice(0, 8).forEach(f => {
  console.log('  [' + f.length + '] ' + f);
  console.log('      NFC? ' + (f === f.normalize('NFC')) + '  NFD? ' + (f === f.normalize('NFD')));
});

console.log('\n-- first 10 files overall:');
files.slice(0, 10).forEach(f => console.log('  ' + JSON.stringify(f)));

const idx = require(path.join(__dirname, 'index.json'));
const want = idx.items.find(i => i.rel.startsWith('poojas/11_'));
const flat = want.href.replace(/^\.\//, '').replace(/[\/\\]/g, '_');
console.log('\n-- expected key for first aarti:');
console.log('  ' + JSON.stringify(flat));
console.log('  NFC? ' + (flat === flat.normalize('NFC')) + '  NFD? ' + (flat === flat.normalize('NFD')));
console.log('  exists(raw)   ' + fs.existsSync(path.join(cacheDir, flat)));
console.log('  exists(NFC)   ' + fs.existsSync(path.join(cacheDir, flat.normalize('NFC'))));
console.log('  exists(NFD)   ' + fs.existsSync(path.join(cacheDir, flat.normalize('NFD'))));
console.log('  exists(_NFC)  ' + fs.existsSync(path.join(cacheDir, '_' + flat.normalize('NFC'))));
console.log('  exists(._raw) ' + fs.existsSync(path.join(cacheDir, '._' + flat)));

// Do any cache files NFC-normalise onto the expected key?
const target = flat.normalize('NFC');
const matchByNorm = files.filter(f => f.normalize('NFC') === target || ('_' + f).normalize('NFC') === target || f.normalize('NFC') === '_' + target);
console.log('  normalised matches: ' + matchByNorm.length + ' ' + JSON.stringify(matchByNorm.slice(0, 3)));
