/**
 * English stories (stories-en) section tests.
 *
 * Covers:
 *   [24] Manifest integrity and body file existence
 *   [25] Reader view renders English content correctly
 *   [26] is-latin CSS class applied for native English
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = async function (ctx) {
  const { window, document, ok, txt, wait } = ctx;
  const app = window.jinbhaktApp;

  /* ------------------------------------------------------------------ */
  console.log('\n[24] English stories manifest + body files');

  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'content', 'stories-en.json'), 'utf8'));
  ok('stories-en.json has 114 entries', manifest.length === 114, 'got ' + manifest.length);

  const readable = manifest.filter(i => i.hasContent === true);
  const readableCount = readable.length;
  ok(readableCount + ' stories have body files', readableCount > 0, 'got ' + readableCount);

  // Check that all readable items have matching sequential cref values starting at 1
  const crefs = readable.map(i => i.cref).sort((a, b) => a - b);
  const expectedCrefs = Array.from({length: readableCount}, (_, i) => i + 1);
  ok('readable crefs are 1-' + readableCount, JSON.stringify(crefs) === JSON.stringify(expectedCrefs),
     'got ' + JSON.stringify(crefs));

  // Check every readable item has a body file
  let missingFiles = 0;
  readable.forEach(item => {
    const tf = path.join(ROOT, 'content', 'text', 'stories-en', item.cref + '.json');
    if (!fs.existsSync(tf)) missingFiles++;
  });
  ok('all readable stories have body files', missingFiles === 0, missingFiles + ' missing');

  // Check pending items have hasContent:false
  const pending = manifest.filter(i => i.hasContent !== true);
  ok((manifest.length - readableCount) + ' stories pending translation',
     pending.length === manifest.length - readableCount, 'got ' + pending.length);

  // Check _id uniqueness
  const ids = manifest.map(i => i._id);
  ok('_id values are unique', new Set(ids).size === ids.length,
     'dupes: ' + ids.filter((v, i) => ids.indexOf(v) !== i).slice(0, 3).join(','));

  // Check prev/next chain
  let chainOk = true;
  for (let i = 1; i < manifest.length; i++) {
    if (manifest[i].ePrev !== manifest[i - 1]._id) { chainOk = false; break; }
  }
  for (let j = 0; j < manifest.length - 1; j++) {
    if (manifest[j].eNext !== manifest[j + 1]._id) { chainOk = false; break; }
  }
  ok('prev/next chain is complete', chainOk);

  // Check categories.json includes stories-en
  const cats = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'content', 'categories.json'), 'utf8'));
  ok('categories.json includes stories-en',
     cats.some(c => c.id === 'stories-en'));

  // Check service worker caches the manifest
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  ok('service-worker caches stories-en.json',
     sw.indexOf("'./content/stories-en.json'") !== -1);

  /* ------------------------------------------------------------------ */
  console.log('\n[25] English stories reader view');

  // Navigate to stories-en category
  window.location.hash = '#/stories-en';
  await wait(400);
  ok('stories-en category view rendered',
     /Stories/.test(txt(document.querySelector('.cat-view-title'))),
     txt(document.querySelector('.cat-view-title')));

  const storyLinks = document.querySelectorAll('.item-list:not(.item-list-soon) .item-link');
  ok('lists ' + readableCount + ' readable stories', storyLinks.length === readableCount, 'got ' + storyLinks.length);

  const soonItems = document.querySelectorAll('.item-list-soon .item-row-disabled');
  const pendingCount = manifest.length - readableCount;
  ok('lists ' + pendingCount + ' pending stories', soonItems.length === pendingCount, 'got ' + soonItems.length);

  // Navigate to the first story
  window.location.hash = '#/stories-en/' + encodeURIComponent(manifest[0]._id);
  await wait(1800);
  const body = document.getElementById('prayer-body');
  ok('story reader title renders',
     !!document.querySelector('.reader-title') &&
     /Story of Patrakesari/.test(txt(document.querySelector('.reader-title'))),
     txt(document.querySelector('.reader-title')));
  ok('story body populated (>200 chars)',
     !!body && txt(body).length > 200, 'len=' + (body ? txt(body).length : 0));
  ok('story body contains English text',
     !!body && /[A-Z][a-z]+/.test(txt(body)),
     txt(body).slice(0, 60));
  ok('story body has HTML headings',
     !!body && body.querySelectorAll('h3').length > 0,
     'h3s=' + (body ? body.querySelectorAll('h3').length : 0));

  /* ------------------------------------------------------------------ */
  console.log('\n[26] is-latin CSS class for native English');

  ok('prayer body has is-latin class',
     !!body && body.classList.contains('is-latin'),
     'class=' + (body ? body.className : ''));

  // Confirm is-latin is NOT set on Hindi content
  window.location.hash = '#/katha/001-पात्रकेसरी-की-कथा';
  await wait(1800);
  const hBody = document.getElementById('prayer-body');
  ok('Hindi content does NOT have is-latin',
     !!hBody && !hBody.classList.contains('is-latin'),
     'class=' + (hBody ? hBody.className : ''));

  // Navigate back to English and confirm class is restored
  window.location.hash = '#/stories-en/' + encodeURIComponent(manifest[1]._id);
  await wait(1800);
  const enBody = document.getElementById('prayer-body');
  ok('second English story also has is-latin',
     !!enBody && enBody.classList.contains('is-latin'));
  ok('second story title renders',
     !!document.querySelector('.reader-title') &&
     /Story of Bhattaklankdev/.test(txt(document.querySelector('.reader-title'))),
     txt(document.querySelector('.reader-title')));

  // Check prev/next navigation works within stories-en
  const navBtns = document.querySelectorAll('.reader-nav .nav-btn:not(.nav-btn-placeholder)');
  ok('second story has both nav buttons', navBtns.length === 2,
     'count=' + navBtns.length);
};
