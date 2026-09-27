/* ============================================================
   STATE
   ============================================================ */
var S = {
  lang: 'hi', sound: true, aud: null, name: '', screen: 'lang',
  round: 10, timerKey: 'standard', timerSec: 12,
  pool: [], deck: [], idx: 0,
  score: 0, streak: 0, best: 0, correct: 0, answered: 0,
  startedAt: 0, clockId: null, timerId: null, elapsed: 0,
  lock: false, missed: [], lastRank: 0
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

/* Row: [id, aud, topic, answer(1|0), enS, hiS, enX, hiX] */
function qText(q)  { return S.lang === 'hi' ? q[5] : q[4]; }
function qWhy(q)   { return S.lang === 'hi' ? q[7] : q[6]; }
function qTrue(q)  { return q[3] === 1; }
function topicName(key) {
  for (var i = 0; i < TOPICS.length; i++) {
    if (TOPICS[i][0] === key) return S.lang === 'hi' ? TOPICS[i][2] : TOPICS[i][1];
  }
  return key;
}
function timerSecFor(key) {
  for (var i = 0; i < TIMERS.length; i++) if (TIMERS[i].key === key) return TIMERS[i].sec;
  return 12;
}

function buildPool() {
  S.pool = QUESTIONS.filter(function (q) {
    return S.aud === 'adults' ? true : (q[1] !== 'adults');
  });
}

function stopClock() { if (S.clockId) { clearInterval(S.clockId); S.clockId = null; } }
function stopTimer() { if (S.timerId) { clearTimeout(S.timerId); S.timerId = null; } }
function startClock() {
  if (S.startedAt) return;
  S.startedAt = Date.now();
  stopClock();
  S.clockId = setInterval(function () {
    S.elapsed = Math.floor((Date.now() - S.startedAt) / 1000);
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
  S.timerSec = timerSecFor(S.timerKey);

  S.idx = 0; S.score = 0; S.streak = 0; S.best = 0;
  S.correct = 0; S.answered = 0;
  S.startedAt = 0; S.elapsed = 0; S.lock = false; S.missed = []; S.lastRank = 0;
  stopClock(); stopTimer();
  clearLesson();
  $('lbPanel').classList.add('is-hidden');

  setScreen('play');
  showStatement();
  bell(0.05);
}

/* ============================================================
   PLAY
   ============================================================ */
function showStatement() {
  if (S.idx >= S.deck.length) { endRound(); return; }
  var q = S.deck[S.idx];
  S.lock = false;
  $('statement').textContent = qText(q);
  $('topicLine').textContent = topicName(q[2]);
  $('qNum').textContent = (S.lang === 'hi' ? devNum(S.idx + 1) : (S.idx + 1)) +
    ' / ' + (S.lang === 'hi' ? devNum(S.deck.length) : S.deck.length);
  $('btnTrue').disabled = false;
  $('btnFalse').disabled = false;
  $('statementCard').classList.remove('is-shake');
  clearLesson();
  paintHud();
  startTimerBar();
  say(qText(q));
}

function startTimerBar() {
  stopTimer();
  var fill = $('timerFill');
  var bar = fill.parentNode;
  bar.classList.remove('is-warn');
  if (!S.timerSec) {                      // "no timer" — hide the bar entirely
    bar.style.opacity = '0';
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    return;
  }
  bar.style.opacity = '1';
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(1)';
  void fill.offsetWidth;                   // force reflow so the restart is clean
  if (reduced()) {
    fill.style.transition = 'none';
  } else {
    fill.style.transition = 'transform ' + S.timerSec + 's linear';
    fill.style.transform = 'scaleX(0)';
  }
  S.timerId = setTimeout(function () {
    if (!S.lock) answer(null);
  }, S.timerSec * 1000);
  if (!reduced()) {
    setTimeout(function () { bar.classList.add('is-warn'); },
      Math.round(S.timerSec * (1 - WARN_AT) * 1000));
  }
}

function paintHud() {
  var hi = (S.lang === 'hi');
  $('hudScore').textContent = hi ? devNum(S.score) : String(S.score);
  $('hudStreak').textContent = hi ? devNum(S.streak) : String(S.streak);
  var acc = S.answered ? Math.round((S.correct / S.answered) * 100) : null;
  $('hudAcc').textContent = acc === null ? '—' : (hi ? devNum(acc) : acc) + '%';
  $('progFill').style.transform =
    'scaleX(' + (S.deck.length ? (S.idx / S.deck.length) : 0).toFixed(4) + ')';
}

/** guess === null means the clock ran out. */
function answer(guess) {
  if (S.lock || S.idx >= S.deck.length) return;
  S.lock = true;
  stopTimer();
  startClock();
  $('btnTrue').disabled = true;
  $('btnFalse').disabled = true;

  var q = S.deck[S.idx];
  var right = (guess !== null) && (guess === qTrue(q));
  var gain = BASE + (S.streak >= STREAK_AT ? STREAK_BONUS : 0);

  S.answered++;
  if (right) {
    S.correct++;
    S.streak++;
    if (S.streak > S.best) S.best = S.streak;
    S.score += gain;
    sfx.match();
  } else {
    S.streak = 0;
    S.missed.push(q);
    $('statementCard').classList.add('is-shake');
    sfx.miss();
  }
  paintHud();
  renderLesson(q, right, guess === null, gain);
}

function say(msg) { var e = $('live'); if (e) e.textContent = msg; }

/** Teaching card, inline — built with textContent only, never innerHTML. */
function renderLesson(q, right, timedOut, gain) {
  clearLesson();
  var box = document.createElement('div');
  box.className = 'g-lesson ' + (right ? 'is-correct' : 'is-wrong');

  if (!right && !qTrue(q)) {
    var sw = document.createElement('div');
    sw.className = 'g-stampwrap';
    var stamp = document.createElement('span');
    stamp.className = 'g-stamp';
    stamp.textContent = t('mythStamp');
    sw.appendChild(stamp);
    box.appendChild(sw);
  }

  var head = document.createElement('div');
  head.className = 'g-lesson-head';
  var mark = document.createElement('span');
  mark.className = 'g-lesson-mark';
  mark.innerHTML = right ? artMedal() : artDiya();
  head.appendChild(mark);
  var title = document.createElement('span');
  title.className = 'g-lesson-title';
  title.textContent = right ? t('correctTitle')
    : (timedOut ? t('timeoutTitle') : t('wrongTitle'));
  head.appendChild(title);
  box.appendChild(head);

  var body = document.createElement('p');
  body.className = 'g-lesson-body';
  var lead = right ? (qTrue(q) ? t('trueLead') : t('falseLead')) : '';
  body.textContent = lead + qWhy(q);
  box.appendChild(body);

  var foot = document.createElement('div');
  foot.className = 'g-lesson-foot';
  var tag = document.createElement('span');
  tag.className = 'g-lesson-tag';
  tag.textContent = right
    ? t('points', { n: (S.lang === 'hi' ? devNum(gain) : gain) })
    : topicName(q[2]);
  foot.appendChild(tag);
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'g-btn g-btn-sm g-btn-primary g-lesson-next';
  next.textContent = t('next');
  next.addEventListener('click', nextStatement);
  foot.appendChild(next);
  box.appendChild(foot);

  var anchor = $('statementCard');
  anchor.parentNode.insertBefore(box, anchor.nextSibling);
  next.focus();
  say(title.textContent + ' ' + body.textContent);
}

function clearLesson() {
  var old = document.querySelector('.g-lesson');
  if (old && old.parentNode) old.parentNode.removeChild(old);
}

function nextStatement() {
  S.idx++;
  clearLesson();
  paintHud();
  if (S.idx >= S.deck.length) { endRound(); return; }
  showStatement();
}

/* ============================================================
   RESULT
   ============================================================ */
function levelKey() {
  return (S.aud === 'adults' ? 'adults' : 'kids') + '-' +
         (S.round > 0 ? S.round : 'all') + '-' + S.timerKey;
}
function levelLabel() {
  var who = S.aud === 'adults' ? t('adults') : t('kids');
  var n = S.round > 0
    ? (S.lang === 'hi' ? devNum(S.round) : String(S.round))
    : t('roundAll');
  return who + ' · ' + n + ' · ' + t('timer')[S.timerKey];
}

function tierOf() {
  var pct = S.deck.length ? (S.correct / S.deck.length) : 0;
  if (pct === 1) return 3;
  if (pct >= 0.8) return 2;
  if (pct >= 0.6) return 1;
  return 0;
}

function endRound() {
  stopTimer(); stopClock();
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
  var acc = S.deck.length ? Math.round((S.correct / S.deck.length) * 100) : 0;
  $('stAcc').textContent = (hi ? devNum(acc) : acc) + '%';
  $('stCorrect').textContent = (hi ? devNum(S.correct) : S.correct) + '/' +
                               (hi ? devNum(S.deck.length) : S.deck.length);
  $('stBest').textContent = hi ? devNum(S.best) : String(S.best);
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
  var items = S.missed.length ? S.missed : S.deck.slice(0, 4);

  if (!S.missed.length) {
    var note = document.createElement('p');
    note.className = 'g-fb-note';
    note.textContent = t('reviewEmpty');
    host.appendChild(note);
  }

  items.slice(0, 10).forEach(function (q) {
    var row = document.createElement('div');
    row.className = 'g-revitem';
    var topic = document.createElement('span');
    topic.className = 'g-revtopic';
    topic.textContent = topicName(q[2]);
    row.appendChild(topic);
    var st = document.createElement('div');
    var b = document.createElement('b');
    b.textContent = (qTrue(q) ? t('btnTrue') : t('btnFalse')) + ': ';
    st.appendChild(b);
    st.appendChild(document.createTextNode(qText(q)));
    row.appendChild(st);
    var why = document.createElement('span');
    why.className = 'g-revwhy';
    why.textContent = qWhy(q);
    row.appendChild(why);
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
      td.textContent = v;              // textContent only, never innerHTML
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
    b.textContent = (n === 0) ? t('roundAll') : (S.lang === 'hi' ? devNum(n) : String(n));
    b.setAttribute('aria-pressed', S.round === n ? 'true' : 'false');
    b.addEventListener('click', function () { S.round = n; buildRoundChips(); sfx.tap(); });
    host.appendChild(b);
  });
}

function buildTimerChips() {
  var host = $('timerChips');
  host.innerHTML = '';
  TIMERS.forEach(function (tm) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.timerKey === tm.key ? ' is-on' : '');
    b.textContent = t('timer')[tm.key];
    b.setAttribute('aria-pressed', S.timerKey === tm.key ? 'true' : 'false');
    b.addEventListener('click', function () {
      S.timerKey = tm.key;
      S.timerSec = tm.sec;
      buildTimerChips();
      sfx.tap();
    });
    host.appendChild(b);
  });
}


/* ============================================================
   RENDER · pure function of state, so a language switch mid-round
   never loses the deck, the score or the clock
   ============================================================ */
function applyText() {
  document.documentElement.lang = (S.lang === 'hi') ? 'hi' : 'en';
  document.title = (S.lang === 'hi'
    ? 'मिथक भंजन · Myth Busters'
    : 'Myth Busters · मिथक भंजन');

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
  $('timerLabel').textContent = t('timerLabel');
  $('setupHint').textContent = t('setupHint');
  $('startBtn').textContent = t('start');
  $('lbBtn').textContent = t('leaderboard');
  $('lbTitle').textContent = t('lbTitle');
  $('lbClearBtn').textContent = t('lbClear');

  $('hudScoreLbl').textContent = t('hudScore');
  $('hudStreakLbl').textContent = t('hudStreak');
  $('hudAccLbl').textContent = t('hudAcc');
  $('btnTrue').textContent = t('btnTrue');
  $('btnFalse').textContent = t('btnFalse');
  $('quitBtn').textContent = t('quit');

  $('stScoreLbl').textContent = t('statScore');
  $('stAccLbl').textContent = t('statAcc');
  $('stCorrectLbl').textContent = t('statCorrect');
  $('stBestLbl').textContent = t('statBest');
  $('againBtn').textContent = t('again');
  $('changeBtn').textContent = t('changeSetup');
  $('resLbBtn').textContent = t('showLb');
  $('resLbTitle').textContent = t('lbTitle');
  $('resLbClearBtn').textContent = t('lbClear');
  $('reviewTitle').textContent = t('reviewTitle');
  $('footTxt').textContent = t('foot');

  buildRoundChips();
  buildTimerChips();
  if (!$('lbPanel').classList.contains('is-hidden')) renderLbInto('lbBody');
  if (!$('resLbPanel').classList.contains('is-hidden')) renderLbInto('resLbBody');

  if (S.screen === 'play') {
    var q = S.deck[S.idx];
    if (q) {
      $('statement').textContent = qText(q);
      $('topicLine').textContent = topicName(q[2]);
      $('qNum').textContent = (S.lang === 'hi' ? devNum(S.idx + 1) : (S.idx + 1)) +
        ' / ' + (S.lang === 'hi' ? devNum(S.deck.length) : S.deck.length);
    }
    paintHud();
    /* re-render the open lesson in the new language, keeping its verdict */
    var lesson = document.querySelector('.g-lesson');
    if (lesson && q) {
      var wasRight = lesson.classList.contains('is-correct');
      renderLesson(q, wasRight, false, BASE);
    }
  }
  if (S.screen === 'result') { paintResultText(); renderReview(); }
}

function paintSound() {
  var b = $('sndBtn');
  b.innerHTML = artBell(S.sound);
  b.setAttribute('aria-pressed', S.sound ? 'true' : 'false');
  b.setAttribute('aria-label', S.sound ? t('soundOn') : t('soundOff'));
  b.title = S.sound ? t('soundOn') : t('soundOff');
}


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
  stopTimer(); stopClock();
  sfx.tap();
  setScreen(S.aud ? 'setup' : 'aud');
});

$('startBtn').addEventListener('click', function () { ac(); startRound(); });
$('nameInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); startRound(); }
});
$('btnTrue').addEventListener('click', function () { ac(); answer(true); });
$('btnFalse').addEventListener('click', function () { ac(); answer(false); });
$('quitBtn').addEventListener('click', function () {
  askDialog(t('quitConfirm'), t('quitBody'), t('yes'), t('no'), function () {
    stopTimer(); stopClock();
    setScreen('setup');
    sfx.tap();
  });
});
$('againBtn').addEventListener('click', function () { ac(); startRound(); });
$('changeBtn').addEventListener('click', function () {
  stopTimer(); stopClock();
  sfx.tap();
  setScreen('setup');
});

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

/* T / F answer the statement from the keyboard */
document.addEventListener('keydown', function (e) {
  if (S.screen !== 'play' || S.lock) return;
  var k = e.key.toLowerCase();
  if (k === 't' || k === '1') { e.preventDefault(); ac(); answer(true); }
  else if (k === 'f' || k === '2') { e.preventDefault(); ac(); answer(false); }
  else if (k === 'arrowleft') { e.preventDefault(); ac(); answer(true); }
  else if (k === 'arrowright') { e.preventDefault(); ac(); answer(false); }
});
/* Enter advances past a lesson card */
document.addEventListener('keydown', function (e) {
  if (S.screen !== 'play' || !S.lock) return;
  if (e.key === 'Enter' || e.key === ' ') {
    var nx = document.querySelector('.g-lesson-next');
    if (nx && document.activeElement !== nx) { e.preventDefault(); nx.click(); }
  }
});

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

