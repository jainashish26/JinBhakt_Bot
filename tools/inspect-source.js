// tools/scrape/01-build-index.js — Extract all items from source.html searchTitle list
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('source.html', 'utf8');

// Find the searchTitle list
const searchTitleMatch = html.match(/id=searchTitle[^>]*>([\s\S]*?)<\/ul>/);
if (!searchTitleMatch) {
  console.error('Could not find searchTitle list');
  process.exit(1);
}

const searchList = searchTitleMatch[1];

// Extract all items: <li><a href=...>NUMBER) TITLE</a></li>
const items = [];
const liPattern = /<li[^>]*><a[^>]*href=([^\s>]+)[^>]*>(\d+)\)\s*([^<]+)<\/a><\/li>/g;
let match;

while ((match = liPattern.exec(searchList)) !== null) {
  const href = match[1].replace(/["']/g, '');
  const num = parseInt(match[2]);
  const title = match[3].trim();
  
  // Determine category from URL path
  let category = 'misc';
  if (href.includes('/bhajans/')) category = 'bhajan';
  else if (href.includes('/poojas/')) category = 'pooja';
  else if (href.includes('/gatha/')) category = 'granth';
  else if (href.includes('/egranth/')) category = 'granth';
  else if (href.includes('/teeka/')) category = 'granth';
  else if (href.includes('/shastra/')) category = 'granth';
  else if (href.includes('/youtube/') || href.includes('/youtube-animation/')) category = 'skip';
  
  items.push({ num, title, href, category });
}

console.log(`=== Extracted ${items.length} items from searchTitle list`);

// Group by category
const byCategory = {};
for (const item of items) {
  if (!byCategory[item.category]) byCategory[item.category] = [];
  byCategory[item.category].push(item);
}

console.log('\n=== Items by category:');
for (const [cat, catItems] of Object.entries(byCategory)) {
  console.log(`  ${cat}: ${catItems.length} items`);
}

// Save the index
const outputPath = path.join(__dirname, 'index.json');
fs.writeFileSync(outputPath, JSON.stringify({ items, byCategory }, null, 2), 'utf8');
console.log(`\n=== Saved index to ${outputPath}`);

// Show first few items from each category
console.log('\n=== Sample items:');
for (const [cat, catItems] of Object.entries(byCategory)) {
  console.log(`\n${cat}:`);
  for (const item of catItems.slice(0, 3)) {
    console.log(`  ${item.num}. ${item.title} → ${item.href.substring(0, 60)}...`);
  }
}
