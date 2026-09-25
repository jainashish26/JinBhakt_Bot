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
    display: function () { return ''; },
    transliterateText: function (s) { return String(s == null ? '' : s); },
    hasDevanagari: function () { return false; },
    levenshtein: function () { return 99; },
    skeleton: function () { return ''; },
    fold: function (s) { return String(s == null ? '' : s).toLowerCase(); }
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
    ready: false
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

  var translitOn = readTranslitPref();
  var readerRaw = { body: '', brief: '' };   // untouched source of the open prayer
  var readerDevText = '';                    // plain Devanagari text, used by narration
  var readerLoaded = false;

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
    return T.transliterateText(str, { capitalize: capitalize !== false });
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
    if (document.body) document.body.classList.toggle('translit-on', translitOn);
    paintTranslitButtons();
  }

  /** Repaint the reader from the untouched source, in whichever script is active. */
  function paintReaderContent() {
    if (!readerLoaded) { paintTranslitChrome(); return; }

    var body = document.getElementById('prayer-body');
    if (body) {
      body.innerHTML = sanitizeHTML(normalizeContent(readerRaw.body || ''));
      wrapTables(body);
      readerDevText = extractSpeechText(body);       // captured before any rewriting
      body.classList.toggle('is-translit', translitOn);
      if (translitOn) transliterateTree(body);
    }

    var slot = document.getElementById('reader-brief-slot');
    if (slot) {
      slot.innerHTML = '';
      if (readerRaw.brief) {
        var aside = el('aside', 'reader-brief');
        aside.appendChild(el('h3', null, translitOn ? 'Summary' : '\u0938\u093E\u0930\u093E\u0902\u0936'));
        var bb = el('div', 'brief-body');
        bb.innerHTML = sanitizeHTML(normalizeContent(readerRaw.brief));
        wrapTables(bb);
        bb.classList.toggle('is-translit', translitOn);
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
        entry.latin = T.hasDevanagari(hName) ? T.display(hName) : '';

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
   * Sidebar: category accordion
   * ------------------------------------------------------- */
  function renderNav() {
    dom.categoryList.innerHTML = '';

    // "Home" shortcut
    var homeLink = el('a', 'nav-home-link', '\u2638  मुख्य पृष्ठ');
    homeLink.href = '#/';
    homeLink.setAttribute('data-route', 'home');
    dom.categoryList.appendChild(homeLink);

    state.categories.forEach(function (cat) {
      var all = state.items[cat.id] || [];
      var ready = state.readable[cat.id] || [];

      var details = el('details', 'category-item');
      details.setAttribute('data-cat', cat.id);

      var summary = el('summary', 'category-header');
      summary.appendChild(el('span', 'cat-icon', cat.icon || ''));
      summary.appendChild(el('span', 'cat-label', cat.label));

      var badge = el('span', 'cat-count', String(ready.length));
      badge.title = ready.length + ' पठनीय / ' + all.length + ' कुल';
      badge.setAttribute('aria-label', ready.length + ' पठनीय सामग्री');
      summary.appendChild(badge);

      var links = el('div', 'category-links');
      links.id = 'cat-links-' + cat.id;

      if (ready.length === 0) {
        links.appendChild(el('p', 'cat-empty', 'इस खंड की सामग्री शीघ्र ही जोड़ी जाएगी।'));
      } else {
        ready.forEach(function (item) {
          var a = el('a', 'link-pill', item.hName || item.eName || item._id);
          a.href = '#/' + cat.id + '/' + encodeURIComponent(item._id);
          a.setAttribute('data-route', 'reader');
          a.setAttribute('data-cat', cat.id);
          a.setAttribute('data-id', item._id);
          links.appendChild(a);
        });

        var pending = all.length - ready.length;
        if (pending > 0) {
          var more = el('a', 'link-pill pill-more', '+ ' + pending + ' अन्य शीर्षक');
          more.href = '#/' + cat.id;
          more.setAttribute('data-route', 'category');
          more.title = 'पूरी सूची देखें';
          links.appendChild(more);
        }
      }

      details.appendChild(summary);
      details.appendChild(links);
      dom.categoryList.appendChild(details);
    });
  }

  /** Highlight the sidebar entry matching the current route. */
  function syncNavActive(route) {
    var pills = dom.categoryList.querySelectorAll('.link-pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');

    var details = dom.categoryList.querySelectorAll('details.category-item');
    for (var d = 0; d < details.length; d++) details[d].classList.remove('cat-active');

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
  }

  /* ---------------------------------------------------------
   * Hash router — #/ , #/cat , #/cat/id
   * ------------------------------------------------------- */
  function parseHash() {
    var raw = String(window.location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean).map(decodeURIComponent);

    if (parts.length === 0) return { type: 'home' };
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

    if (route.type === 'category' && categoryById(route.cat)) {
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
   * View: Home — catalogue overview
   * ------------------------------------------------------- */
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
   * View: Reader — a single prayer / text
   * ------------------------------------------------------- */
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
    var title = item.hName || item.eName || item._id;

    document.title = title + ' — जिनभक्त';
    dom.main.innerHTML = '';

    /* This prayer has no text yet — the toggle repaints from `readerRaw`,
     * so it must be emptied first or the previous passage would come back. */
    readerRaw = { body: '', brief: '' };
    readerDevText = '';
    readerLoaded = false;

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

    var topBtn = el('button', 'btn btn-ghost is-translit');
    topBtn.type = 'button';
    topBtn.setAttribute('data-action', 'top');
    topBtn.setAttribute('aria-label', translitOn ? 'Back to top' : 'ऊपर जाएं');
    topBtn.appendChild(swapSpan(null, '↑ ऊपर', '↑ Top'));
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actions.appendChild(topBtn);

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

      if (r.latin) {
        var lat = el('span', 'result-latin');
        appendLatinMarked(lat, r.latin, lt);
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
      setTransliteration: setTransliteration,
      toggleTransliteration: toggleTransliteration,
      paintTranslitButtons: paintTranslitButtons,
      transliterate: function (str, capitalize) { return toRoman(str, capitalize !== false); },
      navigate: navigateTo,
      sanitizeHTML: sanitizeHTML,
      search: function (q) { return runSearch(q, true); },
      state: state
    };

    loadAllData()
      .then(function () {
        renderNav();
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

