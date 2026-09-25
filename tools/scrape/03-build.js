// tools/scrape/03-build.js — Parse cached HTML and transform to target JSON schema
const fs = require('fs');
const path = require('path');

const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));
const cacheDir = path.join(__dirname, 'cache');
const contentDir = path.join(__dirname, '..', '..', 'content');

// Extract prayer content from HTML
function extractPrayerContent(html) {
  let content = '';
  
  // Try to find ALL <div class=pooja> elements and concatenate them
  const poojaMatches = html.match(/<div class=pooja[^>]*>[\s\S]*?<\/div>/g);
  
  if (poojaMatches && poojaMatches.length > 0) {
    // Extract content from each pooja div and concatenate
    const contents = poojaMatches.map(div => {
      const innerMatch = div.match(/<div class=pooja[^>]*>([\s\S]*?)<\/div>/);
      return innerMatch ? innerMatch[1] : '';
    });
    content = contents.join('\n');
  } else {
    // For granths, extract everything from <div class=main> to the end of the content section
    // This includes multiple adhikaar divs
    const mainStart = html.indexOf('<div class=main>');
    if (mainStart >= 0) {
      // Find the end of the content section (look for closing tags or next major section)
      const contentSection = html.substring(mainStart);
      
      // Extract all text content, including from nested divs
      // Stop at common end markers
      const endMarkers = ['<div data-role=footer>', '<div data-role=panel', '</body>'];
      let endIdx = contentSection.length;
      for (const marker of endMarkers) {
        const idx = contentSection.indexOf(marker);
        if (idx > 0 && idx < endIdx) {
          endIdx = idx;
        }
      }
      
      content = contentSection.substring(0, endIdx);
    }
  }
  
  if (!content) return null;
  
  // Clean up the content
  content = content
    .replace(/<\/?br\s*\/?>/gi, '\n')  // Convert <br> to newlines
    .replace(/<[^>]+>/g, '')            // Strip all other HTML tags
    .replace(/&nbsp;/g, ' ')            // Replace &nbsp;
    .replace(/&amp;/g, '&')             // Decode entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\uFEFF/g, '')             // Remove BOM
    .replace(/\uFFFD/g, '')             // Remove replacement characters
    .replace(/\r\n/g, '\n')             // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')         // Collapse multiple blank lines
    .trim();
  
  return content;
}

/**
 * Some bhajan pages don't embed the lyrics — their <div class=pooja> holds a
 * relative path to an external .txt file (e.g. "../../09_पू-.../main/x.txt").
 * Those .txt files 404 on the source server, so the path is not real content.
 * Detect a bare file-path reference so we can mark it "coming soon" instead of
 * showing a confusing raw path to the user.
 */
function isTxtPathReference(content) {
  const c = (content || '').trim();
  // A bare path: ends in .txt, contains a slash, and has no whitespace.
  return /\.txt$/i.test(c) && c.includes('/') && !/\s/.test(c);
}

// Generate English transliteration (simple heuristic)
function transliterate(hindi) {
  const map = {
    'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo',
    'ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
    'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng',
    'च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
    'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
    'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
    'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
    'य':'y','र':'r','ल':'l','व':'v','श':'sh',
    'ष':'sh','स':'s','ह':'h',
    'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo',
    'े':'e','ै':'ai','ो':'o','ौ':'au',
    'ं':'n','ः':'h','ँ':'n','़':'',
    '्':'','॥':'||','।':'|','ॐ':'Om'
  };
  let result = '';
  for (let i = 0; i < hindi.length; i++) {
    result += map[hindi[i]] || hindi[i];
  }
  return result.replace(/\s+/g,' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// Convert Hindi title to snake_case ID
function toId(title) {
  return title
    .replace(/[^\u0900-\u097Fa-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function generateBrief(title, category) {
  const desc = { 
    bhajan:'A devotional song', 
    pooja:'A prayer or worship text', 
    granth:'A sacred text or scripture' 
  };
  return `${desc[category] || 'A prayer'}: ${title}`;
}

// Process all items
function processItems() {
  const items = index.items.filter(i => i.category !== 'skip');
  const byCategory = {};
  const usedIds = new Set();  // Track used IDs to ensure uniqueness
  
  for (const item of items) {
    const cacheFile = item.href.replace(/[\/\\]/g, '_').replace(/\.html$/, '.html');
    const cachePath = path.join(cacheDir, cacheFile);
    
    if (!fs.existsSync(cachePath)) {
      console.warn(`  Skipping ${item.title}: cache file not found`);
      continue;
    }
    
    const html = fs.readFileSync(cachePath, 'utf8');
    const content = extractPrayerContent(html);
    
    if (!content) {
      console.warn(`  Skipping ${item.title}: no content found`);
      continue;
    }
    
    // Remove BOM from content
    let cleanContent = content.replace(/^\uFEFF/, '');
    
    // Remove replacement characters (corrupted UTF-8)
    cleanContent = cleanContent.replace(/\uFFFD/g, '');

    // If the "content" is just a path to a missing external .txt file,
    // treat it as unavailable rather than showing a raw file path to users.
    if (isTxtPathReference(cleanContent)) {
      cleanContent = 'TBC#';
    }

    let id = toId(item.title);
    
    // Ensure ID uniqueness by appending a counter if needed
    let uniqueId = id;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}_${counter}`;
      counter++;
    }
    usedIds.add(uniqueId);
    
    // Clean the title of replacement characters
    const cleanTitle = item.title.replace(/\uFFFD/g, '');
    
    const eName = transliterate(cleanTitle);
    const eBrief = generateBrief(cleanTitle, item.category);
    
    const processed = {
      _id: uniqueId, _index: 0,
      eBrief: eBrief,
      eCtg: item.category.charAt(0).toUpperCase() + item.category.slice(1),
      eName: eName,
      eNext: 'TBC#', ePrev: 'TBC#',
      hAuth: 'TBC#', hBrief: 'TBC#',
      hCont: cleanContent,
      hCtg: item.category === 'bhajan' ? 'भजन' : item.category === 'pooja' ? 'पूजा' : item.category === 'aarti' ? 'आरती' : 'ग्रन्थ',
      hName: cleanTitle,
      isActive: true
    };
    
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(processed);
  }
  
  // Set _index and eNext/ePrev
  for (const catItems of Object.values(byCategory)) {
    catItems.forEach((item, idx) => {
      item._index = idx;
      if (idx > 0) item.ePrev = catItems[idx - 1]._id;
      if (idx < catItems.length - 1) item.eNext = catItems[idx + 1]._id;
    });
  }
  
  return byCategory;
}

// Write content files
function writeContentFiles(byCategory) {
  const fileMap = { 
    'bhajan': 'bhajan.json', 
    'pooja': 'pooja.json', 
    'granth': 'granth.json',
    'aarti': 'aarti.json'
  };
  
  for (const [cat, items] of Object.entries(byCategory)) {
    const filename = fileMap[cat];
    if (!filename) {
      console.log(`  Skipping category ${cat}: no file mapping`);
      continue;
    }
    const outputPath = path.join(contentDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf8');
    console.log(`  Wrote ${outputPath}: ${items.length} items`);
  }
}

// Update categories.json
function updateCategories() {
  const categories = [
    { id: 'pooja', label: 'पूजा', icon: '🙏' },
    { id: 'bhajan', label: 'भजन', icon: '🎵' },
    { id: 'granth', label: 'ग्रन्थ', icon: '📖' },
    { id: 'stotra', label: 'स्तोत्र', icon: '📜' },
    { id: 'aarti', label: 'आरती', icon: '🪔' },
    { id: 'chalisa', label: 'चालीसा', icon: '📖' },
    { id: 'stuti', label: 'स्तुति', icon: '🎵' },
    { id: 'bhakti', label: 'भक्ति', icon: '🙏' },
    { id: 'katha', label: 'कथा-कहानी', icon: '📚' },
    { id: 'misc', label: 'अन्य पाठ्य क्रम', icon: '📋' }
  ];
  const outputPath = path.join(contentDir, 'categories.json');
  fs.writeFileSync(outputPath, JSON.stringify(categories, null, 2), 'utf8');
  console.log(`  Updated ${outputPath}`);
}

console.log('=== Processing cached HTML files...');
const byCategory = processItems();

console.log('\n=== Writing content files...');
writeContentFiles(byCategory);

console.log('\n=== Updating categories.json...');
updateCategories();

console.log('\n=== Summary:');
for (const [cat, items] of Object.entries(byCategory)) {
  console.log(`  ${cat}: ${items.length} items`);
}
console.log('\n=== Done!');
