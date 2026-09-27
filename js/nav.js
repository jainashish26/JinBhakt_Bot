/**
 * JinBhakt Bot Navigation Engine
 * 
 * Provides a performant, tradition-aware 4-lens information architecture:
 * - Path: Traditional daily worship sequence
 * - Browse: Category-based exploration  
 * - Index: Devanagari letter-based lookup
 * - Mine: Personal favorites and settings
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Nav = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  var taxonomy = null;
  var categories = {};
  var allItems = [];
  var indexes = { byCat: {}, byGroup: {}, byPath: {}, byTirthankara: {}, byFestival: {}, byAuthor: {}, byLetter: {} };
  var prefs = { lens: 'browse', theme: 'light', fontSize: 16 };
  var favs = [];

  var DEVANAGARI_AKSHAR_MALA = [
    'अ','आ','इ','ई','उ','ऊ','ऋ','ए','ऐ','ओ','औ','अं','अः',
    'क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण',
    'त','थ','द','ध','न','प','फ','ब','भ','म','य','र','ल','व',
    'श','ष','स','ह','क्ष','त्र','ज्ञ'
  ];

  function devCollate(a, b) {
    if (typeof a !== 'string') a = '';
    if (typeof b !== 'string') b = '';
    a = a.normalize ? a.normalize('NFC') : a;
    b = b.normalize ? b.normalize('NFC') : b;
    var minLen = Math.min(a.length, b.length);
    for (var i = 0; i < minLen; i++) {
      var ca = a.charCodeAt(i);
      var cb = b.charCodeAt(i);
      var rankA = DEVANAGARI_AKSHAR_MALA.indexOf(a.charAt(i));
      var rankB = DEVANAGARI_AKSHAR_MALA.indexOf(b.charAt(i));
      if (rankA >= 0 || rankB >= 0) {
        var rA = rankA >= 0 ? rankA : 9999;
        var rB = rankB >= 0 ? rankB : 9999;
        if (rA !== rB) return rA - rB;
      }
      if (ca !== cb) return ca - cb;
    }
    return a.length - b.length;
  }

  function matches(item, m) {
    if (!m) return true;
    if (m.cats && m.cats.indexOf(item.catId) < 0) return false;
    if (m.sub && m.sub.indexOf(item.sub) < 0) return false;
    if (m.subRegex) {
      var re = new RegExp(m.subRegex);
      if (!re.test(String(item.sub || ''))) return false;
    }
    var name = String(item.hName || '');
    if (m.titleAny) {
      var found = false;
      for (var i = 0; i < m.titleAny.length; i++) {
        if (name.indexOf(m.titleAny[i]) >= 0) { found = true; break; }
      }
      if (!found) return false;
    }
    if (m.titleAll) {
      for (var j = 0; j < m.titleAll.length; j++) {
        if (name.indexOf(m.titleAll[j]) < 0) return false;
      }
    }
    if (m.ids && m.ids.indexOf(item._id) < 0) return false;
    return true;
  }

  function init(taxonomyData, contentDataMap) {
    taxonomy = taxonomyData;
    taxonomy.categories.forEach(function(catMeta) {
      var items = contentDataMap[catMeta.id] || [];
      var readable = items.filter(function(i) { return i.hasContent === true; });
      categories[catMeta.id] = {
        meta: catMeta,
        items: readable.map(function(i) { return Object.assign({}, i, { catId: catMeta.id }); })
      };
      allItems = allItems.concat(categories[catMeta.id].items);
    });
    buildIndexes();
    loadPrefs();
    loadFavs();
  }

  function buildIndexes() {
    taxonomy.categories.forEach(function(catMeta) {
      indexes.byCat[catMeta.id] = categories[catMeta.id].items;
      indexes.byGroup[catMeta.id] = {};
      var items = categories[catMeta.id].items;
      var claimed = {};
      catMeta.groups.forEach(function(group) {
        if (group.catchAll) {
          indexes.byGroup[catMeta.id][group.id] = items.filter(function(i) { return !claimed[i._id]; });
        } else {
          var gi = items.filter(function(i) { return matches(i, group.match) && !claimed[i._id]; });
          gi.forEach(function(i) { claimed[i._id] = true; });
          indexes.byGroup[catMeta.id][group.id] = gi;
        }
      });
    });
    taxonomy.path.forEach(function(step) {
      indexes.byPath[step.id] = allItems.filter(function(i) { return matches(i, step.match); });
    });
    taxonomy.tirthankaras.forEach(function(tk) {
      var sorted = tk.aliases.slice().sort(function(a, b) { return b.length - a.length; });
      indexes.byTirthankara[tk.id] = allItems.filter(function(i) {
        var n = String(i.hName || '');
        return sorted.some(function(a) { return n.indexOf(a) >= 0; });
      });
    });
    taxonomy.festivals.forEach(function(fest) {
      indexes.byFestival[fest.id] = allItems.filter(function(i) { return matches(i, fest.match); });
    });
    buildAuthorIndex();
    buildLetterIndex();
  }

  function buildAuthorIndex() {
    var items = indexes.byCat['bhajan'] || [];
    var authors = {};
    var extractRe = new RegExp(taxonomy.authors.extractFromSub);
    var stripRe = new RegExp(taxonomy.authors.stripSuffix);
    items.forEach(function(item) {
      var sub = String(item.sub || '');
      if (!extractRe.test(sub)) return;
      var author = sub.replace(extractRe, '').replace(stripRe, '');
      if (taxonomy.authors.aliases && taxonomy.authors.aliases[author]) author = taxonomy.authors.aliases[author];
      if (!authors[author]) authors[author] = [];
      authors[author].push(item);
    });
    indexes.byAuthor['bhajan'] = authors;
  }

  function buildLetterIndex() {
    allItems.forEach(function(item) {
      var name = String(item.hName || '').trim();
      if (!name) return;
      var ch = name.charAt(0);
      if (!indexes.byLetter[ch]) indexes.byLetter[ch] = [];
      indexes.byLetter[ch].push(item);
    });
  }

  function getLenses() { return taxonomy.lenses; }

  function getCategories() {
    return taxonomy.categories.map(function(cat) {
      return Object.assign({}, cat, { count: categories[cat.id].items.length });
    });
  }

  function getCategory(catId) {
    var cat = categories[catId];
    if (!cat) return null;
    var groups = cat.meta.groups.map(function(g) {
      return Object.assign({}, g, { count: (indexes.byGroup[catId][g.id] || []).length });
    });
    return Object.assign({}, cat.meta, { count: cat.items.length, groups: groups });
  }

  function getGroup(catId, groupId) {
    var items = indexes.byGroup[catId] && indexes.byGroup[catId][groupId];
    if (!items) return [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function getPathSteps() {
    return taxonomy.path.map(function(s) {
      return Object.assign({}, s, { count: indexes.byPath[s.id].length });
    });
  }

  function getPathStep(stepId) {
    var items = indexes.byPath[stepId];
    if (!items) return [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function getTirthankaras() {
    return taxonomy.tirthankaras.map(function(tk) {
      return Object.assign({}, tk, { count: indexes.byTirthankara[tk.id].length });
    });
  }

  function getTirthankara(tkId) {
    var items = indexes.byTirthankara[tkId];
    if (!items) return [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function getFestivals() {
    return taxonomy.festivals.map(function(f) {
      return Object.assign({}, f, { count: indexes.byFestival[f.id].length });
    });
  }

  function getFestival(festId) {
    var items = indexes.byFestival[festId];
    if (!items) return [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function getAuthors(catId) {
    if (catId !== 'bhajan') return [];
    var authors = indexes.byAuthor['bhajan'] || {};
    var list = Object.keys(authors).map(function(name) {
      return { id: name, name: name, count: authors[name].length };
    });
    return list.sort(function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return devCollate(a.name, b.name);
    });
  }

  function getAuthorItems(catId, authorId) {
    if (catId !== 'bhajan') return [];
    var items = (indexes.byAuthor['bhajan'] || {})[authorId] || [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function getLetters() {
    var result = [];
    DEVANAGARI_AKSHAR_MALA.forEach(function(letter) {
      var items = indexes.byLetter[letter] || [];
      if (items.length > 0) result.push({ letter: letter, count: items.length });
    });
    Object.keys(indexes.byLetter).filter(function(l) {
      return /^[A-Za-z]$/.test(l);
    }).sort().forEach(function(l) {
      result.push({ letter: l, count: indexes.byLetter[l].length });
    });
    return result;
  }

  function getLetterIndex(letter) {
    var items = indexes.byLetter[letter];
    if (!items) return [];
    return items.slice().sort(function(a, b) { return devCollate(a.hName, b.hName); });
  }

  function search(query) {
    if (!query || query.length < 2) return [];
    var q = query.toLowerCase();
    var results = allItems.filter(function(item) {
      var name = String(item.hName || '').toLowerCase();
      var latin = String(item.eName || item.name || '').toLowerCase();
      return name.indexOf(q) >= 0 || latin.indexOf(q) >= 0;
    });
    return results.slice(0, 50).sort(function(a, b) {
      var aN = String(a.hName || '').toLowerCase();
      var bN = String(b.hName || '').toLowerCase();
      var aE = aN === q ? 0 : 1, bE = bN === q ? 0 : 1;
      if (aE !== bE) return aE - bE;
      var aP = aN.indexOf(q) === 0 ? 0 : 1, bP = bN.indexOf(q) === 0 ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return devCollate(a.hName, b.hName);
    });
  }

  function getPrefs() { return Object.assign({}, prefs); }

  function setPrefs(newPrefs) {
    prefs = Object.assign(prefs, newPrefs);
    savePrefs();
  }

  function savePrefs() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('jb_prefs', JSON.stringify(prefs));
    } catch (e) { /* ignore */ }
  }

  function loadPrefs() {
    try {
      if (typeof localStorage !== 'undefined') {
        var s = localStorage.getItem('jb_prefs');
        if (s) prefs = Object.assign(prefs, JSON.parse(s));
      }
    } catch (e) { /* ignore */ }
  }

  function getFavs() { return favs.slice(); }

  function toggleFav(itemId) {
    var idx = favs.indexOf(itemId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(itemId);
    saveFavs();
    return idx < 0;
  }

  function isFav(itemId) { return favs.indexOf(itemId) >= 0; }

  function saveFavs() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('jb_favs', JSON.stringify(favs));
    } catch (e) { /* ignore */ }
  }

  function loadFavs() {
    try {
      if (typeof localStorage !== 'undefined') {
        var s = localStorage.getItem('jb_favs');
        if (s) favs = JSON.parse(s);
      }
    } catch (e) { /* ignore */ }
  }


  return {
    init: init,
    getLenses: getLenses,
    getCategories: getCategories,
    getCategory: getCategory,
    getGroup: getGroup,
    getPathSteps: getPathSteps,
    getPathStep: getPathStep,
    getTirthankaras: getTirthankaras,
    getTirthankara: getTirthankara,
    getFestivals: getFestivals,
    getFestival: getFestival,
    getAuthors: getAuthors,
    getAuthorItems: getAuthorItems,
    getLetters: getLetters,
    getLetterIndex: getLetterIndex,
    search: search,
    getPrefs: getPrefs,
    setPrefs: setPrefs,
    getFavs: getFavs,
    toggleFav: toggleFav,
    isFav: isFav,
    devCollate: devCollate
  };
}));
