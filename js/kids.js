/**
 * JinBhakt Bot — Kids Learning (बाल शिक्षा)
 *
 * Owns the catalogue of the six offline learning games, the bilingual copy
 * for the #/kids hub, and the single shared leaderboard every game writes
 * to.  No DOM access: pure data + storage helpers, so the module is
 * unit-testable under plain Node as well as inside jsdom.
 *
 * Storage contract (must stay byte-identical to the one baked into each
 * games/*.html file — tools/check-games.js enforces it):
 *   jinbhakt:kids:prefs:v1        {lang,aud,sound,name,lastGame}
 *   jinbhakt:kids:leaderboard:v1  { "<gameId>": [Entry, ...] }
 *   jinbhakt:kids:vows:v1         {last,streak,days:{}}   (vow games only)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JinBhaktKids = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------
   * Storage keys — exported so every game uses the same literal
   * ------------------------------------------------------- */
  var KEYS = {
    prefs:       'jinbhakt:kids:prefs:v1',
    leaderboard: 'jinbhakt:kids:leaderboard:v1',
    vows:        'jinbhakt:kids:vows:v1'
  };

  var LB_MAX = 20;          // entries kept per game
  var NAME_MAX = 20;        // leaderboard name cap

  /* ---------------------------------------------------------
   * Game catalogue — the order here IS the menu order
   * ------------------------------------------------------- */
  var GAMES = [
    {
      id: 'sattvic-chef',
      file: 'games/sattvic-chef.html',
      icon: '\uD83E\uDD57',
      hi: 'सात्त्विक रसोई',
      en: 'Sattvic Chef',
      blurbHi: 'भोजन को जैन-अनुकूल या जैन-प्रतिकूल में बाँटिए — हर उत्तर के साथ उसका कारण भी।',
      blurbEn: 'Sort food into Jain-friendly or not — with the reason behind every answer.',
      tagHi: 'आहार · अहिंसा',
      tagEn: 'Food · Ahimsa',
      ages: '5+',
      gates: ['lang', 'aud', 'setup'],
      audience: true,
      countUp: [8, 16, 0],
      scoring: 'score-desc'
    },
    {
      id: 'myth-busters',
      file: 'games/myth-busters.html',
      icon: '\uD83E\uDE94',
      hi: 'मिथक भंजन',
      en: 'Myth Busters',
      blurbHi: 'जैन धर्म के बारे में सत्य या मिथ्या — हर भूल पर एक छोटा स्पष्टीकरण।',
      blurbEn: 'True or false about Jainism — every miss unlocks a short correction.',
      tagHi: 'ज्ञान · श्रद्धा',
      tagEn: 'Knowledge · Faith',
      ages: '8+',
      gates: ['lang', 'aud', 'setup'],
      audience: true,
      countUp: [10, 20, 0],
      scoring: 'score-desc'
    },
    {
      id: 'tirth-sort',
      file: 'games/tirthankar-sort.html',
      icon: '\uD83D\uDD22',
      hi: 'तीर्थंकर क्रम',
      en: 'Tirthankar Sorting',
      blurbHi: 'चौबीस तीर्थंकरों को उनके क्रम, चिन्ह, वर्ण और निर्वाण स्थल से पहचानिए।',
      blurbEn: 'Place the 24 Tirthankaras by order, emblem, complexion or nirvana place.',
      tagHi: 'क्रम · चिन्ह',
      tagEn: 'Order · Emblem',
      ages: '7+',
      gates: ['lang', 'setup'],
      audience: false,
      countUp: [6, 8, 12, 18, 24],
      scoring: 'duration-asc'
    },
    {
      id: 'niyam-wheel',
      file: 'games/niyam-wheel.html',
      icon: '\u2638',
      hi: 'नियम चक्र',
      en: 'Daily Vows · Wheel',
      blurbHi: 'चक्र घुमाइए और आज का अपना एक संयम-संकल्प ग्रहण कीजिए।',
      blurbEn: 'Turn the wheel and take one vow of restraint for today.',
      tagHi: 'नियम · संकल्प',
      tagEn: 'Niyam · Vow',
      ages: '6+',
      gates: ['lang', 'aud'],
      audience: true,
      countUp: [],
      scoring: 'vows-desc'
    },
    {
      id: 'niyam-lotus',
      file: 'games/niyam-lotus.html',
      icon: '\uD83E\uDEB7',
      hi: 'नियम कमल',
      en: 'Daily Vows · Lotus',
      blurbHi: 'श्वास लीजिए, कमल खिलने दीजिए और आज का नियम शांति से स्वीकार कीजिए।',
      blurbEn: 'Breathe, let the lotus open, and accept today\u2019s niyam in quiet.',
      tagHi: 'श्वास · संयम',
      tagEn: 'Breath · Restraint',
      ages: '6+',
      gates: ['lang', 'aud'],
      audience: true,
      countUp: [],
      scoring: 'vows-desc'
    },
    {
      id: 'memory-match',
      file: 'games/memory-match.html',
      icon: '\uD83C\uDFB4',
      hi: 'स्मृति पट्ट',
      en: 'Memory Match',
      blurbHi: 'पत्ते पलटिए और तीर्थंकरों को उनके चिन्ह, वर्ण और निर्वाण स्थल से मिलाइए।',
      blurbEn: 'Flip the cards and pair each Tirthankara with emblem, colour or place.',
      tagHi: 'स्मृति · पहचान',
      tagEn: 'Memory · Recall',
      ages: '6+',
      gates: ['lang', 'setup'],
      audience: false,
      countUp: [4, 6, 8, 12],
      scoring: 'duration-asc'
    }
  ];

  /* ---------------------------------------------------------
   * Leaderboard sort policies
   * ------------------------------------------------------- */
  var SCORING = {
    'score-desc': function (a, b) {
      return (b.score - a.score) ||
             (((b.meta && b.meta.correct) || 0) - ((a.meta && a.meta.correct) || 0)) ||
             (a.duration - b.duration) ||
             (b.ts - a.ts);
    },
    'duration-asc': function (a, b) {
      return (a.duration - b.duration) ||
             (((a.meta && a.meta.moves) || 0) - ((b.meta && b.meta.moves) || 0)) ||
             (b.score - a.score) ||
             (b.ts - a.ts);
    },
    'vows-desc': function (a, b) {
      return (((b.meta && b.meta.vows) || 0) - ((a.meta && a.meta.vows) || 0)) ||
             (((b.meta && b.meta.streakDays) || 0) - ((a.meta && a.meta.streakDays) || 0)) ||
             (a.duration - b.duration) ||
             (b.ts - a.ts);
    }
  };

  /* ---------------------------------------------------------
   * Hub copy — every visible string on #/kids lives here
   * ------------------------------------------------------- */
  var HUB = {
    hi: {
      navLabel: 'बाल शिक्षा',
      navLatin: 'Kids Learning',
      title: 'बाल शिक्षा',
      sub: 'खेल-खेल में अहिंसा, संयम और तीर्थंकरों को जानिए। सब कुछ इसी उपकरण पर संचित होता है — इंटरनेट की आवश्यकता नहीं।',
      sectionGames: 'खेल चुनिए',
      sectionProgress: 'मेरी उपलब्धि',
      plays: '{n} बार खेला',
      bestLabel: 'श्रेष्ठ',
      noRecord: 'अभी कोई रिकॉर्ड नहीं — पहली बार खेलिए',
      lbRank: '#', lbName: 'नाम', lbLevel: 'स्तर', lbTime: 'समय', lbScore: 'अंक',
      lbEmpty: 'इस खेल का अभी कोई रिकॉर्ड नहीं। पहले खिलाड़ी बनिए!',
      lbAllEmpty: 'अभी कोई रिकॉर्ड संचित नहीं है।',
      lbClear: 'यह सूची हटाएँ',
      lbClearAll: 'सभी रिकॉर्ड हटाएँ',
      lbConfirmTitle: 'रिकॉर्ड हटाएँ?',
      lbConfirmOne: 'इस खेल के सभी रिकॉर्ड इस उपकरण से हट जाएँगे।',
      lbConfirmAll: 'सभी खेलों के सभी रिकॉर्ड इस उपकरण से हट जाएँगे।',
      lbConfirmYes: 'हाँ, हटाएँ',
      lbConfirmNo: 'रहने दीजिए',
      lbCleared: 'रिकॉर्ड हटा दिए गए।',
      backToHub: 'सभी खेल',
      openNewTab: 'नई टैब में खोलें',
      reload: 'पुनः आरंभ',
      bannerTitle: 'बाल शिक्षा · Kids Learning',
      bannerBlurb: 'छह खेल — अहिंसा, संयम और चौबीस तीर्थंकर।',
      bannerChip: '{n} खेल',
      offlineNote: 'सभी खेल पूर्णतः ऑफ़लाइन चलते हैं; रिकॉर्ड केवल इसी उपकरण में संचित होते हैं।',
      agesLabel: 'आयु',
      footer: 'दिगंबर जैन परंपरा से प्रेरित · परिवार और परंपरा के अनुसार आचरण भिन्न हो सकते हैं — अपने बड़ों से अवश्य पूछिए।',
      frameTitle: '{name} खेल',
      storageOff: 'रिकॉर्ड संचय उपलब्ध नहीं (निजी विंडो)। खेल सामान्य रूप से चलता रहेगा।'
    },
    en: {
      navLabel: 'Kids Learning',
      navLatin: 'बाल शिक्षा',
      title: 'Kids Learning',
      sub: 'Learn ahimsa, restraint and the Tirthankaras through play. Everything is stored on this device — no internet needed.',
      sectionGames: 'Choose a game',
      sectionProgress: 'My Progress',
      plays: 'Played {n} time(s)',
      bestLabel: 'Best',
      noRecord: 'No record yet — be the first to play',
      lbRank: '#', lbName: 'Name', lbLevel: 'Level', lbTime: 'Time', lbScore: 'Score',
      lbEmpty: 'No records for this game yet. Be the first!',
      lbAllEmpty: 'Nothing recorded yet.',
      lbClear: 'Clear this list',
      lbClearAll: 'Clear all records',
      lbConfirmTitle: 'Clear records?',
      lbConfirmOne: 'Every record for this game will be removed from this device.',
      lbConfirmAll: 'Every record for every game will be removed from this device.',
      lbConfirmYes: 'Yes, clear them',
      lbConfirmNo: 'Keep them',
      lbCleared: 'Records cleared.',
      backToHub: 'All games',
      openNewTab: 'Open in new tab',
      reload: 'Restart',
      bannerTitle: 'Kids Learning · बाल शिक्षा',
      bannerBlurb: 'Six games — ahimsa, restraint and the 24 Tirthankaras.',
      bannerChip: '{n} games',
      offlineNote: 'Every game runs fully offline and records are kept on this device only.',
      agesLabel: 'Ages',
      footer: 'Rooted in the Digambar Jain tradition · practice varies by family and lineage — always ask your elders.',
      frameTitle: '{name} game',
      storageOff: 'Record keeping is unavailable (private window). The games still play normally.'
    }
  };


  /* ---------------------------------------------------------
   * Storage plumbing — every access guarded, private-browsing safe
   * ------------------------------------------------------- */
  var memory = {};          // fallback when localStorage throws or is absent
  var memoryOn = false;

  function getLS() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var probe = '__jb_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
      }
    } catch (e) { /* fall through to the memory store */ }
    memoryOn = true;
    return null;
  }

  function rawGet(key) {
    var ls = getLS();
    try {
      if (ls) return ls.getItem(key);
    } catch (e) { /* ignore */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function rawSet(key, value) {
    var ls = getLS();
    try {
      if (ls) { ls.setItem(key, value); return true; }
    } catch (e) { /* ignore, fall through to memory */ }
    try { memory[key] = value; } catch (e2) { return false; }
    return true;
  }

  function rawRemove(key) {
    var ls = getLS();
    try { if (ls) ls.removeItem(key); } catch (e) { /* ignore */ }
    try { delete memory[key]; } catch (e2) { /* ignore */ }
  }

  function parseJSON(str, fallback) {
    if (!str) return fallback;
    try {
      var v = JSON.parse(str);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) { return fallback; }
  }

  /** False only when the browser refused localStorage (private mode). */
  function storageAvailable() { getLS(); return !memoryOn; }

  /* ---------------------------------------------------------
   * Preferences — shared by the hub and by every game
   * ------------------------------------------------------- */
  var PREF_DEFAULTS = { lang: 'hi', aud: 'kids', sound: true, name: '', lastGame: '' };

  function readPrefs() {
    var p = parseJSON(rawGet(KEYS.prefs), {});
    var out = {};
    for (var k in PREF_DEFAULTS) {
      if (!Object.prototype.hasOwnProperty.call(PREF_DEFAULTS, k)) continue;
      out[k] = (p && p[k] !== undefined && p[k] !== null) ? p[k] : PREF_DEFAULTS[k];
    }
    out.lang = (out.lang === 'en') ? 'en' : 'hi';
    out.aud = (out.aud === 'adults') ? 'adults' : 'kids';
    out.sound = out.sound !== false;
    out.name = sanitizeName(out.name);
    return out;
  }

  function writePrefs(patch) {
    var cur = readPrefs();
    if (patch && typeof patch === 'object') {
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k) &&
            Object.prototype.hasOwnProperty.call(PREF_DEFAULTS, k)) {
          cur[k] = patch[k];
        }
      }
    }
    cur.name = sanitizeName(cur.name);
    rawSet(KEYS.prefs, JSON.stringify(cur));
    return cur;
  }

  /* ---------------------------------------------------------
   * Name handling — markup can never reach the leaderboard
   * ------------------------------------------------------- */
  function sanitizeName(raw) {
    var s = String(raw == null ? '' : raw);
    s = s.replace(/[\u0000-\u001f\u007f]/g, '');   // control characters
    s = s.replace(/[<>"'`\\\/]/g, '');             // markup and path characters
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX).trim();
    return s;
  }

  /* ---------------------------------------------------------
   * Formatting helpers
   * ------------------------------------------------------- */
  var DEV_DIGITS = ['\u0966', '\u0967', '\u0968', '\u0969', '\u096A',
                    '\u096B', '\u096C', '\u096D', '\u096E', '\u096F'];

  function toDevNum(n) {
    return String(n).replace(/\d/g, function (d) { return DEV_DIGITS[+d]; });
  }

  /** Whole seconds -> "m:ss" (or "Hh Mm" above an hour). */
  function formatDuration(sec, lang) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var out;
    if (s < 3600) {
      var m = Math.floor(s / 60);
      var r = s % 60;
      out = m + ':' + (r < 10 ? '0' : '') + r;
    } else {
      out = Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
    }
    return (lang === 'hi') ? toDevNum(out) : out;
  }

  /** Human, already-localised level label with a safe fallback. */
  function formatLevel(game, entry, lang) {
    if (entry && entry.level) return String(entry.level);
    if (!entry || !entry.levelKey) return '';
    var parts = String(entry.levelKey).split('-');
    var audHi = { kids: 'बालक', adults: 'व्यस्क' };
    var audEn = { kids: 'Kids', adults: 'Adults' };
    if (game && game.audience && audHi[parts[0]]) {
      return (lang === 'en' ? audEn[parts[0]] : audHi[parts[0]]) +
             (parts[1] ? ' · ' + parts[1] : '');
    }
    return parts.join(' · ');
  }


  /* ---------------------------------------------------------
   * Leaderboard — one shared record for all six games
   * ------------------------------------------------------- */
  function comparator(gameId) {
    var g = gameById(gameId);
    var fn = g ? SCORING[g.scoring] : null;
    return fn || SCORING['score-desc'];
  }

  function lbReadAll() {
    var all = parseJSON(rawGet(KEYS.leaderboard), {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
    return all;
  }

  /** One game's entries, already sorted best-first. */
  function lbRead(gameId) {
    var all = lbReadAll();
    var list = all[gameId];
    if (!Array.isArray(list)) return [];
    var clean = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || typeof e !== 'object') continue;
      clean.push(normaliseEntry(e));
    }
    clean.sort(comparator(gameId));
    return clean;
  }

  function normaliseEntry(e) {
    return {
      name:     sanitizeName(e.name),
      level:    typeof e.level === 'string' ? e.level : '',
      levelKey: typeof e.levelKey === 'string' ? e.levelKey : '',
      duration: Math.max(0, Math.floor(Number(e.duration) || 0)),
      score:    Math.max(0, Math.floor(Number(e.score) || 0)),
      meta:     (e.meta && typeof e.meta === 'object' && !Array.isArray(e.meta)) ? e.meta : {},
      ts:       Math.floor(Number(e.ts) || Date.now())
    };
  }

  /**
   * Insert a result.  Returns { rank, isBest, total } where rank is 1-based
   * so a game can announce "You are #2".  Never throws.
   */
  function lbWrite(gameId, entry) {
    if (!gameId || !entry || typeof entry !== 'object') {
      return { rank: 0, isBest: false, total: 0 };
    }
    var clean = normaliseEntry(entry);
    clean.ts = clean.ts || Date.now();

    var all = lbReadAll();
    var list = Array.isArray(all[gameId]) ? all[gameId] : [];
    list.push(clean);
    list.sort(comparator(gameId));
    if (list.length > LB_MAX) list = list.slice(0, LB_MAX);
    all[gameId] = list;
    rawSet(KEYS.leaderboard, JSON.stringify(all));

    var rank = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === clean || (list[i].ts === clean.ts &&
          list[i].name === clean.name && list[i].levelKey === clean.levelKey &&
          list[i].duration === clean.duration && list[i].score === clean.score)) {
        rank = i + 1;
        break;
      }
    }
    return { rank: rank, isBest: rank === 1, total: list.length };
  }

  /** Best entry overall, or best within one level when levelKey is given. */
  function lbBest(gameId, levelKey) {
    var list = lbRead(gameId);
    if (!list.length) return null;
    if (!levelKey) return list[0];
    for (var i = 0; i < list.length; i++) {
      if (list[i].levelKey === levelKey) return list[i];
    }
    return null;
  }

  /** Clear one game, or everything when gameId is omitted. */
  function lbClear(gameId) {
    if (!gameId) { rawRemove(KEYS.leaderboard); return; }
    var all = lbReadAll();
    if (Object.prototype.hasOwnProperty.call(all, gameId)) {
      delete all[gameId];
      rawSet(KEYS.leaderboard, JSON.stringify(all));
    }
  }

  /** How many results are stored for a game (for the "played N times" line). */
  function lbPlays(gameId) { return lbRead(gameId).length; }

  /* ---------------------------------------------------------
   * Catalogue accessors
   * ------------------------------------------------------- */
  function getGames() { return GAMES.slice(); }

  function gameById(id) {
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === id) return GAMES[i];
    }
    return null;
  }

  function hubCopy(lang) {
    var c = HUB[lang === 'en' ? 'en' : 'hi'];
    return c || HUB.hi;
  }

  /** {n} / {name} substitution — the only templating this module does. */
  function fill(str, vars) {
    var s = String(str == null ? '' : str);
    if (!vars) return s;
    for (var k in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) continue;
      s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }

  return {
    KEYS: KEYS,
    SCORING: SCORING,
    LB_MAX: LB_MAX,
    NAME_MAX: NAME_MAX,
    getGames: getGames,
    gameById: gameById,
    hubCopy: hubCopy,
    fill: fill,
    readPrefs: readPrefs,
    writePrefs: writePrefs,
    storageAvailable: storageAvailable,
    sanitizeName: sanitizeName,
    formatDuration: formatDuration,
    formatLevel: formatLevel,
    toDevNum: toDevNum,
    lbReadAll: lbReadAll,
    lbRead: lbRead,
    lbWrite: lbWrite,
    lbBest: lbBest,
    lbClear: lbClear,
    lbPlays: lbPlays
  };
}));

