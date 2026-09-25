// tools/check-granth.js — Check granth HTML structure
const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, 'scrape', 'cache');
const files = fs.readdirSync(cacheDir).filter(f => f.includes('teeka'));

if (files.length === 0) {
  console.log('No teeka files found');
  process.exit(1);
}

const file = files[0];
const html = fs.readFileSync(path.join(cacheDir, file), 'utf8');

console.log(`=== Checking ${file}`);
console.log(`Total length: ${html.length}`);

// Look for different content divs
const poojaDiv = html.match(/<div class=pooja>/);
const mainDiv = html.match(/<div class=main>/);
const contentDiv = html.match(/<div class=content>/);
const textDiv = html.match(/<div class=text>/);

console.log('\n=== Content divs found:');
console.log('  <div class=pooja>:', !!poojaDiv);
console.log('  <div class=main>:', !!mainDiv);
console.log('  <div class=content>:', !!contentDiv);
console.log('  <div class=text>:', !!textDiv);

// Look for Hindi text
const hindiMatch = html.match(/[\u0900-\u097F]{10,}/);
if (hindiMatch) {
  const idx = html.indexOf(hindiMatch[0]);
  console.log('\n=== First Hindi text (500 chars):');
  console.log(html.substring(Math.max(0, idx - 100), idx + 500));
}

// Look for collapsible sections
const collapsibleCount = (html.match(/data-role=collapsible/g) || []).length;
console.log('\n=== Collapsible sections:', collapsibleCount);

// Look for table content
const tableCount = (html.match(/<table/g) || []).length;
console.log('=== Tables:', tableCount);
