'use strict';
/**
 * tools/games/build.js — Kids Learning game assembler (dev-time only)
 *
 * Each game is authored as small parts under tools/games/parts/<game>/ and
 * assembled with the shared fragments in tools/games/_shared.js into ONE
 * standalone games/<file>.html with inline <style> and <script>.
 *
 * The emitted files are the shipped artefact: self-contained, zero network
 * requests, and they run by double-clicking.  This script is an authoring
 * aid in the same spirit as tools/build-katha.js — it is never needed at
 * runtime and the games never reference it.
 *
 * Sharing one source guarantees the constraints tools/check-games.js enforces:
 * the two vow games carry a byte-identical corpus, and the two Tirthankara
 * games carry byte-identical Tirthankara data.
 *
 * Usage:  node tools/games/build.js [gameId ...]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PARTS = path.join(__dirname, 'parts');
const OUT_DIR = path.join(ROOT, 'games');
const SHARED = require('./_shared.js');

/** Game registry: id -> output file + which shared fragments it needs.
 *  `shared` names a parts folder holding the common ui.js / logic.js / data.js;
 *  identity parts (title, desc, lang, body, extra.css) always come from the
 *  game's own folder. This is how the two vow games share one corpus and one
 *  engine while keeping a wheel ritual and a lotus ritual apart. */
const GAMES = {
  'memory-match':      { file: 'memory-match.html',      tirth: true,  ref: true },
  'tirthankar-sort':   { file: 'tirthankar-sort.html',   tirth: true, gid: 'tirth-sort' },
  'sattvic-chef':      { file: 'sattvic-chef.html' },
  'myth-busters':      { file: 'myth-busters.html' },
  'niyam-wheel':       { file: 'niyam-wheel.html',       vows: true, shared: '_niyam' },
  'niyam-lotus':       { file: 'niyam-lotus.html',       vows: true, shared: '_niyam' },
  'index':             { file: 'index.html',             hub: true }
};

/** The leaderboard/route id must match js/kids.js exactly, or the hub cannot
 *  find a game's records. `gid` overrides the parts-folder name. */
function gameIdOf(id) { return GAMES[id].gid || id; }

function readFrom(dir, file, required) {
  const p = path.join(PARTS, dir, file);
  if (!fs.existsSync(p)) {
    if (required) throw new Error('missing required part: ' + dir + '/' + file);
    return '';
  }
  return fs.readFileSync(p, 'utf8').replace(/\s+$/, '');
}

/** Identity parts come from the game's own folder. */
function readOwn(id, file, required) { return readFrom(id, file, required); }

/** Engine parts fall back to the shared folder when one is declared. */
function readEngine(id, shared, file, required) {
  const own = readFrom(id, file, false);
  if (own) return own;
  if (shared) {
    const s = readFrom(shared, file, required);
    if (s) return s;
  }
  if (required) throw new Error('missing required part: ' + id + '/' + file);
  return '';
}

/** Rewrite the reference game's fixed identifiers for the target game. */
function retarget(src, gameId, meta) {
  return src
    .replace(/var GAME_ID = '[^']*';/, "var GAME_ID = '" + gameId + "';")
    .replace(/<body data-game="[^"]*">/, '<body data-game="' + gameId + '">');
}

function build(id) {
  const meta = GAMES[id];
  if (!meta) throw new Error('unknown game: ' + id);
  const shared = meta.shared || null;

  /* Identity: always from the game's own folder. */
  const title    = readOwn(id, 'title.txt', true).trim();
  const desc     = readOwn(id, 'desc.txt', true).trim();
  const lang     = readOwn(id, 'lang.txt', false).trim() || 'hi';
  const body     = readOwn(id, 'body.html', true);

  /* Shared CSS from the engine folder, then this game's own overrides. */
  const extraCss = [
    shared ? readFrom(shared, 'extra.css', false) : '',
    readOwn(id, 'extra.css', false)
  ].filter(s => s && s.trim()).join('\n\n');

  /* Engine: own folder first, else the declared shared folder. */
  const data  = readEngine(id, shared, 'data.js', false);
  const ui    = readEngine(id, shared, 'ui.js', true);
  const logic = readEngine(id, shared, 'logic.js', true);

  /* Shared fragments. The reference game (memory-match) is hand-maintained;
     every other game is assembled from the same extracted fragments. */
  const gid = gameIdOf(id);
  let tirthBlock = '';
  if (meta.tirth && !meta.ref) {
    tirthBlock = SHARED.JS_TIRTH
      .replace(/var GAME_ID = '[^']*';/, "var GAME_ID = '" + gid + "';");
  }
  let vowsBlock = '';
  if (meta.vows) {
    vowsBlock = fs.readFileSync(path.join(PARTS, '_vows.js'), 'utf8').replace(/\s+$/, '');
  }

  const coreBlock = meta.ref ? '' : SHARED.JS_CORE;
  const shellBlock = meta.ref ? '' : SHARED.JS_SHELL;

  const script = [
    '(function () {',
    "'use strict';",
    '',
    data,
    tirthBlock,
    vowsBlock,
    ui,
    coreBlock,
    shellBlock,
    logic,
    '',
    '})();'
  ].filter(s => s && s.trim()).join('\n\n');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="' + lang + '">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="theme-color" content="#6D1B2F">',
    '<meta name="description" content="' + desc.replace(/"/g, '&quot;') + '">',
    '<title>' + title + '</title>',
    '<style>',
    SHARED.CSS_BASE.replace(/\s+$/, ''),
    extraCss,
    '</style>',
    '</head>',
    '<body data-game="' + gid + '">',
    body,
    '<script>',
    script,
    '</' + 'script>',
    '</body>',
    '</html>',
    ''
  ].filter(s => s !== undefined && s !== '').join('\n');

  const out = path.join(OUT_DIR, meta.file);
  fs.writeFileSync(out, retarget(html, gid, meta), 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log('  built games/' + meta.file.padEnd(24) + kb.padStart(7) + ' KB  ' +
              html.split('\n').length + ' lines');
  return out;
}

const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(GAMES).filter(k => !GAMES[k].ref);

console.log('\n=== building Kids Learning games ===');
ids.forEach(build);
console.log('done.\n');
