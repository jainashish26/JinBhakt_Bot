// tools/scrape/02-fetch.js — Download all prayer HTML pages with throttling and caching
const fs = require('fs');
const path = require('path');
const https = require('https');

const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));
const cacheDir = path.join(__dirname, 'cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Convert relative href to full URL
function hrefToUrl(href) {
  const cleanHref = href.replace(/^\.\//, '');
  return `https://nikkyjain.github.io/${cleanHref}`;
}

// Download a single URL with retry
function download(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const doRequest = (attempt) => {
      https.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (attempt < retries) {
            setTimeout(() => doRequest(attempt + 1), 1000);
          } else {
            reject(new Error(`Redirect failed after ${retries} attempts`));
          }
          return;
        }
        
        if (res.statusCode !== 200) {
          if (attempt < retries) {
            setTimeout(() => doRequest(attempt + 1), 1000);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', (err) => {
        if (attempt < retries) {
          setTimeout(() => doRequest(attempt + 1), 1000);
        } else {
          reject(err);
        }
      });
    };
    
    doRequest(1);
  });
}

// Process items with concurrency control
async function processWithConcurrency(items, concurrency, processor) {
  const results = [];
  const queue = [...items];
  
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const result = await processor(item);
      results.push(result);
    }
  }
  
  const workers = Array(concurrency).fill(null).map(() => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const allItems = index.items.filter(i => i.category !== 'skip');
  console.log(`=== Fetching ${allItems.length} items (excluding youtube/skip)...`);
  
  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  
  const results = await processWithConcurrency(allItems, 5, async (item) => {
    // Create cache filename from href
    const cacheFile = item.href.replace(/[\/\\]/g, '_').replace(/\.html$/, '.html');
    const cachePath = path.join(cacheDir, cacheFile);
    
    // Check cache
    if (fs.existsSync(cachePath)) {
      cached++;
      return { ...item, cached: true };
    }
    
    // Download
    try {
      const url = hrefToUrl(item.href);
      const html = await download(url);
      fs.writeFileSync(cachePath, html, 'utf8');
      downloaded++;
      
      if (downloaded % 50 === 0) {
        console.log(`  Progress: ${downloaded} downloaded, ${cached} cached, ${failed} failed`);
      }
      
      return { ...item, cached: false };
    } catch (err) {
      failed++;
      console.error(`  Failed: ${item.title} - ${err.message}`);
      return { ...item, error: err.message };
    }
  });
  
  console.log(`\n=== Fetch complete:`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Cached: ${cached}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${results.length}`);
}

main().catch(console.error);
