/* ============================================================
   STATE
   ============================================================ */
var S = {
  lang: 'hi', sound: true, aud: null, cat: 'any', name: '',
  pool: [], rot: 0, phase: 'idle',
  accepted: false, current: null,
  vowsToday: 0, streakDays: 0, startedAt: 0, elapsed: 0,
  lastRank: 0, listOpen: false
};

var DATA = { kids: KIDS, adults: ADULTS };

function setScreen(name) {
  ['scrLang', 'scrAud', 'scrMain'].forEach(function (id) {
    var e = $(id);
    if (e) e.classList.toggle('is-hidden', id !== 'scr' + name.charAt(0).toUpperCase() + name.slice(1));
  });
  var rb = $('restartBtn');
  if (rb) rb.classList.toggle('is-hidden', name !== 'main');
}

/* ============================================================
   VOW LEDGER · accepted vows + day streak (ISO day keys)
   ============================================================ */
function dayKey(d) {
  var x = d || new Date();
  var m = x.getMonth() + 1, day = x.getDate();
  return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function readVows() {
  var v = parseJSON(rawGet(VOW_KEY), null);
  if (!v || typeof v !== 'object') return { last: '', streak: 0, days: {} };
  if (!v.days || typeof v.days !== 'object') v.days = {};
  v.streak = Math.max(0, Math.floor(Number(v.streak) || 0));
  return v;
}
function writeVows(v) { rawSet(VOW_KEY, JSON.stringify(v)); }

/** Record one accepted vow; recompute the streak by day-number, not string. */
function recordVow(name) {
  var v = readVows();
  var today = dayKey();
  if (!Array.isArray(v.days[today])) v.days[today] = [];
  v.days[today].push(name);

  if (v.last !== today) {
    var y = new Date();
    y.setDate(y.getDate() - 1);
    v.streak = (v.last === dayKey(y)) ? (v.streak + 1) : 1;
    v.last = today;
  }
  writeVows(v);
  S.vowsToday = v.days[today].length;
  S.streakDays = v.streak;
  return v;
}

/* ============================================================
   POOL + CHIPS
   ============================================================ */
function computePool() {
  var all = DATA[S.aud] || [];
  S.pool = (S.cat === 'any') ? all.slice() : all.filter(function (e) { return e[0] === +S.cat; });
}

function renderChips() {
  var host = $('chips');
  if (!host) return;
  host.innerHTML = '';
  var all = DATA[S.aud] || [];

  function mk(val, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.cat === val ? ' is-on' : '');
    b.textContent = label;
    b.setAttribute('aria-pressed', S.cat === val ? 'true' : 'false');
    b.addEventListener('click', function () {
      if (S.phase === 'moving') return;
      S.cat = val;
      computePool();
      renderChips();
      buildRitual();
      paintMeta();
      hideResult();
      sfx.tap();
    });
    host.appendChild(b);
  }

  mk('any', t('any'));
  CATS.forEach(function (c, i) {
    var n = all.filter(function (e) { return e[0] === i + 1; }).length;
    if (!n) return;
    mk(String(i + 1), c[1] + ' ' + (S.lang === 'hi' ? c[3] : c[2]));
  });
}

function paintMeta() {
  var m = $('metaLine');
  if (!m) return;
  var who = S.aud === 'adults' ? t('whoAdults') : t('whoKids');
  m.textContent = t('meta', { n: (S.lang === 'hi' ? devNum(S.pool.length) : S.pool.length), who: who });
}

/* ============================================================
   RITUAL ART · 14 sectors (wheel) or 14 petals (lotus), one per
   category — always readable whatever the corpus size.
   ============================================================ */
var NS = 'http://www.w3.org/2000/svg';
/* Soft pastel palette with gradient feel for the wheel sectors */
var PAL = ['#E8B4B8', '#F4D03F', '#82E0AA', '#85C1E9', '#D7BDE2', '#F0B27A',
           '#A9DFBF', '#AED6F1', '#F5CBA7', '#D2B4DE', '#FAD7A0', '#A3E4D7',
           '#F1948A', '#BB8FCE'];

function sectorPath(cx, cy, r, a0, a1) {
  var p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  var p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  var large = (a1 - a0) > Math.PI ? 1 : 0;
  return 'M' + cx + ' ' + cy + ' L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
         ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' Z';
}

function buildRitual() {
  if (RITUAL === 'wheel') buildWheel();
  else buildLotus();
}

function buildWheel() {
  var g = $('wheelG');
  if (!g) return;
  g.innerHTML = '';
  var n = CATS.length, cx = 200, cy = 200, R = 186, step = (Math.PI * 2) / n;

  for (var i = 0; i < n; i++) {
    var a0 = i * step - Math.PI / 2;
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', sectorPath(cx, cy, R, a0, a0 + step));
    p.setAttribute('fill', PAL[i % PAL.length]);
    p.setAttribute('stroke', '#FFF8F0');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('opacity', '0.92');
    g.appendChild(p);

    /* No text labels on the wheel — category names live in the chips above */
  }
  g.style.transform = 'rotate(' + S.rot + 'deg)';
}

function buildLotus() {
  var g = $('petalG');
  if (!g) return;
  g.innerHTML = '';
  var n = CATS.length;
  for (var i = 0; i < n; i++) {
    var ang = i * (360 / n);
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M180 180 C 150 122, 150 74, 180 46 C 210 74, 210 122, 180 180 Z');
    p.setAttribute('fill', PAL[i % PAL.length]);
    p.setAttribute('opacity', '0.88');
    p.setAttribute('stroke', '#FFF8F0');
    p.setAttribute('stroke-width', '1.2');
    p.setAttribute('class', 'g-petal');
    p.setAttribute('data-ang', String(ang));
    p.setAttribute('data-cat', String(i + 1));
    p.style.transformOrigin = '180px 180px';
    p.style.transform = 'rotate(' + ang + 'deg) scale(.34)';
    g.appendChild(p);
  }
  resetLotus();
}

function resetLotus() {
  var ps = document.querySelectorAll('.g-petal');
  for (var i = 0; i < ps.length; i++) {
    ps[i].style.transform = 'rotate(' + ps[i].getAttribute('data-ang') + 'deg) scale(.34)';
    ps[i].style.opacity = '0.88';
  }
  var wrap = $('lotusWrap');
  if (wrap) wrap.classList.remove('is-breathing');
}


/* ============================================================
   DRAW · the ritual resolves a category, then a vow within it
   ============================================================ */
function beginRitual() {
  if (S.phase === 'moving' || !S.pool.length) return;
  S.phase = 'moving';
  S.accepted = false;
  hideResult();
  if (!S.startedAt) S.startedAt = Date.now();

  var btn = $('actBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = RITUAL === 'wheel' ? t('wheelTurning') : t('lotusBlooming');
  }
  var hint = $('hintLine');
  if (hint) hint.textContent = t('hintBreath');

  /* Which category does the ritual land on? */
  var catNo;
  if (S.cat === 'any') {
    var present = [];
    CATS.forEach(function (c, i) {
      if (S.pool.some(function (e) { return e[0] === i + 1; })) present.push(i + 1);
    });
    catNo = present.length ? pick(present) : 1;
  } else {
    catNo = +S.cat;
  }
  var inCat = S.pool.filter(function (e) { return e[0] === catNo; });
  var vow = inCat.length ? pick(inCat) : pick(S.pool);

  if (RITUAL === 'wheel') spinTo(catNo, vow);
  else bloomTo(catNo, vow);
}

function spinTo(catNo, vow) {
  var n = CATS.length, step = 360 / n;
  var target = -((catNo - 1) * step + step / 2);
  var base = ((S.rot % 360) + 360) % 360;
  var delta = (target - base) % 360;
  if (delta < 0) delta += 360;
  var turns = reduced() ? 0 : 4;
  var finalRot = S.rot + turns * 360 + delta;
  var g = $('wheelG');
  if (g) {
    g.style.transition = reduced() ? 'none' : 'transform 5.6s cubic-bezier(.12,.64,.08,1)';
    g.style.transform = 'rotate(' + finalRot + 'deg)';
  }
  S.rot = finalRot;
  bell(0.05);
  setTimeout(function () { reveal(vow); }, reduced() ? 120 : 5750);
}

function bloomTo(catNo, vow) {
  var wrap = $('lotusWrap');
  if (wrap && S.aud !== 'kids' && !reduced()) wrap.classList.add('is-breathing');
  var ps = document.querySelectorAll('.g-petal');
  for (var i = 0; i < ps.length; i++) {
    (function (p, k) {
      setTimeout(function () {
        p.style.transform = 'rotate(' + p.getAttribute('data-ang') + 'deg) scale(1)';
        if (!reduced()) tone(560 + k * 14, 0.05, 'sine', 0.022);
      }, reduced() ? 0 : k * 62);
    })(ps[i], i);
  }
  bell(0.05);
  var settle = reduced() ? 120 : (S.aud === 'kids' ? 900 : 2400);
  setTimeout(function () {
    var chosen = document.querySelector('.g-petal[data-cat="' + catNo + '"]');
    if (chosen) chosen.style.opacity = '1';
    if (wrap) wrap.classList.remove('is-breathing');
    reveal(vow);
  }, settle);
}

function reveal(vow) {
  S.phase = 'shown';
  S.current = vow;
  var cat = CATS[vow[0] - 1];
  var L = S.lang === 'hi' ? 4 : 1;

  var rc = $('rCat');
  if (rc) rc.textContent = cat[1] + '  ' + t('catLbl') + ' · ' +
    (S.lang === 'hi' ? cat[3] : cat[2]) + ' · ' + cat[4];
  var rn = $('rName');
  if (rn) rn.textContent = vow[L];
  var rp = $('rP');
  if (rp) rp.textContent = vow[L + 1];
  var rt = $('rT');
  if (rt) rt.textContent = vow[L + 2];
  var ch = $('rCheer');
  if (ch) ch.textContent = pick(t('cheers'));

  var ab = $('acceptBtn');
  if (ab) { ab.textContent = t('accept'); ab.classList.remove('is-done'); ab.disabled = false; }
  var card = $('resultCard');
  if (card) card.classList.remove('is-hidden');

  var btn = $('actBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = RITUAL === 'wheel' ? t('wheelSpin') : t('lotusBloom');
  }
  var hint = $('hintLine');
  if (hint) hint.textContent = S.aud === 'kids' ? t('hintKids') : t('hintIdle');

  petals(reduced() ? 0 : 20);
  sfx.match();
  say(t('resTitle') + ': ' + vow[L]);
}

function hideResult() {
  var card = $('resultCard');
  if (card) card.classList.add('is-hidden');
}

function say(msg) { var e = $('live'); if (e) e.textContent = msg; }


/* ============================================================
   ACCEPT · records the vow, the day streak and the leaderboard row
   ============================================================ */
function acceptVow() {
  if (S.accepted || !S.current) return;
  S.accepted = true;
  var name = S.current[S.lang === 'hi' ? 4 : 1];
  recordVow(name);

  var ab = $('acceptBtn');
  if (ab) { ab.textContent = t('accepted'); ab.classList.add('is-done'); ab.disabled = true; }

  S.elapsed = S.startedAt ? Math.floor((Date.now() - S.startedAt) / 1000) : 0;
  var entry = {
    name: S.name || '',
    level: S.aud === 'adults' ? t('whoAdults') : t('whoKids'),
    levelKey: S.aud === 'adults' ? 'adults' : 'kids',
    duration: S.elapsed,
    score: S.vowsToday,
    meta: { vows: S.vowsToday, streakDays: S.streakDays },
    ts: Date.now()
  };
  var res = lbSave(entry);
  S.lastRank = res.saved ? res.rank : 0;

  paintStreak();
  renderTodayList();
  petals(reduced() ? 0 : 18);
  bell(0.06);
  toast(t('toastAcc'));
  if (S.streakDays > 1) setTimeout(function () {
    toast(t('toastStreak', { n: S.lang === 'hi' ? devNum(S.streakDays) : S.streakDays }));
  }, 1500);
}

function paintStreak() {
  var p = $('streakPill');
  if (!p) return;
  if (S.streakDays > 0) {
    p.textContent = t('streak', { n: S.lang === 'hi' ? devNum(S.streakDays) : S.streakDays });
    p.classList.remove('is-hidden');
  } else {
    p.classList.add('is-hidden');
  }
}

function renderTodayList() {
  var host = $('todayList');
  if (!host) return;
  host.innerHTML = '';
  var v = readVows();
  var list = v.days[dayKey()] || [];
  if (!list.length) {
    var e = document.createElement('p');
    e.className = 'g-lb-empty';
    e.textContent = t('noVowsYet');
    host.appendChild(e);
    return;
  }
  var h = document.createElement('h4');
  h.className = 'g-review-title';
  h.textContent = t('reviewTitle') + ' · ' + (S.lang === 'hi' ? devNum(list.length) : list.length);
  host.appendChild(h);
  var ul = document.createElement('ul');
  ul.style.cssText = 'list-style:none;padding:0;margin:0';
  list.forEach(function (nm, i) {
    var li = document.createElement('li');
    li.style.cssText = 'padding:7px 2px;border-top:1px dashed #EADBC0;font-size:.86rem';
    li.textContent = (S.lang === 'hi' ? devNum(i + 1) : (i + 1)) + '.  ' + nm;
    ul.appendChild(li);
  });
  host.appendChild(ul);
}

/* ============================================================
   FULL LIST · every niyam, grouped by the 14 categories
   ============================================================ */
function renderFullList() {
  var host = $('listBody');
  if (!host) return;
  host.innerHTML = '';
  var all = DATA[S.aud] || [];
  var title = $('listTitle');
  if (title) {
    title.textContent = t('listTitle', {
      who: S.aud === 'adults' ? t('whoAdults') : t('whoKids'),
      n: (S.lang === 'hi' ? devNum(all.length) : all.length)
    });
  }
  var L = S.lang === 'hi' ? 4 : 1;
  var labP = t('labP').split('·')[0].trim();
  var labT = t('labT').split('·')[0].trim();

  CATS.forEach(function (c, ci) {
    var items = all.filter(function (e) { return e[0] === ci + 1; });
    if (!items.length) return;

    var grp = document.createElement('div');
    grp.className = 'g-grp';

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'g-grp-head';
    head.setAttribute('aria-expanded', 'false');
    var lbl = document.createElement('span');
    lbl.textContent = c[1] + ' ' + (S.lang === 'hi' ? c[3] : c[2]) + ' · ' + c[4];
    var cnt = document.createElement('span');
    cnt.className = 'g-grp-cnt';
    cnt.textContent = S.lang === 'hi' ? devNum(items.length) : String(items.length);
    head.appendChild(lbl);
    head.appendChild(cnt);

    var bodyEl = document.createElement('div');
    bodyEl.className = 'g-grp-body is-hidden';
    items.forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'g-nrow';
      var nm = document.createElement('div');
      nm.className = 'g-ntitle';
      nm.textContent = e[L];
      var sub = document.createElement('div');
      sub.className = 'g-nsub';
      var b1 = document.createElement('b');
      b1.textContent = labP + ': ';
      sub.appendChild(b1);
      sub.appendChild(document.createTextNode(e[L + 1]));
      sub.appendChild(document.createElement('br'));
      var b2 = document.createElement('b');
      b2.textContent = labT + ': ';
      sub.appendChild(b2);
      sub.appendChild(document.createTextNode(e[L + 2]));
      row.appendChild(nm);
      row.appendChild(sub);
      bodyEl.appendChild(row);
    });

    head.addEventListener('click', function () {
      var open = bodyEl.classList.toggle('is-hidden');
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      sfx.tap();
    });
    grp.appendChild(head);
    grp.appendChild(bodyEl);
    host.appendChild(grp);
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
  [t('thRank'), t('thLbName'), t('thLbLevel'), t('thLbVows'), t('thLbTime')].forEach(function (h) {
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
      (S.lang === 'hi' ? devNum((e.meta && e.meta.vows) || 0) : String((e.meta && e.meta.vows) || 0)),
      fmtClock(e.duration)
    ];
    vals.forEach(function (v, ci) {
      var td = document.createElement('td');
      td.textContent = v;                 // textContent only, never innerHTML
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
  askDialog(t('lbConfirmTitle'), t('lbConfirmBody'), t('lbConfirmYes'), t('lbConfirmNo'), function () {
    lbClear();
    renderLbInto('lbBody');
    renderLbInto('resLbBody');
    toast(t('lbCleared'));
  });
}


/* ============================================================
   RENDER · a pure function of state, so a live language switch
   never loses the vow, the streak or the opened list.
   ============================================================ */
function applyText() {
  document.documentElement.lang = (S.lang === 'hi') ? 'hi' : 'en';
  document.title = (S.lang === 'hi' ? 'नियम · Daily Vow' : 'Daily Vow · नियम');

  var mark = $('brandMark');
  if (mark) mark.innerHTML = artSwastika();
  /* Ritual centres: the wheel hub takes a symmetric mandala, the lotus bud
     takes the Jain Swastika. Both are SVG paths, so neither can ever mirror. */
  var hub = $('wheelHub');
  if (hub) hub.innerHTML = artRosette();
  var bud = $('budMark');
  if (bud) bud.innerHTML = artSwastika();
  var bh = $('brandHi'); if (bh) bh.textContent = t('brandHi');
  var be = $('brandEn'); if (be) be.textContent = t('brandEn');
  var lb = $('langBtn'); if (lb) lb.textContent = t('langSwitch');
  var hb = $('hubBtn'); if (hb) hb.textContent = t('hub');
  var rb = $('restartBtn'); if (rb) rb.textContent = t('restart');
  paintSound();

  var s1t = $('s1Title'); if (s1t) s1t.textContent = t('s1Title');
  var s1s = $('s1Sub'); if (s1s) s1s.textContent = t('s1Sub');
  var glyph = $('langGlyph'); if (glyph) glyph.innerHTML = artRosette();

  var s2t = $('s2Title'); if (s2t) s2t.textContent = t('s2Title');
  var s2s = $('s2Sub'); if (s2s) s2s.textContent = t('s2Sub');
  var kl = $('kidsLbl'); if (kl) kl.textContent = t('kids');
  var kn = $('kidsNote'); if (kn) kn.textContent = t('kidsNote');
  var al = $('adultsLbl'); if (al) al.textContent = t('adults');
  var an = $('adultsNote'); if (an) an.textContent = t('adultsNote');

  var ct = $('catTitle'); if (ct) ct.textContent = t('catTitle');
  var ab = $('actBtn');
  if (ab && S.phase !== 'moving') {
    ab.textContent = RITUAL === 'wheel' ? t('wheelSpin') : t('lotusBloom');
  }
  var hint = $('hintLine');
  if (hint && S.phase !== 'moving') {
    hint.textContent = S.aud === 'kids' ? t('hintKids') : t('hintIdle');
  }
  var lp = $('labP'); if (lp) lp.textContent = t('labP');
  var lt = $('labT'); if (lt) lt.textContent = t('labT');
  var rtT = $('resTitle'); if (rtT) rtT.textContent = t('resTitle');
  var accB = $('acceptBtn');
  if (accB) accB.textContent = S.accepted ? t('accepted') : t('accept');
  var agB = $('againBtn'); if (agB) agB.textContent = t('again');
  var liB = $('listBtn'); if (liB) liB.textContent = S.listOpen ? t('hideList') : t('list');

  var nl = $('nameLabel'); if (nl) nl.textContent = t('nameLabel');
  var ni = $('nameInput'); if (ni) ni.placeholder = t('namePh');
  var no = $('nameNote'); if (no) no.textContent = t('nameOptional');

  var lbt = $('lbTitle'); if (lbt) lbt.textContent = t('lbTitle');
  var lbc = $('lbClearBtn'); if (lbc) lbc.textContent = t('lbClear');
  var rlt = $('resLbTitle'); if (rlt) rlt.textContent = t('lbTitle');
  var rlc = $('resLbClearBtn'); if (rlc) rlc.textContent = t('lbClear');
  var ft = $('footTxt'); if (ft) ft.textContent = t('foot');

  if (S.aud) {
    renderChips();
    paintMeta();
    buildRitual();
    renderFullList();
    renderTodayList();
    paintStreak();
    /* Re-label the open vow in the new language without re-running the ritual. */
    if (S.current) {
      var cat = CATS[S.current[0] - 1];
      var L = S.lang === 'hi' ? 4 : 1;
      var rc = $('rCat');
      if (rc) rc.textContent = cat[1] + '  ' + t('catLbl') + ' · ' +
        (S.lang === 'hi' ? cat[3] : cat[2]) + ' · ' + cat[4];
      var rn = $('rName'); if (rn) rn.textContent = S.current[L];
      var rp = $('rP'); if (rp) rp.textContent = S.current[L + 1];
      var rq = $('rT'); if (rq) rq.textContent = S.current[L + 2];
      $('resultCard').classList.remove('is-hidden');
    }
    if (!$('lbPanel').classList.contains('is-hidden')) renderLbInto('lbBody');
    if (!$('resLbPanel').classList.contains('is-hidden')) renderLbInto('resLbBody');
  }
}

function paintSound() {
  var b = $('sndBtn');
  if (!b) return;
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
  applyText();            // text only — the vow, streak and list state survive
}

function chooseAud(aud) {
  S.aud = aud;
  S.cat = 'any';
  S.phase = 'idle';
  S.current = null;
  S.accepted = false;
  writePrefs({ aud: aud });
  var v = readVows();
  S.streakDays = v.streak || 0;
  S.vowsToday = (v.days[dayKey()] || []).length;
  computePool();
  hideResult();
  setScreen('main');
  applyText();
  var lp = $('listPanel');
  if (lp) { lp.classList.add('is-hidden'); S.listOpen = false; }
  bell(0.045);
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

var langBtn = $('langBtn');
if (langBtn) langBtn.addEventListener('click', function () {
  ac();
  setLang(S.lang === 'hi' ? 'en' : 'hi');
  sfx.tap();
});

var sndBtn = $('sndBtn');
if (sndBtn) sndBtn.addEventListener('click', function () {
  S.sound = !S.sound;
  writePrefs({ sound: S.sound });
  paintSound();
  if (S.sound) { ac(); sfx.tap(); }
});

var hubBtn = $('hubBtn');
if (hubBtn) hubBtn.addEventListener('click', function () {
  sfx.tap();
  try {
    if (window.parent && window.parent !== window && window.parent.location) {
      window.parent.location.hash = '#/kids';
      return;
    }
  } catch (e) { /* cross-origin: fall through to the file hub */ }
  window.location.href = 'index.html';
});

var restartBtn = $('restartBtn');
if (restartBtn) restartBtn.addEventListener('click', function () {
  sfx.tap();
  S.aud = null; S.cat = 'any'; S.phase = 'idle'; S.current = null; S.accepted = false;
  hideResult();
  setScreen('lang');
});

var actBtn = $('actBtn');
if (actBtn) actBtn.addEventListener('click', function () { ac(); beginRitual(); });

var ritualStage = RITUAL === 'wheel' ? $('wheelSvg') : $('lotusSvg');
if (ritualStage) ritualStage.addEventListener('click', function () {
  if (S.phase !== 'moving') { ac(); beginRitual(); }
});

var acceptBtn = $('acceptBtn');
if (acceptBtn) acceptBtn.addEventListener('click', acceptVow);

var againBtn = $('againBtn');
if (againBtn) againBtn.addEventListener('click', function () { ac(); beginRitual(); });

var listBtn = $('listBtn');
if (listBtn) listBtn.addEventListener('click', function () {
  var p = $('listPanel');
  if (!p) return;
  S.listOpen = p.classList.toggle('is-hidden') ? false : true;
  listBtn.textContent = S.listOpen ? t('hideList') : t('list');
  if (S.listOpen) renderFullList();
  sfx.tap();
});

var nameInput = $('nameInput');
if (nameInput) nameInput.addEventListener('input', function () {
  S.name = sanitizeName(nameInput.value);
  writePrefs({ name: S.name });
});

[['lbBtn', 'lbPanel'], ['resLbBtn', 'resLbPanel']].forEach(function (pair) {
  var b = $(pair[0]), p = $(pair[1]);
  if (!b || !p) return;
  b.addEventListener('click', function () {
    p.classList.toggle('is-hidden');
    if (!p.classList.contains('is-hidden')) renderLbInto(p.id === 'lbPanel' ? 'lbBody' : 'resLbBody');
    sfx.tap();
  });
});
[['lbClearBtn'], ['resLbClearBtn']].forEach(function (pair) {
  var b = $(pair[0]);
  if (b) b.addEventListener('click', clearLb);
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

function boot() {
  var prefs = readPrefs();
  S.lang = (prefs.lang === 'en') ? 'en' : 'hi';
  S.sound = prefs.sound !== false;
  S.name = prefs.name || '';
  if (nameInput) nameInput.value = S.name;

  var q = parseQuery();
  if (q.lang === 'en' || q.lang === 'hi') S.lang = q.lang;
  if (q.embed === '1' && hubBtn) hubBtn.classList.add('is-hidden');

  writePrefs({ lang: S.lang, sound: S.sound, lastGame: GAME_ID });
  applyText();

  /* ?lang=&aud= skip both gates; the header pill still switches live. */
  if (q.lang && (q.aud === 'kids' || q.aud === 'adults')) chooseAud(q.aud);
  else if (q.lang) setScreen('aud');
  else setScreen('lang');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

