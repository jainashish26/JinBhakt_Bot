// tools/scrape/01-build-index.js — Extract all items from source.html
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('source.html', 'utf8');

// Extract items from searchTitle list
const searchTitleMatch = html.match(/id=searchTitle[^>]*>([\s\S]*?)<\/ul>/);
const searchList = searchTitleMatch ? searchTitleMatch[1] : '';

// Extract all items from searchTitle: <li><a href=...>NUMBER) TITLE</a></li>
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
  else if (href.includes('/poojas/11_आरती/') || href.includes('/poojas/11_%E0%A4%86%E0%A4%B0%E0%A4%A4%E0%A5%80/')) category = 'aarti';
  else if (href.includes('/poojas/')) category = 'pooja';
  else if (href.includes('/gatha/')) category = 'granth';
  else if (href.includes('/egranth/')) category = 'granth';
  else if (href.includes('/teeka/')) category = 'granth';
  else if (href.includes('/shastra/')) category = 'granth';
  else if (href.includes('/youtube/') || href.includes('/youtube-animation/')) category = 'skip';
  
  items.push({ num, title, href, category, source: 'searchTitle' });
}

console.log(`Extracted ${items.length} items from searchTitle list`);

// Now extract gatha links from the entire HTML (they're not in searchTitle)
const gathaPattern = /href=["']?\.\/jainDataBase\/(gatha\/[^"'\s>]+\/html\/index\.html)["']?/g;
const gathaHrefs = new Set();
while ((match = gathaPattern.exec(html)) !== null) {
  gathaHrefs.add('./jainDataBase/' + match[1]);
}

// Extract title from gatha URL path
function extractTitleFromPath(href) {
  const parts = href.split('/');
  // Find the part with the title (usually after the category number)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && part !== 'html' && part !== 'index.html' && !part.match(/^\d+_/)) {
      return decodeURIComponent(part).replace(/-/g, ' ').replace(/_/g, ' ');
    }
    if (part && part.match(/^\d+_(.+)/)) {
      const titlePart = part.match(/^\d+_(.+)/)[1];
      return decodeURIComponent(titlePart).replace(/-/g, ' ').replace(/_/g, ' ');
    }
  }
  return 'Unknown';
}

// Add gatha items
const existingHrefs = new Set(items.map(i => i.href));
let gathaAdded = 0;
gathaHrefs.forEach(href => {
  if (!existingHrefs.has(href)) {
    const title = extractTitleFromPath(href);
    items.push({
      num: items.length + 1,
      title: title,
      href: href,
      category: 'granth',
      source: 'gatha'
    });
    existingHrefs.add(href);
    gathaAdded++;
  }
});

console.log(`Added ${gathaAdded} gatha items from HTML links`);

// Check for any other missing directories
const allHrefPattern = /href=["']?\.\/jainDataBase\/([^"'\s>]+\/html\/index\.html)["']?/g;
const allHrefs = new Set();
while ((match = allHrefPattern.exec(html)) !== null) {
  allHrefs.add('./jainDataBase/' + match[1]);
}

let otherAdded = 0;
allHrefs.forEach(href => {
  if (!existingHrefs.has(href)) {
    // Skip youtube and downloads
    if (href.includes('/youtube/') || href.includes('/youtube-animation/') || 
        href.includes('/downloads/') || href.includes('/crosswords/') ||
        href.includes('/wordSearch/') || href.includes('/jainExam/') ||
        href.includes('/jainComics/')) {
      return;
    }
    
    const title = extractTitleFromPath(href);
    let category = 'misc';
    if (href.includes('/bhajans/')) category = 'bhajan';
    else if (href.includes('/poojas/')) category = 'pooja';
    else if (href.includes('/gatha/') || href.includes('/egranth/') || 
             href.includes('/teeka/') || href.includes('/shastra/')) category = 'granth';
    
    items.push({
      num: items.length + 1,
      title: title,
      href: href,
      category: category,
      source: 'other'
    });
    existingHrefs.add(href);
    otherAdded++;
  }
});

console.log(`Added ${otherAdded} other items from HTML links`);
console.log(`\nTotal items: ${items.length}`);

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
