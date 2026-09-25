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
   'css/variables.css', 'css/base.css', 'css/layout.css', 'css/components.css'
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
  ok('catalogue total is 1854 items', total === 1854, 'got ' + total);
  ok('1826 items have real content', readable === 1826, 'got ' + readable);
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
};
