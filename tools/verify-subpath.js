/**
 * One-off: serve the repo from a NESTED path (like GitHub Pages
 * username.github.io/JinBhakt_Bot/) and verify every asset the app requests
 * resolves with HTTP 200 when URLs are resolved the way a browser resolves
 * them (new URL(relative, base)).
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

const REPO = path.join(__dirname, '..');
const PARENT = path.dirname(REPO);
const SUB = path.basename(REPO) + '/';       // e.g. "JinBhakt_Bot/"
const PORT = 8124;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(PARENT, rel);
  if (rel.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, async () => {
  const BASE = `http://127.0.0.1:${PORT}/${SUB}index.html`;
  const get = url => new Promise(r => {
    http.get(url, res => { res.resume(); r(res.statusCode); })
      .on('error', () => r(0));
  });

  // 1. the app itself must load from the nested path
  const root = await get(`http://127.0.0.1:${PORT}/${SUB}`);
  const idx = await get(BASE);
  console.log(`GET /${SUB}          -> ${root}`);
  console.log(`GET /${SUB}index.html -> ${idx}`);

  // 2. resolve every reference the way the browser would
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const refs = (html.match(/(?:href|src)="([^"]+)"/g) || [])
    .map(s => s.slice(s.indexOf('"') + 1, -1))
    .filter(u => !/^(https?:|data:|#|mailto:)/.test(u));

  let bad = 0;
  for (const ref of refs) {
    const abs = new URL(ref, BASE).href;      // browser-identical resolution
    const code = await get(abs);
    const rel = abs.replace(`http://127.0.0.1:${PORT}/`, '');
    if (code !== 200) bad++;
    console.log(`  ${code === 200 ? 'OK  ' : 'FAIL'} ${ref.padEnd(28)} -> /${rel}  [${code}]`);
  }

  // 3. manifest icons + SW precache resolved against the nested base
  const manBase = new URL('manifest.json', BASE).href;
  const man = JSON.parse(await new Promise(r => {
    http.get(manBase, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(d)); });
  }));
  for (const icon of man.icons) {
    const abs = new URL(icon.src, manBase).href;
    const code = await get(abs);
    if (code !== 200) bad++;
    console.log(`  ${code === 200 ? 'OK  ' : 'FAIL'} manifest ${icon.src.padEnd(22)} [${code}]`);
  }

  const sw = fs.readFileSync(path.join(REPO, 'service-worker.js'), 'utf8');
  const swBase = new URL('service-worker.js', BASE).href;
  const assets = (sw.match(/'(\.\/[^']*)'/g) || []).map(s => s.slice(1, -1));
  for (const a of assets) {
    const abs = new URL(a, swBase).href;
    const code = await get(abs);
    // './' resolves to the directory -> index.html, still 200
    if (code !== 200) bad++;
  }
  console.log(`  SW precache entries checked: ${assets.length}`);

  // 4. content JSON that app.js fetches at runtime (CONTENT_DIR = 'content/')
  const cats = JSON.parse(fs.readFileSync(path.join(REPO, 'content', 'categories.json'), 'utf8'));
  for (const c of [{ id: 'categories' }].concat(cats)) {
    const abs = new URL('content/' + c.id + '.json', BASE).href;
    const code = await get(abs);
    if (code !== 200) bad++;
    console.log(`  ${code === 200 ? 'OK  ' : 'FAIL'} content/${(c.id + '.json').padEnd(20)} [${code}]`);
  }

  console.log(`\nROOT=${root} INDEX=${idx} FAILURES=${bad}`);
  server.close();
  process.exit(bad === 0 && root === 200 && idx === 200 ? 0 : 1);
});
