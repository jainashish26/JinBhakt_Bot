/* ============================================================
   STATE
   ============================================================ */
var S = {
  lang: 'hi', sound: true, aud: null, name: '', screen: 'lang',
  round: 8, pool: [], deck: [], idx: 0,
  score: 0, streak: 0, best: 0, correct: 0,
  startedAt: 0, clockId: null, elapsed: 0,
  lock: false, mistakes: [], lastRank: 0, touchX: null
};

function setScreen(name) {
  S.screen = name;
  ['scrLang', 'scrAud', 'scrSetup', 'scrPlay', 'scrResult'].forEach(function (id) {
    $(id).classList.toggle('is-hidden',
      id !== 'scr' + name.charAt(0).toUpperCase() + name.slice(1));
  });
  $('restartBtn').classList.toggle('is-hidden', name !== 'play' && name !== 'result');
  window.scrollTo(0, 0);
}

/* Row indices: 0 id, 1 cat, 2 jain, 3 level, 4 svg, 5 enName, 6 hiName,
                7 enWhy, 8 hiWhy, 9 note (optional) */
function foodName(f) { return S.lang === 'hi' ? f[6] : f[5]; }
function foodWhy(f)  { return S.lang === 'hi' ? f[8] : f[7]; }
function foodNote(f) { return f[9] || ''; }
function foodJain(f) { return f[2] === 1; }

function catOf(key) {
  for (var i = 0; i < FCATS.length; i++) if (FCATS[i][0] === key) return FCATS[i];
  return null;
}
function catName(key) {
  var c = catOf(key);
  return c ? (S.lang === 'hi' ? c[3] : c[2]) : key;
}

/** The kids' pool excludes the strict adult-only observances. */
function buildPool() {
  S.pool = FOODS.filter(function (f) {
    return S.aud === 'adults' ? true : (f[3] !== 'adults');
  });
}

function stopClock() { if (S.clockId) { clearInterval(S.clockId); S.clockId = null; } }
function startClock() {
  if (S.startedAt) return;
  S.startedAt = Date.now();
  stopClock();
  S.clockId = setInterval(function () {
    S.elapsed = Math.floor((Date.now() - S.startedAt) / 1000);
    $('hudTime').textContent = fmtTime(S.elapsed);
  }, 500);
}

function startRound() {
  var nm = sanitizeName($('nameInput').value);
  if (!nm) { toast(t('nameNeeded')); $('nameInput').focus(); return; }
  S.name = nm;
  writePrefs({ name: nm, aud: S.aud, lastGame: GAME_ID });

  buildPool();
  var src = S.pool.slice();
  shuffle(src);
  S.deck = (S.round > 0) ? src.slice(0, Math.min(S.round, src.length)) : src;

  S.idx = 0; S.score = 0; S.streak = 0; S.best = 0; S.correct = 0;
  S.startedAt = 0; S.elapsed = 0; S.lock = false;
  S.mistakes = []; S.lastRank = 0; S.touchX = null;
  stopClock();
  $('feedback').innerHTML = '';
  $('lbPanel').classList.add('is-hidden');

  setScreen('play');
  paintBins();
  showCard();
  paintHud();
  bell(0.05);
}

/* ============================================================
   FOOD ART · parametric runtime SVG glyphs, no images
   ============================================================ */
var GLYPH = {
  fruitRound:  '<circle cx="32" cy="36" r="19" fill="currentColor" opacity=".85"/>' +
               '<path d="M32 17 C32 11 36 8 41 7 C40 13 36 16 32 17 Z" fill="currentColor"/>' +
               '<ellipse cx="25" cy="29" rx="5" ry="3.4" fill="#FFF8F0" opacity=".45" transform="rotate(-28 25 29)"/>',
  fruitLong:   '<path d="M32 12 C44 20 46 40 36 54 C26 46 22 26 32 12 Z" fill="currentColor" opacity=".85"/>' +
               '<path d="M32 12 C30 8 32 5 36 4" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>',
  rootBulb:    '<circle cx="32" cy="38" r="17" fill="currentColor" opacity=".85"/>' +
               '<path d="M32 21 C30 15 32 10 37 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
               '<path d="M26 24 C24 18 26 13 30 10" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>',
  rootTaper:   '<path d="M24 14 L40 14 L33 56 Z" fill="currentColor" opacity=".85"/>' +
               '<path d="M28 14 C26 8 29 5 33 3 M36 14 C38 9 36 5 32 4" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
  leafCluster: '<path d="M32 56 C18 48 14 30 22 16 C34 22 40 40 32 56 Z" fill="currentColor" opacity=".8"/>' +
               '<path d="M32 56 C42 46 48 30 44 16 C34 22 30 40 32 56 Z" fill="currentColor" opacity=".55"/>' +
               '<path d="M32 56 V20" stroke="#FFF8F0" stroke-width="2" opacity=".6"/>',
  grainEar:    '<path d="M32 58 V22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
               '<path d="M32 26 C24 24 21 18 22 12 C29 13 32 19 32 26 Z" fill="currentColor" opacity=".8"/>' +
               '<path d="M32 26 C40 24 43 18 42 12 C35 13 32 19 32 26 Z" fill="currentColor" opacity=".8"/>' +
               '<path d="M32 38 C24 36 21 30 22 24 C29 25 32 31 32 38 Z" fill="currentColor" opacity=".6"/>' +
               '<path d="M32 38 C40 36 43 30 42 24 C35 25 32 31 32 38 Z" fill="currentColor" opacity=".6"/>',
  podSeeds:    '<path d="M16 40 C22 22 44 18 50 32 C44 48 22 52 16 40 Z" fill="currentColor" opacity=".8"/>' +
               '<circle cx="27" cy="35" r="3.2" fill="#FFF8F0" opacity=".75"/>' +
               '<circle cx="36" cy="34" r="3.2" fill="#FFF8F0" opacity=".75"/>' +
               '<circle cx="31" cy="42" r="3.2" fill="#FFF8F0" opacity=".75"/>',
  nutShell:    '<ellipse cx="32" cy="36" rx="15" ry="20" fill="currentColor" opacity=".85"/>' +
               '<path d="M32 16 V56" stroke="#FFF8F0" stroke-width="2.2" opacity=".55"/>' +
               '<path d="M22 26 C28 32 36 32 42 26" stroke="#FFF8F0" stroke-width="2" fill="none" opacity=".45"/>',
  milkJug:     '<path d="M22 20 H42 L45 30 V52 A4 4 0 0 1 41 56 H23 A4 4 0 0 1 19 52 V30 Z" fill="currentColor" opacity=".85"/>' +
               '<path d="M22 20 V12 H42 V20" fill="none" stroke="currentColor" stroke-width="3.4"/>' +
               '<path d="M19 34 H45" stroke="#FFF8F0" stroke-width="2.4" opacity=".6"/>',
  gheePot:     '<path d="M18 28 H46 L43 54 A4 4 0 0 1 39 57 H25 A4 4 0 0 1 21 54 Z" fill="currentColor" opacity=".85"/>' +
               '<ellipse cx="32" cy="28" rx="14" ry="4.6" fill="currentColor"/>' +
               '<path d="M24 20 C28 14 36 14 40 20" fill="none" stroke="currentColor" stroke-width="3"/>',
  honeyComb:   '<path d="M32 12 L46 20 V36 L32 44 L18 36 V20 Z" fill="currentColor" opacity=".8"/>' +
               '<path d="M32 28 L46 36 V52 L32 60 L18 52 V36 Z" fill="currentColor" opacity=".55"/>' +
               '<circle cx="32" cy="28" r="4" fill="#FFF8F0" opacity=".7"/>',
  eggOval:     '<ellipse cx="32" cy="36" rx="16" ry="21" fill="currentColor" opacity=".85"/>' +
               '<ellipse cx="26" cy="28" rx="5" ry="6.5" fill="#FFF8F0" opacity=".4"/>',
  boneMeat:    '<path d="M18 46 C12 40 14 30 22 28 C26 18 40 16 46 24 C54 28 54 40 46 44 C42 52 28 54 18 46 Z" fill="currentColor" opacity=".8"/>' +
               '<path d="M26 36 C30 32 38 32 42 36" stroke="#FFF8F0" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>',
  rotiDisc:    '<circle cx="32" cy="34" r="20" fill="currentColor" opacity=".85"/>' +
               '<circle cx="25" cy="28" r="3" fill="#FFF8F0" opacity=".45"/>' +
               '<circle cx="38" cy="32" r="2.4" fill="#FFF8F0" opacity=".4"/>' +
               '<circle cx="30" cy="42" r="2.6" fill="#FFF8F0" opacity=".4"/>',
  bowlDal:     '<path d="M12 32 H52 C52 48 43 56 32 56 C21 56 12 48 12 32 Z" fill="currentColor" opacity=".85"/>' +
               '<ellipse cx="32" cy="32" rx="20" ry="5" fill="currentColor"/>' +
               '<path d="M18 30 C24 26 40 26 46 30" stroke="#FFF8F0" stroke-width="2.2" fill="none" opacity=".5"/>',
  mushroomCap: '<path d="M14 34 C14 20 22 12 32 12 C42 12 50 20 50 34 Z" fill="currentColor" opacity=".85"/>' +
               '<path d="M26 34 V52 A6 6 0 0 0 38 52 V34 Z" fill="currentColor" opacity=".6"/>' +
               '<circle cx="24" cy="24" r="3" fill="#FFF8F0" opacity=".5"/>' +
               '<circle cx="38" cy="22" r="2.4" fill="#FFF8F0" opacity=".45"/>'
};
function foodArt(key, title) {
  return svgWrap(GLYPH[key] || GLYPH.fruitRound, 64, title);
}
function binMarkYes() { return artRosette(); }
function binMarkNo() {
  return svgWrap(
    '<circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="4"/>' +
    '<path d="M17 47 L47 17" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"/>',
    64, '');
}


/* ============================================================
   PLAY · card, bins, sorting, teaching feedback
   ============================================================ */
function paintBins() {
  $('binYesMark').innerHTML = binMarkYes();
  $('binNoMark').innerHTML = binMarkNo();
  $('binYesName').textContent = t('binYes');
  $('binYesNote').textContent = t('binYesNote');
  $('binNoName').textContent = t('binNo');
  $('binNoNote').textContent = t('binNoNote');
  /* The arrows always describe the bins' MEASURED on-screen order, so the
     swipe mapping can never disagree with what the player sees. */
  var yesLeft = binIsLeft();
  $('binYesArrow').textContent = yesLeft ? t('binYesArrow') : t('binYesArrow').replace('←', '→');
  $('binNoArrow').textContent = yesLeft ? t('binNoArrow') : t('binNoArrow').replace('→', '←');
}

/** True when the Jain-friendly bin is physically to the left of the other. */
function binIsLeft() {
  var y = $('binYes').getBoundingClientRect();
  var n = $('binNo').getBoundingClientRect();
  if (!y.width && !y.left) return true;      // jsdom / un laid-out: assume markup order
  return y.left <= n.left;
}

function showCard() {
  if (S.idx >= S.deck.length) { endRound(); return; }
  var f = S.deck[S.idx];
  var card = $('foodCard');
  card.classList.remove('is-hidden', 'is-swipeL', 'is-swipeR');
  $('foodArt').innerHTML = foodArt(f[4], foodName(f));
  $('foodName').textContent = foodName(f);
  $('foodHint').textContent = t('cardHint');
  card.setAttribute('aria-label', foodName(f));
  /* restart the entry animation */
  card.classList.remove('is-in');
  void card.offsetWidth;
  card.classList.add('is-in');
  S.lock = false;
  paintHud();
}

function paintHud() {
  var hi = (S.lang === 'hi');
  $('hudScore').textContent = hi ? devNum(S.score) : String(S.score);
  $('hudStreak').textContent = hi ? devNum(S.streak) : String(S.streak);
  $('hudCount').textContent = (hi ? devNum(S.idx) : S.idx) + '/' +
                              (hi ? devNum(S.deck.length) : S.deck.length);
  $('hudTime').textContent = fmtTime(S.elapsed);
  var pct = S.deck.length ? (S.idx / S.deck.length) : 0;
  $('progFill').style.transform = 'scaleX(' + pct.toFixed(4) + ')';
}

/** choice === true means the player sorted it into the Jain-friendly bin. */
function sortFood(choice) {
  if (S.lock || S.idx >= S.deck.length) return;
  S.lock = true;
  startClock();

  var f = S.deck[S.idx];
  var right = (choice === foodJain(f));
  var bin = choice ? $('binYes') : $('binNo');
  var gain = BASE + Math.min(S.streak, STREAK_MAX) * STREAK_STEP;

  bin.classList.add(right ? 'is-good' : 'is-bad');
  setTimeout(function () { bin.classList.remove('is-good', 'is-bad'); }, reduced() ? 60 : 560);

  if (right) {
    S.correct++;
    S.streak++;
    if (S.streak > S.best) S.best = S.streak;
    S.score += gain;
  } else {
    S.streak = 0;
    S.mistakes.push(f);
  }
  paintHud();
  renderFeedback(f, right, gain);
  if (right) sfx.match(); else sfx.miss();
}

/** Teaching card — built entirely with textContent, never innerHTML. */
function renderFeedback(f, right, gain) {
  var host = $('feedback');
  host.innerHTML = '';

  var box = document.createElement('div');
  box.className = 'g-fb ' + (right ? 'is-correct' : 'is-wrong');

  var mark = document.createElement('span');
  mark.className = 'g-fb-mark';
  mark.innerHTML = right ? artMedal() : artDiya();
  box.appendChild(mark);

  var body = document.createElement('div');
  body.className = 'g-fb-body';

  var head = document.createElement('div');
  head.className = 'g-fb-head';
  head.textContent = right ? t('correct') : t('wrong');
  body.appendChild(head);

  var verdict = document.createElement('div');
  verdict.className = 'g-fb-verdict';
  verdict.textContent = foodName(f) + ' ' + (foodJain(f) ? t('verdictYes') : t('verdictNo'));
  body.appendChild(verdict);

  var why = document.createElement('p');
  why.className = 'g-fb-why';
  why.textContent = foodWhy(f);
  body.appendChild(why);

  var cat = document.createElement('p');
  cat.className = 'g-fb-why';
  cat.style.opacity = '.8';
  cat.textContent = catName(f[1]);
  body.appendChild(cat);

  var note = foodNote(f);
  if (note) {
    var n = document.createElement('div');
    n.className = 'g-fb-note';
    var b = document.createElement('b');
    b.textContent = t('noteLabel') + ': ';
    n.appendChild(b);
    n.appendChild(document.createTextNode(note));
    body.appendChild(n);
  }

  var foot = document.createElement('div');
  foot.className = 'g-fb-foot';
  var tag = document.createElement('span');
  tag.className = 'g-fb-tag';
  tag.textContent = right ? t('points', { n: (S.lang === 'hi' ? devNum(gain) : gain) })
                          : t('keepLearning');
  foot.appendChild(tag);
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'g-btn g-btn-sm g-btn-primary g-fb-next';
  next.textContent = t('next');
  next.addEventListener('click', nextFood);
  foot.appendChild(next);
  body.appendChild(foot);

  box.appendChild(body);
  host.appendChild(box);
  next.focus();
  say(head.textContent + ' ' + verdict.textContent + ' ' + why.textContent);
}

function say(msg) { var e = $('live'); if (e) e.textContent = msg; }

function nextFood() {
  S.idx++;
  $('feedback').innerHTML = '';
  paintHud();
  if (S.idx >= S.deck.length) { endRound(); return; }
  showCard();
}


/* ============================================================
   RESULT
   ============================================================ */
function levelKey() {
  return (S.aud === 'adults' ? 'adults' : 'kids') + '-' + (S.round > 0 ? S.round : 'all');
}
function levelLabel() {
  var who = S.aud === 'adults' ? t('adults') : t('kids');
  var n = S.round > 0
    ? (S.lang === 'hi' ? devNum(S.round) : String(S.round))
    : t('roundAll');
  return who + ' · ' + n;
}

function tierOf() {
  var pct = S.deck.length ? (S.correct / S.deck.length) : 0;
  if (pct === 1) return 3;
  if (pct >= 0.8) return 2;
  if (pct >= 0.6) return 1;
  return 0;
}

function endRound() {
  stopClock();
  if (S.startedAt) S.elapsed = Math.floor((Date.now() - S.startedAt) / 1000);

  var entry = {
    name: S.name,
    level: levelLabel(),
    levelKey: levelKey(),
    duration: S.elapsed,
    score: S.score,
    meta: { correct: S.correct, total: S.deck.length, best: S.best, aud: S.aud },
    ts: Date.now()
  };
  var res = lbSave(entry);
  S.lastRank = res.saved ? res.rank : 0;

  setScreen('result');
  paintResultText();
  renderReview();
  if (tierOf() >= 1) petals(26);
  sfx.finish();
  toast(res.saved ? t('saved', { n: (S.lang === 'hi' ? devNum(S.score) : S.score) })
                  : t('storageOff'));
}

function paintResultText() {
  var tier = tierOf();
  var hi = (S.lang === 'hi');
  $('medalMark').innerHTML = artMedal();
  $('resTitle').textContent = t('resTitle')[tier];
  $('resSub').textContent = t('resSub')[tier];
  $('stScore').textContent = hi ? devNum(S.score) : String(S.score);
  $('stCorrect').textContent = (hi ? devNum(S.correct) : S.correct) + '/' +
                               (hi ? devNum(S.deck.length) : S.deck.length);
  $('stBest').textContent = hi ? devNum(S.best) : String(S.best);
  $('stTime').textContent = fmtClock(S.elapsed);
  $('cheerLine').textContent = pick(t('cheers'));
  var rk = $('resRank');
  if (S.lastRank) {
    rk.textContent = t('rankLine', { n: hi ? devNum(S.lastRank) : S.lastRank });
    rk.classList.remove('is-hidden');
  } else {
    rk.classList.add('is-hidden');
  }
  $('resLbPanel').classList.remove('is-hidden');
  renderLbInto('resLbBody');
}

/** Review the misses; when nothing was missed, show four worth remembering. */
function renderReview() {
  var host = $('reviewList');
  host.innerHTML = '';
  var items = S.mistakes.length ? S.mistakes : S.deck.slice(0, 4);

  if (!S.mistakes.length) {
    var note = document.createElement('p');
    note.className = 'g-fb-note';
    note.textContent = t('reviewEmpty');
    host.appendChild(note);
  }

  items.slice(0, 10).forEach(function (f) {
    var row = document.createElement('div');
    row.className = 'g-revitem';
    var b = document.createElement('b');
    b.textContent = foodName(f) + ' — ';
    row.appendChild(b);
    row.appendChild(document.createTextNode(
      foodJain(f) ? t('verdictYes') : t('verdictNo')));
    var why = document.createElement('span');
    why.className = 'g-revwhy';
    why.textContent = foodWhy(f);
    row.appendChild(why);
    var nt = foodNote(f);
    if (nt) {
      var nn = document.createElement('span');
      nn.className = 'g-revwhy';
      nn.style.fontStyle = 'italic';
      nn.textContent = t('noteLabel') + ': ' + nt;
      row.appendChild(nn);
    }
    host.appendChild(row);
  });
}

/* ============================================================
   LEADERBOARD
   ============================================================ */
function renderLbInto(id) {
  var host = $(id);
  if (!host) return;
  host.innerHTML = '';
  var list = lbList();
  if (!list.length) {
    var p = document.createElement('p');
    p.className = 'g-lb-empty';
    p.textContent = t('lbEmpty');
    host.appendChild(p);
    return;
  }
  var wrap = document.createElement('div');
  wrap.className = 'g-tablewrap';
  var tb = document.createElement('table');
  tb.className = 'g-table';
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  [t('thRank'), t('thLbName'), t('thLbLevel'), t('thLbScore'), t('thLbTime')].forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  tb.appendChild(thead);
  var body = document.createElement('tbody');
  var medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  list.slice(0, 10).forEach(function (e, i) {
    var tr = document.createElement('tr');
    var vals = [
      i < 3 ? medals[i] : String(i + 1),
      e.name || '—',
      e.level || e.levelKey || '—',
      (S.lang === 'hi' ? devNum(e.score) : String(e.score)),
      fmtClock(e.duration)
    ];
    vals.forEach(function (v, ci) {
      var td = document.createElement('td');
      td.textContent = v;               // textContent only, never innerHTML
      if (ci === 0 && i < 3) td.className = 'g-medalcell';
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  tb.appendChild(body);
  wrap.appendChild(tb);
  host.appendChild(wrap);
}

function clearLb() {
  askDialog(t('lbConfirmTitle'), t('lbConfirmBody'), t('lbClear'), t('no'), function () {
    lbClear();
    renderLbInto('lbBody');
    renderLbInto('resLbBody');
    toast(t('lbCleared'));
  });
}


/* ============================================================
   SETUP CHIPS
   ============================================================ */
function buildRoundChips() {
  var host = $('roundChips');
  host.innerHTML = '';
  ROUNDS.forEach(function (n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.round === n ? ' is-on' : '');
    b.textContent = (n === 0) ? t('roundAll')
      : (S.lang === 'hi' ? devNum(n) : String(n));
    b.setAttribute('aria-pressed', S.round === n ? 'true' : 'false');
    b.addEventListener('click', function () { S.round = n; buildRoundChips(); sfx.tap(); });
    host.appendChild(b);
  });
}

/* ============================================================
   RENDER · pure function of state; a language switch mid-round
   never loses the deck, the score or the clock
   ============================================================ */
function applyText() {
  document.documentElement.lang = (S.lang === 'hi') ? 'hi' : 'en';
  document.title = (S.lang === 'hi'
    ? 'सात्त्विक रसोई · Sattvic Chef'
    : 'Sattvic Chef · सात्त्विक रसोई');

  $('brandMark').innerHTML = artSwastika();
  $('brandHi').textContent = t('brandHi');
  $('brandEn').textContent = t('brandEn');
  $('langBtn').textContent = t('langSwitch');
  $('hubBtn').textContent = t('hub');
  $('restartBtn').textContent = t('restart');
  paintSound();

  $('langGlyph').innerHTML = artRosette();
  $('s1Title').textContent = t('s1Title');
  $('s1Sub').textContent = t('s1Sub');

  $('s2Title').textContent = t('s2Title');
  $('s2Sub').textContent = t('s2Sub');
  $('kidsLbl').textContent = t('kids');
  $('kidsNote').textContent = t('kidsNote');
  $('adultsLbl').textContent = t('adults');
  $('adultsNote').textContent = t('adultsNote');

  $('s3Title').textContent = t('s3Title');
  $('s3Sub').textContent = t('s3Sub');
  $('nameLabel').textContent = t('nameLabel');
  $('nameInput').placeholder = t('namePh');
  $('roundLabel').textContent = t('roundLabel');
  $('setupHint').textContent = t('setupHint');
  $('startBtn').textContent = t('start');
  $('lbBtn').textContent = t('leaderboard');
  $('lbTitle').textContent = t('lbTitle');
  $('lbClearBtn').textContent = t('lbClear');

  $('hudScoreLbl').textContent = t('hudScore');
  $('hudStreakLbl').textContent = t('hudStreak');
  $('hudCountLbl').textContent = t('hudCount');
  $('hudTimeLbl').textContent = t('hudTime');
  $('quitBtn').textContent = t('quit');

  $('stScoreLbl').textContent = t('statScore');
  $('stCorrectLbl').textContent = t('statCorrect');
  $('stBestLbl').textContent = t('statBest');
  $('stTimeLbl').textContent = t('statTime');
  $('againBtn').textContent = t('again');
  $('changeBtn').textContent = t('changeSetup');
  $('resLbBtn').textContent = t('showLb');
  $('resLbTitle').textContent = t('lbTitle');
  $('resLbClearBtn').textContent = t('lbClear');
  $('reviewTitle').textContent = t('reviewTitle');
  $('footTxt').textContent = t('foot');

  buildRoundChips();
  /* The bins live in the DOM at all times, so they must be repainted on every
     language switch — otherwise a mid-round switch leaves stale labels. */
  paintBins();
  if (!$('lbPanel').classList.contains('is-hidden')) renderLbInto('lbBody');
  if (!$('resLbPanel').classList.contains('is-hidden')) renderLbInto('resLbBody');
  if (S.screen === 'play') showCardText();
  if (S.screen === 'result') { paintResultText(); renderReview(); }
}

/** Repaint only the current card's text and art — the deck stays untouched. */
function showCardText() {
  var f = S.deck[S.idx];
  if (!f) return;
  $('foodArt').innerHTML = foodArt(f[4], foodName(f));
  $('foodName').textContent = foodName(f);
  $('foodHint').textContent = t('cardHint');
  $('foodCard').setAttribute('aria-label', foodName(f));
  paintHud();
}

function paintSound() {
  var b = $('sndBtn');
  b.innerHTML = artBell(S.sound);
  b.setAttribute('aria-pressed', S.sound ? 'true' : 'false');
  b.setAttribute('aria-label', S.sound ? t('soundOn') : t('soundOff'));
  b.title = S.sound ? t('soundOn') : t('soundOff');
}


/* ============================================================
   INPUT · drag-and-drop, swipe, tap and keyboard
   ============================================================ */
var card = $('foodCard');

/* --- HTML5 drag and drop (desktop) --- */
card.addEventListener('dragstart', function (e) {
  card.classList.add('is-dragging');
  try { e.dataTransfer.setData('text/plain', 'food'); } catch (err) { /* ignore */ }
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
});
card.addEventListener('dragend', function () { card.classList.remove('is-dragging'); });

['binYes', 'binNo'].forEach(function (id) {
  var bin = $(id);
  bin.addEventListener('dragover', function (e) { e.preventDefault(); bin.classList.add('is-drop'); });
  bin.addEventListener('dragleave', function () { bin.classList.remove('is-drop'); });
  bin.addEventListener('drop', function (e) {
    e.preventDefault();
    bin.classList.remove('is-drop');
    sortFood(id === 'binYes');
  });
  /* a tap on a bin always works, in every layout */
  bin.addEventListener('click', function () { ac(); sortFood(id === 'binYes'); });
});

/* --- swipe (touch). Direction is resolved against the bins' MEASURED
       on-screen order, so it can never disagree with what is visible. --- */
card.addEventListener('touchstart', function (e) {
  if (e.touches && e.touches.length) S.touchX = e.touches[0].clientX;
}, { passive: true });
card.addEventListener('touchend', function (e) {
  if (S.touchX === null || !e.changedTouches || !e.changedTouches.length) return;
  var dx = e.changedTouches[0].clientX - S.touchX;
  S.touchX = null;
  if (Math.abs(dx) < 70) return;               // a tap, not a swipe
  var wentRight = dx > 0;
  var yesIsLeft = binIsLeft();
  var choseYes = yesIsLeft ? !wentRight : wentRight;
  var cls = choseYes
    ? (yesIsLeft ? 'is-swipeL' : 'is-swipeR')
    : (yesIsLeft ? 'is-swipeR' : 'is-swipeL');
  card.classList.add(cls);
  setTimeout(function () {
    card.classList.remove('is-swipeL', 'is-swipeR');
    sortFood(choseYes);
  }, reduced() ? 0 : 180);
}, { passive: true });

/* --- keyboard: 1 / 2, or arrow keys toward the matching bin --- */
document.addEventListener('keydown', function (e) {
  if (S.screen !== 'play') return;
  var yesLeft = binIsLeft();
  if (e.key === '1') { e.preventDefault(); ac(); sortFood(true); }
  else if (e.key === '2') { e.preventDefault(); ac(); sortFood(false); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); ac(); sortFood(yesLeft); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); ac(); sortFood(!yesLeft); }
});

/* keep the swipe and arrow mapping honest after a rotation or resize */
window.addEventListener('resize', function () {
  if (S.screen === 'play') paintBins();
});

/* ============================================================
   WIRING
   ============================================================ */
function setLang(lang) {
  S.lang = (lang === 'en') ? 'en' : 'hi';
  writePrefs({ lang: S.lang });
  applyText();          // text only — deck, score and clock survive
}

function chooseAud(aud) {
  S.aud = aud;
  writePrefs({ aud: aud });
  buildPool();
  /* if the chosen round is bigger than the new pool, fall back to "all" */
  if (S.round > 0 && S.round > S.pool.length) S.round = 0;
  buildRoundChips();
  setScreen('setup');
  sfx.tap();
}


document.querySelectorAll('[data-lang]').forEach(function (b) {
  b.addEventListener('click', function () {
    ac();
    setLang(b.dataset.lang);
    sfx.tap();
    setScreen('aud');
  });
});
document.querySelectorAll('[data-aud]').forEach(function (b) {
  b.addEventListener('click', function () { ac(); chooseAud(b.dataset.aud); });
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
$('hubBtn').addEventListener('click', function () {
  sfx.tap();
  try {
    if (window.parent && window.parent !== window && window.parent.location) {
      window.parent.location.hash = '#/kids';
      return;
    }
  } catch (e) { /* cross-origin: fall through to the file hub */ }
  window.location.href = 'index.html';
});
$('restartBtn').addEventListener('click', function () {
  stopClock();
  sfx.tap();
  setScreen(S.aud ? 'setup' : 'aud');
});

$('startBtn').addEventListener('click', function () { ac(); startRound(); });
$('nameInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); startRound(); }
});
$('quitBtn').addEventListener('click', function () {
  askDialog(t('quitConfirm'), t('quitBody'), t('yes'), t('no'), function () {
    stopClock();
    setScreen('setup');
    sfx.tap();
  });
});
$('againBtn').addEventListener('click', function () { ac(); startRound(); });
$('changeBtn').addEventListener('click', function () { stopClock(); sfx.tap(); setScreen('setup'); });

$('lbBtn').addEventListener('click', function () {
  var p = $('lbPanel');
  p.classList.toggle('is-hidden');
  if (!p.classList.contains('is-hidden')) renderLbInto('lbBody');
  sfx.tap();
});
$('resLbBtn').addEventListener('click', function () {
  var p = $('resLbPanel');
  p.classList.toggle('is-hidden');
  if (!p.classList.contains('is-hidden')) renderLbInto('resLbBody');
  sfx.tap();
});
$('lbClearBtn').addEventListener('click', clearLb);
$('resLbClearBtn').addEventListener('click', clearLb);

/* ============================================================
   BOOT
   ============================================================ */
function parseQuery() {
  var q = {};
  try {
    var sp = new URLSearchParams(window.location.search || '');
    sp.forEach(function (v, k) { q[k] = v; });
  } catch (e) { q = {}; }
  return q;
}

function storageOk() {
  try {
    localStorage.setItem('__jb_t__', '1');
    localStorage.removeItem('__jb_t__');
    return true;
  } catch (e) { return false; }
}

function boot() {
  var prefs = readPrefs();
  S.lang = (prefs.lang === 'en') ? 'en' : 'hi';
  S.sound = prefs.sound !== false;
  S.name = prefs.name || '';
  S.aud = (prefs.aud === 'adults') ? 'adults' : null;

  var q = parseQuery();
  var qLang = (q.lang === 'en' || q.lang === 'hi') ? q.lang : null;
  if (qLang) S.lang = qLang;
  var qAud = (q.aud === 'kids' || q.aud === 'adults') ? q.aud : null;
  if (qAud) S.aud = qAud;
  var qn = parseInt(q.n, 10);
  if (ROUNDS.indexOf(qn) >= 0) S.round = qn;
  if (q.embed === '1') $('hubBtn').classList.add('is-hidden');

  if (S.name) $('nameInput').value = S.name;
  writePrefs({ lang: S.lang, sound: S.sound, lastGame: GAME_ID });

  applyText();
  if (qLang && qAud) { buildPool(); setScreen('setup'); }
  else if (qLang) setScreen('aud');
  else setScreen('lang');

  if (!storageOk()) setTimeout(function () { toast(t('storageOff')); }, 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

