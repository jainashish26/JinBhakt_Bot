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

  /* ---------------------------------------------------------
   * Application state
   * ------------------------------------------------------- */
  var state = {
    categories: [],   // [{id,label,icon}]
    items: {},        // catId -> [item]   (every item)
    readable: {},     // catId -> [item]   (items with real content)
    searchIndex: [],  // flattened catalogue for search
    ready: false
  };

  var dom = {};
  var initialized = false;

  /* ---------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------- */
  function isPlaceholder(v) {
    if (v === null || v === undefined) return true;
    var s = String(v).trim();
    return s === '' || s === PLACEHOLDER;
  }

  function hasContent(item) {
    return !!item && !isPlaceholder(item.hCont);
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

  /** Tidy raw JSON markup: CRLF, stray indentation, blank-line spam. */
  function normalizeContent(html) {

    return String(html)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
   * Build a complete search index from the real catalogue.
   * (The bundled search.json only covers a fraction of items.)
   */
  function buildSearchIndex() {
    var seen = {};
    state.searchIndex = [];

    state.categories.forEach(function (cat) {
      (state.items[cat.id] || []).forEach(function (item) {
        var key = cat.id + '::' + item._id;
        if (seen[key]) return;
        seen[key] = true;
        state.searchIndex.push({
          cat: cat.id,
          catLabel: cat.label,
          icon: cat.icon,
          id: item._id,
          hName: item.hName || item.eName || '',
          eName: item.eName || '',
          hCtg: item.hCtg || cat.label,
          readable: hasContent(item)
        });
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

  /* ---------------------------------------------------------
   * View: Category — full title list
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
      wrap.appendChild(el('h3', 'section-title', 'पढ़ने योग्य पाठ'));
      var list = el('ul', 'item-list');
      ready.forEach(function (item) {
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
      wrap.appendChild(list);
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
    if (cat) metaBits.push((cat.icon || '') + ' ' + cat.label);
    if (!isPlaceholder(item.hAuth)) metaBits.push('रचियता: ' + item.hAuth);
    if (siblings.total > 1 && siblings.index >= 0) {
      metaBits.push((siblings.index + 1) + ' / ' + siblings.total);
    }
    if (metaBits.length) head.appendChild(el('p', 'reader-meta', metaBits.join('  ·  ')));
    art.appendChild(head);

    /* --- actions --- */
    var actions = el('div', 'reader-actions');

    var speakBtn = el('button', 'btn btn-primary', '\uD83D\uDD0A  सुनें');
    speakBtn.id = 'btn-speak';
    speakBtn.type = 'button';
    speakBtn.setAttribute('data-action', 'speak');
    speakBtn.setAttribute('aria-label', 'यह पाठ सुनें');
    actions.appendChild(speakBtn);

    var listBtn = el('a', 'btn btn-ghost', 'सूची देखें');
    listBtn.href = '#/' + catId;
    actions.appendChild(listBtn);

    var topBtn = el('button', 'btn btn-ghost', '\u2191 ऊपर');
    topBtn.type = 'button';
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actions.appendChild(topBtn);

    art.appendChild(actions);

    /* --- body --- */
    var body = el('div', 'prayer-body');
    body.id = 'prayer-body';
    body.innerHTML = sanitizeHTML(normalizeContent(item.hCont));
    wrapTables(body);
    art.appendChild(body);

    if (!isPlaceholder(item.hBrief)) {
      var brief = el('aside', 'reader-brief');
      brief.appendChild(el('h3', null, 'सारांश'));
      var briefBody = el('div', 'brief-body');
      briefBody.innerHTML = sanitizeHTML(normalizeContent(item.hBrief));
      wrapTables(briefBody);
      brief.appendChild(briefBody);
      art.appendChild(brief);
    }

    /* --- prev / next --- */
    if (siblings.prev || siblings.next) {
      var nav = el('nav', 'reader-nav');
      nav.setAttribute('aria-label', 'पाठ नेविगेशन');

      if (siblings.prev) {
        var pv = el('a', 'nav-btn nav-prev');
        pv.href = '#/' + catId + '/' + encodeURIComponent(siblings.prev._id);
        pv.appendChild(el('span', 'nav-btn-dir', '\u2190 पिछला'));
        pv.appendChild(el('span', 'nav-btn-name', siblings.prev.hName || siblings.prev.eName));
        nav.appendChild(pv);
      } else {
        nav.appendChild(el('span', 'nav-btn nav-btn-placeholder'));
      }

      if (siblings.next) {
        var nx = el('a', 'nav-btn nav-next');
        nx.href = '#/' + catId + '/' + encodeURIComponent(siblings.next._id);
        nx.appendChild(el('span', 'nav-btn-dir', 'अगला \u2192'));
        nx.appendChild(el('span', 'nav-btn-name', siblings.next.hName || siblings.next.eName));
        nav.appendChild(nx);
      } else {
        nav.appendChild(el('span', 'nav-btn nav-btn-placeholder'));
      }

      art.appendChild(nav);
    }

    dom.main.appendChild(art);
    window.scrollTo({ top: 0, behavior: 'auto' });
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

  function handleSearch() {
    var q = dom.searchInput.value.trim();
    if (!q) { hideSearchResults(); return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { runSearch(q); }, 200);
  }

  function runSearch(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var qLow = query.toLowerCase();
    var scored = [];

    for (var i = 0; i < state.searchIndex.length; i++) {
      var entry = state.searchIndex[i];
      var hay = ((entry.hName || '') + ' ' + (entry.eName || '') + ' ' +
                 (entry.catLabel || '')).toLowerCase();

      var allMatch = true;
      for (var t = 0; t < terms.length; t++) {
        if (hay.indexOf(terms[t]) === -1) { allMatch = false; break; }
      }
      if (!allMatch) continue;

      // Rank: readable content first, then by name-prefix match strength
      var score = entry.readable ? 0 : 100;
      var nameLow = (entry.hName || '').toLowerCase();
      if (nameLow.indexOf(qLow) === 0) score -= 50;
      else if (nameLow.indexOf(qLow) !== -1) score -= 25;
      if ((entry.eName || '').toLowerCase().indexOf(qLow) === 0) score -= 30;
      scored.push({ entry: entry, score: score });
    }

    scored.sort(function (a, b) { return a.score - b.score; });
    renderSearchResults(scored.slice(0, 25).map(function (s) { return s.entry; }));
  }

  function renderSearchResults(results) {
    dom.searchResults.innerHTML = '';

    if (!results.length) {
      dom.searchResults.appendChild(el('div', 'no-results-msg', 'कोई परिणाम नहीं मिला'));
      showSearchBox(true);
      return;
    }

    results.forEach(function (r) {
      var a = el('a', 'search-result-item' + (r.readable ? '' : ' result-pending'));
      a.href = '#/' + r.cat + '/' + encodeURIComponent(r.id);
      a.setAttribute('role', 'option');

      var top = el('span', 'result-top');
      top.appendChild(el('span', 'result-cat',
        (r.icon || '') + ' ' + (r.catLabel || r.hCtg || '')));
      if (!r.readable) top.appendChild(el('span', 'result-tag', 'जल्द'));
      a.appendChild(top);

      a.appendChild(el('span', 'result-name', r.hName || r.eName || r.id));
      dom.searchResults.appendChild(a);
    });

    showSearchBox(true);
  }

  function showSearchBox(visible) {
    dom.searchResults.classList.toggle('hidden', !visible);
    dom.searchInput.setAttribute('aria-expanded', visible ? 'true' : 'false');
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
      if (e.key === 'Enter') {
        var first = dom.searchResults.querySelector('.search-result-item');
        if (first) { e.preventDefault(); window.location.hash = first.getAttribute('href').slice(1); hideSearchResults(); }
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
      getTitle: function () {
        var t = document.querySelector('.reader-title');
        return t ? (t.textContent || '') : '';
      },
      navigate: navigateTo,
      sanitizeHTML: sanitizeHTML,
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

