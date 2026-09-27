'use strict';
/**
 * tools/check-games.js
 *
 * Static contract validator for games/*.html.  Enforces the single-file,
 * zero-network, motion-safe, accessibility-respecting rules that every Kids
 * Learning game must satisfy, plus the corpus sizes the brief requires.
 *
 * Plain Node — fs, path, vm only.  Exit code 1 on any failure.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');

const GAME_FILES = [
  'index.html',
  'sattvic-chef.html',
  'myth-busters.html',
  'tirthankar-sort.html',
  'niyam-wheel.html',
  'niyam-lotus.html',
  'memory-match.html'
];

let pass = 0;
const fails = [];

function ok(name, cond, extra) {
  if (cond) { pass++; }
  else {
    fails.push(name + (extra ? ' :: ' + extra : ''));
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

/* ---------- helpers ---------- */

function blocks(html, tag) {
  const out = [];
  const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'g');
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** Balanced-brace extraction of every @keyframes block body. */
function keyframesBodies(css) {
  const out = [];
  const re = /@keyframes\s+[^\{]+\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push({ name: m[0].trim(), body: css.slice(start, Math.max(start, i - 1)) });
  }
  return out;
}

/** Properties actually animated inside a keyframes body. */
function animatedProps(body) {
  const props = new Set();
  body.split(/[{};]/).forEach(d => {
    const mm = /^\s*([a-zA-Z-]+)\s*:/.exec(d);
    if (mm) props.add(mm[1].toLowerCase());
  });
  return Array.from(props);
}

/** Return the raw text of a JS array literal `var <name> = [...]` (or ''). */
function arrayLiteral(src, name) {
  const m = new RegExp('var\\s+' + name + '\\s*=\\s*\\[').exec(src);
  if (!m) return '';
  let i = m.index + m[0].length - 1;
  let depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

/** Evaluate a JS array literal safely and return the parsed value. */
function evalArray(src, name) {
  const lit = arrayLiteral(src, name);
  if (!lit) return null;
  try {
    return vm.runInNewContext('(' + lit + ')', {}, { timeout: 4000 });
  } catch (e) {
    return null;
  }
}

function countArrayRows(src, name) {
  const literal = arrayLiteral(src, name);
  if (!literal) return -1;
  let rows = 0, d = 0, inStr = null;
  for (let k = 0; k < literal.length; k++) {
    const c = literal[k];
    if (inStr) {
      if (c === '\\') { k++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === '[') { d++; if (d === 2) rows++; }
    else if (c === ']') d--;
  }
  return rows;
}

/* ---------- per-file structural checks ---------- */
function checkFile(name) {
  const p = path.join(GAMES_DIR, name);
  if (!fs.existsSync(p)) { ok(name + ' exists', false, 'missing'); return null; }
  const html = fs.readFileSync(p, 'utf8');
  const styles = blocks(html, 'style');
  const scripts = blocks(html, 'script');

  ok(name + ': exactly one <style>', styles.length === 1, 'got ' + styles.length);
  ok(name + ': exactly one <script>', scripts.length === 1, 'got ' + scripts.length);
  ok(name + ': no <link>', !/<link/i.test(html));
  ok(name + ': no <img>', !/<img/i.test(html));
  ok(name + ': no css url()', !/url\(/i.test(html));
  ok(name + ': no data:image', !/data:image/i.test(html));

  const urls = (html.match(/https?:\/\/[^"'\s)]+/g) || [])
    .filter(u => u.indexOf('www.w3.org/2000/svg') < 0);
  ok(name + ': no external URLs', urls.length === 0, urls.join(' | '));
  /* CDN keywords are only a problem when they appear in a real reference,
     not inside a prose comment such as "no CDN, no images". */
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cdnHits = (noComments.match(/["'(](?:https?:)?\/\/[^"'()]*(?:cdn|googleapis|unpkg|jsdelivr|fonts\.g)[^"'()]*/gi) || []);
  ok(name + ': no CDN references', cdnHits.length === 0, cdnHits.join(' | '));

  scripts.forEach((src, i) => {
    try { new vm.Script(src); ok(name + ': script[' + i + '] parses', true); }
    catch (e) { ok(name + ': script[' + i + '] parses', false, e.message); }
  });

  ok(name + ': prefers-reduced-motion in CSS',
     styles.some(s => s.indexOf('prefers-reduced-motion') >= 0));
  ok(name + ': prefers-reduced-motion in JS',
     scripts.some(s => s.indexOf('prefers-reduced-motion') >= 0));
  ok(name + ': no native dialogs', !/\b(?:window\.)?(alert|confirm|prompt)\s*\(/.test(html));
  ok(name + ': no document.write', !/document\.write/.test(html));
  ok(name + ': shared leaderboard key', html.indexOf('jinbhakt:kids:leaderboard:v1') >= 0);
  ok(name + ': shared prefs key', html.indexOf('jinbhakt:kids:prefs:v1') >= 0);
  ok(name + ': has en + hi UI dictionaries', /en\s*:\s*\{/.test(html) && /hi\s*:\s*\{/.test(html));
  ok(name + ': no Om character', html.indexOf('\u0950') < 0);
  ok(name + ': no swastika text glyph',
     html.indexOf('\u5350') < 0 && html.indexOf('\u534D') < 0);
  ok(name + ': try/catch guards localStorage', /try\s*\{[\s\S]{0,220}localStorage/.test(html));
  ok(name + ': exactly one <body>',
     (html.match(/<body/g) || []).length === 1 && (html.match(/<\/body>/g) || []).length === 1);
  ok(name + ': <html> has lang', /<html[^>]+lang=/.test(html));
  ok(name + ': has viewport meta', /name="viewport"/.test(html));
  ok(name + ': has aria-live region', /aria-live=/.test(html));

  styles.forEach(css => {
    keyframesBodies(css).forEach(kf => {
      const illegal = animatedProps(kf.body)
        .filter(p => p !== 'transform' && p !== 'opacity' && p !== '-webkit-transform');
      ok(name + ': ' + kf.name.replace(/\s+/g, ' ').slice(0, 34) + ' animates transform/opacity only',
         illegal.length === 0, illegal.join(','));
    });
  });

  return html;
}

/* ---------- corpus checks ---------- */
function checkTirthankara(name, html) {
  const src = blocks(html, 'script')[0] || '';
  const rows = arrayLiteral(src, 'T_ROWS');
  ok(name + ': TIRTH has 24 rows', countArrayRows(src, 'T_ROWS') === 24,
     'got ' + countArrayRows(src, 'T_ROWS'));
  /* scoped to the data literal only — the art helpers also mention 'seated' */
  const seated = (rows.match(/'seated'/g) || []).length;
  ok(name + ': exactly 3 seated Tirthankaras', seated === 3, 'got ' + seated);
  const sammend = (rows.match(/'sammend'/g) || []).length;
  ok(name + ': 20 Sammed Shikharji nirvanas', sammend === 20, 'got ' + sammend);
  ['ashtapada', 'champapuri', 'girnar', 'pavapuri'].forEach(k => {
    ok(name + ': nirvana place "' + k + '" present', rows.indexOf("'" + k + "'") >= 0);
  });
}

function checkVows(name, html) {
  const src = blocks(html, 'script')[0] || '';
  ok(name + ': 14 categories', countArrayRows(src, 'CATS') === 14,
     'got ' + countArrayRows(src, 'CATS'));
  ok(name + ': KIDS corpus is 108', countArrayRows(src, 'KIDS') === 108,
     'got ' + countArrayRows(src, 'KIDS'));
  ok(name + ': ADULTS corpus is 216', countArrayRows(src, 'ADULTS') === 216,
     'got ' + countArrayRows(src, 'ADULTS'));
}

/* ---------- SPA wiring ---------- */
function checkWiring() {
  const kidsJs = path.join(ROOT, 'js', 'kids.js');
  ok('js/kids.js exists', fs.existsSync(kidsJs));
  if (fs.existsSync(kidsJs)) {
    const K = require(kidsJs);
    ok('kids.js exposes 6 games', K.getGames().length === 6, 'got ' + K.getGames().length);
    const ids = K.getGames().map(g => g.id);
    ok('kids.js game ids are unique', new Set(ids).size === ids.length);
    K.getGames().forEach(g => {
      ok('game file resolves: ' + g.file, fs.existsSync(path.join(ROOT, g.file)));
    });
  }

  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  ok('service-worker cache bumped past v17', /jinbhakt-v(1[89]|[2-9]\d)/.test(sw),
     (sw.match(/jinbhakt-v\d+/) || ['none'])[0]);
  ok('service-worker precaches js/kids.js', sw.indexOf('./js/kids.js') >= 0);
  GAME_FILES.forEach(f => {
    ok('service-worker precaches games/' + f, sw.indexOf('./games/' + f) >= 0);
  });

  const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'taxonomy.json'), 'utf8'));
  const kidsQb = (tax.quickBar || []).filter(q => q.id === 'kids')[0];
  ok('taxonomy quickBar has a kids entry pointing at #/kids',
     !!kidsQb && kidsQb.href === '#/kids', kidsQb ? kidsQb.href : 'absent');
}


/* ---------- shared-corpus checks ---------- */
function sharedSlice(file, startMark, endMark) {
  const p = path.join(GAMES_DIR, file);
  if (!fs.existsSync(p)) return null;
  const src = blocks(fs.readFileSync(p, 'utf8'), 'script')[0] || '';
  const s = src.indexOf(startMark);
  if (s < 0) return null;
  const e = src.indexOf(endMark, s + startMark.length);
  /* normalise line endings: the reference game is hand-authored (CRLF) while
     generated games are written with LF — the corpus itself must match. */
  return src.slice(s, e > s ? e : src.length).replace(/\r\n/g, '\n');
}

/* ---------- run ---------- */
console.log('\n=== Kids Learning · game contract check ===');

GAME_FILES.forEach(f => {
  const html = checkFile(f);
  if (!html) return;
  const src = blocks(html, 'script')[0] || '';

  if (f === 'memory-match.html' || f === 'tirthankar-sort.html') checkTirthankara(f, html);

  if (f === 'niyam-wheel.html' || f === 'niyam-lotus.html') checkVows(f, html);

  if (f === 'sattvic-chef.html') {
    const foods = evalArray(src, 'FOODS');
    ok('sattvic-chef: FOODS parses', Array.isArray(foods), 'not an array');
    if (Array.isArray(foods)) {
      ok('sattvic-chef: >= 84 food items', foods.length >= 84, 'got ' + foods.length);
      const yes = foods.filter(r => r[2] === 1).length;
      ok('sattvic-chef: >= 40 Jain-friendly items', yes >= 40, 'got ' + yes);
      const kidsPool = foods.filter(r => r[3] !== 'adults').length;
      ok('sattvic-chef: kids pool >= 50 items', kidsPool >= 50, 'got ' + kidsPool);
      const bad = foods.filter(r =>
        r.length < 9 || typeof r[0] !== 'string' || !r[0] ||
        ['kids', 'adults', 'both'].indexOf(r[3]) < 0 ||
        (r[2] !== 0 && r[2] !== 1) ||
        !r[5] || !r[6] || !r[7] || !r[8]);
      ok('sattvic-chef: every row is well formed and bilingual', bad.length === 0,
         bad.length + ' bad row(s): ' + bad.slice(0, 2).map(r => r[0]).join(','));
      const ids = foods.map(r => r[0]);
      ok('sattvic-chef: ids are unique', new Set(ids).size === ids.length);
    }
  }

  if (f === 'myth-busters.html') {
    const qs = evalArray(src, 'QUESTIONS');
    ok('myth-busters: QUESTIONS parses', Array.isArray(qs), 'not an array');
    if (Array.isArray(qs)) {
      ok('myth-busters: >= 72 statements', qs.length >= 72, 'got ' + qs.length);
      const tr = qs.filter(r => r[3] === 1).length;
      const fa = qs.filter(r => r[3] === 0).length;
      ok('myth-busters: >= 25 true statements', tr >= 25, 'got ' + tr);
      ok('myth-busters: >= 25 false statements', fa >= 25, 'got ' + fa);
      const kidsPool = qs.filter(r => r[1] !== 'adults').length;
      ok('myth-busters: kids pool >= 30 statements', kidsPool >= 30, 'got ' + kidsPool);
      const bad = qs.filter(r =>
        r.length < 8 || !r[0] ||
        ['kids', 'adults', 'both'].indexOf(r[1]) < 0 ||
        (r[3] !== 0 && r[3] !== 1) ||
        !r[4] || !r[5] || !r[6] || !r[7]);
      ok('myth-busters: every row is well formed and bilingual', bad.length === 0,
         bad.length + ' bad row(s): ' + bad.slice(0, 2).map(r => r[0]).join(','));
      const ids = qs.map(r => r[0]);
      ok('myth-busters: ids are unique', new Set(ids).size === ids.length);
      const topics = new Set(qs.map(r => r[2]));
      ok('myth-busters: >= 6 distinct topics', topics.size >= 6, 'got ' + topics.size);
    }
  }
});

/* the two vow games must carry a byte-identical corpus */
const wheelVows = sharedSlice('niyam-wheel.html', 'var CATS', 'var UI');
const lotusVows = sharedSlice('niyam-lotus.html', 'var CATS', 'var UI');
if (wheelVows && lotusVows) {
  ok('wheel + lotus share an identical vow corpus', wheelVows === lotusVows,
     'wheel ' + wheelVows.length + ' chars vs lotus ' + lotusVows.length + ' chars');
}

/* the two Tirthankara games must agree */
const memT = sharedSlice('memory-match.html', 'var T_ROWS', 'var T_NOTES');
const sortT = sharedSlice('tirthankar-sort.html', 'var T_ROWS', 'var T_NOTES');
if (memT && sortT) {
  ok('memory-match + tirthankar-sort share identical Tirthankara data', memT === sortT);
}

checkWiring();

console.log('\n======================================');
console.log('  PASSED: ' + pass + '    FAILED: ' + fails.length);
console.log('======================================');
if (fails.length) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nAll game contracts satisfied.');

