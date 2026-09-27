/**
 * ============================================================
 *  JinBhakt — Main Application
 *  Dependency-free vanilla ES6+ · hash-routed SPA
 * ============================================================
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------
   * Constants
   * ------------------------------------------------------- */
  var CONTENT_DIR = 'content/';
  var PLACEHOLDER = 'TBC#';

  /**
   * Transliteration engine (js/translit.js). Search degrades to plain
   * substring matching if the module is missing, so a stale cache can
   * never take the whole feature down.
   */
  var T = window.jinbhaktTranslit || {
    buildField: function (text, w) {
      var t = String(text == null ? '' : text).toLowerCase().trim();
      if (!t) return null;
      return { w: w || 0, dn: t, lts: [t], sk: '', words: t.split(/\s+/) };
    },
    analyzeToken: function (raw) {
      var t = String(raw == null ? '' : raw).toLowerCase().trim();
      if (!t) return null;
      return { raw: t, dn: t, lt: t, lts: [t], sk: '' };
    },
    display: function (s, opts) { return String(s == null ? '' : s); },
    transliterateText: function (s, opts) { return String(s == null ? '' : s); },
    hasDevanagari: function () { return false; },
    levenshtein: function () { return 99; },
    skeleton: function () { return ''; },
    fold: function (s) { return String(s == null ? '' : s).toLowerCase(); }
  };

  /**
   * Panchang engine (js/panchang.js).  Falls back to a no-op stub if the
   * module is missing — the home page simply omits the Panchang Patra.
   */
  var Panchang = window.jinbhaktPanchang || null;

  /**
   * Kids Learning engine (js/kids.js).  Owns the six offline learning games,
   * the bilingual hub copy and the shared on-device leaderboard.  Falls back
   * to a stub so a stale cache can never take the rest of the app down — the
   * menu section is simply omitted.
   */
  var Kids = window.JinBhaktKids || {
    getGames: function () { return []; },
    gameById: function () { return null; },
    hubCopy: function () { return {}; },
    fill: function (s) { return String(s == null ? '' : s); },
    readPrefs: function () { return { lang: 'hi' }; },
    writePrefs: function () {},
    lbRead: function () { return []; },
    lbBest: function () { return null; },
    lbClear: function () {},
    lbPlays: function () { return 0; },
    formatDuration: function (s) { return String(s); },
    storageAvailable: function () { return false; }
  };

  /* ---------------------------------------------------------
   * Application state
   * ------------------------------------------------------- */
  var state = {
    categories: [],   // [{id,label,icon}]
    items: {},        // catId -> [item]   (metadata manifest for every item)
    readable: {},     // catId -> [item]   (manifest items flagged hasContent)
    searchIndex: [],  // flattened catalogue for search
    contentCache: {}, // "catId/cref" -> {hCont,hBrief}  (lazy-loaded bodies)
    activeResult: -1, // keyboard-selected search result
    ready: false,
    navReady: false,
    taxonomy: null,
    activeLens: 'browse',
    panchangData: null   // lazy-loaded content/panchang.json
  };

  var dom = {};
  var initialized = false;
  var readerToken = 0;   // guards async content population against stale navigation

  /* ---------------------------------------------------------
   * English transliteration (reader view)
   *
   * A visitor who cannot read Devanagari can flip the open passage
   * into Roman letters. The choice is remembered, so it survives
   * navigation, reloads and the prev/next buttons. The conversion
   * itself lives in js/translit.js — if that module is missing the
   * button simply keeps showing the original text.
   * ------------------------------------------------------- */
  var TRANSLIT_KEY = 'jinbhakt:translit';
  var TRANSLIT_STYLE_KEY = 'jinbhakt:translit-style';

  function readTranslitPref() {
    try { return window.localStorage.getItem(TRANSLIT_KEY) === '1'; }
    catch (e) { return false; }        // private mode / storage blocked
  }

  function writeTranslitPref(on) {
    try {
      if (on) window.localStorage.setItem(TRANSLIT_KEY, '1');
      else window.localStorage.removeItem(TRANSLIT_KEY);
    } catch (e) { /* ignore — the toggle still works for this session */ }
  }

  function readTranslitStylePref() {
    try {
      var v = window.localStorage.getItem(TRANSLIT_STYLE_KEY);
      return v === 'ascii' ? 'ascii' : 'iast';     // default IAST
    } catch (e) { return 'iast'; }
  }

  function writeTranslitStylePref(style) {
    try {
      if (style === 'ascii') window.localStorage.setItem(TRANSLIT_STYLE_KEY, 'ascii');
      else window.localStorage.removeItem(TRANSLIT_STYLE_KEY);
    } catch (e) { /* ignore */ }
  }

  var translitOn = readTranslitPref();
  var translitStyle = readTranslitStylePref();
  var readerRaw = { body: '', brief: '' };   // untouched source of the open prayer
  var readerDevText = '';                    // plain Devanagari text, used by narration
  var readerLoaded = false;
  var readerCatId = '';                      // current reader's category id

  /* ---------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------- */
  function isPlaceholder(v) {
    if (v === null || v === undefined) return true;
    var s = String(v).trim();
    return s === '' || s === PLACEHOLDER;
  }

  function hasContent(item) {
    // Manifests carry a precomputed hasContent flag (the body lives in a
    // separate lazy-loaded text file, so hCont is no longer in memory).
    if (!item) return false;
    if (typeof item.hasContent === 'boolean') return item.hasContent;
    return !isPlaceholder(item.hCont);   // fallback for legacy full items
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Whitelist sanitizer — keeps devotional tables intact, strips all attrs. */
  var ALLOWED_TAGS = {
    BR: 1, I: 1, B: 1, U: 1, EM: 1, STRONG: 1, P: 1, DIV: 1, SPAN: 1,
    SMALL: 1, SUB: 1, SUP: 1, HR: 1, BLOCKQUOTE: 1,
    UL: 1, OL: 1, LI: 1,
    TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TH: 1, TD: 1, CAPTION: 1,
    H2: 1, H3: 1, H4: 1, H5: 1, H6: 1
  };

  function sanitizeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    var temp = document.createElement('div');
    temp.innerHTML = str;

    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var child = kids[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!ALLOWED_TAGS[child.tagName]) {
            var frag = document.createDocumentFragment();
            while (child.firstChild) frag.appendChild(child.firstChild);
            if (child.parentNode) child.parentNode.replaceChild(frag, child);
          } else {
            while (child.attributes.length > 0) {
              child.removeAttribute(child.attributes[0].name);
            }
            walk(child);
          }
        } else if (child.nodeType === Node.COMMENT_NODE) {
          if (child.parentNode) child.parentNode.removeChild(child);
        }
      }
    })(temp);

    return temp.innerHTML;
  }

  /**
   * Wrap every <table> in a horizontally-scrollable container.
   * Wide devotional tables (e.g. णमोकार मंत्र) must never force the
   * whole page to overflow on a narrow phone screen.
   */
  function wrapTables(container) {
    if (!container || !container.querySelectorAll) return;
    var tables = container.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.parentNode && t.parentNode.classList &&
          t.parentNode.classList.contains('table-scroll')) continue;
      var scroller = document.createElement('div');
      scroller.className = 'table-scroll';
      scroller.setAttribute('tabindex', '0');
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', 'तालिका — स्क्रॉल करें');
      t.parentNode.insertBefore(scroller, t);
      scroller.appendChild(t);
    }
  }

  /* ---------------------------------------------------------
   * English transliteration — painting
   *
   * The passage is never rebuilt from a string: the sanitized
   * Devanagari DOM is repainted from `readerRaw` and then, if the
   * toggle is on, only the text nodes are rewritten. Every <br>,
   * table, heading and verse therefore keeps its exact place.
   * ------------------------------------------------------- */
  var INLINE_TAGS = { B: 1, I: 1, U: 1, EM: 1, STRONG: 1, SPAN: 1, SMALL: 1, SUB: 1, SUP: 1 };

  function hasDevanagari(str) {
    return /[\u0900-\u097f]/.test(String(str == null ? '' : str));
  }

  /** Devanagari -> Roman, degrading to the input if the engine is missing. */
  function toRoman(str, capitalize) {
    if (!T.transliterateText) return String(str == null ? '' : str);
    return T.transliterateText(str, {
      capitalize: capitalize !== false,
      style: translitStyle
    });
  }

  /**
   * Should this text node start with a capital letter?
   * True when nothing precedes it inside its own block, or when the text
   * before it ended a sentence. The reader paints one line per text node,
   * so verse lines keep looking like verse lines instead of one long
   * lowercase run — while inline <b>/<i> fragments mid-line stay lowercase.
   */
  function sentenceStart(node) {
    var before = '';
    var cur = node;
    var guard = 0;

    while (cur && guard++ < 8) {
      for (var sib = cur.previousSibling; sib; sib = sib.previousSibling) {
        before = (sib.nodeType === Node.TEXT_NODE ? sib.nodeValue : (sib.textContent || '')) + before;
      }
      if (before.trim()) break;                       // found the preceding words

      var parent = cur.parentNode;
      if (!parent || parent.nodeType !== Node.ELEMENT_NODE) break;
      if (!INLINE_TAGS[parent.tagName]) break;        // block edge = a new sentence
      cur = parent;                                   // inline wrapper: keep looking left
    }

    before = before.replace(/\s+$/, '');
    return !before.trim() || /[.!?।॥:]$/.test(before);
  }

  /** Rewrite every Devanagari text node under `root` into Roman letters. */
  function transliterateTree(root) {
    if (!root || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (var i = 0; i < nodes.length; i++) {
      var text = nodes[i].nodeValue;
      if (!text || !hasDevanagari(text)) continue;    // Latin words pass through untouched
      nodes[i].nodeValue = toRoman(text, sentenceStart(nodes[i]));
    }
  }

  /**
   * Flip one element's label between the two scripts. The Devanagari
   * original is stashed in data-dev the first time, so the toggle can
   * always go back without re-reading the manifest. data-en pins the
   * exact English wording when a plain romanization would read badly
   * ("↑ ऊपर" -> "↑ Top", not "↑ Oopar").
   */
  function swapLabel(node) {
    if (!node || !node.getAttribute) return;
    var dev = node.getAttribute('data-dev');
    if (dev === null) {
      dev = node.textContent || '';
      node.setAttribute('data-dev', dev);
    }
    if (!translitOn || !hasDevanagari(dev)) { node.textContent = dev; return; }
    var en = node.getAttribute('data-en');
    node.textContent = en ? en : toRoman(dev);
  }

  /**
   * A reader-chrome label that follows the chosen script. Marked with
   * data-swap so paintTranslitChrome() can find and repaint it.
   * (The "English Transliterate" button is deliberately NOT built this way:
   * in Devanagari view its reader cannot read Devanagari, so it stays English.)
   */
  function swapSpan(className, dev, en) {
    var node = el('span', className, translitOn ? en : dev);
    node.setAttribute('data-dev', dev);
    node.setAttribute('data-en', en);
    node.setAttribute('data-swap', '');
    return node;
  }

  /** Plain text of a rendered body, with <br> turned back into line breaks. */
  function extractSpeechText(container) {
    if (!container) return '';
    var clone = container.cloneNode(true);
    var brs = clone.querySelectorAll('br');
    for (var i = 0; i < brs.length; i++) {
      brs[i].replaceWith(document.createTextNode('\n'));
    }
    var text = (clone.textContent || '').replace(/\u00a0/g, ' ');
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Title + prev/next names + the body-class hook for CSS. */
  function paintTranslitChrome() {
    swapLabel(document.querySelector('.reader-title'));
    var names = document.querySelectorAll('.nav-btn-name');
    for (var i = 0; i < names.length; i++) swapLabel(names[i]);
    // every other chrome label built with swapSpan() — top, list, prev/next arrows, meta
    var labels = document.querySelectorAll('.reader [data-swap]');
    for (var j = 0; j < labels.length; j++) swapLabel(labels[j]);
    if (document.body) {
      document.body.classList.toggle('translit-on', translitOn);
      document.body.classList.toggle('translit-iast', translitOn && translitStyle === 'iast');
    }
    // Show/hide the style switch — visible only when transliteration is on
    var styleGroup = document.querySelector('.translit-style-group');
    if (styleGroup) {
      styleGroup.style.display = translitOn ? '' : 'none';
    }
    paintTranslitButtons();
  }

  /** Repaint the reader from the untouched source, in whichever script is active. */
  function paintReaderContent() {
    if (!readerLoaded) { paintTranslitChrome(); return; }

    var isLatin = readerCatId === 'stories-en';

    var body = document.getElementById('prayer-body');
    if (body) {
      body.innerHTML = sanitizeHTML(normalizeContent(readerRaw.body || ''));
      wrapTables(body);
      readerDevText = extractSpeechText(body);       // captured before any rewriting
      body.classList.toggle('is-translit', translitOn);
      body.classList.toggle('is-latin', isLatin);
      if (translitOn) transliterateTree(body);
    }

    var slot = document.getElementById('reader-brief-slot');
    if (slot) {
      slot.innerHTML = '';
      if (readerRaw.brief) {
        var aside = el('aside', 'reader-brief');
        aside.appendChild(el('h3', null, (translitOn || isLatin) ? 'Summary' : '\u0938\u093E\u0930\u093E\u0902\u0936'));
        var bb = el('div', 'brief-body');
        bb.innerHTML = sanitizeHTML(normalizeContent(readerRaw.brief));
        wrapTables(bb);
        bb.classList.toggle('is-translit', translitOn);
        bb.classList.toggle('is-latin', isLatin);
        if (translitOn) transliterateTree(bb);
        aside.appendChild(bb);
        slot.appendChild(aside);
      }
    }

    paintTranslitChrome();
  }

  /** Keep every transliteration button in sync with the current state. */
  function paintTranslitButtons() {
    var btns = document.querySelectorAll('[data-action="transliterate"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', translitOn);
      btns[i].setAttribute('aria-pressed', translitOn ? 'true' : 'false');
      btns[i].setAttribute('title', translitOn
        ? 'Showing English letters \u2014 tap for Devanagari'
        : 'Show this text in English (Roman) letters');
    }
    // Sync the IAST / Simple style switch
    var styleBtns = document.querySelectorAll('[data-action="translit-style"]');
    for (var j = 0; j < styleBtns.length; j++) {
      var isActive = styleBtns[j].getAttribute('data-style') === translitStyle;
      styleBtns[j].classList.toggle('is-active', isActive);
      styleBtns[j].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
    // speech.js owns the listen/stop wording — ask it to repaint in this script
    if (window.jinbhaktSpeech && typeof window.jinbhaktSpeech.paintButtons === 'function') {
      window.jinbhaktSpeech.paintButtons();
    }
  }

  function setTransliteration(on) {
    on = !!on;
    if (on === translitOn) { paintTranslitButtons(); return translitOn; }
    translitOn = on;
    writeTranslitPref(on);
    paintTranslitButtons();
    paintReaderContent();
    return translitOn;
  }

  function toggleTransliteration() {
    return setTransliteration(!translitOn);
  }

  function setTranslitStyle(style) {
    style = style === 'ascii' ? 'ascii' : 'iast';
    if (style === translitStyle) { paintTranslitButtons(); return translitStyle; }
    translitStyle = style;
    writeTranslitStylePref(style);
    paintReaderContent();
    return translitStyle;
  }

  /** Tidy raw JSON markup: CRLF, stray indentation, blank-line spam. */
  function normalizeContent(html) {

    return String(html)
      .replace(/\r\n?/g, '\n')        // normalize CRLF/CR -> LF
      .replace(/[ \t]+\n/g, '\n')     // strip trailing whitespace on each line
      .replace(/\n{3,}/g, '\n\n')     // collapse 3+ blank lines down to one blank line
      .trim()                         // drop leading/trailing blank lines
      .replace(/\n/g, '<br>\n');      // convert surviving newlines to <br> for rendering
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function loadJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    });
  }

  /* ---------------------------------------------------------
   * Lazy content loading
   * Item bodies live in content/text/<cat>/<cref>.json and are
   * fetched only when the reader opens that prayer. Results are
   * memoised in state.contentCache so prev/next is instant.
   * ------------------------------------------------------- */
  function contentRef(item) {
    return (item && item.cref !== undefined && item.cref !== null) ? item.cref : (item ? item._index : 0);
  }

  function contentUrl(catId, item) {
    return CONTENT_DIR + 'text/' + catId + '/' + contentRef(item) + '.json';
  }

  function loadItemContent(catId, item) {
    var key = catId + '/' + contentRef(item);
    if (state.contentCache[key]) return Promise.resolve(state.contentCache[key]);
    return loadJSON(contentUrl(catId, item)).then(function (data) {
      state.contentCache[key] = data || {};
      return state.contentCache[key];
    });
  }

  /* ---------------------------------------------------------
   * DOM cache
   * ------------------------------------------------------- */
  function cacheDOM() {
    dom.menuToggle    = document.getElementById('menu-toggle');
    dom.overlay       = document.getElementById('body-overlay');
    dom.navPanel      = document.getElementById('nav-panel');
    dom.searchInput   = document.getElementById('search-input');
    dom.searchResults = document.getElementById('search-results-box');
    dom.categoryList  = document.getElementById('category-list');
    dom.quickBar      = document.getElementById('quick-bar');
    dom.main          = document.getElementById('main-content');
  }

  /* ---------------------------------------------------------
   * Data layer — load every category once, index it all
   * ------------------------------------------------------- */
  function loadAllData() {
    return loadJSON(CONTENT_DIR + 'categories.json').then(function (cats) {
      state.categories = Array.isArray(cats) ? cats : [];

      var jobs = state.categories.map(function (cat) {
        return loadJSON(CONTENT_DIR + cat.id + '.json')
          .then(function (list) {
            var arr = Array.isArray(list) ? list : [];
            state.items[cat.id] = arr;
            state.readable[cat.id] = arr.filter(hasContent);
          })
          .catch(function (err) {
            console.error('Could not load ' + cat.id + '.json:', err);
            state.items[cat.id] = [];
            state.readable[cat.id] = [];
          });
      });

      return Promise.all(jobs).then(function () {
        buildSearchIndex();
        state.ready = true;
        return loadJSON(CONTENT_DIR + 'taxonomy.json').then(function (taxonomy) {
          state.taxonomy = taxonomy;
          if (window.Nav && typeof Nav.init === 'function') {
            Nav.init(taxonomy, state.items);
            state.navReady = true;
          }
        }).catch(function (err) {
          console.warn('Could not load taxonomy.json:', err);
          state.navReady = false;
        });
      });
    });
  }

  /**
   * Build a complete search index from the real catalogue — every category
   * manifest listed in categories.json is walked, so nothing is left out.
   *
   * Every entry carries a small set of weighted "fields". Each field is
   * pre-romanized into several Latin spellings plus a consonant skeleton,
   * so an English query like "SamaySar" or "Vaasupujya Bhagwaan Pooja"
   * can meet the Devanagari title it means.
   */
  var FIELD_CACHE = {};   // "w\u0001text" -> field object (categories/subs repeat a lot)

  function cachedField(text, w) {
    if (isPlaceholder(text)) return null;
    var key = w + '\u0001' + text;
    if (Object.prototype.hasOwnProperty.call(FIELD_CACHE, key)) return FIELD_CACHE[key];
    var f = T.buildField(text, w);
    FIELD_CACHE[key] = f;
    return f;
  }

  function buildSearchIndex() {
    var seen = {};
    state.searchIndex = [];

    state.categories.forEach(function (cat) {
      // Category labels are shared by every item in the category — build once.
      var catFields = [];
      var cf = cachedField(cat.label, 4);
      if (cf) catFields.push(cf);

      (state.items[cat.id] || []).forEach(function (item) {
        var key = cat.id + '::' + item._id;
        if (seen[key]) return;
        seen[key] = true;

        var hName = item.hName || item.eName || '';
        var fields = [];
        var push = function (f) { if (f) fields.push(f); };

        push(cachedField(hName, 0));                       // the title itself
        push(cachedField(item.eName, 1));                  // legacy romanization
        push(cachedField(item.sub, 2));                    // granth sub-type (टीका / गाथा …)
        push(cachedField(item.hAuth, 3));                  // author
        push(cachedField(item.hCtg, 4));                   // Hindi category name
        push(cachedField(item.eCtg, 4));                   // English category name
        push(cachedField(item._id, 4));                    // slug
        catFields.forEach(push);

        var entry = {
          cat: cat.id,
          catLabel: cat.label,
          icon: cat.icon,
          id: item._id,
          hName: hName,
          eName: item.eName || '',
          hCtg: item.hCtg || cat.label,
          sub: item.sub || '',
          hAuth: isPlaceholder(item.hAuth) ? '' : item.hAuth,
          readable: hasContent(item),
          f: fields
        };

        // Flat "does this entry mention the token at all?" probes — one cheap
        // indexOf per token rejects the vast majority of the catalogue
        // before any detailed scoring runs.
        var lt = [], sk = [], dn = [];
        for (var i = 0; i < fields.length; i++) {
          lt.push(fields[i].lts.join(' '));
          if (fields[i].sk) sk.push(fields[i].sk);
          if (fields[i].dn) dn.push(fields[i].dn);
        }
        entry.b = { lt: lt.join(' '), sk: sk.join(' '), dn: dn.join(' ') };

        // Human-readable romanization shown under the Devanagari title.
        // Both ASCII and IAST forms are precomputed so that flipping the
        // style switch never rebuilds the index.
        if (T.hasDevanagari(hName)) {
          entry.latin = T.display(hName);
          entry.latinIast = T.display(hName, { style: 'iast' });
        } else {
          entry.latin = '';
          entry.latinIast = '';
        }

        state.searchIndex.push(entry);
      });
    });
  }

  function findItem(catId, itemId) {
    var list = state.items[catId] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === itemId) return list[i];
    }
    // tolerate lookup by Hindi/English name
    for (var j = 0; j < list.length; j++) {
      if (list[j].hName === itemId || list[j].eName === itemId) return list[j];
    }
    return null;
  }

  /** Locate an item across every category (used by search + deep links). */
  function findItemAnywhere(itemId) {
    for (var c = 0; c < state.categories.length; c++) {
      var catId = state.categories[c].id;
      var hit = findItem(catId, itemId);
      if (hit) return { catId: catId, item: hit };
    }
    return null;
  }

  /** Sibling navigation computed from real position, not the empty eNext/ePrev. */
  function getSiblings(catId, itemId) {
    var list = state.readable[catId] || [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === itemId) { idx = i; break; }
    }
    return {
      index: idx,
      total: list.length,
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null
    };
  }

  function categoryById(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return null;
  }

  /* ---------------------------------------------------------
   * Mobile navigation drawer
   * ------------------------------------------------------- */
  function openNav() {
    document.body.classList.add('nav-open');
    dom.menuToggle.setAttribute('aria-expanded', 'true');
    dom.menuToggle.setAttribute('aria-label', 'मेन्यू बंद करें');
    dom.overlay.setAttribute('aria-hidden', 'false');
  }

  function closeNav() {
    document.body.classList.remove('nav-open');
    dom.menuToggle.setAttribute('aria-expanded', 'false');
    dom.menuToggle.setAttribute('aria-label', 'मेन्यू खोलें');
    dom.overlay.setAttribute('aria-hidden', 'true');
  }

  function toggleNav() {
    if (document.body.classList.contains('nav-open')) closeNav();
    else openNav();
  }

  function isMobile() {
    return window.matchMedia('(max-width: 899px)').matches;
  }

  /* ---------------------------------------------------------
   * Sidebar: 4-lens navigation (Path / Browse / Index / Mine)
   * Uses Nav engine when available, falls back to raw state.
   * ------------------------------------------------------- */
  function renderNav() {
    renderLensTabs();
    renderLensContent(state.activeLens);
  }

  /** Render the lens tab bar above the category list. */
  function renderLensTabs() {
    var existing = dom.navPanel.querySelector('.lens-tabs');
    if (existing) existing.remove();

    var lenses = (state.navReady && window.Nav) ? Nav.getLenses() : [
      { id: 'path', label: 'क्रम', latin: 'Daily Path', icon: '\uD83E\uDE94' },
      { id: 'browse', label: 'विषय', latin: 'Browse', icon: '\uD83D\uDCDA' },
      { id: 'index', label: 'अ–क्ष', latin: 'Index', icon: '\uD83D\uDD24' },
      { id: 'mine', label: 'मेरे', latin: 'Mine', icon: '⭐' }
    ];

    var tabs = el('div', 'lens-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'नेविगेशन दृश्य');

    lenses.forEach(function (lens) {
      var btn = el('button', 'lens-tab' + (state.activeLens === lens.id ? ' is-active' : ''));
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeLens === lens.id ? 'true' : 'false');
      btn.setAttribute('data-lens', lens.id);
      btn.setAttribute('title', lens.latin || lens.label);
      btn.appendChild(el('span', 'lens-tab-icon', lens.icon || ''));
      btn.appendChild(el('span', 'lens-tab-label', lens.label));
      btn.addEventListener('click', function () { switchLens(lens.id); });
      tabs.appendChild(btn);
    });

    dom.navPanel.insertBefore(tabs, dom.categoryList);
  }

  /** Switch the active lens and re-render sidebar content. */
  function switchLens(lensId) {
    state.activeLens = lensId;
    if (state.navReady && window.Nav) Nav.setPrefs({ lens: lensId });

    var tabs = dom.navPanel.querySelectorAll('.lens-tab');
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].getAttribute('data-lens') === lensId;
      tabs[i].classList.toggle('is-active', isActive);
      tabs[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    renderLensContent(lensId);
  }

  /** Render the sidebar content for the given lens. */
  function renderLensContent(lensId) {
    dom.categoryList.innerHTML = '';
    switch (lensId) {
      case 'path':    renderLensPath(); break;
      case 'browse':  renderLensBrowse(); break;
      case 'index':   renderLensIndex(); break;
      case 'mine':    renderLensMine(); break;
      default:        renderLensBrowse(); break;
    }
    /* Kids Learning is always the last section of the menu bar, in every lens. */
    var kidsSection = buildKidsMenuSection();
    if (kidsSection) dom.categoryList.appendChild(kidsSection);
  }

  /* Browse lens: category accordion (same DOM as legacy renderNav). */
  function renderLensBrowse() {
    var homeLink = el('a', 'nav-home-link', '\u2638  मुख्य पृष्ठ');
    homeLink.href = '#/';
    homeLink.setAttribute('data-route', 'home');
    dom.categoryList.appendChild(homeLink);

    var catList = (state.navReady && window.Nav) ? Nav.getCategories() : state.categories;
    catList.forEach(function (cat) {
      var all = state.items[cat.id] || [];
      var ready = state.readable[cat.id] || [];
      var details = el('details', 'category-item');
      details.setAttribute('data-cat', cat.id);
      var summary = el('summary', 'category-header');
      summary.appendChild(el('span', 'cat-icon', cat.icon || ''));
      summary.appendChild(el('span', 'cat-label', cat.label));
      var badge = el('span', 'cat-count', String(ready.length));
      var isEn = (cat.id === 'stories-en');
      badge.title = ready.length + (isEn ? ' readable / ' : ' पठनीय / ') + all.length + (isEn ? ' total' : ' कुल');
      badge.setAttribute('aria-label', ready.length + (isEn ? ' readable items' : ' पठनीय सामग्री'));
      summary.appendChild(badge);
      var links = el('div', 'category-links');
      links.id = 'cat-links-' + cat.id;
      if (ready.length === 0) {
        links.appendChild(el('p', 'cat-empty', isEn ? 'Content for this section will be added soon.' : 'इस खंड की सामग्री शीघ्र ही जोड़ी जाएगी।'));
      } else {
        ready.forEach(function (item) {
          // For English stories category, prefer eName; for all others prefer hName.
          var label = isEn
            ? (item.eName || item.hName || item._id)
            : (item.hName || item.eName || item._id);
          var a = el('a', 'link-pill', label);
          a.href = '#/' + cat.id + '/' + encodeURIComponent(item._id);
          a.setAttribute('data-route', 'reader');
          a.setAttribute('data-cat', cat.id);
          a.setAttribute('data-id', item._id);
          links.appendChild(a);
        });
        var pending = all.length - ready.length;
        if (pending > 0) {
          var more = el('a', 'link-pill pill-more', '+ ' + pending + (isEn ? ' more titles' : ' अन्य शीर्षक'));
          more.href = '#/' + cat.id;
          more.setAttribute('data-route', 'category');
          more.title = isEn ? 'View full list' : 'पूरी सूची देखें';
          links.appendChild(more);
        }
      }
      details.appendChild(summary);
      details.appendChild(links);
      dom.categoryList.appendChild(details);
    });
  }

  /* Path lens: daily worship steps as accordion. */
  function renderLensPath() {
    if (!state.navReady || !window.Nav) {
      dom.categoryList.appendChild(el('p', 'nav-loading', 'क्रम शीघ्र ही उपलब्ध होगा।'));
      return;
    }
    var homeLink = el('a', 'nav-home-link', '\uD83E\uDE94  नित्य पूजा क्रम');
    homeLink.href = '#/path';
    homeLink.setAttribute('data-route', 'path');
    dom.categoryList.appendChild(homeLink);

    var steps = Nav.getPathSteps();
    steps.forEach(function (step, idx) {
      var details = el('details', 'category-item');
      details.setAttribute('data-path-step', step.id);
      var summary = el('summary', 'category-header');
      summary.appendChild(el('span', 'cat-icon', String(idx + 1) + '.'));
      summary.appendChild(el('span', 'cat-label', step.label));
      var badge = el('span', 'cat-count', String(step.count));
      badge.setAttribute('aria-label', step.count + ' पाठ');
      summary.appendChild(badge);
      var links = el('div', 'category-links');
      var items = Nav.getPathStep(step.id);
      items.slice(0, 20).forEach(function (item) {
        var a = el('a', 'link-pill', item.hName || item.eName || item._id);
        a.href = '#/' + item.catId + '/' + encodeURIComponent(item._id);
        a.setAttribute('data-route', 'reader');
        a.setAttribute('data-cat', item.catId);
        a.setAttribute('data-id', item._id);
        links.appendChild(a);
      });
      if (items.length > 20) {
        var more = el('a', 'link-pill pill-more', '+ ' + (items.length - 20) + ' अन्य');
        more.href = '#/path/' + step.id;
        more.setAttribute('data-route', 'path-step');
        links.appendChild(more);
      }
      details.appendChild(summary);
      details.appendChild(links);
      dom.categoryList.appendChild(details);
    });
  }

  /* Index lens: Devanagari letter grid in sidebar. */
  function renderLensIndex() {
    if (!state.navReady || !window.Nav) {
      dom.categoryList.appendChild(el('p', 'nav-loading', 'अक्षर सूची शीघ्र ही उपलब्ध होगी।'));
      return;
    }
    var homeLink = el('a', 'nav-home-link', '\uD83D\uDD24  अक्षर माला');
    homeLink.href = '#/index';
    homeLink.setAttribute('data-route', 'index');
    dom.categoryList.appendChild(homeLink);

    var letters = Nav.getLetters();
    var grid = el('div', 'nav-letter-grid');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:8px 12px;';
    letters.forEach(function (l) {
      var a = el('a', 'link-pill', l.letter);
      a.href = '#/index/' + encodeURIComponent(l.letter);
      a.title = l.count + ' पाठ';
      a.style.cssText = 'min-width:32px;text-align:center;';
      a.setAttribute('data-route', 'letter');
      grid.appendChild(a);
    });
    dom.categoryList.appendChild(grid);
  }

  /* Mine lens: favorites list + settings. */
  function renderLensMine() {
    if (!state.navReady || !window.Nav) {
      dom.categoryList.appendChild(el('p', 'nav-loading', 'प्रिय पाठ शीघ्र ही उपलब्ध होंगे।'));
      return;
    }
    var homeLink = el('a', 'nav-home-link', '⭐  मेरे प्रिय पाठ');
    homeLink.href = '#/fav';
    homeLink.setAttribute('data-route', 'fav');
    dom.categoryList.appendChild(homeLink);

    var favIds = Nav.getFavs();
    if (favIds.length === 0) {
      dom.categoryList.appendChild(el('p', 'cat-empty',
        'अभी कोई प्रिय पाठ नहीं। पाठ पढ़ते समय ⭐ दबाएँ।'));
      return;
    }
    var links = el('div', 'category-links');
    links.style.padding = '8px 12px';
    favIds.forEach(function (favId) {
      var parts = favId.split('::');
      if (parts.length < 2) return;
      var catId = parts[0];
      var itemId = parts[1];
      var found = findItem(catId, itemId);
      var name = found ? (found.hName || found.eName || itemId) : itemId;
      var a = el('a', 'link-pill', name);
      a.href = '#/' + catId + '/' + encodeURIComponent(itemId);
      a.setAttribute('data-route', 'reader');
      a.setAttribute('data-cat', catId);
      a.setAttribute('data-id', itemId);
      links.appendChild(a);
    });
    dom.categoryList.appendChild(links);
  }

  /** Highlight the sidebar entry matching the current route. */
  function syncNavActive(route) {
    var pills = dom.categoryList.querySelectorAll('.link-pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');

    var details = dom.categoryList.querySelectorAll('details.category-item');
    for (var d = 0; d < details.length; d++) details[d].classList.remove('cat-active');

    // Highlight the matching lens tab
    var tabs = dom.navPanel.querySelectorAll('.lens-tab');
    var lensMap = { path: 'path', 'path-step': 'path', index: 'index',
      letter: 'index', fav: 'mine', reader: 'browse', category: 'browse', home: 'browse',
      kids: 'browse', 'kids-game': 'browse' };
    var activeLens = lensMap[route.type] || state.activeLens;
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].classList.toggle('is-active', tabs[t].getAttribute('data-lens') === activeLens);
    }

    if (!route) return;

    if (route.type === 'reader' || route.type === 'category') {
      var target = dom.categoryList.querySelector('details[data-cat="' + route.cat + '"]');
      if (target) {
        target.classList.add('cat-active');
        if (route.type === 'reader') {
          var pill = target.querySelector('.link-pill[data-id="' +
            (window.CSS && CSS.escape ? CSS.escape(route.id) : route.id) + '"]');
          if (pill) pill.classList.add('active');
        }
        if (route.type === 'reader' && isMobile()) target.open = true;
      }
    }

    if (route.type === 'path-step') {
      var stepTarget = dom.categoryList.querySelector('details[data-path-step="' + route.step + '"]');
      if (stepTarget) {
        stepTarget.classList.add('cat-active');
        if (isMobile()) stepTarget.open = true;
      }
    }

    if (route.type === 'kids' || route.type === 'kids-game') {
      var kidsTarget = dom.categoryList.querySelector('details.kids-category');
      if (kidsTarget) {
        kidsTarget.classList.add('cat-active');
        if (route.type === 'kids-game') {
          var gamePill = kidsTarget.querySelector('.link-pill[data-id="' + route.game + '"]');
          if (gamePill) gamePill.classList.add('active');
        }
        if (isMobile()) kidsTarget.open = true;
      }
    }
  }

  /* ---------------------------------------------------------
   * Hash router — #/ , #/cat , #/cat/id , #/path , #/path/step ,
   *               #/index , #/index/letter , #/fav
   * ------------------------------------------------------- */
  function parseHash() {
    var raw = String(window.location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean).map(decodeURIComponent);

    if (parts.length === 0) return { type: 'home' };
    if (parts[0] === 'path') {
      if (parts.length >= 2) return { type: 'path-step', step: parts[1] };
      return { type: 'path' };
    }
    if (parts[0] === 'index') {
      if (parts.length >= 2) return { type: 'letter', letter: parts[1] };
      return { type: 'index' };
    }
    if (parts[0] === 'fav') return { type: 'fav' };
    if (parts[0] === 'kids') {
      if (parts.length >= 2) return { type: 'kids-game', game: parts[1] };
      return { type: 'kids' };
    }
    if (parts.length === 1) return { type: 'category', cat: parts[0] };
    return { type: 'reader', cat: parts[0], id: parts[1] };
  }

  function navigateTo(hash) {
    if (window.location.hash === hash) router();
    else window.location.hash = hash;
  }

  function router() {
    if (!state.ready) return;
    var route = parseHash();
    hideSearchResults();

    if (route.type === 'path') {
      renderPathView();
    } else if (route.type === 'path-step') {
      renderPathStepView(route.step);
    } else if (route.type === 'index') {
      renderIndexView();
    } else if (route.type === 'letter') {
      renderLetterView(route.letter);
    } else if (route.type === 'fav') {
      renderFavView();
    } else if (route.type === 'kids') {
      renderKidsView();
    } else if (route.type === 'kids-game') {
      renderKidsGameView(route.game);
    } else if (route.type === 'category' && categoryById(route.cat)) {
      renderCategoryView(route.cat);
    } else if (route.type === 'reader' && categoryById(route.cat)) {
      renderReaderView(route.cat, route.id);
    } else {
      renderHomeView();
      route = { type: 'home' };
    }

    syncNavActive(route);
    if (isMobile()) closeNav();
  }

  /* ---------------------------------------------------------
   * Panchang Patra — today's lunar almanac strip
   * ------------------------------------------------------- */
  var panchangFetchPromise = null;

  function fetchPanchangData() {
    if (state.panchangData) return Promise.resolve(state.panchangData);
    if (panchangFetchPromise) return panchangFetchPromise;
    panchangFetchPromise = fetch(CONTENT_DIR + 'panchang.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) state.panchangData = data;
        return data;
      })
      .catch(function () { return null; });
    return panchangFetchPromise;
  }

  function buildMoonSVG(illumination, waxing) {
    var R = 46, cx = 50, cy = 50;
    var f = illumination;
    if (f < 0.02) {
      return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#2A1A0A"/>'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#554430" stroke-width="1"/>'
        + '</svg>';
    }
    if (f > 0.98) {
      return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#F5E6C8"/>'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#D4B88A" stroke-width="0.5"/>'
        + '</svg>';
    }
    var rx = R * Math.abs(1 - 2 * f);
    var shadowLeft = waxing;
    var path;
    if (shadowLeft) {
      path = 'M' + cx + ',' + (cy - R)
        + ' A' + R + ',' + R + ' 0 1,0 ' + cx + ',' + (cy + R)
        + ' A' + rx.toFixed(1) + ',' + R + ' 0 0,' + (f < 0.5 ? '0' : '1') + ' ' + cx + ',' + (cy - R)
        + ' Z';
    } else {
      path = 'M' + cx + ',' + (cy - R)
        + ' A' + R + ',' + R + ' 0 1,1 ' + cx + ',' + (cy + R)
        + ' A' + rx.toFixed(1) + ',' + R + ' 0 0,' + (f < 0.5 ? '1' : '0') + ' ' + cx + ',' + (cy - R)
        + ' Z';
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#F5E6C8"/>'
      + '<path d="' + path + '" fill="#2A1A0A"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#D4B88A" stroke-width="0.5"/>'
      + '</svg>';
  }

  /* ---------------------------------------------------------
   * View: Home — catalogue overview
   * ------------------------------------------------------- */
  function renderTodayStrip() {
    if (!Panchang || !state.panchangData) return null;
    var info = Panchang.getTodayInfo(new Date(), state.panchangData);
    var ld = info.lunar;
    if (!ld) return null;

    var section = el('section', 'panchang-patra');
    section.setAttribute('aria-label', 'आज का पंचांग');

    var header = el('div', 'patra-header');
    header.appendChild(el('h3', 'patra-title', 'पंचांग पत्र'));
    var ds = ld.date.getDate() + '/' + (ld.date.getMonth() + 1) + '/' + ld.date.getFullYear();
    header.appendChild(el('time', 'patra-date', ds));
    section.appendChild(header);

    var body = el('div', 'patra-body');
    var moonDiv = el('div', 'patra-moon');
    moonDiv.innerHTML = buildMoonSVG(ld.illumination, ld.waxing);
    moonDiv.setAttribute('role', 'img');
    moonDiv.setAttribute('aria-label', 'चन्द्रमा ' + Math.round(ld.illumination * 100) + '% प्रकाशित');
    body.appendChild(moonDiv);

    var infoDiv = el('div', 'patra-info');
    infoDiv.appendChild(el('div', 'patra-tithi', ld.tithiDev + ' · ' + ld.pakshaH));
    infoDiv.appendChild(el('div', 'patra-month', ld.monthH + ' · ' + ld.monthLatin));
    if (ld.nakshatra) {
      infoDiv.appendChild(el('div', 'patra-nakshatra', 'नक्षत्र: ' + ld.nakshatra));
    }
    var sv = ld.samvat;
    infoDiv.appendChild(el('div', 'patra-samvat',
      'वी.नि.सं. ' + sv.vns + ' · वि.सं. ' + sv.vs + ' · शाक ' + sv.shaka));
    body.appendChild(infoDiv);
    section.appendChild(body);

    if (info.parvs && info.parvs.length > 0) {
      info.parvs.forEach(function (p) {
        var parvDiv = el('div', 'patra-parv');
        var nameHtml = '';
        if (p.icon) nameHtml += '<span class="patra-parv-icon">' + p.icon + '</span>';
        nameHtml += '<span class="patra-parv-name">' + p.h + '</span>';
        if (p.totalDays > 1) {
          nameHtml += '<span class="patra-parv-day">दिन ' + p.day + '/' + p.totalDays + '</span>';
        }
        var nameEl = el('div');
        nameEl.innerHTML = nameHtml;
        parvDiv.appendChild(nameEl);
        if (p.blurb) parvDiv.appendChild(el('div', 'patra-parv-blurb', p.blurb));
        section.appendChild(parvDiv);
      });
    }

    if (info.kalyanaks && info.kalyanaks.length > 0) {
      info.kalyanaks.forEach(function (k) {
        var kDiv = el('div', 'patra-kalyanak');
        kDiv.innerHTML = '<span class="patra-kalyanak-label">' + k.typeH + '</span>'
          + ' — ' + k.tirthankarH + ' (' + k.tirthankarLatin + ', तीर्थंकर ' + k.no + ')';
        section.appendChild(kDiv);
      });
    }

    return section;
  }

  function totalReadable() {
    var n = 0;
    state.categories.forEach(function (c) { n += (state.readable[c.id] || []).length; });
    return n;
  }

  function renderHomeView() {
    document.title = 'जय जिनेन्द्र बन्धु — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'home-view');

    var hero = el('section', 'home-hero');
    hero.appendChild(el('span', 'om-symbol', '\u2638'));
    var h = el('h2', null, 'जय जिनेन्द्र बन्धु');
    hero.appendChild(h);
    hero.appendChild(el('p', 'hero-sub',
      'जैन धर्म की प्रार्थनाएँ, आरती, स्तोत्र, चालीसा और अन्य भक्ति पाठ — एक ही स्थान पर।'));

    var stat = el('p', 'hero-stat');
    stat.appendChild(el('strong', null, String(totalReadable())));
    stat.appendChild(document.createTextNode(' पठनीय पाठ · '));
    stat.appendChild(el('strong', null, String(state.searchIndex.length)));
    stat.appendChild(document.createTextNode(' शीर्षक · '));
    stat.appendChild(el('strong', null, String(state.categories.length)));
    stat.appendChild(document.createTextNode(' खंड'));
    hero.appendChild(stat);
    wrap.appendChild(hero);

    /* Panchang Patra — non-fatal: if panchang.js or the data file
     * is unavailable the strip is simply omitted. */
    if (Panchang) {
      fetchPanchangData().then(function (data) {
        if (!data) return;
        /* Re-check we're still on the home view before inserting. */
        if (!wrap.parentNode) return;
        var strip = renderTodayStrip();
        if (strip) {
          /* Insert after hero, before the grid title. */
          var gridTitle = wrap.querySelector('.section-title');
          wrap.insertBefore(strip, gridTitle || null);
        }
      });
    }

    var gridTitle = el('h3', 'section-title', 'विषय चुनें');
    wrap.appendChild(gridTitle);

    var grid = el('div', 'cat-grid');
    state.categories.forEach(function (cat) {
      var all = state.items[cat.id] || [];
      var ready = state.readable[cat.id] || [];

      var card = el('a', 'cat-card' + (ready.length ? '' : ' cat-card-empty'));
      card.href = '#/' + cat.id;
      card.setAttribute('data-route', 'category');

      card.appendChild(el('span', 'cat-card-icon', cat.icon || ''));
      card.appendChild(el('span', 'cat-card-label', cat.label));

      var meta = el('span', 'cat-card-meta');
      if (ready.length) {
        meta.textContent = ready.length + ' पठनीय पाठ';
      } else {
        meta.textContent = all.length + ' शीर्षक · शीघ्र आ रहे हैं';
      }
      card.appendChild(meta);

      if (ready.length) {
        var peek = el('span', 'cat-card-peek', ready[0].hName || ready[0].eName || '');
        card.appendChild(peek);
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    /* Kids Learning banner — deliberately OUTSIDE .cat-grid so the category
     * card count (and its test assertion) is unaffected. */
    var kidsGames = Kids.getGames();
    if (kidsGames.length) {
      var kPrefs = Kids.readPrefs();
      var kCopy = Kids.hubCopy(kPrefs.lang === 'en' ? 'en' : 'hi');
      var banner = el('a', 'kids-banner');
      banner.href = '#/kids';
      banner.setAttribute('data-route', 'kids');
      var bMark = el('span', 'kids-banner-mark');
      bMark.appendChild(kidsSwastikaSVG());
      banner.appendChild(bMark);
      var bCopy = el('span', 'kids-banner-copy');
      bCopy.appendChild(el('strong', null, kCopy.bannerTitle));
      bCopy.appendChild(el('span', null, kCopy.bannerBlurb));
      banner.appendChild(bCopy);
      banner.appendChild(el('span', 'kids-banner-chip',
        Kids.fill(kCopy.bannerChip, {
          n: kPrefs.lang === 'en' ? String(kidsGames.length) : Kids.toDevNum(kidsGames.length)
        })));
      wrap.appendChild(banner);
    }

    dom.main.appendChild(wrap);
  }

  /** Render a <ul class="item-list"> of reader links for the given items. */
  function buildItemList(catId, items) {
    var list = el('ul', 'item-list');
    items.forEach(function (item) {
      var li = el('li', 'item-row');
      var a = el('a', 'item-link');
      a.href = '#/' + catId + '/' + encodeURIComponent(item._id);
      a.setAttribute('data-route', 'reader');
      a.appendChild(el('span', 'item-name', item.hName || item.eName || item._id));
      if (!isPlaceholder(item.hAuth)) {
        a.appendChild(el('span', 'item-author', 'रचियता: ' + item.hAuth));
      }
      a.appendChild(el('span', 'item-go', 'पढ़ें ›'));
      li.appendChild(a);
      list.appendChild(li);
    });
    return list;
  }

  /* ---------------------------------------------------------
   * View: Category — full title list (grouped by subcategory)
   * ------------------------------------------------------- */
  function renderCategoryView(catId) {
    var cat = categoryById(catId);
    if (!cat) { renderHomeView(); return; }

    var all = state.items[catId] || [];
    var ready = state.readable[catId] || [];

    document.title = cat.label + ' — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'cat-view');

    var head = el('header', 'cat-view-head');
    var crumb = el('nav', 'breadcrumb', '');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', cat.label));
    head.appendChild(crumb);

    var title = el('h2', 'cat-view-title');
    title.appendChild(el('span', 'cat-view-icon', cat.icon || ''));
    title.appendChild(document.createTextNode(' ' + cat.label));
    head.appendChild(title);

    head.appendChild(el('p', 'cat-view-sub',
      ready.length + ' पठनीय पाठ उपलब्ध · कुल ' + all.length + ' शीर्षक'));
    wrap.appendChild(head);

    if (ready.length) {
      // Group by subcategory when items carry a `sub` label
      // (e.g. ग्रन्थ → टीका / गाथा / अंग्रेज़ी ग्रन्थ).
      var hasSubs = ready.some(function (i) { return !!i.sub; });
      if (hasSubs) {
        var groups = {}, order = [];
        ready.forEach(function (item) {
          var s = item.sub || 'अन्य';
          if (!groups[s]) { groups[s] = []; order.push(s); }
          groups[s].push(item);
        });
        order.forEach(function (subName) {
          wrap.appendChild(el('h3', 'section-title subcat-title',
            subName + ' (' + groups[subName].length + ')'));
          wrap.appendChild(buildItemList(catId, groups[subName]));
        });
      } else {
        wrap.appendChild(el('h3', 'section-title', 'पढ़ने योग्य पाठ'));
        wrap.appendChild(buildItemList(catId, ready));
      }
    } else {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('p', null, 'इस खंड में अभी कोई पठनीय सामग्री उपलब्ध नहीं है।'));
      empty.appendChild(el('p', 'empty-sub', 'नीचे दिए गए शीर्षक शीघ्र ही जोड़े जाएँगे।'));
      wrap.appendChild(empty);
    }

    var pending = all.filter(function (i) { return !hasContent(i); });
    if (pending.length) {
      wrap.appendChild(el('h3', 'section-title', 'शीघ्र आ रहे हैं (' + pending.length + ')'));
      var soon = el('ul', 'item-list item-list-soon');
      pending.forEach(function (item) {
        var li = el('li', 'item-row item-row-disabled');
        li.appendChild(el('span', 'item-name', item.hName || item.eName || item._id));
        li.appendChild(el('span', 'item-soon-tag', 'जल्द'));
        soon.appendChild(li);
      });
      wrap.appendChild(soon);
    }

    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Path — daily worship sequence
   * ------------------------------------------------------- */
  function renderPathView() {
    if (!state.navReady || !window.Nav) {
      renderHomeView();
      return;
    }
    document.title = 'नित्य पूजा क्रम — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'path-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', 'नित्य पूजा क्रम'));
    wrap.appendChild(crumb);

    var hero = el('section', 'home-hero');
    hero.style.marginBottom = '20px';
    hero.appendChild(el('span', 'om-symbol', '\uD83E\uDE94'));
    hero.appendChild(el('h2', null, 'नित्य पूजा क्रम'));
    hero.appendChild(el('p', 'hero-sub',
      'पारम्परिक दैनिक पूजा का क्रम — पहले मंगल, फिर प्रतिक्रमण, अन्त में क्षमापना।'));
    wrap.appendChild(hero);

    var steps = Nav.getPathSteps();
    var stepper = el('div', 'path-stepper');
    steps.forEach(function (step, idx) {
      var card = el('a', 'path-step-card');
      card.href = '#/path/' + step.id;
      card.setAttribute('data-route', 'path-step');

      card.appendChild(el('span', 'path-step-num', String(idx + 1)));

      var info = el('div', 'path-step-info');
      info.appendChild(el('span', 'path-step-label', step.label));
      if (step.latin) info.appendChild(el('span', 'path-step-meta', step.latin));
      card.appendChild(info);

      card.appendChild(el('span', 'path-step-count', step.count + ' पाठ'));

      stepper.appendChild(card);
    });
    wrap.appendChild(stepper);
    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Path Step — items within a single worship step
   * ------------------------------------------------------- */
  function renderPathStepView(stepId) {
    if (!state.navReady || !window.Nav) {
      renderHomeView();
      return;
    }
    var step = Nav.getPathStep(stepId);
    if (!step || step.length === 0) {
      renderPathView();
      return;
    }
    var steps = Nav.getPathSteps();
    var stepMeta = null;
    var stepIdx = -1;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].id === stepId) { stepMeta = steps[i]; stepIdx = i; break; }
    }
    var title = stepMeta ? stepMeta.label : stepId;
    document.title = title + ' — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'path-step-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    var cPath = el('a', null, 'नित्य क्रम');
    cPath.href = '#/path';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(cPath);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', title));
    wrap.appendChild(crumb);

    var head = el('div', 'path-step-header');
    head.appendChild(el('h2', null, (stepIdx >= 0 ? (stepIdx + 1) + '. ' : '') + title));
    if (stepMeta && stepMeta.latin) {
      head.appendChild(el('p', null, stepMeta.latin));
    }
    if (steps.length > 0) {
      var pct = Math.round(((stepIdx + 1) / steps.length) * 100);
      var prog = el('div', 'path-progress');
      var bar = el('div', 'path-progress-bar');
      var fill = el('div', 'path-progress-fill');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      prog.appendChild(bar);
      prog.appendChild(el('span', 'path-progress-text',
        'चरण ' + (stepIdx + 1) + ' / ' + steps.length));
      head.appendChild(prog);
    }
    wrap.appendChild(head);

    // Render items grouped by category
    var byCat = {};
    var catOrder = [];
    step.forEach(function (item) {
      var c = item.catId || 'other';
      if (!byCat[c]) { byCat[c] = []; catOrder.push(c); }
      byCat[c].push(item);
    });
    catOrder.forEach(function (catId) {
      var cat = categoryById(catId);
      var catLabel = cat ? (cat.icon || '') + ' ' + cat.label : catId;
      wrap.appendChild(el('h3', 'section-title', catLabel + ' (' + byCat[catId].length + ')'));
      wrap.appendChild(buildItemList(catId, byCat[catId]));
    });

    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Index — Devanagari letter grid
   * ------------------------------------------------------- */
  function renderIndexView() {
    if (!state.navReady || !window.Nav) {
      renderHomeView();
      return;
    }
    document.title = 'अक्षर माला — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'index-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', 'अक्षर माला'));
    wrap.appendChild(crumb);

    var hero = el('section', 'home-hero');
    hero.style.marginBottom = '20px';
    hero.appendChild(el('span', 'om-symbol', '\uD83D\uDD24'));
    hero.appendChild(el('h2', null, 'अक्षर माला'));
    hero.appendChild(el('p', 'hero-sub',
      'हिन्दी अक्षर के अनुसार सभी पाठ खोजें — अ से ह तक।'));
    wrap.appendChild(hero);

    var letters = Nav.getLetters();
    var grid = el('div', 'letter-grid');
    letters.forEach(function (l) {
      var cell = el('a', 'letter-cell');
      cell.href = '#/index/' + encodeURIComponent(l.letter);
      cell.setAttribute('data-route', 'letter');
      cell.appendChild(el('span', 'letter-char', l.letter));
      cell.appendChild(el('span', 'letter-count', l.count));
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Letter — items starting with a specific letter
   * ------------------------------------------------------- */
  function renderLetterView(letter) {
    if (!state.navReady || !window.Nav) {
      renderHomeView();
      return;
    }
    var items = Nav.getLetterIndex(letter);
    if (!items || items.length === 0) {
      renderIndexView();
      return;
    }
    document.title = letter + ' — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'letter-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    var cIdx = el('a', null, 'अक्षर माला');
    cIdx.href = '#/index';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(cIdx);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', letter));
    wrap.appendChild(crumb);

    var head = el('div', 'letter-header');
    head.appendChild(el('span', 'letter-header-char', letter));
    var info = el('div', 'letter-header-info');
    info.appendChild(el('h2', null, letter + ' से शुरू होने वाले पाठ'));
    info.appendChild(el('p', null, items.length + ' पाठ उपलब्ध'));
    head.appendChild(info);
    wrap.appendChild(head);

    // Group items by category
    var byCat = {};
    var catOrder = [];
    items.forEach(function (item) {
      var c = item.catId || 'other';
      if (!byCat[c]) { byCat[c] = []; catOrder.push(c); }
      byCat[c].push(item);
    });
    catOrder.forEach(function (catId) {
      var cat = categoryById(catId);
      var catLabel = cat ? (cat.icon || '') + ' ' + cat.label : catId;
      wrap.appendChild(el('h3', 'section-title', catLabel + ' (' + byCat[catId].length + ')'));
      wrap.appendChild(buildItemList(catId, byCat[catId]));
    });

    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Favorites — user's starred items
   * ------------------------------------------------------- */
  function renderFavView() {
    if (!state.navReady || !window.Nav) {
      renderHomeView();
      return;
    }
    document.title = 'प्रिय पाठ — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'mine-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', 'प्रिय पाठ'));
    wrap.appendChild(crumb);

    var favIds = Nav.getFavs();
    if (favIds.length === 0) {
      var empty = el('div', 'fav-empty-state');
      empty.appendChild(el('span', 'fav-empty-icon', '⭐'));
      empty.appendChild(el('h3', null, 'अभी कोई प्रिय पाठ नहीं'));
      empty.appendChild(el('p', null,
        'कोई भी पाठ पढ़ते समय ⭐ बटन दबाकर उसे अपने प्रिय पाठों में जोड़ें।'));
      wrap.appendChild(empty);
    } else {
      var hero = el('section', 'home-hero');
      hero.style.marginBottom = '20px';
      hero.appendChild(el('span', 'om-symbol', '⭐'));
      hero.appendChild(el('h2', null, 'मेरे प्रिय पाठ'));
      hero.appendChild(el('p', 'hero-sub',
        favIds.length + ' पाठ आपके प्रिय हैं।'));
      wrap.appendChild(hero);

      // Group favorites by category
      var byCat = {};
      var catOrder = [];
      favIds.forEach(function (favId) {
        var parts = favId.split('::');
        if (parts.length < 2) return;
        var catId = parts[0];
        if (!byCat[catId]) { byCat[catId] = []; catOrder.push(catId); }
        var found = findItem(catId, parts[1]);
        if (found) byCat[catId].push(found);
      });

      catOrder.forEach(function (catId) {
        var cat = categoryById(catId);
        var catLabel = cat ? (cat.icon || '') + ' ' + cat.label : catId;
        wrap.appendChild(el('h3', 'section-title',
          catLabel + ' (' + byCat[catId].length + ')'));
        wrap.appendChild(buildItemList(catId, byCat[catId]));
      });
    }

    dom.main.appendChild(wrap);
  }

  /* ---------------------------------------------------------
   * View: Kids Learning (बाल शिक्षा) — hub + game frame
   *
   * Each game is a single self-contained offline .html file under
   * games/. They are embedded in a same-origin <iframe> so their own
   * palette, CSS reset and class names can never collide with the
   * app's, while still sharing localStorage with the hub leaderboard.
   * ------------------------------------------------------- */

  /** Jain Swastika — drawn as SVG paths so no font can ever mirror it. */
  function kidsSwastikaSVG(size) {
    var s = 'fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="square"';
    var inner =
      '<g transform="translate(0,2)">' +
        '<path ' + s + ' d="M26 22 H42 V38"/>' +
        '<path ' + s + ' d="M42 26 V42 H26"/>' +
        '<path ' + s + ' d="M38 42 H22 V26"/>' +
        '<path ' + s + ' d="M22 38 V22 H38"/>' +
      '</g>' +
      '<circle cx="26" cy="52" r="2.3" fill="currentColor"/>' +
      '<circle cx="32" cy="54.4" r="2.3" fill="currentColor"/>' +
      '<circle cx="38" cy="52" r="2.3" fill="currentColor"/>' +
      '<path d="M22 12 A12 12 0 0 0 42 12 A10 10 0 0 1 22 12 Z" fill="currentColor"/>' +
      '<circle cx="32" cy="5.4" r="2.4" fill="currentColor"/>';
    var box = el('span', null);
    box.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" ' +
      'xmlns="http://www.w3.org/2000/svg"' +
      (size ? ' width="' + size + '" height="' + size + '"' : '') + '>' + inner + '</svg>';
    return box.firstChild;
  }

  /** The menu section appended last in every lens of the sidebar. */
  function buildKidsMenuSection() {
    var games = Kids.getGames();
    if (!games.length) return null;

    var prefs = Kids.readPrefs();
    var copy = Kids.hubCopy(prefs.lang === 'en' ? 'en' : 'hi');

    var details = el('details', 'category-item kids-category');
    details.setAttribute('data-kids', '1');

    var summary = el('summary', 'category-header nav-kids-summary');
    var icon = el('span', 'cat-icon', '\uD83E\uDEB7');
    icon.setAttribute('aria-hidden', 'true');
    summary.appendChild(icon);
    summary.appendChild(el('span', 'cat-label',
      copy.navLabel + ' · ' + copy.navLatin));
    var badge = el('span', 'cat-count', String(games.length));
    badge.title = games.length + ' games';
    badge.setAttribute('aria-label', games.length +
      (prefs.lang === 'en' ? ' games' : ' खेल'));
    summary.appendChild(badge);

    var links = el('div', 'category-links');
    links.id = 'cat-links-kids';
    games.forEach(function (game) {
      var a = el('a', 'link-pill');
      var gi = el('span', 'kids-pill-icon', game.icon || '');
      gi.setAttribute('aria-hidden', 'true');
      a.appendChild(gi);
      a.appendChild(document.createTextNode(prefs.lang === 'en' ? game.en : game.hi));
      a.href = '#/kids/' + game.id;
      a.setAttribute('data-route', 'kids-game');
      a.setAttribute('data-id', game.id);
      a.title = prefs.lang === 'en' ? game.blurbEn : game.blurbHi;
      links.appendChild(a);
    });
    var all = el('a', 'link-pill pill-more',
      prefs.lang === 'en' ? 'All games →' : 'सभी खेल →');
    all.href = '#/kids';
    all.setAttribute('data-route', 'kids');
    links.appendChild(all);

    details.appendChild(summary);
    details.appendChild(links);
    return details;
  }

  /** Relative src so sub-path hosting keeps working. */
  function kidsFrameSrc(game) {
    var prefs = Kids.readPrefs();
    var q = ['embed=1', 'lang=' + (prefs.lang === 'en' ? 'en' : 'hi')];
    if (game.audience) q.push('aud=' + (prefs.aud === 'adults' ? 'adults' : 'kids'));
    return game.file + '?' + q.join('&');
  }

  /** In-page replacement for window.confirm() — safe inside an iframe too. */
  function askKidsDialog(copy, title, body, yesLabel, onYes) {
    var prev = document.querySelector('.kids-dialog');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var wrap = el('div', 'kids-dialog');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    var card = el('div', 'kids-dialog-card');
    card.appendChild(el('h3', null, title));
    card.appendChild(el('p', null, body));

    var actions = el('div', 'kids-dialog-actions');
    var yes = el('button', 'btn btn-primary', yesLabel);
    yes.type = 'button';
    var no = el('button', 'btn btn-ghost', copy.lbConfirmNo);
    no.type = 'button';
    actions.appendChild(yes);
    actions.appendChild(no);
    card.appendChild(actions);
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    function close() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    yes.addEventListener('click', function () { close(); if (onYes) onYes(); });
    no.addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey);
    no.focus();
  }

  /** Shared leaderboard panel: 'all' for the hub, or one gameId. */
  function renderKidsLeaderboardPanel(scope, copy, prefs) {
    var games = Kids.getGames();
    var panel = el('section', 'kids-lb');

    var head = el('div', 'kids-lb-head');
    head.appendChild(el('h3', null, copy.sectionProgress));
    var actions = el('div', 'kids-lb-actions');
    panel.appendChild(head);

    var lang = prefs.lang === 'en' ? 'en' : 'hi';
    var list = (scope === 'all') ? games : games.filter(function (g) { return g.id === scope; });
    var anyRecords = false;

    list.forEach(function (game) {
      var entries = Kids.lbRead(game.id);
      var box = el('div', 'kids-lb-game');
      var h4 = el('h4');
      var ic = el('span', null, game.icon || '');
      ic.setAttribute('aria-hidden', 'true');
      h4.appendChild(ic);
      h4.appendChild(document.createTextNode(' ' + (lang === 'en' ? game.en : game.hi)));
      if (entries.length) {
        anyRecords = true;
        h4.appendChild(el('span', 'kids-lb-best',
          Kids.fill(copy.plays, { n: lang === 'hi' ? Kids.toDevNum(entries.length) : entries.length }) +
          ' · ' + copy.bestLabel + ' ' + Kids.formatDuration(entries[0].duration, lang)));
      }
      box.appendChild(h4);

      if (!entries.length) {
        box.appendChild(el('p', 'kids-lb-empty', copy.noRecord));
      } else {
        var wrap = el('div', 'kids-lb-wrap');
        var tbl = el('table', 'kids-lb-table');
        var thead = el('thead');
        var htr = el('tr');
        [copy.lbRank, copy.lbName, copy.lbLevel, copy.lbTime].forEach(function (h) {
          htr.appendChild(el('th', null, h));
        });
        thead.appendChild(htr);
        tbl.appendChild(thead);
        var tbody = el('tbody');
        var medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
        entries.slice(0, 5).forEach(function (e, i) {
          var tr = el('tr');
          var rank = el('td', i < 3 ? 'kids-lb-medal' : 'kids-lb-rank',
            i < 3 ? medals[i] : String(i + 1));
          tr.appendChild(rank);
          tr.appendChild(el('td', null, e.name || '—'));
          tr.appendChild(el('td', null, Kids.formatLevel(game, e, lang)));
          tr.appendChild(el('td', null, Kids.formatDuration(e.duration, lang)));
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        wrap.appendChild(tbl);
        box.appendChild(wrap);

        var clr = el('button', 'kids-lb-clear', copy.lbClear);
        clr.type = 'button';
        clr.setAttribute('data-kids-clear', game.id);
        clr.addEventListener('click', function () {
          askKidsDialog(copy, copy.lbConfirmTitle, copy.lbConfirmOne, copy.lbClear, function () {
            Kids.lbClear(game.id);
            rerenderKids();
          });
        });
        var clrWrap = el('div', 'kids-lb-actions');
        clrWrap.appendChild(clr);
        box.appendChild(clrWrap);
      }
      panel.appendChild(box);
    });

    if (anyRecords && scope === 'all') {
      var all = el('button', 'kids-lb-clear', copy.lbClearAll);
      all.type = 'button';
      all.addEventListener('click', function () {
        askKidsDialog(copy, copy.lbConfirmTitle, copy.lbConfirmAll, copy.lbClearAll, function () {
          Kids.lbClear();
          rerenderKids();
        });
      });
      actions.appendChild(all);
    }
    head.appendChild(actions);

    if (!Kids.storageAvailable()) {
      panel.appendChild(el('p', 'kids-note', copy.storageOff));
    }
    return panel;
  }

  /** Re-render whichever kids screen is currently showing. */
  function rerenderKids() {
    var route = parseHash();
    if (route.type === 'kids-game') renderKidsGameView(route.game);
    else renderKidsView();
  }


  /** Hub: #/kids — the six games plus the unified on-device leaderboard. */
  function renderKidsView() {
    var prefs = Kids.readPrefs();
    var lang = prefs.lang === 'en' ? 'en' : 'hi';
    var copy = Kids.hubCopy(lang);

    document.title = copy.title + ' — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'kids-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'breadcrumb');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', copy.title));
    wrap.appendChild(crumb);

    var hero = el('section', 'kids-hero');
    var mark = el('span', 'kids-hero-mark');
    mark.appendChild(kidsSwastikaSVG());
    hero.appendChild(mark);
    hero.appendChild(el('h2', null, copy.title));
    hero.appendChild(el('p', null, copy.sub));
    wrap.appendChild(hero);

    wrap.appendChild(el('h3', 'section-title', copy.sectionGames));

    var grid = el('div', 'kids-grid');
    Kids.getGames().forEach(function (game) {
      var card = el('a', 'kids-card');
      card.href = '#/kids/' + game.id;
      card.setAttribute('data-route', 'kids-game');
      card.setAttribute('data-game', game.id);

      var top = el('div', 'kids-card-top');
      var icon = el('span', 'kids-card-icon', game.icon || '');
      icon.setAttribute('aria-hidden', 'true');
      top.appendChild(icon);
      var titles = el('div', 'kids-card-titles');
      titles.appendChild(el('span', 'kids-card-title', lang === 'en' ? game.en : game.hi));
      titles.appendChild(el('span', 'kids-card-en', lang === 'en' ? game.hi : game.en));
      top.appendChild(titles);
      card.appendChild(top);

      card.appendChild(el('p', 'kids-card-blurb',
        lang === 'en' ? game.blurbEn : game.blurbHi));

      var tags = el('div', 'kids-card-tags');
      tags.appendChild(el('span', 'kids-tag', lang === 'en' ? game.tagEn : game.tagHi));
      tags.appendChild(el('span', 'kids-ages',
        copy.agesLabel + ' ' + game.ages));
      card.appendChild(tags);

      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(renderKidsLeaderboardPanel('all', copy, prefs));
    wrap.appendChild(el('p', 'kids-note', copy.offlineNote));
    wrap.appendChild(el('p', 'kids-note', copy.footer));

    dom.main.appendChild(wrap);
  }

  /** Game: #/kids/<gameId> — the standalone file inside a same-origin frame. */
  function renderKidsGameView(gameId) {
    var game = Kids.gameById(gameId);
    if (!game) { renderKidsView(); return; }

    var prefs = Kids.readPrefs();
    var lang = prefs.lang === 'en' ? 'en' : 'hi';
    var copy = Kids.hubCopy(lang);

    Kids.writePrefs({ lastGame: game.id });

    document.title = (lang === 'en' ? game.en : game.hi) + ' — ' + copy.title + ' — जिनभक्त';
    dom.main.innerHTML = '';

    var wrap = el('div', 'kids-game-view');

    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'breadcrumb');
    var cHome = el('a', null, 'मुख्य पृष्ठ');
    cHome.href = '#/';
    crumb.appendChild(cHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    var cHub = el('a', null, copy.title);
    cHub.href = '#/kids';
    crumb.appendChild(cHub);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', lang === 'en' ? game.en : game.hi));
    wrap.appendChild(crumb);

    var bar = el('div', 'kids-game-bar');
    var title = el('div', 'kids-game-title');
    var tIcon = el('span', null, game.icon || '');
    tIcon.setAttribute('aria-hidden', 'true');
    title.appendChild(tIcon);
    title.appendChild(document.createTextNode(' ' + (lang === 'en' ? game.en : game.hi)));
    title.appendChild(el('span', 'kids-game-en', lang === 'en' ? game.hi : game.en));
    bar.appendChild(title);

    var actions = el('div', 'kids-game-actions');
    var reload = el('button', 'kids-frame-reload', copy.reload);
    reload.type = 'button';
    reload.id = 'kids-reload';
    var openNew = el('a', 'kids-frame-open', copy.openNewTab);
    openNew.href = kidsFrameSrc(game);
    openNew.target = '_blank';
    openNew.rel = 'noopener noreferrer';
    actions.appendChild(reload);
    actions.appendChild(openNew);
    bar.appendChild(actions);
    wrap.appendChild(bar);

    var frameBox = el('div', 'kids-game-frame');
    var frame = el('iframe', 'kids-frame');
    frame.id = 'kids-frame';
    frame.setAttribute('src', kidsFrameSrc(game));
    frame.setAttribute('title', Kids.fill(copy.frameTitle,
      { name: lang === 'en' ? game.en : game.hi }));
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frameBox.appendChild(frame);
    wrap.appendChild(frameBox);

    reload.addEventListener('click', function () {
      var f = document.getElementById('kids-frame');
      if (f) f.setAttribute('src', kidsFrameSrc(game) + '&_r=' + Date.now());
    });

    dom.main.appendChild(wrap);
  }



  function renderReaderView(catId, itemId) {
    var cat = categoryById(catId);
    var item = findItem(catId, itemId);

    // Deep link may point at the wrong category — recover it.
    if (!item) {
      var found = findItemAnywhere(itemId);
      if (found && hasContent(found.item)) {
        navigateTo('#/' + found.catId + '/' + encodeURIComponent(found.item._id));
        return;
      }
      renderNotFound(catId, itemId);
      return;
    }

    if (!hasContent(item)) {
      renderUnavailable(cat, item);
      return;
    }

    var siblings = getSiblings(catId, item._id);
    var title = (catId === 'stories-en')
      ? (item.eName || item.hName || item._id)
      : (item.hName || item.eName || item._id);

    document.title = title + ' — जिनभक्त';
    dom.main.innerHTML = '';

    /* This prayer has no text yet — the toggle repaints from `readerRaw`,
     * so it must be emptied first or the previous passage would come back. */
    readerRaw = { body: '', brief: '' };
    readerDevText = '';
    readerLoaded = false;
    readerCatId = catId;

    var art = el('article', 'reader');

    /* --- breadcrumb --- */
    var crumb = el('nav', 'breadcrumb');
    crumb.setAttribute('aria-label', 'ब्रेडक्रम्ब');
    var aHome = el('a', null, 'मुख्य पृष्ठ'); aHome.href = '#/';
    var aCat = el('a', null, cat ? cat.label : catId); aCat.href = '#/' + catId;
    crumb.appendChild(aHome);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(aCat);
    crumb.appendChild(el('span', 'crumb-sep', '›'));
    crumb.appendChild(el('span', 'crumb-current', title));
    art.appendChild(crumb);

    /* --- heading --- */
    var head = el('header', 'reader-head');
    head.appendChild(el('h2', 'reader-title', title));

    var metaBits = [];
    var metaBitsEn = [];
    if (cat) {
      metaBits.push((cat.icon || '') + ' ' + cat.label);
      metaBitsEn.push((cat.icon || '') + ' ' + toRoman(cat.label));
    }
    if (!isPlaceholder(item.hAuth)) {
      metaBits.push('रचियता: ' + item.hAuth);
      metaBitsEn.push('Author: ' + toRoman(item.hAuth));
    }
    if (siblings.total > 1 && siblings.index >= 0) {
      var pos = (siblings.index + 1) + ' / ' + siblings.total;
      metaBits.push(pos);
      metaBitsEn.push(pos);
    }
    if (metaBits.length) {
      var meta = el('p', 'reader-meta');
      meta.appendChild(swapSpan(null, metaBits.join('  ·  '), metaBitsEn.join('  ·  ')));
      head.appendChild(meta);
    }
    art.appendChild(head);

    /* --- actions --- */
    var actions = el('div', 'reader-actions');

    var speakBtn = el('button', 'btn btn-primary', '\uD83D\uDD0A  सुनें');
    speakBtn.id = 'btn-speak';
    speakBtn.type = 'button';
    speakBtn.setAttribute('data-action', 'speak');
    speakBtn.setAttribute('aria-label', 'यह पाठ सुनें');
    actions.appendChild(speakBtn);

    var listBtn = el('a', 'btn btn-ghost');
    listBtn.href = '#/' + catId;
    listBtn.appendChild(swapSpan(null, 'सूची देखें', 'View list'));
    actions.appendChild(listBtn);

    /* Devanagari <-> English letters. Label is kept in both scripts so an
     * English reader can see what it does before turning it on. */
    var translitBtn = el('button', 'btn btn-ghost is-translit' + (translitOn ? ' is-active' : ''));
    translitBtn.type = 'button';
    translitBtn.dataset.action = 'transliterate';
    translitBtn.setAttribute('aria-pressed', translitOn ? 'true' : 'false');
    translitBtn.setAttribute('title', translitOn
      ? 'Showing English letters — tap for Devanagari'
      : 'Show this text in English (Roman) letters');
    translitBtn.innerHTML = '<span data-dev="\uD83D\uDD24  अंग्रेज़ी लिप्यांतरण">\uD83D\uDD24  English Transliterate</span>';
    translitBtn.addEventListener('click', function () { toggleTransliteration(); });
    actions.appendChild(translitBtn);

    /* IAST / Simple style switch — a segmented control shown only while
     * transliteration is on.  Hidden (display:none) in Devanagari view so
     * it leaves the tab order and doesn't crowd the action row. */
    var styleGroup = el('div', 'translit-style-group');
    styleGroup.setAttribute('role', 'group');
    styleGroup.setAttribute('aria-label', 'Transliteration style');
    styleGroup.style.display = translitOn ? '' : 'none';

    var iastBtn = el('button', 'btn btn-ghost btn-style' + (translitStyle === 'iast' ? ' is-active' : ''));
    iastBtn.type = 'button';
    iastBtn.setAttribute('data-action', 'translit-style');
    iastBtn.setAttribute('data-style', 'iast');
    iastBtn.setAttribute('aria-pressed', translitStyle === 'iast' ? 'true' : 'false');
    iastBtn.setAttribute('title', 'Scholarly romanization with diacritics (ṇ, ā, ś…)');
    iastBtn.textContent = 'IAST';
    iastBtn.addEventListener('click', function () { setTranslitStyle('iast'); });
    styleGroup.appendChild(iastBtn);

    var asciiBtn = el('button', 'btn btn-ghost btn-style' + (translitStyle === 'ascii' ? ' is-active' : ''));
    asciiBtn.type = 'button';
    asciiBtn.setAttribute('data-action', 'translit-style');
    asciiBtn.setAttribute('data-style', 'ascii');
    asciiBtn.setAttribute('aria-pressed', translitStyle === 'ascii' ? 'true' : 'false');
    asciiBtn.setAttribute('title', 'Plain ASCII romanization (no diacritics)');
    asciiBtn.textContent = 'Simple';
    asciiBtn.addEventListener('click', function () { setTranslitStyle('ascii'); });
    styleGroup.appendChild(asciiBtn);

    actions.appendChild(styleGroup);

    var topBtn = el('button', 'btn btn-ghost is-translit');
    topBtn.type = 'button';
    topBtn.setAttribute('data-action', 'top');
    topBtn.setAttribute('aria-label', translitOn ? 'Back to top' : 'ऊपर जाएं');
    topBtn.appendChild(swapSpan(null, '↑ ऊपर', '↑ Top'));
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actions.appendChild(topBtn);

    /* Fav / star button (only when Nav engine is available) */
    if (state.navReady && window.Nav) {
      var favId = catId + '::' + item._id;
      var isFav = Nav.isFav(favId);
      var favBtn = el('button', 'btn-fav' + (isFav ? ' is-fav' : ''));
      favBtn.type = 'button';
      favBtn.setAttribute('data-action', 'fav');
      favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      favBtn.setAttribute('title', isFav ? 'प्रिय से हटाएँ' : 'प्रिय में जोड़ें');
      favBtn.appendChild(el('span', 'btn-fav-icon', isFav ? '⭐' : '☆'));
      favBtn.appendChild(el('span', null, isFav ? 'प्रिय' : 'जोड़ें'));
      favBtn.addEventListener('click', function () {
        var added = Nav.toggleFav(favId);
        favBtn.classList.toggle('is-fav', added);
        favBtn.setAttribute('aria-pressed', added ? 'true' : 'false');
        favBtn.setAttribute('title', added ? 'प्रिय से हटाएँ' : 'प्रिय में जोड़ें');
        favBtn.querySelector('.btn-fav-icon').textContent = added ? '⭐' : '☆';
        favBtn.querySelector('span:last-child').textContent = added ? 'प्रिय' : 'जोड़ें';
        // Refresh Mine lens sidebar if it's currently active
        if (state.activeLens === 'mine') renderLensContent('mine');
      });
      actions.appendChild(favBtn);
    }

    art.appendChild(actions);

    /* --- body (filled lazily from content/text/<cat>/<cref>.json) --- */
    var body = el('div', 'prayer-body');
    body.id = 'prayer-body';
    body.appendChild(el('p', 'reader-loading', translitOn ? 'Loading…' : 'पाठ लोड हो रहा है…'));
    art.appendChild(body);

    var briefSlot = el('div', 'reader-brief-slot');
    briefSlot.id = 'reader-brief-slot';
    art.appendChild(briefSlot);

    /* --- prev / next --- */
    if (siblings.prev || siblings.next) {
      var nav = el('nav', 'reader-nav');
      nav.setAttribute('aria-label', translitOn ? 'Prayer navigation' : 'पाठ नेविगेशन');

      if (siblings.prev) {
        var pv = el('a', 'nav-btn nav-prev');
        pv.href = '#/' + catId + '/' + encodeURIComponent(siblings.prev._id);
        pv.appendChild(swapSpan('nav-btn-dir', '← पिछला', '← Previous'));
        pv.appendChild(el('span', 'nav-btn-name', siblings.prev.hName || siblings.prev.eName));
        nav.appendChild(pv);
      } else {
        nav.appendChild(el('span', 'nav-btn nav-btn-placeholder'));
      }

      if (siblings.next) {
        var nx = el('a', 'nav-btn nav-next');
        nx.href = '#/' + catId + '/' + encodeURIComponent(siblings.next._id);
        nx.appendChild(swapSpan('nav-btn-dir', 'अगला →', 'Next →'));
        nx.appendChild(el('span', 'nav-btn-name', siblings.next.hName || siblings.next.eName));
        nav.appendChild(nx);
      } else {
        nav.appendChild(el('span', 'nav-btn nav-btn-placeholder'));
      }

      art.appendChild(nav);
    }

    dom.main.appendChild(art);
    window.scrollTo({ top: 0, behavior: 'auto' });

    /* --- fetch this prayer's body on demand (lazy) --- */
    var token = ++readerToken;
    loadItemContent(catId, item).then(function (data) {
      if (token !== readerToken) return;            // user navigated away — ignore
      if (!document.getElementById('prayer-body')) return;

      // Keep the untouched source: the toggle repaints from these strings.
      readerRaw.body = (data && data.hCont) ? data.hCont : '';
      readerRaw.brief = (data && !isPlaceholder(data.hBrief)) ? data.hBrief : '';
      readerLoaded = true;

      paintReaderContent();                          // honours the current script choice

      // Re-apply speech highlighting if audio was already playing this text.
      if (window.jinbhaktSpeech && typeof window.jinbhaktSpeech.isSpeaking === 'function' &&
          window.jinbhaktSpeech.isSpeaking() && typeof window.jinbhaktSpeech.highlightSegment === 'function') {
        window.jinbhaktSpeech.highlightSegment(0);
      }
    }).catch(function (err) {
      if (token !== readerToken) return;
      readerLoaded = false;
      readerRaw = { body: '', brief: '' };
      readerDevText = '';
      var b = document.getElementById('prayer-body');
      if (b) { b.innerHTML = ''; b.appendChild(el('p', 'reader-error', 'पाठ लोड नहीं हो सका। कृपया पुनः प्रयास करें।')); }
      console.error('[JinBhakt] content load failed for ' + catId + '/' + contentRef(item) + ':', err);
    });
  }

  function renderUnavailable(cat, item) {
    document.title = (item.hName || item._id) + ' — जिनभक्त';
    dom.main.innerHTML = '';
    var box = el('div', 'empty-state');
    box.appendChild(el('span', 'empty-icon', '\uD83D\uDCD6'));
    box.appendChild(el('h2', null, item.hName || item.eName || item._id));
    box.appendChild(el('p', null, 'यह पाठ अभी तैयार किया जा रहा है।'));
    box.appendChild(el('p', 'empty-sub', 'कृपया शीघ्र ही पुनः देखें।'));
    if (cat) {
      var back = el('a', 'btn btn-primary', cat.label + ' की सूची देखें');
      back.href = '#/' + cat.id;
      back.style.marginTop = '16px';
      box.appendChild(back);
    }
    dom.main.appendChild(box);
  }

  function renderNotFound(catId, itemId) {
    document.title = 'नहीं मिला — जिनभक्त';
    dom.main.innerHTML = '';
    var box = el('div', 'empty-state');
    box.appendChild(el('span', 'empty-icon', '\uD83D\uDD0D'));
    box.appendChild(el('h2', null, 'सामग्री नहीं मिली'));
    box.appendChild(el('p', null, '"' + (itemId || '') + '" इस खंड में उपलब्ध नहीं है।'));
    var home = el('a', 'btn btn-primary', 'मुख्य पृष्ठ पर जाएँ');
    home.href = '#/';
    home.style.marginTop = '16px';
    box.appendChild(home);
    dom.main.appendChild(box);
  }





  /* ---------------------------------------------------------
   * Search — over the complete in-memory index
   * ------------------------------------------------------- */
  var searchTimer = null;
  var searchCache = { q: null, r: null };
  var MAX_RESULTS = 30;
  var SEARCH_DEBOUNCE = 140;

  /** Tiny filler words that add noise to a multi-word query. */
  var STOPWORDS = {
    ki: 1, ka: 1, ke: 1, the: 1, of: 1, and: 1, or: 1, to: 1, in: 1, for: 1,
    a: 1, an: 1, hai: 1, me: 1, ek: 1, aur: 1, on: 1, at: 1, is: 1, it: 1,
    with: 1, by: 1, ne: 1, hi: 1, ho: 1, he: 1
  };

  function handleSearch() {
    var q = dom.searchInput.value.trim();
    if (!q) { hideSearchResults(); return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { runSearch(q); }, SEARCH_DEBOUNCE);
  }

  /** Folded spellings with one character removed — the cheap typo probe. */
  function dropOneVariants(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var v = s.slice(0, i) + s.slice(i + 1);
      if (v.length >= 4 && out.indexOf(v) === -1) out.push(v);
    }
    return out;
  }

  /** Split a raw query into phonetic tokens (stopwords dropped when redundant). */
  function analyzeQuery(query) {
    var parts = String(query == null ? '' : query).trim().split(/\s+/);
    var toks = [];
    for (var i = 0; i < parts.length; i++) {
      var t = T.analyzeToken(parts[i]);
      if (!t) continue;
      // Only long tokens earn typo tolerance; on short ones a single dropped
      // character is too loose and would drag in the whole catalogue.
      t.d1 = (t.lt && t.lt.length >= 6) ? dropOneVariants(t.lt) : null;
      toks.push(t);
    }
    if (toks.length >= 2) {
      var kept = toks.filter(function (t) { return !STOPWORDS[t.lt]; });
      if (kept.length) toks = kept;
    }
    return toks;
  }

  /** Does any word inside `hay` begin with `needle`? */
  function wordStart(hay, needle) {
    var idx = hay.indexOf(needle);
    while (idx !== -1) {
      if (idx === 0 || hay.charAt(idx - 1) === ' ') return true;
      idx = hay.indexOf(needle, idx + 1);
    }
    return false;
  }

  /** Cheap pre-filter: could this token possibly occur anywhere in the entry? */
  function blobMightMatch(entry, tok) {
    var i;
    for (i = 0; i < tok.lts.length; i++) {
      if (tok.lts[i] && entry.b.lt.indexOf(tok.lts[i]) !== -1) return true;
    }
    if (tok.dn && entry.b.dn.indexOf(tok.dn) !== -1) return true;
    if (tok.sk && tok.sk.length >= 4 && entry.b.sk.indexOf(tok.sk) !== -1) return true;
    // Typo probe — without this the Levenshtein tier in scoreField() is
    // unreachable, because a misspelling never survives the checks above.
    if (tok.d1) {
      for (i = 0; i < tok.d1.length; i++) {
        if (entry.b.lt.indexOf(tok.d1[i]) !== -1) return true;
      }
    }
    return false;
  }

  /**
   * Score one query token against one weighted field.
   * Lower is better; Infinity means "no relation at all".
   *
   * Tiers (field-relative):
   *    0 exact · 8 prefix · 16 word-prefix · 20 reverse-prefix
   *   28 substring · 34/42/50 consonant-skeleton · 60 fuzzy typo
   */
  function scoreField(tok, hay) {
    var w = hay.w * 8;
    var best = Infinity;
    var i, j, hv, tv, sc;

    // 1. Direct script match — a Devanagari query against a Devanagari title.
    if (tok.dn && hay.dn) {
      if (hay.dn === tok.dn) return w;
      if (hay.dn.indexOf(tok.dn) === 0) sc = 8;
      else if (wordStart(hay.dn, tok.dn)) sc = 16;
      else if (hay.dn.indexOf(tok.dn) !== -1) sc = 28;
      else sc = Infinity;
      if (sc < best) best = sc;
    }

    // 2. Romanized match — the transliteration bridge.
    for (i = 0; i < hay.lts.length; i++) {
      hv = hay.lts[i];
      if (!hv) continue;
      for (j = 0; j < tok.lts.length; j++) {
        tv = tok.lts[j];
        if (!tv) continue;
        if (hv === tv) sc = 0;
        else if (hv.indexOf(tv) === 0) sc = 8;
        else if (wordStart(hv, tv)) sc = 16;
        else if (tv.length >= 4 && hv.length >= 4 && tv.indexOf(hv) === 0) sc = 20;
        else if (hv.indexOf(tv) !== -1) sc = 28;
        else sc = Infinity;
        if (sc < best) best = sc;
      }
      if (best === 0) break;
    }

    // 3. Consonant skeleton — survives vowel habits folding cannot absorb
    //    ("SamaySar" vs "Smysar", "Bhagwaan" vs "Bhagvan").
    if (best > 32 && tok.sk && tok.sk.length >= 4 && hay.sk) {
      if (hay.sk.indexOf(tok.sk) === 0) sc = 34;
      else if (wordStart(hay.sk, tok.sk)) sc = 42;
      else if (hay.sk.indexOf(tok.sk) !== -1) sc = 50;
      else sc = Infinity;
      if (sc < best) best = sc;
    }

    // 4. Typo tolerance — only worth its cost on longer tokens.
    if (best === Infinity && tok.lt && tok.lt.length >= 5 && hay.words) {
      var tol = tok.lt.length >= 9 ? 2 : 1;
      for (i = 0; i < hay.words.length; i++) {
        if (Math.abs(hay.words[i].length - tok.lt.length) > tol) continue;
        if (T.levenshtein(tok.lt, hay.words[i], tol) <= tol) {
          best = 60;
          break;
        }
      }
    }

    return best === Infinity ? Infinity : best + w;
  }

  /**
   * Run the search. With `dry` it returns the scored payload instead of
   * touching the DOM — that is what the tests and window.jinbhaktApp use.
   */
  function runSearch(query, dry) {
    var q = String(query == null ? '' : query).trim();
    var empty = { items: [], tokens: [], allCount: 0, partialFrom: -1, query: q };

    if (!q) {
      searchCache = { q: null, r: null };
      if (!dry) hideSearchResults();
      return empty;
    }
    if (searchCache.q === q && searchCache.r) {
      if (!dry) renderSearchResults(searchCache.r);
      return searchCache.r;
    }

    var toks = analyzeQuery(q);
    if (!toks.length) {
      if (!dry) hideSearchResults();
      return empty;
    }

    var index = state.searchIndex;
    var N = index.length;
    var out = [];
    var i, t, f;

    /* Pass 1 — cheap blob reject + document frequency per token.
     * A token that occurs in 100+ entries ("pooja", via the category
     * label) must not outweigh one that occurs in 2 ("vaasupujya"). */
    var df = [];
    for (t = 0; t < toks.length; t++) df.push(0);
    var cand = [];
    for (i = 0; i < N; i++) {
      var e = index[i];
      var hitToks = null;
      for (t = 0; t < toks.length; t++) {
        if (!blobMightMatch(e, toks[t])) continue;
        df[t]++;
        if (!hitToks) hitToks = [];
        hitToks.push(t);
      }
      if (hitToks) cand.push({ e: e, t: hitToks });
    }

    var idf = [];
    for (t = 0; t < toks.length; t++) {
      idf.push(Math.log((N + 1) / (df[t] + 1)) * 4);
    }

    /* Pass 2 — detailed scoring, only for entries that survived the reject. */
    for (var c = 0; c < cand.length; c++) {
      var entry = cand[c].e;
      var matched = 0, sum = 0, exact = 0, titleMatched = 0, rarity = 0;

      for (var k = 0; k < cand[c].t.length; k++) {
        var ti = cand[c].t[k];
        var tok = toks[ti];
        var bs = Infinity, bw = 99;
        for (f = 0; f < entry.f.length; f++) {
          var s = scoreField(tok, entry.f[f]);
          if (s < bs || (s === bs && entry.f[f].w < bw)) { bs = s; bw = entry.f[f].w; }
        }
        if (bs === Infinity) continue;
        matched++;
        sum += bs;
        rarity += idf[ti];
        if (bs <= 10) exact++;
        if (bw <= 1) titleMatched++;   // title / legacy English name, not a category label
      }

      if (!matched) continue;

      // Full matches always outrank partials; readable content outranks
      // "coming soon"; rare-token hits, exact hits and short titles win ties.
      var score = sum
        - rarity
        + (matched === toks.length ? 0 : 1000)
        + (entry.readable ? 0 : 250)
        - exact * 6
        - matched * 3
        + Math.min((entry.hName || '').length, 80) * 0.1;

      out.push({
        entry: entry, score: score, matched: matched, total: toks.length,
        titleMatched: titleMatched, exact: exact
      });
    }

    out.sort(function (a, b) {
      var af = a.matched === a.total, bf = b.matched === b.total;
      if (af !== bf) return af ? -1 : 1;
      if (a.matched !== b.matched) return b.matched - a.matched;
      // A token found in the title beats one found only in the category label.
      if (a.titleMatched !== b.titleMatched) return b.titleMatched - a.titleMatched;
      if (a.score !== b.score) return a.score - b.score;
      return String(a.entry.hName).localeCompare(String(b.entry.hName));
    });

    var items = out.slice(0, MAX_RESULTS);
    var partialFrom = -1;
    for (var k = 0; k < items.length; k++) {
      if (items[k].matched !== items[k].total) { partialFrom = k; break; }
    }

    var payload = {
      items: items,
      tokens: toks,
      allCount: out.length,
      partialFrom: partialFrom,
      query: q
    };
    searchCache = { q: q, r: payload };
    if (!dry) renderSearchResults(payload);
    return payload;
  }


  /** Case-insensitive occurrence ranges of every needle inside `text`. */
  function matchRanges(text, needles) {
    var low = text.toLowerCase();
    var ranges = [];
    for (var n = 0; n < needles.length; n++) {
      var needle = String(needles[n] || '').toLowerCase();
      if (needle.length < 2) continue;
      var idx = low.indexOf(needle);
      while (idx !== -1) {
        ranges.push([idx, idx + needle.length]);
        idx = low.indexOf(needle, idx + needle.length);
      }
    }
    if (!ranges.length) return ranges;
    ranges.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var merged = [];
    for (var i = 0; i < ranges.length; i++) {
      var last = merged[merged.length - 1];
      if (last && ranges[i][0] <= last[1]) {
        if (ranges[i][1] > last[1]) last[1] = ranges[i][1];
      } else {
        merged.push([ranges[i][0], ranges[i][1]]);
      }
    }
    return merged;
  }

  /** Write `text` into `node`, wrapping matched spans in <mark class="hit">. */
  function appendMarked(node, text, needles) {
    text = String(text == null ? '' : text);
    var ranges = matchRanges(text, needles);
    if (!ranges.length) { node.appendChild(document.createTextNode(text)); return; }
    var pos = 0;
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i][0] > pos) node.appendChild(document.createTextNode(text.slice(pos, ranges[i][0])));
      node.appendChild(el('mark', 'hit', text.slice(ranges[i][0], ranges[i][1])));
      pos = ranges[i][1];
    }
    if (pos < text.length) node.appendChild(document.createTextNode(text.slice(pos)));
  }

  /**
   * Word-level highlighting for the romanized subtitle. A query's Roman
   * spelling never matches a title's character-for-character ("Vaasupujya"
   * vs "Vasupujy", "aarti" vs "Arati"), so folded word forms are compared
   * instead, with the consonant skeleton as the last resort.
   */
  function appendLatinMarked(node, text, foldedNeedles) {
    text = String(text == null ? '' : text);
    var parts = text.split(/(\s+)/);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (/^\s+$/.test(part)) { node.appendChild(document.createTextNode(part)); continue; }
      var wf = T.fold(part);
      var wsk = T.skeleton(wf);
      var hit = false;
      for (var n = 0; n < foldedNeedles.length && !hit; n++) {
        var nd = foldedNeedles[n];
        if (!nd) continue;
        var nsk = T.skeleton(nd);
        if (wf === nd || wf.indexOf(nd) !== -1) hit = true;
        else if (wf.length >= 3 && nd.indexOf(wf) !== -1) hit = true;
        // Identical consonant sequences — catches the vowel-length mismatch
        // between how a title is romanized ("Arati") and how it is typed
        // ("aarti"), which folding alone cannot bridge.
        else if (wsk && wsk.length >= 2 && wsk === nsk) hit = true;
        else if (wsk.length >= 4 && nsk.length >= 4) {
          if (wsk.indexOf(nsk) !== -1 || nsk.indexOf(wsk) !== -1) hit = true;
        }
      }
      if (hit) node.appendChild(el('mark', 'hit', part));
      else node.appendChild(document.createTextNode(part));
    }
  }

  /** Devanagari spellings of every query token — used on the Hindi title line. */
  function devNeedles(tokens) {
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) {
      var t = tokens[i];
      if (t.raw && T.hasDevanagari(t.raw)) out.push(t.raw);
      if (t.dn && T.hasDevanagari(t.dn)) out.push(t.dn);
    }
    return out;
  }

  /** Folded Latin spellings of every query token — used on the romanized line. */
  function latinNeedles(tokens) {
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) {
      var lts = tokens[i].lts || [];
      for (var j = 0; j < lts.length; j++) if (lts[j]) out.push(lts[j]);
    }
    return out;
  }

  function renderSearchResults(payload) {
    var box = dom.searchResults;
    var items = (payload && payload.items) || [];
    box.innerHTML = '';
    state.activeResult = -1;
    dom.searchInput.removeAttribute('aria-activedescendant');

    if (!items.length) {
      var msg = el('div', 'no-results-msg');
      msg.appendChild(el('div', null, 'कोई परिणाम नहीं मिला'));
      msg.appendChild(el('div', 'no-results-hint',
        'देवनागरी या English दोनों में खोजें — जैसे "samaysar", "pooja", "आरती"।'));
      box.appendChild(msg);
      showSearchBox(true);
      return;
    }

    var head = el('div', 'search-result-head');
    head.appendChild(el('span', 'search-count',
      (payload.allCount > items.length
        ? items.length + '/' + payload.allCount
        : String(items.length)) + ' परिणाम'));
    if (payload.partialFrom === 0) head.appendChild(el('span', 'search-hint', 'आंशिक मिलान'));
    box.appendChild(head);

    var dn = devNeedles(payload.tokens);
    var lt = latinNeedles(payload.tokens);

    for (var i = 0; i < items.length; i++) {
      var hit = items[i];
      var r = hit.entry;

      if (i === payload.partialFrom && i > 0) {
        box.appendChild(el('div', 'search-result-divider', 'आंशिक मिलान'));
      }

      var a = el('a', 'search-result-item'
        + (r.readable ? '' : ' result-pending')
        + (hit.matched === hit.total ? '' : ' result-partial'));
      a.href = '#/' + r.cat + '/' + encodeURIComponent(r.id);
      a.setAttribute('role', 'option');
      a.id = 'sr-opt-' + i;
      a.dataset.index = String(i);

      var top = el('span', 'result-top');
      var meta = el('span', 'result-meta');
      meta.appendChild(el('span', 'result-cat', (r.icon || '') + ' ' + (r.catLabel || r.hCtg || '')));
      if (r.sub) meta.appendChild(el('span', 'result-sub', r.sub));
      top.appendChild(meta);
      if (!r.readable) top.appendChild(el('span', 'result-tag', 'जल्द'));
      a.appendChild(top);

      var name = el('span', 'result-name');
      appendMarked(name, r.hName || r.eName || r.id, dn);
      a.appendChild(name);

      // Pick the subtitle form matching the current translit style.
      var subText = translitStyle === 'iast' ? (r.latinIast || r.latin) : r.latin;
      if (subText) {
        var lat = el('span', 'result-latin');
        appendLatinMarked(lat, subText, lt);
        a.appendChild(lat);
      }

      box.appendChild(a);
    }

    showSearchBox(true);
  }

  /** ↑ / ↓ / Enter navigation across the result list. */
  function moveActiveResult(delta) {
    var links = dom.searchResults.querySelectorAll('.search-result-item');
    if (!links.length) return;
    var next = state.activeResult + delta;
    if (next < 0) next = links.length - 1;
    if (next >= links.length) next = 0;
    state.activeResult = next;
    for (var i = 0; i < links.length; i++) links[i].classList.toggle('is-active', i === next);
    dom.searchInput.setAttribute('aria-activedescendant', links[next].id);
    if (links[next].scrollIntoView) links[next].scrollIntoView({ block: 'nearest' });
  }

  function openActiveResult() {
    var links = dom.searchResults.querySelectorAll('.search-result-item');
    if (!links.length) return false;
    var target = links[state.activeResult >= 0 ? state.activeResult : 0];
    window.location.hash = target.getAttribute('href').slice(1);
    hideSearchResults();
    dom.searchInput.blur();
    return true;
  }


  function showSearchBox(visible) {
    dom.searchResults.classList.toggle('hidden', !visible);
    dom.searchInput.setAttribute('aria-expanded', visible ? 'true' : 'false');
    if (!visible) state.activeResult = -1;
  }

  function hideSearchResults() {
    dom.searchResults.innerHTML = '';
    showSearchBox(false);
  }


  /* ---------------------------------------------------------
   * Keyboard shortcuts
   * ------------------------------------------------------- */
  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      var ae = document.activeElement;
      var tag = (ae && ae.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select';

      // Escape → close search first, then the drawer
      if (e.key === 'Escape') {
        if (!dom.searchResults.classList.contains('hidden')) {
          hideSearchResults(); dom.searchInput.blur(); return;
        }
        if (document.body.classList.contains('nav-open')) {
          closeNav(); dom.menuToggle.focus();
        }
        return;
      }

      if (typing) return;

      // "/" → focus search (opens drawer on mobile)
      if (e.key === '/') {
        e.preventDefault();
        if (isMobile()) openNav();
        dom.searchInput.focus();
        return;
      }
      // "m" → toggle drawer
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleNav(); return; }
      // "h" or Home → go to the home shelf
      if (e.key === 'h' || e.key === 'H' || e.key === 'Home') { e.preventDefault(); navigateTo('#/'); return; }

      // ← / → → prev / next inside the reader
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        var sel = e.key === 'ArrowLeft' ? '.reader-nav .nav-prev' : '.reader-nav .nav-next';
        var link = document.querySelector(sel);
        if (link && link.getAttribute('href')) {
          e.preventDefault();
          window.location.hash = link.getAttribute('href').slice(1);
        }
      }
    });
  }

  /* ---------------------------------------------------------
   * Service worker (relative path → works on sub-path hosting)
   * ------------------------------------------------------- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').then(
        function () { console.log('[JinBhakt] service worker registered'); },
        function (err) { console.warn('[JinBhakt] SW registration failed:', err); }
      );
    });
  }

  /* ---------------------------------------------------------
   * Mobile quick bar (bottom toolbar)
   * ------------------------------------------------------- */
  function renderQuickBar() {
    if (!dom.quickBar) return;
    dom.quickBar.innerHTML = '';

    var items = (state.taxonomy && state.taxonomy.quickBar) ? state.taxonomy.quickBar.slice() : [
      { id: 'search', icon: '\uD83D\uDD0D', label: 'खोज', action: 'focus-search' },
      { id: 'path', icon: '\uD83D\uDE4F', label: 'नित्य क्रम', href: '#/path' },
      { id: 'fav', icon: '⭐', label: 'प्रिय', href: '#/fav' },
      { id: 'menu', icon: '☰', label: 'सूची', action: 'open-nav' }
    ];

    /* Kids Learning always sits just before the menu button. Injected here as
     * well as in taxonomy.json, so a stale cached taxonomy cannot hide it. */
    var kidsItem = { id: 'kids', icon: '\uD83E\uDEB7', label: 'खेल', href: '#/kids' };
    var hasKids = items.some(function (i) { return i.id === 'kids'; });
    if (!hasKids) {
      var menuIdx = -1;
      for (var q = 0; q < items.length; q++) {
        if (items[q].id === 'menu') { menuIdx = q; break; }
      }
      if (menuIdx >= 0) items.splice(menuIdx, 0, kidsItem);
      else items.push(kidsItem);
    }

    items.forEach(function (item) {
      if (item.href) {
        var a = el('a', 'quick-bar-btn');
        a.href = item.href;
        a.appendChild(el('span', 'quick-bar-icon', item.icon || ''));
        a.appendChild(el('span', null, item.label || ''));
        dom.quickBar.appendChild(a);
      } else if (item.action) {
        var btn = el('button', 'quick-bar-btn');
        btn.type = 'button';
        btn.setAttribute('data-action', item.action);
        btn.appendChild(el('span', 'quick-bar-icon', item.icon || ''));
        btn.appendChild(el('span', null, item.label || ''));
        btn.addEventListener('click', function () {
          if (item.action === 'focus-search') {
            dom.searchInput.focus();
            if (isMobile()) openNav();
          } else if (item.action === 'open-nav') {
            toggleNav();
          }
        });
        dom.quickBar.appendChild(btn);
      }
    });
  }

  /* ---------------------------------------------------------
   * Boot
   * ------------------------------------------------------- */
  function showFatal(message) {
    dom.main.innerHTML = '';
    var box = el('div', 'empty-state');
    box.appendChild(el('span', 'empty-icon', '\u26A0'));
    box.appendChild(el('h2', null, 'सामग्री लोड नहीं हो सकी'));
    box.appendChild(el('p', null, message));
    box.appendChild(el('p', 'empty-sub',
      'यह ऐप फ़ाइल से सीधे नहीं चलती — कृपया स्थानीय सर्वर चलाएँ (जैसे: python -m http.server)।'));
    dom.main.appendChild(box);
  }

  function init() {
    if (initialized) return;      // guard: never wire the app twice
    initialized = true;

    cacheDOM();

    dom.menuToggle.addEventListener('click', toggleNav);
    dom.overlay.addEventListener('click', closeNav);

    dom.searchInput.addEventListener('input', handleSearch);
    dom.searchInput.addEventListener('focus', function () {
      if (dom.searchInput.value.trim()) handleSearch();
    });
    dom.searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActiveResult(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveActiveResult(-1); return; }
      if (e.key === 'Enter') {
        if (openActiveResult()) e.preventDefault();
      }
    });

    // Dismiss the results panel when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.search-section')) hideSearchResults();
    });

    window.addEventListener('hashchange', router);
    window.addEventListener('resize', function () { if (!isMobile()) closeNav(); });

    // Public hooks consumed by speech.js
    window.jinbhaktApp = {
      getCurrentText: function () {
        var b = document.getElementById('prayer-body');
        return b ? (b.textContent || '') : '';
      },
      /* Narration source. The reader may be showing Roman letters, but the
       * hi-IN voice must always be fed the original Devanagari. */
      getSpeechText: function () {
        return readerLoaded ? readerDevText : '';
      },
      getTitle: function () {
        var t = document.querySelector('.reader-title');
        return t ? (t.textContent || '') : '';
      },
      isTransliterated: function () { return translitOn; },
      getTranslitStyle: function () { return translitStyle; },
      setTranslitStyle: setTranslitStyle,
      setTransliteration: setTransliteration,
      toggleTransliteration: toggleTransliteration,
      paintTranslitButtons: paintTranslitButtons,
      transliterate: function (str, capitalize) { return toRoman(str, capitalize !== false); },
      navigate: navigateTo,
      sanitizeHTML: sanitizeHTML,
      search: function (q) { return runSearch(q, true); },
      state: state,
      /* Panchang Patra hooks for tests */
      renderTodayStrip: renderTodayStrip,
      buildMoonSVG: buildMoonSVG,
      fetchPanchangData: fetchPanchangData,
      /* Kids Learning hooks for tests */
      getKidsGames: function () { return Kids.getGames(); },
      kidsFrameSrc: kidsFrameSrc,
      buildKidsMenuSection: buildKidsMenuSection,
      renderKidsView: renderKidsView,
      renderKidsGameView: renderKidsGameView,
      kidsSwastikaSVG: kidsSwastikaSVG
    };

    loadAllData()
      .then(function () {
        renderNav();
        renderQuickBar();
        if (!window.location.hash) window.location.replace('#/');
        router();
        registerServiceWorker();
      })
      .catch(function (err) {
        console.error('[JinBhakt] init failed:', err);
        showFatal(String(err && err.message ? err.message : err));
      });

    setupKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

