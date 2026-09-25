/**
 * JinBhakt — functional test harness (jsdom)
 * Simulates a browser, serves content/ from disk, and exercises the real
 * app.js: routing, nav, reader, sanitizer, prev/next, search, drawer.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const problems = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; problems.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
               '.json':'application/json', '.png':'image/png', '.ico':'image/x-icon' };

async function boot(hash, mobile, setup) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', e => jsErrors.push('jsdomError: ' + (e.stack || e.message)));
  vc.on('error', (...a) => jsErrors.push('console.error: ' + a.map(String).join(' ')));

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost:8000/' + (hash || ''),
    virtualConsole: vc
  });
  const { window } = dom;

  // stub fetch against the real files on disk
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : input.url;
    let p = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\.\//, '/');
    if (p === '/' || p === '') p = '/index.html';
    const file = path.join(ROOT, decodeURIComponent(p.split('?')[0]));
    return new Promise(resolve => {
      fs.readFile(file, (err, buf) => {
        if (err) return resolve({ ok:false, status:404, statusText:'Not Found',
                                  json: () => Promise.reject(err) });
        const ext = path.extname(file).toLowerCase();
        const res = {
          ok:true, status:200, statusText:'OK', type:'basic',
          headers:{ get: () => MIME[ext] || 'text/plain' },
          json: () => Promise.resolve(JSON.parse(buf.toString('utf8'))),
          text: () => Promise.resolve(buf.toString('utf8')),
          clone() { return res; }
        };
        resolve(res);
      });
    });
  };

  // browser APIs jsdom lacks
  const wantMobile = mobile !== false;
  window.matchMedia = q => ({
    matches: /max-width:\s*899px/.test(q) ? wantMobile : false,
    media: q, addListener(){}, removeListener(){},
    addEventListener(){}, removeEventListener(){}
  });
  window.scrollTo = () => {};
  window.print = () => {};
  Object.defineProperty(window.navigator, 'serviceWorker', { value: undefined, configurable: true });
  window.speechSynthesis = { getVoices: () => [{ lang:'hi-IN', name:'t' }], speak(){}, cancel(){}, onvoiceschanged:null };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.location.replace = function (h) { window.location.hash = h; };

  // Optional pre-boot hook: seed localStorage / stub APIs before the real
  // app scripts run, so tests can cover "what a returning visitor sees".
  if (typeof setup === 'function') setup(window);

  // run the REAL app code (order mirrors index.html)
  window.eval(fs.readFileSync(path.join(ROOT, 'js', 'speech.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(ROOT, 'js', 'translit.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'));

  // jsdom fires its own DOMContentLoaded; only dispatch manually if the
  // scripts were eval'd before it fired, otherwise init() would run twice.
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  }

  await new Promise(r => setTimeout(r, 800));
  return { window, document: window.document, jsErrors };
}

function txt(n) { return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = { boot, ok, txt, wait, ROOT,
  stats: () => ({ pass, fail, problems }) };
