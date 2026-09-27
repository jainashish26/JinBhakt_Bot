/**
 * Build integrity checks — catches the class of bug that jsdom cannot see:
 * a precached/manifest/HTML reference pointing at a file that does not exist,
 * which silently breaks offline support or the PWA install prompt.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

module.exports = function ({ ok }) {
  console.log('\n[16] Service worker precache integrity');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  ok('SW syntax is valid', (() => {
    try { new Function(sw); return true; } catch (e) { return false; }
  })());

  const listBlock = (name) => {
    const m = sw.match(new RegExp('var\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
    if (!m) return null;
    return (m[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
  };

  const shell = listBlock('SHELL_ASSETS');
  const content = listBlock('CONTENT_ASSETS');
  ok('SHELL_ASSETS parsed', Array.isArray(shell) && shell.length > 0, 'n=' + (shell || []).length);
  ok('CONTENT_ASSETS parsed', Array.isArray(content) && content.length > 0, 'n=' + (content || []).length);

  const missing = (shell || []).concat(content || [])
    .map(u => u.replace(/^\.\//, ''))
    .filter(u => u !== '' && !exists(u));
  ok('every precached asset exists on disk', missing.length === 0, 'missing: ' + missing.join(', '));

  const precached = new Set((shell || []).concat(content || []).map(u => u.replace(/^\.\//, '')));
  ['index.html', 'manifest.json', 'js/app.js', 'js/speech.js', 'js/translit.js',
   'css/variables.css', 'css/base.css', 'css/layout.css', 'css/components.css',
   'js/nav.js', 'js/panchang.js', 'content/panchang.json'
  ].forEach(f => ok('critical file precached: ' + f, precached.has(f)));

  const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'categories.json'), 'utf8'));
  cats.forEach(c => ok('category JSON precached: ' + c.id, precached.has('content/' + c.id + '.json')));

  ok('cache name is versioned', /var CACHE_NAME = 'jinbhakt-v\d+'/.test(sw),
     (sw.match(/CACHE_NAME = '([^']+)'/) || [])[1]);
  ok('old caches are purged on activate', /caches\.delete/.test(sw));
  ok('install tolerates a single 404', /cache\.add\(url\)\.catch/.test(sw));
  ok('manifests are network-first (no stale metadata)',
     /\(isJSON && !isLazyText\) \|\| isNavigation/.test(sw));
  ok('lazy prayer bodies (content/text/) are cache-first',
     /isLazyText/.test(sw) && /\/content\/text\//.test(sw));
  const all = (shell || []).concat(content || []);
  const absolute = all.filter(u => u.startsWith('/') || /^[a-z]+:\/\//i.test(u));
  ok('SW uses relative paths only (sub-path safe)', absolute.length === 0,
     'absolute: ' + absolute.join(', '));
  ok('every SW entry is ./-relative', all.every(u => u.startsWith('./')),
     all.filter(u => !u.startsWith('./')).join(', '));

  console.log('\n[17] Manifest + HTML asset integrity');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  ok('manifest has name + short_name', !!man.name && !!man.short_name);
  ok('manifest has theme + background color', !!man.theme_color && !!man.background_color);
  ok('manifest start_url is relative (sub-path safe)', man.start_url === './', man.start_url);
  ok('manifest scope is relative', man.scope === './', man.scope);

  const iconMiss = man.icons.filter(i => !exists(i.src));
  ok('every manifest icon exists', iconMiss.length === 0,
     iconMiss.map(i => i.src).join(', '));
  ok('has a 192px icon', man.icons.some(i => i.sizes === '192x192'));
  ok('has a real 512px icon', man.icons.some(i => i.sizes === '512x512'));
  ok('has a maskable icon', man.icons.some(i => i.purpose === 'maskable'));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const refs = (html.match(/(?:href|src)="([^"]+)"/g) || [])
    .map(s => s.slice(s.indexOf('"') + 1, -1))
    .filter(u => !/^(https?:|data:|#|mailto:)/.test(u));
  const htmlMiss = refs.filter(u => u !== '' && !exists(u.replace(/^\.\//, '')));
  ok('every HTML asset reference resolves', htmlMiss.length === 0, 'missing: ' + htmlMiss.join(', '));
  ok('HTML has no root-absolute asset paths', !refs.some(u => u.startsWith('/')),
     refs.filter(u => u.startsWith('/')).join(', '));
  ok('viewport meta present', /name="viewport"/.test(html));
  ok('lang is Hindi', /<html[^>]+lang="hi"/.test(html));
  ok('deferred scripts used', (html.match(/<script[^>]+defer/g) || []).length >= 2);

  console.log('\n[18] Content data integrity (manifest + lazy text)');
  let total = 0, readable = 0, missingText = 0, inlineCont = 0;
  cats.forEach(c => {
    const raw = fs.readFileSync(path.join(ROOT, 'content', c.id + '.json'));
    ok(c.id + '.json is BOM-free UTF-8',
       !(raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) &&
       !/\uFFFD/.test(raw.toString('utf8')));
    const arr = JSON.parse(raw.toString('utf8'));
    ok(c.id + '.json is an array', Array.isArray(arr), 'n=' + arr.length);
    const noId = arr.filter(i => !i._id);
    ok(c.id + ': every item has _id (routing key)', noId.length === 0,
       noId.length + ' missing _id');
    const ids = arr.map(i => i._id);
    ok(c.id + ': _id values are unique', new Set(ids).size === ids.length,
       'dupes: ' + ids.filter((v, i) => ids.indexOf(v) !== i).slice(0, 3).join(','));
    const badName = arr.filter(i => !i.hName && !i.eName);
    ok(c.id + ': every item has a display name', badName.length === 0,
       badName.length + ' unnamed');
    // The heavy body must NOT be inlined in the manifest (it lives in content/text/).
    if (arr.some(i => Object.prototype.hasOwnProperty.call(i, 'hCont'))) inlineCont++;
    total += arr.length;
    arr.forEach(i => {
      if (i.hasContent === true) {
        readable++;
        const tf = path.join(ROOT, 'content', 'text', c.id, i.cref + '.json');
        if (!fs.existsSync(tf)) missingText++;
      }
    });
  });
  ok('no manifest inlines hCont (lazy split intact)', inlineCont === 0, inlineCont + ' cats still inline');
  // Derive expected counts from manifests on disk
  let expectedTotal = 0, expectedReadable = 0;
  cats.forEach(c => {
    const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', c.id + '.json'), 'utf8'));
    expectedTotal += arr.length;
    expectedReadable += arr.filter(i => i.hasContent === true).length;
  });
  ok('catalogue total matches disk (' + expectedTotal + ')', total === expectedTotal, 'got ' + total);
  ok(expectedReadable + ' items have real content', readable === expectedReadable, 'got ' + readable);
  ok('every readable item has a lazy text file', missingText === 0, missingText + ' missing');

  console.log('\n[19] No dead references to removed files');
  const allSrc = [html, sw,
    fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'js', 'speech.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')].join('\n');
  ['css/main.css', 'js/main.js', 'js/jQuery', 'jquery'].forEach(dead => {
    ok('no reference to removed ' + dead,
       !allSrc.toLowerCase().includes(dead.toLowerCase()), dead + ' still referenced');
  });

  console.log('\n[19c] Granth page integrity (source not split)');
  const granthManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'content', 'granth.json'), 'utf8'));
  const granth110 = granthManifest.find(i => i.cref === 110);
  ok('granth cref 110 still exists', !!granth110, 'cref 110 missing');
  ok('granth cref 110 still has content', granth110 && granth110.hasContent === true);
  const granth110File = path.join(ROOT, 'content', 'text', 'granth', '110.json');
  ok('granth 110.json body file still exists', fs.existsSync(granth110File));
  const g110 = JSON.parse(fs.readFileSync(granth110File, 'utf8'));
  ok('granth 110 body still contains full text (>50k chars)',
     g110.hCont && g110.hCont.length > 50000,
     'len=' + (g110.hCont ? g110.hCont.length : 0));
  ok('granth 110 body still has 116+ markers',
     (g110.hCont.match(/^\s*\+/gm) || []).length >= 116);

  console.log('\n[19d] Katha manifest integrity');
  const kathaManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'content', 'katha.json'), 'utf8'));
  ok('katha manifest has 116 entries', kathaManifest.length === 116,
     'got ' + kathaManifest.length);
  ok('katha entries all have hCtg = कथा-कोश',
     kathaManifest.every(i => i.hCtg === 'कथा-कोश'));
  ok('katha entries all have sub = आराधना कथा कोश',
     kathaManifest.every(i => i.sub === 'आराधना कथा कोश'));
  ok('katha has exactly 2 pending stories (115, 116)',
     kathaManifest.filter(i => !i.hasContent).length === 2);
  ok('katha _ids all start with 3-digit number prefix',
     kathaManifest.every(i => /^\d{3}-/.test(i._id)));
  ok('katha prev/next chain is complete',
     kathaManifest[0].ePrev === 'TBC#' &&
     kathaManifest[115].eNext === 'TBC#' &&
     kathaManifest.every((item, idx) => {
       if (idx > 0 && item.ePrev !== kathaManifest[idx - 1]._id) return false;
       if (idx < 115 && item.eNext !== kathaManifest[idx + 1]._id) return false;
       return true;
     }));
  ok('katha body files exist for all readable stories',
     kathaManifest.filter(i => i.hasContent).every(i =>
       fs.existsSync(path.join(ROOT, 'content', 'text', 'katha', i.cref + '.json'))));

  console.log('\n[19b] Panchang data file integrity');
  const pRaw = fs.readFileSync(path.join(ROOT, 'content', 'panchang.json'), 'utf8');
  ok('panchang.json is valid JSON', (() => {
    try { JSON.parse(pRaw); return true; } catch (e) { return false; }
  })());
  const pData = JSON.parse(pRaw);
  ok('panchang.json has parvs array', Array.isArray(pData.parvs) && pData.parvs.length > 0);
  ok('panchang.json has 24 Tirthankaras',
     pData.kalyanaks && pData.kalyanaks.tirthankaras &&
     pData.kalyanaks.tirthankaras.length === 24);
  ok('panchang.json parvs have required fields',
     pData.parvs.every(p => p.id && p.h && p.month != null && p.paksha != null && p.startTithi != null));
  ok('panchang.json kalyanaks have 5 types',
     pData.kalyanaks && pData.kalyanaks.types && pData.kalyanaks.types.length === 5);
};
