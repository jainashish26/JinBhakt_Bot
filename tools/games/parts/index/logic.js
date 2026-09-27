/* ============================================================
   STATE
   ============================================================ */
var S = { lang: 'hi', sound: true, screen: 'lang', embedded: false };

function setScreen(name) {
  S.screen = name;
  ['scrLang', 'scrHub'].forEach(function (id) {
    $(id).classList.toggle('is-hidden',
      id !== 'scr' + name.charAt(0).toUpperCase() + name.slice(1));
  });
  /* Entering the hub must paint the grid and the leaderboard. applyText()
     only repaints them when the hub is ALREADY the current screen, so a
     gate -> hub transition would otherwise show an empty hub. */
  if (name === 'hub') { renderGameGrid(); renderLeaderboard(); }
  window.scrollTo(0, 0);
}

function say(msg) { var e = $('live'); if (e) e.textContent = msg; }

function storageOk() {
  try {
    localStorage.setItem('__jb_t__', '1');
    localStorage.removeItem('__jb_t__');
    return true;
  } catch (e) { return false; }
}

/* ============================================================
   LEADERBOARD · read-only aggregation across all six games
   ============================================================ */
function lbAllGames() {
  var all = lbAll();
  return (all && typeof all === 'object') ? all : {};
}

/** Sort one game's entries using that game's own policy. */
function sortedFor(game) {
  var list = lbAllGames()[game.id];
  if (!Array.isArray(list)) return [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e || typeof e !== 'object') continue;
    out.push({
      name: sanitizeName(e.name),
      level: String(e.level || ''),
      levelKey: String(e.levelKey || ''),
      duration: Math.max(0, Math.floor(Number(e.duration) || 0)),
      score: Math.max(0, Math.floor(Number(e.score) || 0)),
      meta: (e.meta && typeof e.meta === 'object') ? e.meta : {},
      ts: Math.floor(Number(e.ts) || 0)
    });
  }
  out.sort(function (a, b) {
    if (game.scoring === 'duration-asc') {
      return (a.duration - b.duration) ||
             (((a.meta.moves) || 0) - ((b.meta.moves) || 0)) || (b.ts - a.ts);
    }
    if (game.scoring === 'vows-desc') {
      return (((b.meta.vows) || 0) - ((a.meta.vows) || 0)) ||
             (((b.meta.streakDays) || 0) - ((a.meta.streakDays) || 0)) ||
             (a.duration - b.duration) || (b.ts - a.ts);
    }
    return (b.score - a.score) ||
           (((b.meta.correct) || 0) - ((a.meta.correct) || 0)) ||
           (a.duration - b.duration) || (b.ts - a.ts);
  });
  return out;
}

/** One line summarising a game's best entry. */
function bestLine(game) {
  var list = sortedFor(game);
  if (!list.length) return '';
  var e = list[0];
  if (game.scoring === 'duration-asc') return fmtClock(e.duration);
  if (game.scoring === 'vows-desc') {
    var v = (e.meta && e.meta.vows) || 0;
    return (S.lang === 'hi' ? devNum(v) : v) + ' · ' + fmtClock(e.duration);
  }
  return (S.lang === 'hi' ? devNum(e.score) : e.score) + ' · ' + fmtClock(e.duration);
}

function renderGameGrid() {
  var host = $('gameGrid');
  host.innerHTML = '';
  GAMES.forEach(function (g) {
    var a = document.createElement('a');
    a.className = 'g-gamecard';
    a.href = g.file;
    a.setAttribute('data-game', g.id);

    var top = document.createElement('div');
    top.className = 'g-gamecard-top';
    var ic = document.createElement('span');
    ic.className = 'g-gamecard-icon';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = g.icon || '';
    top.appendChild(ic);
    var titles = document.createElement('span');
    titles.className = 'g-gamecard-titles';
    var ti = document.createElement('span');
    ti.className = 'g-gamecard-title';
    ti.textContent = S.lang === 'hi' ? g.hi : g.en;
    var en = document.createElement('span');
    en.className = 'g-gamecard-en';
    en.textContent = S.lang === 'hi' ? g.en : g.hi;
    titles.appendChild(ti);
    titles.appendChild(en);
    top.appendChild(titles);
    a.appendChild(top);

    var blurb = document.createElement('span');
    blurb.className = 'g-gamecard-blurb';
    blurb.textContent = S.lang === 'hi' ? g.blurbHi : g.blurbEn;
    a.appendChild(blurb);

    var tags = document.createElement('span');
    tags.className = 'g-gamecard-tags';
    var tag = document.createElement('span');
    tag.className = 'g-gamecard-tag';
    tag.textContent = S.lang === 'hi' ? g.tagHi : g.tagEn;
    tags.appendChild(tag);
    var ages = document.createElement('span');
    ages.className = 'g-gamecard-ages';
    ages.textContent = t('agesLabel') + ' ' + g.ages;
    tags.appendChild(ages);
    a.appendChild(tags);

    var list = sortedFor(g);
    var best = document.createElement('span');
    best.className = 'g-gamecard-best';
    best.textContent = list.length
      ? t('bestLabel') + ': ' + bestLine(g)
      : t('noRecord');
    a.appendChild(best);

    a.addEventListener('click', function () {
      writePrefs({ lastGame: g.id });
      sfx.tap();
    });
    host.appendChild(a);
  });
}

function renderLeaderboard() {
  var host = $('lbBody');
  host.innerHTML = '';
  var anyRecords = false;
  var medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  GAMES.forEach(function (g) {
    var list = sortedFor(g);
    var box = document.createElement('div');
    box.className = 'g-lbgame';

    var h = document.createElement('h4');
    var ic = document.createElement('span');
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = g.icon || '';
    h.appendChild(ic);
    h.appendChild(document.createTextNode(' ' + (S.lang === 'hi' ? g.hi : g.en)));
    if (list.length) {
      anyRecords = true;
      var b = document.createElement('span');
      b.className = 'g-lbbest';
      b.textContent = t('plays', { n: S.lang === 'hi' ? devNum(list.length) : list.length });
      h.appendChild(b);
    }
    box.appendChild(h);

    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'g-lb-empty';
      empty.textContent = t('noRecord');
      box.appendChild(empty);
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'g-tablewrap';
      var tb = document.createElement('table');
      tb.className = 'g-table';
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      [t('lbRank'), t('lbName'), t('lbLevel'), t('lbTime'), t('lbScore')].forEach(function (x) {
        var th = document.createElement('th');
        th.textContent = x;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      tb.appendChild(thead);
      var tbody = document.createElement('tbody');
      list.slice(0, 3).forEach(function (e, i) {
        var tr = document.createElement('tr');
        var vals = [
          i < 3 ? medals[i] : String(i + 1),
          e.name || '—',
          e.level || e.levelKey || '—',
          fmtClock(e.duration),
          (S.lang === 'hi' ? devNum(e.score) : String(e.score))
        ];
        vals.forEach(function (v, ci) {
          var td = document.createElement('td');
          td.textContent = v;          // textContent only, never innerHTML
          if (ci === 0 && i < 3) td.className = 'g-medalcell';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      wrap.appendChild(tb);
      box.appendChild(wrap);

      var acts = document.createElement('div');
      acts.className = 'g-lbactions';
      var clr = document.createElement('button');
      clr.type = 'button';
      clr.className = 'g-btn g-btn-sm';
      clr.textContent = t('lbClear');
      clr.addEventListener('click', function () {
        askDialog(t('lbConfirmTitle'), t('lbConfirmOne'), t('lbConfirmYes'), t('lbConfirmNo'),
          function () { clearGame(g.id); });
      });
      acts.appendChild(clr);
      box.appendChild(acts);
    }
    host.appendChild(box);
  });

  $('lbClearAllBtn').style.display = anyRecords ? '' : 'none';
  if (!anyRecords) {
    var p = document.createElement('p');
    p.className = 'g-lb-empty';
    p.textContent = t('lbEmpty');
    host.appendChild(p);
  }
}

function clearGame(id) {
  var all = lbAllGames();
  if (Object.prototype.hasOwnProperty.call(all, id)) {
    delete all[id];
    rawSet(LB_KEY, JSON.stringify(all));
  }
  renderLeaderboard();
  renderGameGrid();
  toast(t('lbCleared'));
}

function clearAll() {
  askDialog(t('lbConfirmTitle'), t('lbConfirmAll'), t('lbConfirmYes'), t('lbConfirmNo'),
    function () {
      rawDel(LB_KEY);
      renderLeaderboard();
      renderGameGrid();
      toast(t('lbCleared'));
    });
}


/* ============================================================
   RENDER · pure function of state; language never loses anything
   ============================================================ */
function applyText() {
  document.documentElement.lang = (S.lang === 'hi') ? 'hi' : 'en';
  document.title = (S.lang === 'hi'
    ? 'बाल शिक्षा · Kids Learning'
    : 'Kids Learning · बाल शिक्षा');

  $('brandMark').innerHTML = artSwastika();
  $('brandHi').textContent = t('brandHi');
  $('brandEn').textContent = t('brandEn');
  $('langBtn').textContent = t('langSwitch');
  paintSound();

  $('langGlyph').innerHTML = artRosette();
  $('s1Title').textContent = t('s1Title');
  $('s1Sub').textContent = t('s1Sub');

  $('heroMark').innerHTML = artSwastika();
  $('hubTitle').textContent = t('title');
  $('hubSub').textContent = t('sub');
  $('gamesLabel').textContent = t('sectionGames');
  $('progressLabel').textContent = t('sectionProgress');
  $('lbTitle').textContent = t('sectionProgress');
  $('lbClearAllBtn').textContent = t('lbClearAll');
  $('offlineNote').textContent = t('offlineNote');
  $('footTxt').textContent = t('foot');

  var sn = $('storageNote');
  if (storageOk()) sn.classList.add('is-hidden');
  else { sn.textContent = t('storageOff'); sn.classList.remove('is-hidden'); }

  var ab = $('appBtn');
  ab.classList.toggle('is-hidden', !S.embedded);
  if (S.embedded) ab.textContent = t('appNote');

  if (S.screen === 'hub') { renderGameGrid(); renderLeaderboard(); }
}

function paintSound() {
  var b = $('sndBtn');
  b.innerHTML = artBell(S.sound);
  b.setAttribute('aria-pressed', S.sound ? 'true' : 'false');
  b.setAttribute('aria-label', S.sound ? t('soundOn') : t('soundOff'));
  b.title = S.sound ? t('soundOn') : t('soundOff');
}

/* ============================================================
   WIRING + BOOT
   ============================================================ */
function setLang(lang) {
  S.lang = (lang === 'en') ? 'en' : 'hi';
  writePrefs({ lang: S.lang });
  applyText();
}

document.querySelectorAll('[data-lang]').forEach(function (b) {
  b.addEventListener('click', function () {
    ac();
    setLang(b.dataset.lang);
    sfx.tap();
    setScreen('hub');
  });
});
$('langBtn').addEventListener('click', function () {
  ac();
  setLang(S.lang === 'hi' ? 'en' : 'hi');
  sfx.tap();
});
$('sndBtn').addEventListener('click', function () {
  S.sound = !S.sound;
  writePrefs({ sound: S.sound });
  paintSound();
  if (S.sound) { ac(); sfx.tap(); }
});
$('lbClearAllBtn').addEventListener('click', clearAll);
$('appBtn').addEventListener('click', function () {
  try {
    if (window.parent && window.parent !== window && window.parent.location) {
      window.parent.location.hash = '#/kids';
      return;
    }
  } catch (e) { /* standalone: nothing to do */ }
});

function parseQuery() {
  var q = {};
  try {
    var sp = new URLSearchParams(window.location.search || '');
    sp.forEach(function (v, k) { q[k] = v; });
  } catch (e) { q = {}; }
  return q;
}

function boot() {
  var prefs = readPrefs();
  S.lang = (prefs.lang === 'en') ? 'en' : 'hi';
  S.sound = prefs.sound !== false;

  var q = parseQuery();
  var qLang = (q.lang === 'en' || q.lang === 'hi') ? q.lang : null;
  if (qLang) S.lang = qLang;
  S.embedded = (q.embed === '1');

  writePrefs({ lang: S.lang, sound: S.sound });
  applyText();
  setScreen(qLang ? 'hub' : 'lang');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

