/* ============================================================
   STATE
   ============================================================ */
var S = {
  lang: 'hi', sound: true, name: '', screen: 'lang',
  mode: 'order', count: 8, diff: 'hard',
  tiles: [],          // [{th, no}] in canonical order for the chosen subset
  order: [],          // current arrangement: order[pos] = index into tiles
  buckets: [],        // bucket mode: [{key,label,hex,items:[tileIdx]}]
  placed: {},         // bucket mode: tileIdx -> bucketKey
  slots: [],          // emblem mode: slots[pos] = tileIdx
  sel: -1, moves: 0, hints: HINTS_MAX, hintsUsed: 0,
  startedAt: 0, clockId: null, elapsed: 0, bonus: 0,
  lastRank: 0, lock: false
};

function setScreen(name) {
  S.screen = name;
  ['scrLang', 'scrSetup', 'scrPlay', 'scrResult'].forEach(function (id) {
    $(id).classList.toggle('is-hidden',
      id !== 'scr' + name.charAt(0).toUpperCase() + name.slice(1));
  });
  $('restartBtn').classList.toggle('is-hidden', name !== 'play' && name !== 'result');
  window.scrollTo(0, 0);
}

/* ============================================================
   ROUND SET-UP
   ============================================================ */
function bucketDefs() {
  return (S.mode === 'varna') ? VARNA_BUCKETS : MOKSHA_BUCKETS;
}
function isBucketMode() { return S.mode === 'varna' || S.mode === 'moksha'; }

/** Pick `count` Tirthankaras. Bucket modes draw a balanced subset so that
 *  every bucket present in the data can actually appear in the round. */
function pickSubset(n) {
  if (!isBucketMode()) {
    return shuffle(TIRTH.slice()).slice(0, n).sort(function (a, b) { return a.no - b.no; });
  }
  var key = (S.mode === 'varna') ? 'varnaKey' : 'mokshaKey';
  var groups = {};
  TIRTH.forEach(function (th) {
    var k = th[key];
    if (!groups[k]) groups[k] = [];
    groups[k].push(th);
  });
  var keys = Object.keys(groups).filter(function (k) { return groups[k].length; });
  shuffle(keys);
  var out = [];
  /* round-robin across buckets, capped, until we reach n */
  var i = 0;
  while (out.length < n && i < 400) {
    var k = keys[i % keys.length];
    var bucket = groups[k];
    var take = Math.floor(i / keys.length);
    if (take < Math.min(BUCKET_CAP, bucket.length)) {
      var cand = bucket[take];
      if (out.indexOf(cand) < 0) out.push(cand);
    }
    i++;
  }
  if (out.length < n) {
    shuffle(TIRTH.slice()).forEach(function (th) {
      if (out.length < n && out.indexOf(th) < 0) out.push(th);
    });
  }
  return out.sort(function (a, b) { return a.no - b.no; });
}

function startRound() {
  var nm = sanitizeName($('nameInput').value);
  if (!nm) { toast(t('nameNeeded')); $('nameInput').focus(); return; }
  if (S.mode === 'moksha' && S.count < 8) { toast(t('modeNeeds8')); return; }
  S.name = nm;
  writePrefs({ name: nm, lastGame: GAME_ID });

  S.tiles = pickSubset(S.count);
  S.moves = 0; S.hints = HINTS_MAX; S.hintsUsed = 0; S.bonus = 0;
  S.sel = -1; S.lock = false;
  S.startedAt = 0; S.elapsed = 0;
  stopClock();

  if (isBucketMode()) {
    var defs = bucketDefs();
    var key = (S.mode === 'varna') ? 'varnaKey' : 'mokshaKey';
    var present = {};
    S.tiles.forEach(function (th) { present[th[key]] = true; });
    S.buckets = defs.filter(function (b) { return present[b.key]; })
                    .map(function (b) { return { key: b.key, hex: b.hex || null, items: [] }; });
    S.placed = {};
    S.order = [];
    S.slots = [];
  } else if (S.mode === 'chinh') {
    S.slots = S.tiles.map(function () { return -1; });
    S.order = shuffle(S.tiles.map(function (_, i) { return i; }));
    S.buckets = [];
  } else {
    S.order = shuffle(S.tiles.map(function (_, i) { return i; }));
    S.slots = [];
    S.buckets = [];
  }

  setScreen('play');
  buildPlayField();
  paintHud();
  bell(0.05);
}

/* ============================================================
   PLAY FIELD · rail (emblem mode) + tiles + buckets
   ============================================================ */
function L(obj, hi, en) { return S.lang === 'hi' ? obj[hi] : obj[en]; }

function bucketLabel(key) {
  if (S.mode === 'varna') {
    var th = TIRTH.filter(function (x) { return x.varnaKey === key; })[0];
    return th ? L(th, 'varnaHi', 'varnaEn') : key;
  }
  var m = TIRTH.filter(function (x) { return x.mokshaKey === key; })[0];
  return m ? L(m, 'mokshaHi', 'mokshaEn') : key;
}

function buildPlayField() {
  var rail = $('rail'), board = $('board'), buck = $('buckets');
  rail.innerHTML = ''; board.innerHTML = ''; buck.innerHTML = '';

  rail.classList.toggle('is-hidden', S.mode !== 'chinh');
  buck.classList.toggle('is-hidden', !isBucketMode());
  board.classList.toggle('is-hidden', isBucketMode() === false ? false : false);

  /* Emblem mode: a fixed, numbered name rail the emblems drop into. */
  if (S.mode === 'chinh') {
    S.tiles.forEach(function (th, i) {
      var slot = document.createElement('div');
      slot.className = 'g-slot';
      slot.dataset.slot = String(i);
      var num = document.createElement('span');
      num.className = 'g-slot-num';
      num.textContent = S.lang === 'hi' ? devNum(th.no) : String(th.no);
      var nm = document.createElement('span');
      nm.className = 'g-slot-name';
      nm.textContent = L(th, 'hi', 'en');
      slot.appendChild(num);
      slot.appendChild(nm);
      addDropTarget(slot, 'slot', i);
      rail.appendChild(slot);
    });
  }

  /* Buckets for varna / moksha modes. */
  if (isBucketMode()) {
    S.buckets.forEach(function (b) {
      var box = document.createElement('div');
      box.className = 'g-bucket';
      box.dataset.bucket = b.key;
      var head = document.createElement('div');
      head.className = 'g-bucket-head';
      if (b.hex) {
        var sw = document.createElement('span');
        sw.className = 'g-swatch';
        sw.style.background = b.hex;
        head.appendChild(sw);
      }
      var lbl = document.createElement('span');
      lbl.className = 'g-bucket-name';
      lbl.textContent = bucketLabel(b.key);
      head.appendChild(lbl);
      var list = document.createElement('div');
      list.className = 'g-bucket-list';
      box.appendChild(head);
      box.appendChild(list);
      box.addEventListener('click', function () {
        if (S.sel >= 0) placeInBucket(S.sel, b.key);
      });
      addDropTarget(box, 'bucket', b.key);
      buck.appendChild(box);
    });
  }

  renderTiles();
  paintHintLine();
}

/** Tiles live in #board (the tray) for every mode; in bucket mode the tray
 *  holds only the tiles not yet placed, and the buckets show the placed ones. */
function renderTiles() {
  var board = $('board');
  board.innerHTML = '';

  if (isBucketMode()) {
    S.tiles.forEach(function (th, i) {
      if (S.placed[i] !== undefined) return;
      board.appendChild(makeTile(i));
    });
    if (!board.childNodes.length) {
      var empty = document.createElement('p');
      empty.className = 'g-hint';
      empty.style.textAlign = 'center';
      empty.textContent = t('playHintBucket');
      board.appendChild(empty);
    }
    /* repaint the buckets */
    S.buckets.forEach(function (b) {
      var box = document.querySelector('.g-bucket[data-bucket="' + b.key + '"]');
      if (!box) return;
      var list = box.querySelector('.g-bucket-list');
      list.innerHTML = '';
      S.tiles.forEach(function (th, i) {
        if (S.placed[i] !== b.key) return;
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'g-chipin';
        chip.dataset.tile = String(i);
        chip.setAttribute('aria-label', L(th, 'hi', 'en'));
        var art = document.createElement('span');
        art.className = 'g-art';
        art.innerHTML = artEmblem(th.chinhSvg);
        var nm = document.createElement('span');
        nm.textContent = L(th, 'hi', 'en');
        chip.appendChild(art);
        chip.appendChild(nm);
        chip.addEventListener('click', function () { unplace(i); });
        list.appendChild(chip);
      });
    });
    paintBuckets();
    return;
  }

  S.order.forEach(function (tileIdx, pos) {
    var el = makeTile(tileIdx);
    el.dataset.pos = String(pos);
    board.appendChild(el);
  });
  validateAll();
}

function makeTile(tileIdx) {
  var th = S.tiles[tileIdx];
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'g-tile' + (S.sel === tileIdx ? ' is-selected' : '');
  b.dataset.tile = String(tileIdx);
  b.setAttribute('aria-label', L(th, 'hi', 'en'));

  var num = document.createElement('span');
  num.className = 'g-tnum';
  /* Position numbers only shown in Easy mode (hard mode = no hints) */
  num.textContent = (S.mode === 'order' && S.diff === 'easy')
    ? (S.lang === 'hi' ? devNum(th.no) : String(th.no)) : '';
  b.appendChild(num);

  if (S.mode === 'chinh') {
    var art = document.createElement('span');
    art.className = 'g-art';
    art.innerHTML = artEmblem(th.chinhSvg);
    b.appendChild(art);
    var cap = document.createElement('span');
    cap.className = 'g-tname';
    cap.textContent = L(th, 'chinhHi', 'chinhEn');
    b.appendChild(cap);
  } else {
    var nm = document.createElement('span');
    nm.className = 'g-tname';
    nm.textContent = L(th, 'hi', 'en');
    b.appendChild(nm);
  }

  b.addEventListener('click', function () { tapTile(tileIdx); });
  addDragSource(b, tileIdx);
  return b;
}


/* ============================================================
   INTERACTION · tap-swap, HTML5 drag-and-drop and keyboard
   ============================================================ */
function startClock() {
  if (S.startedAt) return;
  S.startedAt = Date.now();
  stopClock();
  S.clockId = setInterval(function () {
    S.elapsed = Math.floor((Date.now() - S.startedAt) / 1000) + S.bonus;
    $('hudTime').textContent = fmtTime(S.elapsed);
  }, 500);
}
function stopClock() { if (S.clockId) { clearInterval(S.clockId); S.clockId = null; } }

function tapTile(tileIdx) {
  startClock();
  sfx.tap();

  if (isBucketMode()) {
    if (S.sel === tileIdx) { S.sel = -1; renderTiles(); return; }
    S.sel = tileIdx;
    renderTiles();
    say(t('selected', { name: L(S.tiles[tileIdx], 'hi', 'en') }));
    return;
  }

  if (S.mode === 'chinh') {
    if (S.sel === tileIdx) { S.sel = -1; repaintSel(); return; }
    S.sel = tileIdx;
    repaintSel();
    say(t('selected', { name: L(S.tiles[tileIdx], 'chinhHi', 'chinhEn') }));
    return;
  }

  /* order mode: tap one tile then another to swap their positions */
  if (S.sel < 0) { S.sel = tileIdx; repaintSel(); return; }
  if (S.sel === tileIdx) { S.sel = -1; repaintSel(); return; }
  var p1 = S.order.indexOf(S.sel);
  var p2 = S.order.indexOf(tileIdx);
  S.sel = -1;
  swapPositions(p1, p2);
}

function repaintSel() {
  var all = document.querySelectorAll('.g-tile');
  for (var i = 0; i < all.length; i++) {
    all[i].classList.toggle('is-selected', +all[i].dataset.tile === S.sel);
  }
}

function swapPositions(p1, p2) {
  if (p1 < 0 || p2 < 0 || p1 === p2) return;
  var tmp = S.order[p1];
  S.order[p1] = S.order[p2];
  S.order[p2] = tmp;
  S.moves++;
  var moved = S.tiles[S.order[p2]];
  renderTiles();
  paintHud();
  sfx.flip();
  say(t('swapped', { name: L(moved, 'hi', 'en') }));
}

/** Emblem mode: put the chosen emblem tile into a rail slot. */
function placeInSlot(tileIdx, slotPos) {
  startClock();
  var current = S.slots[slotPos];
  var from = S.slots.indexOf(tileIdx);
  S.slots[slotPos] = tileIdx;
  if (from >= 0 && from !== slotPos) S.slots[from] = current;
  if (current >= 0 && current !== tileIdx && from < 0) {
    var empty = S.slots.indexOf(-1);
    if (empty >= 0) S.slots[empty] = current;
  }
  S.sel = -1;
  S.moves++;
  renderTiles();
  paintSlots();
  paintHud();
  sfx.flip();
}

/** Bucket modes: assign a tile to a group. */
function placeInBucket(tileIdx, bucketKey) {
  startClock();
  S.placed[tileIdx] = bucketKey;
  S.sel = -1;
  S.moves++;
  renderTiles();
  paintHud();
  sfx.flip();
  var th = S.tiles[tileIdx];
  say(t('placedIn', { name: L(th, 'hi', 'en'), bucket: bucketLabel(bucketKey) }));
}

function unplace(tileIdx) {
  delete S.placed[tileIdx];
  S.sel = -1;
  renderTiles();
  paintHud();
  sfx.tap();
}


/* ---------- drag and drop (mouse + touch), tap as the accessible fallback ---------- */
var dragSrc = null;

function addDragSource(el, tileIdx) {
  el.setAttribute('draggable', 'true');
  el.addEventListener('dragstart', function (e) {
    dragSrc = tileIdx;
    el.classList.add('is-dragging');
    try { e.dataTransfer.setData('text/plain', String(tileIdx)); } catch (err) { /* ignore */ }
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', function () {
    el.classList.remove('is-dragging');
    clearDropMarks();
    dragSrc = null;
  });
}

function addDropTarget(el, kind, key) {
  el.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    el.classList.add('is-drop');
  });
  el.addEventListener('dragleave', function () { el.classList.remove('is-drop'); });
  el.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('is-drop');
    var idx = dragSrc;
    if (idx === null || idx === undefined) {
      idx = parseInt((e.dataTransfer && e.dataTransfer.getData('text/plain')) || '', 10);
    }
    if (isNaN(idx)) return;
    if (kind === 'slot') placeInSlot(idx, +key);
    else if (kind === 'bucket') placeInBucket(idx, key);
    dragSrc = null;
  });
}

function clearDropMarks() {
  var m = document.querySelectorAll('.is-drop');
  for (var i = 0; i < m.length; i++) m[i].classList.remove('is-drop');
}

/* tile-to-tile drop in order mode, delegated so re-renders stay cheap */
document.addEventListener('dragover', function (e) {
  if (S.screen !== 'play' || S.mode !== 'order') return;
  var tl = e.target && e.target.closest ? e.target.closest('.g-tile') : null;
  if (tl) { e.preventDefault(); tl.classList.add('is-drop'); }
});
document.addEventListener('drop', function (e) {
  if (S.screen !== 'play' || S.mode !== 'order') return;
  var tl = e.target && e.target.closest ? e.target.closest('.g-tile') : null;
  if (!tl || dragSrc === null) return;
  e.preventDefault();
  tl.classList.remove('is-drop');
  swapPositions(S.order.indexOf(dragSrc), S.order.indexOf(+tl.dataset.tile));
  dragSrc = null;
});

/* ---------- keyboard ---------- */
function tileEls() {
  return Array.prototype.slice.call(document.querySelectorAll('#board .g-tile'));
}
document.addEventListener('keydown', function (e) {
  if (S.screen !== 'play') return;
  var els = tileEls();
  if (!els.length) return;
  var cur = els.indexOf(document.activeElement);
  var nav = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
  if (nav.indexOf(e.key) >= 0) {
    e.preventDefault();
    if (cur < 0) { els[0].focus(); return; }
    var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    els[(cur + d + els.length) % els.length].focus();
  } else if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    useHint();
  }
});


/* ============================================================
   VALIDATION · colour each tile / slot once the first move lands
   ============================================================ */
function correctCount() {
  if (S.mode === 'order') {
    var n = 0;
    S.order.forEach(function (ti, pos) { if (pos === ti) n++; });
    return n;
  }
  if (S.mode === 'chinh') {
    var c = 0;
    S.slots.forEach(function (ti, pos) { if (ti >= 0 && ti === pos) c++; });
    return c;
  }
  var key = (S.mode === 'varna') ? 'varnaKey' : 'mokshaKey';
  var k = 0;
  S.tiles.forEach(function (th, i) {
    if (S.placed[i] !== undefined && S.placed[i] === th[key]) k++;
  });
  return k;
}

function isComplete() {
  if (isBucketMode()) return correctCount() === S.tiles.length;
  if (S.mode === 'chinh') return S.slots.every(function (ti, pos) { return ti === pos; });
  return S.order.every(function (ti, pos) { return ti === pos; });
}

function validateAll() {
  if (S.moves < 1) return;
  if (S.mode === 'order') {
    var els = document.querySelectorAll('#board .g-tile');
    for (var i = 0; i < els.length; i++) {
      var ti = +els[i].dataset.tile;
      var pos = +els[i].dataset.pos;
      els[i].classList.remove('is-correct', 'is-wrong');
      els[i].classList.add(pos === ti ? 'is-correct' : 'is-wrong');
      /* once a tile settles it is locked, so the board cannot thrash */
      els[i].classList.toggle('is-done', pos === ti);
    }
  } else if (S.mode === 'chinh') {
    paintSlots();
  } else {
    paintBuckets();
  }
  /* Auto-finish: if every tile is correctly placed, transition after a brief beat */
  if (isComplete() && !S.lock) {
    S.lock = true;
    setTimeout(function () { finishRound(); }, reduced() ? 100 : 650);
  }
}

function paintSlots() {
  var slots = document.querySelectorAll('.g-slot');
  for (var i = 0; i < slots.length; i++) {
    var ti = S.slots[i];
    slots[i].classList.remove('is-correct', 'is-wrong');
    if (ti >= 0 && S.moves >= 1) slots[i].classList.add(ti === i ? 'is-correct' : 'is-wrong');
  }
  var tiles = document.querySelectorAll('#board .g-tile');
  for (var j = 0; j < tiles.length; j++) {
    var idx = +tiles[j].dataset.tile;
    tiles[j].classList.toggle('is-done', S.slots.indexOf(idx) >= 0);
    tiles[j].classList.remove('is-correct', 'is-wrong');
  }
}

function paintBuckets() {
  var key = (S.mode === 'varna') ? 'varnaKey' : 'mokshaKey';
  var chips = document.querySelectorAll('.g-chipin');
  for (var i = 0; i < chips.length; i++) {
    var idx = +chips[i].dataset.tile;
    var th = S.tiles[idx];
    if (!th) continue;
    chips[i].classList.remove('is-correct', 'is-wrong');
    chips[i].classList.add(S.placed[idx] === th[key] ? 'is-correct' : 'is-wrong');
  }
}

/* ============================================================
   HUD + HINTS
   ============================================================ */
function paintHud() {
  var hi = (S.lang === 'hi');
  var done = correctCount();
  var total = S.tiles.length;
  $('hudPlaced').textContent = hi ? devNum(done) + '/' + devNum(total) : done + '/' + total;
  $('hudMoves').textContent = hi ? devNum(S.moves) : String(S.moves);
  $('hudTime').textContent = fmtTime(S.elapsed);
  $('hudHints').textContent = hi ? devNum(S.hints) : String(S.hints);
  $('progFill').style.transform = 'scaleX(' + (total ? (done / total) : 0).toFixed(4) + ')';
  var hb = $('hintBtn');
  if (hb) hb.disabled = S.hints <= 0;
}

function useHint() {
  if (S.hints <= 0) { toast(t('hintNone')); return; }
  startClock();
  S.hints--;
  S.hintsUsed++;
  S.bonus += HINT_PENALTY;
  S.elapsed += HINT_PENALTY;

  /* glow one tile that is still out of place — it teaches, never gives it away */
  var target = -1;
  for (var i = 0; i < S.tiles.length; i++) {
    var pos = (S.mode === 'order') ? S.order.indexOf(i) : i;
    if (!tileIsCorrectAt(i, pos)) { target = i; break; }
  }
  if (target >= 0) {
    var el = document.querySelector('#board .g-tile[data-tile="' + target + '"]');
    if (el) {
      el.classList.add('is-hint');
      setTimeout(function () { el.classList.remove('is-hint'); }, reduced() ? 200 : 1600);
    }
  }
  paintHud();
  toast(t('hintUsed', {
    n: (S.lang === 'hi' ? devNum(S.hints) : S.hints),
    s: (S.lang === 'hi' ? devNum(HINT_PENALTY) : HINT_PENALTY)
  }));
  sfx.tap();
}

function tileIsCorrectAt(tileIdx, pos) {
  if (S.mode === 'order') return pos === tileIdx;
  if (S.mode === 'chinh') return S.slots[tileIdx] === tileIdx;
  var key = (S.mode === 'varna') ? 'varnaKey' : 'mokshaKey';
  return S.placed[tileIdx] === S.tiles[tileIdx][key];
}

function paintHintLine() {
  var h = $('playHint');
  if (!h) return;
  h.textContent = S.mode === 'order' ? t('playHintOrder')
    : S.mode === 'chinh' ? t('playHintChinh')
    : t('playHintBucket');
}


/* ============================================================
   FINISH · only reachable once every tile is correctly placed
   ============================================================ */
function tryFinish() {
  if (!isComplete()) {
    toast(t('incomplete'));
    sfx.miss();
    var els = document.querySelectorAll('#board .g-tile.is-wrong');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        el.classList.add('is-shake');
        setTimeout(function () { el.classList.remove('is-shake'); }, reduced() ? 60 : 460);
      })(els[i]);
    }
    return;
  }
  finishRound();
}

function levelKey() { return S.mode + '-' + S.count; }
function levelLabel() {
  var m = t('mode')[S.mode][0];
  var n = (S.lang === 'hi') ? devNum(S.count) : String(S.count);
  return m + ' · ' + n;
}

function tierOf() {
  var ideal = S.count;
  var ratio = S.moves ? (ideal / S.moves) : 0;
  if (ratio >= 0.85 && S.hintsUsed === 0) return 3;
  if (ratio >= 0.6) return 2;
  if (ratio >= 0.35) return 1;
  return 0;
}

function finishRound() {
  stopClock();
  S.elapsed = S.startedAt
    ? Math.floor((Date.now() - S.startedAt) / 1000) + S.bonus
    : S.bonus;
  S.lock = true;

  var entry = {
    name: S.name,
    level: levelLabel(),
    levelKey: levelKey(),
    duration: S.elapsed,
    score: Math.max(0, Math.round(1000 * (S.count / Math.max(1, S.moves)))),
    meta: { moves: S.moves, tiles: S.count, hints: S.hintsUsed, mode: S.mode },
    ts: Date.now()
  };
  var res = lbSave(entry);
  S.lastRank = res.saved ? res.rank : 0;

  setScreen('result');
  paintResultText();
  renderReview();
  petals(26);
  sfx.finish();
  toast(res.saved ? t('saved', { time: fmtClock(S.elapsed) }) : t('storageOff'));
}

function paintResultText() {
  var tier = tierOf();
  $('medalMark').innerHTML = artMedal();
  $('resTitle').textContent = t('resTitle')[tier];
  $('resSub').textContent = t('resSub')[tier];
  $('stTime').textContent = fmtClock(S.elapsed);
  $('stMoves').textContent = (S.lang === 'hi') ? devNum(S.moves) : String(S.moves);
  $('stHints').textContent = (S.lang === 'hi') ? devNum(S.hintsUsed) : String(S.hintsUsed);
  $('stTiles').textContent = (S.lang === 'hi') ? devNum(S.count) : String(S.count);
  $('cheerLine').textContent = pick(t('cheers'));
  var rk = $('resRank');
  if (S.lastRank) {
    rk.textContent = t('rankLine', { n: (S.lang === 'hi' ? devNum(S.lastRank) : S.lastRank) });
    rk.classList.remove('is-hidden');
  } else {
    rk.classList.add('is-hidden');
  }
  $('resLbPanel').classList.remove('is-hidden');
  renderLbInto('resLbBody');
}

/* ============================================================
   REVIEW · the full 24-row reference table + tradition notes
   ============================================================ */
function renderReview() {
  var head = $('reviewHead');
  head.innerHTML = '';
  [t('thNo'), t('thName'), t('thChinh'), t('thVarna'), t('thAasan'),
   t('thMoksha'), t('thJanma')].forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });

  var body = $('reviewBody');
  body.innerHTML = '';
  var played = {};
  S.tiles.forEach(function (th) { played[th.no] = true; });

  TIRTH.forEach(function (th) {
    var tr = document.createElement('tr');
    if (!played[th.no]) tr.style.opacity = '.55';
    var cells = [
      (S.lang === 'hi' ? devNum(th.no) : String(th.no)),
      L(th, 'hi', 'en') + (L(th, 'aliasHi', 'aliasEn') ? ' (' + L(th, 'aliasHi', 'aliasEn') + ')' : ''),
      L(th, 'chinhHi', 'chinhEn'),
      L(th, 'varnaHi', 'varnaEn'),
      AASAN[th.aasanKey][S.lang],
      L(th, 'mokshaHi', 'mokshaEn'),
      L(th, 'janmaHi', 'janmaEn')
    ];
    cells.forEach(function (v, ci) {
      var td = document.createElement('td');
      if (ci === 0) td.className = 'g-num';
      td.textContent = v;              // textContent only — never innerHTML
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  var notes = $('tradNotes');
  notes.innerHTML = '';
  var h = document.createElement('p');
  h.className = 'g-note';
  h.textContent = t('tradTitle') + ': ';
  var first = true;
  TIRTH.forEach(function (th) {
    var n = L(th, 'noteHi', 'noteEn');
    if (!n) return;
    if (!first) h.appendChild(document.createTextNode('  ·  '));
    h.appendChild(document.createTextNode(
      (S.lang === 'hi' ? devNum(th.no) : th.no) + '. ' + L(th, 'hi', 'en') + ' — ' + n));
    first = false;
  });
  notes.appendChild(h);
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
  [t('thRank'), t('thLbName'), t('thLbLevel'), t('thLbTime'), t('thLbMoves')].forEach(function (h) {
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
      fmtClock(e.duration),
      (S.lang === 'hi' ? devNum((e.meta && e.meta.moves) || 0) : String((e.meta && e.meta.moves) || 0))
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
function buildModeChips() {
  var host = $('modeChips');
  host.innerHTML = '';
  MODES.forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.mode === m ? ' is-on' : '');
    b.textContent = t('mode')[m][0];
    b.title = t('mode')[m][1];
    b.setAttribute('aria-pressed', S.mode === m ? 'true' : 'false');
    b.addEventListener('click', function () {
      S.mode = m;
      /* the nirvana round needs enough tiles for every place to appear */
      if (m === 'moksha' && S.count < 8) S.count = 8;
      buildModeChips();
      buildCountChips();
      sfx.tap();
    });
    host.appendChild(b);
  });
}

function buildCountChips() {
  var host = $('countChips');
  host.innerHTML = '';
  COUNTS.forEach(function (n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.count === n ? ' is-on' : '');
    b.textContent = (S.lang === 'hi') ? devNum(n) : String(n);
    b.setAttribute('aria-pressed', S.count === n ? 'true' : 'false');
    if (S.mode === 'moksha' && n < 8) b.disabled = true;
    b.addEventListener('click', function () {
      if (S.mode === 'moksha' && n < 8) { toast(t('modeNeeds8')); return; }
      S.count = n;
      buildCountChips();
      sfx.tap();
    });
    host.appendChild(b);
  });
}

function buildDiffChips() {
  var host = $('diffChips');
  if (!host) return;
  host.innerHTML = '';
  ['hard', 'easy'].forEach(function (d) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-chip' + (S.diff === d ? ' is-on' : '');
    b.textContent = t('diff')[d][0];
    b.title = t('diff')[d][1];
    b.setAttribute('aria-pressed', S.diff === d ? 'true' : 'false');
    b.addEventListener('click', function () {
      S.diff = d;
      buildDiffChips();
      sfx.tap();
    });
    host.appendChild(b);
  });
}


/* ============================================================
   RENDER · a pure function of state, so switching language
   mid-round never loses the arrangement, the clock or the hints
   ============================================================ */
function applyText() {
  document.documentElement.lang = (S.lang === 'hi') ? 'hi' : 'en';
  document.title = (S.lang === 'hi'
    ? 'तीर्थंकर क्रम · Tirthankar Sorting'
    : 'Tirthankar Sorting · तीर्थंकर क्रम');

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

  $('s3Title').textContent = t('s3Title');
  $('s3Sub').textContent = t('s3Sub');
  $('nameLabel').textContent = t('nameLabel');
  $('nameInput').placeholder = t('namePh');
  $('modeLabel').textContent = t('modeLabel');
  $('diffLabel').textContent = t('diffLabel');
  $('countLabel').textContent = t('countLabel');
  $('setupHint').textContent = t('setupHint');
  $('startBtn').textContent = t('start');
  $('lbBtn').textContent = t('leaderboard');
  $('lbTitle').textContent = t('lbTitle');
  $('lbClearBtn').textContent = t('lbClear');

  $('hudPlacedLbl').textContent = t('hudPlaced');
  $('hudMovesLbl').textContent = t('hudMoves');
  $('hudTimeLbl').textContent = t('hudTime');
  $('hudHintsLbl').textContent = t('hudHints');
  $('hintBtn').textContent = t('hint');
  $('quitBtn').textContent = t('quit');

  $('stTimeLbl').textContent = t('statTime');
  $('stMovesLbl').textContent = t('statMoves');
  $('stHintsLbl').textContent = t('statHints');
  $('stTilesLbl').textContent = t('statTiles');
  $('againBtn').textContent = t('again');
  $('changeBtn').textContent = t('changeSetup');
  $('resLbBtn').textContent = t('showLb');
  $('resLbTitle').textContent = t('lbTitle');
  $('resLbClearBtn').textContent = t('lbClear');
  $('reviewTitle').textContent = t('reviewTitle');
  $('footTxt').textContent = t('foot');

  buildModeChips();
  buildDiffChips();
  buildCountChips();
  if (!$('lbPanel').classList.contains('is-hidden')) renderLbInto('lbBody');
  if (!$('resLbPanel').classList.contains('is-hidden')) renderLbInto('resLbBody');
  if (S.screen === 'play') { buildPlayField(); paintHud(); }
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
  applyText();          // text only — the arrangement and clock survive
}

document.querySelectorAll('[data-lang]').forEach(function (b) {
  b.addEventListener('click', function () {
    ac();
    setLang(b.dataset.lang);
    sfx.tap();
    setScreen('setup');
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
  setScreen('setup');
});

$('startBtn').addEventListener('click', function () { ac(); startRound(); });
$('nameInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); startRound(); }
});
$('hintBtn').addEventListener('click', useHint);
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

  var q = parseQuery();
  if (q.lang === 'en' || q.lang === 'hi') S.lang = q.lang;
  if (q.mode && MODES.indexOf(q.mode) >= 0) S.mode = q.mode;
  var qn = parseInt(q.n, 10);
  if (COUNTS.indexOf(qn) >= 0) S.count = qn;
  if (S.mode === 'moksha' && S.count < 8) S.count = 8;
  if (q.embed === '1') $('hubBtn').classList.add('is-hidden');

  if (S.name) $('nameInput').value = S.name;
  writePrefs({ lang: S.lang, sound: S.sound, lastGame: GAME_ID });

  applyText();
  setScreen(q.lang ? 'setup' : 'lang');
  if (!storageOk()) setTimeout(function () { toast(t('storageOff')); }, 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

