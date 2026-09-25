/**
 * Transliteration-aware search.
 *
 * Three layers are covered:
 *   [14b]  js/translit.js on its own (pure functions, loaded straight from disk)
 *   [14c]  the same engine driving the real app's search over the whole catalogue
 *   [14d]  what the result list actually renders + keyboard navigation
 *   [14e]  the reader's "English Transliterate" toggle (paint, labels, speech)
 *   [14f]  that the choice survives a reload
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'translit.js'));

module.exports = async function (ctx) {
  const { window, document, ok, txt, wait } = ctx;
  const app = window.jinbhaktApp;

  /* ------------------------------------------------------------------ */
  console.log('\n[14b] Transliteration module (js/translit.js)');

  ok('module exports the full API',
     ['romanize', 'display', 'fold', 'skeleton', 'devNorm', 'hasDevanagari',
      'levenshtein', 'latinVariants', 'buildField', 'analyzeToken', 'transliterateText']
       .every(k => typeof T[k] === 'function'),
     Object.keys(T).join(','));

  ok('fold is case-insensitive', T.fold('Bhagwaan') === T.fold('bhagwaan'));
  ok('fold collapses aa -> a (vowel-length habit)',
     T.fold('bhagwaan') === T.fold('bhagwan'),
     T.fold('bhagwaan') + ' vs ' + T.fold('bhagwan'));
  ok('fold collapses oo -> u (pooja/puja)',
     T.fold('pooja') === T.fold('puja'), T.fold('pooja') + ' vs ' + T.fold('puja'));
  ok('fold ignores punctuation', T.fold('shree-vasupujya') === T.fold('shree vasupujya'));

  ok('romanize("alt") reads naturally', /samaysaar/i.test(T.romanize('समयसार', 'alt')),
     T.romanize('समयसार', 'alt'));
  ok('romanize("full") keeps every vowel',
     T.romanize('समयसार', 'full').length >= T.romanize('समयसार', 'alt').length,
     T.romanize('समयसार', 'full'));
  ok('display() de-hyphenates and capitalises',
     T.display('भगवान-आदिनाथ-चालीसा') === 'Bhagvan Adinath Chalisa',
     T.display('भगवान-आदिनाथ-चालीसा'));
  ok('display() turns _ into spaces', T.display('आत्मा_ही_समयसार').indexOf('_') === -1,
     T.display('आत्मा_ही_समयसार'));
  ok('skeleton strips vowels', /^[^aeiou\s]*$/.test(T.skeleton('samaysar')),
     T.skeleton('samaysar'));
  ok('hasDevanagari detects script',
     T.hasDevanagari('आरती') === true && T.hasDevanagari('aarti') === false);
  ok('levenshtein measures distance', T.levenshtein('namokar', 'namokr', 2) === 1,
     String(T.levenshtein('namokar', 'namokr', 2)));
  ok('levenshtein bails out past max', T.levenshtein('abcdef', 'zyxwvu', 1) > 1);

  const variants = T.latinVariants('समयसार');
  ok('latinVariants offers several spellings', variants.length >= 3, JSON.stringify(variants));
  ok('latinVariants leads with the folded primary',
     variants[0] === T.fold(T.romanize('समयसार', 'alt')), JSON.stringify(variants));
  ok('latinVariants includes a vowel-stripped form',
     variants.indexOf('smysar') !== -1, JSON.stringify(variants));

  const field = T.buildField('समयसार', 2);
  ok('buildField keeps the requested weight', field.w === 2);
  ok('buildField exposes dn / lts / sk / words',
     !!(field.dn && field.lts.length && field.sk && field.words.length));
  ok('buildField rejects placeholders', T.buildField('TBC#', 0) === null);
  ok('buildField rejects empty input', T.buildField('   ', 0) === null);

  const tok = T.analyzeToken('SamaySar');
  ok('analyzeToken folds into lt', tok.lt === 'samaysar', tok.lt);
  ok('analyzeToken carries lts + sk', tok.lts.length > 0 && !!tok.sk);
  ok('analyzeToken rejects empty', T.analyzeToken('  ') === null);

  /* ---- transliterateText(): whole passages, for the reader toggle ---- */
  const tt = (s, o) => T.transliterateText(s, o);

  ok('transliterateText converts a full verse',
     tt('ॐ जय शीतलनाथ स्वामी ।') === 'Om jay shitalnath svami.',
     tt('ॐ जय शीतलनाथ स्वामी ।'));
  ok('transliterateText keeps the tek marker',
     tt('देख्या मैंने नेमिजी प्यारा ॥टेक॥') === 'Dekhya mainne nemiji pyara ||tek||',
     tt('देख्या मैंने नेमिजी प्यारा ॥टेक॥'));
  ok('danda becomes a full stop', tt('स्वामी ।').indexOf('.') !== -1, tt('स्वामी ।'));
  ok('double danda becomes ||', tt('देख्या ॥टेक॥') === 'Dekhya ||tek||', tt('देख्या ॥टेक॥'));
  ok('Devanagari digits become Latin digits', tt('॥१॥') === '||1||', tt('॥१॥'));
  ok('line breaks survive', tt('ॐ\nजय') === 'Om\nJay', JSON.stringify(tt('ॐ\nजय')));
  ok('a space before punctuation is tidied', tt('अर्थ : गवैया') === 'Arth: gavaiya',
     tt('अर्थ : गवैया'));
  ok('Latin words and digits pass through untouched',
     tt('Already English 123 (ok)') === 'Already English 123 (ok)',
     tt('Already English 123 (ok)'));
  ok('whitespace is preserved', tt('  इंदेंट  ') === '  Indent  ', JSON.stringify(tt('  इंदेंट  ')));
  ok('empty and null input are safe', tt('') === '' && tt(null) === '' && tt(undefined) === '');
  ok('capitalize can be switched off', tt('भगवान', { capitalize: false }) === 'bhagvan',
     tt('भगवान', { capitalize: false }));
  ok('vowels:"long" keeps the long vowel', tt('भगवान', { vowels: 'long' }) === 'Bhagvaan',
     tt('भगवान', { vowels: 'long' }));
  ok('mode:"full" keeps every inherent vowel', tt('समयसार', { mode: 'full' }) === 'Samayasara',
     tt('समयसार', { mode: 'full' }));
  ok('reader output agrees with the search subtitle',
     tt('भगवान') === T.display('भगवान'), tt('भगवान') + ' vs ' + T.display('भगवान'));
  ok('transliterating the output again changes nothing',
     tt(tt('ॐ जय शीतलनाथ स्वामी ।')) === tt('ॐ जय शीतलनाथ स्वामी ।'));
  ok('no Devanagari survives a pass',
     !T.hasDevanagari(tt('श्री समयसार — जैन ग्रन्थ ॥१॥ (सारांश)')),
     tt('श्री समयसार — जैन ग्रन्थ ॥१॥ (सारांश)'));

  /* ------------------------------------------------------------------ */
  console.log('\n[14c] Romanized queries reach Devanagari content');

  ok('translit module is wired into the page',
     !!window.jinbhaktTranslit && typeof window.jinbhaktTranslit.fold === 'function');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('index.html loads translit.js before app.js',
     html.indexOf('js/translit.js') !== -1
     && html.indexOf('js/translit.js') < html.indexOf('js/app.js'));

  const top = q => {
    const r = app.search(q, true);
    return r.items.length ? r.items[0].entry : { hName: '(none)' };
  };
  const ids = q => app.search(q, true).items.slice(0, 5).map(i => i.entry.id).join(',');
  const count = q => app.search(q, true).allCount;

  ok('"SamaySar" finds समयसार', /समयसार/.test(top('SamaySar').hName), top('SamaySar').hName);
  ok('"SamaySar" is a full match, not a partial one', (() => {
    const it = app.search('SamaySar', true).items[0];
    return it.matched === it.total;
  })());
  ok('search is case-insensitive', ids('SamaySar') === ids('SAMAYSAR'), ids('SAMAYSAR'));
  ok('vowel habits agree: samaysar / samayasar', ids('samaysar') === ids('samayasar'));
  ok('consonant skeleton reaches it: "smysar"', /समयसार/.test(top('smysar').hName),
     top('smysar').hName);
  ok('dropped vowel reaches it: "samaysr"', /समयसार/.test(top('samaysr').hName),
     top('samaysr').hName);
  ok('typo tolerance reaches it: "samaysarr"', /समयसार/.test(top('samaysarr').hName),
     top('samaysarr').hName);
  ok('typo tolerance reaches it: "namokarr"', /णमोकार/.test(top('namokarr').hName),
     top('namokarr').hName);
  ok('typo tolerance does not inflate the result count',
     count('chalisaa') === count('chalisa'), count('chalisaa') + ' vs ' + count('chalisa'));

  const vbp = app.search('Vaasupujya Bhagwaan Pooja', true);
  ok('multi-word romanized query ranks the title match first',
     /वासुपूज्य/.test(vbp.items[0].entry.hName), vbp.items[0].entry.hName);
  ok('  ...and is stable across spelling habits',
     ids('Vaasupujya Bhagwaan Pooja') === ids('vasupujya bhagwan puja'),
     ids('vasupujya bhagwan puja'));
  ok('a title hit outranks a category-label-only hit',
     vbp.items[0].titleMatched > vbp.items[2].titleMatched,
     vbp.items.slice(0, 4).map(i => i.titleMatched).join('/'));
  ok('no full match is claimed when none exists',
     vbp.partialFrom === 0 && vbp.items[0].matched < vbp.items[0].total,
     'partialFrom=' + vbp.partialFrom);

  ok('"vaasupujya" spelling variants agree',
     ids('vaasupujya') === ids('vasupujya') && ids('vasupujya') === ids('vaasupoojya'),
     ids('vasupujya'));
  ok('"pooja" and "puja" agree', ids('pooja') === ids('puja'));
  ok('"kalyanmandir" as one word finds कल्याणमन्दिर',
     /कल्याणमन्दिर/.test(top('kalyanmandir').hName), top('kalyanmandir').hName);
  ok('"bhaktamar" finds भक्तामर', /भक्तामर/.test(top('bhaktamar').hName), top('bhaktamar').hName);

  console.log('\n[14c-2] Devanagari queries keep working');
  ok('"आरती" returns results', count('आरती') > 0, String(count('आरती')));
  ok('"आरती" top hit is an आरती', /आरती|आरति/.test(top('आरती').hName), top('आरती').hName);
  ok('"aarti" and "आरती" return the same top 5', ids('aarti') === ids('आरती'),
     ids('aarti') + ' vs ' + ids('आरती'));
  ok('"आरति" (short-i spelling) agrees with "आरती"', ids('आरति') === ids('आरती'));
  ok('"पूजा" and "pooja" return the same top 5', ids('पूजा') === ids('pooja'));
  ok('diacritic input still works: "namokār"', /णमोकार/.test(top('namokār').hName),
     top('namokār').hName);
  ok('mixed-script query works: "जिन pooja"', count('जिन pooja') > 0, String(count('जिन pooja')));
  ok('nonsense query returns nothing', count('xyzxyzxyz') === 0, String(count('xyzxyzxyz')));
  ok('a stopword tail does not change the results',
     count('aarti ki') > 0 && ids('aarti ki') === ids('aarti'), ids('aarti ki'));

  /* ------------------------------------------------------------------ */
  console.log('\n[14d] Result rendering + keyboard navigation');

  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results-box');
  const type = async q => {
    input.value = q;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await wait(400);
  };
  const keydown = k => input.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const rows = () => box.querySelectorAll('.search-result-item');

  const MAX_RESULTS = 30;   // mirrors js/app.js

  await type('aarti');
  const aartiHits = app.search('aarti', true).allCount;
  const aartiShown = Math.min(aartiHits, MAX_RESULTS);
  ok('box is visible', !box.classList.contains('hidden'));
  ok('result count header rendered', !!box.querySelector('.search-count'),
     txt(box.querySelector('.search-count')));
  ok('header reports the plain or capped total consistently',
     txt(box.querySelector('.search-count')) ===
       (aartiHits > MAX_RESULTS
         ? MAX_RESULTS + '/' + aartiHits + ' परिणाम'
         : aartiHits + ' परिणाम'),
     txt(box.querySelector('.search-count')));
  ok('rendered rows match the header count',
     rows().length === aartiShown, rows().length + ' vs ' + aartiShown);
  ok('rows expose role=option for screen readers',
     box.querySelectorAll('.search-result-item[role="option"]').length === rows().length);
  ok('every row is a hash link',
     Array.from(rows()).every(a => /^#\/[^/]+\/.+/.test(a.getAttribute('href'))));
  ok('category badge rendered on every row',
     box.querySelectorAll('.result-cat').length === rows().length);
  ok('no partial hint when everything fully matched', !box.querySelector('.search-hint'));
  ok('no divider when everything fully matched', !box.querySelector('.search-result-divider'));
  ok('latin query highlights the romanized line',
     box.querySelector('.result-latin').querySelectorAll('mark.hit').length > 0,
     box.querySelector('.result-latin').innerHTML.slice(0, 120));
  ok('highlight bridges the vowel-length gap ("aarti" -> "Arati")',
     /^Arati$/i.test(txt(box.querySelector('.result-latin mark.hit'))),
     txt(box.querySelector('.result-latin mark.hit')));
  ok('highlighting stays precise — unrelated words are not marked', (() => {
    const lat = box.querySelector('.result-latin');
    return lat.querySelectorAll('mark.hit').length === 1
        && lat.textContent.split(/\s+/).length > 2;
  })(), box.querySelector('.result-latin').innerHTML);

  // A broad query is what actually exercises the MAX_RESULTS cap.
  await type('pooja');
  const broad = app.search('pooja', true);
  ok('broad query exceeds MAX_RESULTS', broad.allCount > MAX_RESULTS, String(broad.allCount));
  ok('result list is capped at MAX_RESULTS (30)', rows().length === MAX_RESULTS,
     String(rows().length));
  ok('capped header reports shown/total',
     /^30\/\d+ परिणाम$/.test(txt(box.querySelector('.search-count'))),
     txt(box.querySelector('.search-count')));
  ok('capped rows still expose role=option',
     box.querySelectorAll('.search-result-item[role="option"]').length === MAX_RESULTS);
  ok('capped rows still show a category badge',
     box.querySelectorAll('.result-cat').length === MAX_RESULTS);
  ok('capped list has no partial section', !box.querySelector('.search-result-divider'));

  await type('Vaasupujya Bhagwaan Pooja');
  ok('partial-only query flags "आंशिक मिलान" in the header',
     /आंशिक/.test(txt(box.querySelector('.search-hint'))), txt(box.querySelector('.search-hint')));
  ok('partial rows carry .result-partial', !!box.querySelector('.search-result-item.result-partial'));
  ok('romanized subtitle rendered', txt(box.querySelector('.result-latin')).length > 3,
     txt(box.querySelector('.result-latin')));
  ok('subtitle has no underscores', !/_/.test(txt(box.querySelector('.result-latin'))),
     txt(box.querySelector('.result-latin')));

  await type('आरती');
  ok('Devanagari query highlights the Devanagari title',
     box.querySelector('.result-name').querySelectorAll('mark.hit').length > 0,
     box.querySelector('.result-name').innerHTML.slice(0, 120));
  ok('highlighted span is the query itself',
     /आरती/.test(txt(box.querySelector('.result-name mark.hit'))),
     txt(box.querySelector('.result-name mark.hit')));

  await type('aarti panch');
  ok('partial divider separates full from partial hits',
     !!box.querySelector('.search-result-divider'), txt(box.querySelector('.search-result-divider')));
  const ap = app.search('aarti panch', true);
  ok('query yields both full and partial matches',
     ap.partialFrom > 0 && ap.partialFrom < ap.items.length,
     'partialFrom=' + ap.partialFrom + ' items=' + ap.items.length);
  ok('divider sits after the full matches',
     Array.from(box.children).indexOf(box.querySelector('.search-result-divider')) === ap.partialFrom + 1,
     String(Array.from(box.children).indexOf(box.querySelector('.search-result-divider'))));
  ok('rows after the divider are flagged partial',
     !!box.querySelector('.search-result-divider + .search-result-item.result-partial'));

  await type('zzzqqqxxx');
  ok('no-results message shown', !!box.querySelector('.no-results-msg'));
  ok('no-results hint suggests both scripts', !!box.querySelector('.no-results-hint'),
     txt(box.querySelector('.no-results-hint')));

  await type('samaysar');
  keydown('ArrowDown');
  ok('ArrowDown selects the first row', app.state.activeResult === 0, String(app.state.activeResult));
  keydown('ArrowDown');
  ok('ArrowDown again selects the second row', app.state.activeResult === 1,
     String(app.state.activeResult));
  ok('exactly one row carries .is-active', rows().length > 0
     && box.querySelectorAll('.search-result-item.is-active').length === 1);
  ok('aria-activedescendant tracks the selection',
     input.getAttribute('aria-activedescendant') === 'sr-opt-1',
     input.getAttribute('aria-activedescendant'));
  keydown('ArrowUp');
  ok('ArrowUp moves back', app.state.activeResult === 0, String(app.state.activeResult));
  keydown('ArrowUp');
  ok('ArrowUp wraps to the last row', app.state.activeResult === rows().length - 1,
     String(app.state.activeResult));

  await type('samaysar');
  keydown('Enter');
  await wait(450);
  ok('Enter opens the highlighted result', /^#\/[^/]+\/.+/.test(window.location.hash),
     window.location.hash);
  ok('result box hides after navigation', box.classList.contains('hidden'));
  ok('reader rendered for the chosen result', !!document.querySelector('.reader-title'),
     txt(document.querySelector('.reader-title')));

  // leave the app in a clean state for [15] Console health
  await type('');
  ok('clearing the query hides the box again', box.classList.contains('hidden'));

  /* ------------------------------------------------------------------ */
  console.log('\n[14e] Reader: English Transliterate toggle');

  const DEV = /[\u0900-\u097f]/;
  const click = n => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const prayerBody = () => document.querySelector('#prayer-body');

  /* The passage body is lazy-loaded, so poll for it instead of sleeping a
     fixed amount — a fixed sleep turns into a flaky test on a slow machine.
     Polling alone is not enough either: the previous passage is still on
     screen the instant the hash changes, so wait for a signature change. */
  const settle = async (fn, ms) => {
    const end = Date.now() + (ms || 6000);
    while (Date.now() < end) { if (fn()) return true; await wait(50); }
    return fn();
  };
  const passageSig = () => txt(document.querySelector('.reader-title')) +
    '|' + (app.getSpeechText() || '').length;

  const openPassage = async hash => {
    const before = passageSig();
    window.location.hash = hash;
    await wait(60);                       // let the router swap the old passage out
    await settle(() => passageSig() !== before && txt(prayerBody()).length > 100);
  };

  // Table-heavy page: the rewrite must not disturb the table wrapper.
  await openPassage('#/bhakti/Namokar-Mahamantra');

  const tBtn = document.querySelector('.reader-actions [data-action="transliterate"]');
  ok('transliterate button sits with the other reader actions', !!tBtn,
     Array.from(document.querySelectorAll('.reader-actions .btn')).map(b => txt(b)).join(' | '));
  ok('button is labelled in English', !!tBtn && /English Transliterate/.test(txt(tBtn)),
     tBtn && txt(tBtn));
  ok('button stashes the Devanagari label so it can flip back',
     !!tBtn && /अंग्रेज़ी/.test(tBtn.querySelector('[data-dev]').getAttribute('data-dev')),
     tBtn && tBtn.querySelector('[data-dev]').getAttribute('data-dev'));
  ok('button starts un-pressed',
     !!tBtn && tBtn.getAttribute('aria-pressed') === 'false' && !tBtn.classList.contains('is-active'));
  ok('app hook reports the Devanagari view', app.isTransliterated() === false);

  const htmlDev = prayerBody().innerHTML;
  const titleDev = txt(document.querySelector('.reader-title'));
  const tbl = document.querySelector('#prayer-body table');
  const rowsBefore = tbl ? tbl.querySelectorAll('tr').length : 0;
  const cellsBefore = tbl ? tbl.querySelectorAll('td,th').length : 0;
  ok('fixture page really has a table', rowsBefore > 0 && cellsBefore > 0,
     rowsBefore + ' rows / ' + cellsBefore + ' cells');

  click(tBtn);
  await wait(60);

  ok('clicking switches the button on',
     tBtn.classList.contains('is-active') && tBtn.getAttribute('aria-pressed') === 'true');
  ok('transliterate button stays readable in English in both states',
     /English Transliterate/.test(txt(tBtn)), txt(tBtn));
  ok('top button label follows the script',
     txt(document.querySelector('[data-action="top"]')) === '↑ Top',
     txt(document.querySelector('[data-action="top"]')));
  ok('list button label follows the script',
     txt(document.querySelector('.reader-actions a[href="#/bhakti"]')) === 'View list',
     txt(document.querySelector('.reader-actions a[href="#/bhakti"]')));
  ok('prev/next arrows follow the script', (() => {
    const dirs = document.querySelectorAll('.nav-btn-dir');
    return dirs.length > 0 &&
      Array.from(dirs).every(n => /Previous|Next/.test(txt(n)));
  })(), Array.from(document.querySelectorAll('.nav-btn-dir')).map(txt).join(' | '));
  ok('listen button follows the script',
     /Listen/.test(txt(document.getElementById('btn-speak'))),
     txt(document.getElementById('btn-speak')));
  ok('meta line follows the script', !DEV.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));
  ok('app hook reports the English view', app.isTransliterated() === true);
  ok('passage is flagged for the Latin stylesheet',
     prayerBody().classList.contains('is-translit') &&
     document.body.classList.contains('translit-on'));
  ok('no Devanagari left in the passage', !DEV.test(txt(prayerBody())),
     txt(prayerBody()).slice(0, 90));
  ok('title flipped to English letters', !DEV.test(txt(document.querySelector('.reader-title'))),
     titleDev + ' -> ' + txt(document.querySelector('.reader-title')));
  ok('prev/next names flipped too',
     Array.from(document.querySelectorAll('.nav-btn-name')).every(n => !DEV.test(txt(n))));
  ok('summary panel flipped too', (() => {
    const h3 = document.querySelector('#reader-brief-slot .reader-brief h3');
    const bb = document.querySelector('#reader-brief-slot .brief-body');
    return !!h3 && txt(h3) === 'Summary' && !!bb && bb.classList.contains('is-translit')
        && !DEV.test(txt(bb));
  })(), txt(document.querySelector('#reader-brief-slot .reader-brief h3')));
  ok('table survived the rewrite intact', (() => {
    const t2 = document.querySelector('#prayer-body table');
    return !!t2 && !!t2.closest('.table-scroll')
        && t2.querySelectorAll('tr').length === rowsBefore
        && t2.querySelectorAll('td,th').length === cellsBefore;
  })(), rowsBefore + ' rows / ' + cellsBefore + ' cells');
  ok('choice is stored for the next visit',
     window.localStorage.getItem('jinbhakt:translit') === '1',
     String(window.localStorage.getItem('jinbhakt:translit')));

  // Narration must keep reading Devanagari while the screen shows Latin.
  const spoken = [];
  const RealUtterance = window.SpeechSynthesisUtterance;
  window.SpeechSynthesisUtterance = function (t) { spoken.push(t); this.text = t; };
  const speakBtn = document.getElementById('btn-speak');
  click(speakBtn);
  await wait(60);
  ok('narration still uses Devanagari in the English view',
     spoken.length > 0 && DEV.test(spoken.join('\n')), (spoken[0] || '').slice(0, 60));
  ok('app.getSpeechText() is the Devanagari source', DEV.test(app.getSpeechText() || ''),
     (app.getSpeechText() || '').slice(0, 60));
  click(speakBtn);                                   // stop again
  window.SpeechSynthesisUtterance = RealUtterance;

  // Toggling off must give back the exact original markup.
  click(tBtn);
  await wait(60);
  ok('toggling off restores the original Devanagari markup',
     prayerBody().innerHTML === htmlDev,
     prayerBody().innerHTML.slice(0, 70) + ' ||| ' + htmlDev.slice(0, 70));

  ok('title is restored', txt(document.querySelector('.reader-title')) === titleDev,
     txt(document.querySelector('.reader-title')));
  ok('summary heading is restored', (() => {
    const h3 = document.querySelector('#reader-brief-slot .reader-brief h3');
    return !!h3 && txt(h3) === 'सारांश';
  })(), txt(document.querySelector('#reader-brief-slot .reader-brief h3')));
  ok('CSS hooks are cleared', !prayerBody().classList.contains('is-translit')
     && !document.body.classList.contains('translit-on'));
  ok('chrome labels go back to Devanagari', (() => {
    return txt(document.querySelector('[data-action="top"]')) === '↑ ऊपर'
        && txt(document.querySelector('.reader-actions a[href="#/bhakti"]')) === 'सूची देखें'
        && /सुनें/.test(txt(document.getElementById('btn-speak')))
        && DEV.test(txt(document.querySelector('.reader-meta')))
        && Array.from(document.querySelectorAll('.nav-btn-dir')).some(n => /पिछला|अगला/.test(txt(n)));
  })(), txt(document.querySelector('[data-action="top"]')) + ' | ' +
     txt(document.getElementById('btn-speak')) + ' | ' +
     txt(document.querySelector('.reader-meta')));
  ok('stored choice is cleared', !window.localStorage.getItem('jinbhakt:translit'),
     String(window.localStorage.getItem('jinbhakt:translit')));

  // The choice must survive navigation to a different passage.
  click(tBtn);
  await wait(60);
  const bhakti = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'bhakti.json'), 'utf8'));
  const other = bhakti.find(i => i.hasContent === true && i._id !== 'Namokar-Mahamantra');
  await openPassage('#/bhakti/' + encodeURIComponent(other._id));
  const tBtn2 = document.querySelector('.reader-actions [data-action="transliterate"]');
  ok('new passage opens already in English letters',
     txt(prayerBody()).length > 100 && !DEV.test(txt(prayerBody())),
     txt(prayerBody()).slice(0, 90));
  ok('new button renders in the pressed state',
     !!tBtn2 && tBtn2.classList.contains('is-active') &&
     tBtn2.getAttribute('aria-pressed') === 'true');
  ok('speech source followed the new passage',
     DEV.test(app.getSpeechText() || '') && app.getSpeechText().length > 100,
     'len=' + (app.getSpeechText() || '').length);

  click(tBtn2);
  await wait(60);
  ok('toggling off on the new passage brings Devanagari back',
     DEV.test(txt(prayerBody())) && !prayerBody().classList.contains('is-translit'));

  /* ------------------------------------------------------------------ */
  console.log('\n[14f] Choice survives a reload');

  /* The preference is read while app.js is being evaluated, so the only
     honest way to test "a returning visitor" is a genuinely fresh page that
     already has the key in localStorage before the scripts run. */
  const { boot } = require('./harness.js');
  const reloaded = await boot('#/bhakti/Namokar-Mahamantra', true, w => {
    w.localStorage.setItem('jinbhakt:translit', '1');
  });
  const rw = reloaded.window;
  const rd = reloaded.document;
  const rApp = rw.jinbhaktApp;

  /* A cold boot has to fetch the manifest and then the lazy text file, so
     wait for the passage to be painted before asserting on it — otherwise
     the "no Devanagari" checks would pass vacuously on an empty body. */
  await settle(() => (rApp.getSpeechText() || '').length > 50);

  const rBody = () => txt(rd.querySelector('#prayer-body'));

  ok('no JS errors on the reloaded page', reloaded.jsErrors.length === 0,
     reloaded.jsErrors.join(' | '));
  ok('the reloaded passage really finished loading', rBody().length > 100,
     'len=' + rBody().length);
  ok('a reload with the stored choice opens in English letters',
     rApp.isTransliterated() === true && rBody().length > 100 && !DEV.test(rBody()),
     rBody().replace(/\s+/g, ' ').slice(0, 80));
  ok('the reloaded button comes up pressed', (() => {
    const b = rd.querySelector('[data-action="transliterate"]');
    return !!b && b.classList.contains('is-active') && b.getAttribute('aria-pressed') === 'true';
  })());
  ok('the reloaded chrome is English', (() => {
    const title = txt(rd.querySelector('.reader-title'));
    const top = txt(rd.querySelector('[data-action="top"]'));
    return title.length > 0 && !DEV.test(title) && top === '↑ Top';
  })(), txt(rd.querySelector('.reader-title')) + ' | ' + txt(rd.querySelector('[data-action="top"]')));
  ok('the reloaded page still narrates Devanagari',
     DEV.test(rApp.getSpeechText() || ''), (rApp.getSpeechText() || '').slice(0, 60));

  rd.querySelector('[data-action="transliterate"]')
    .dispatchEvent(new rw.MouseEvent('click', { bubbles: true }));
  await wait(80);
  ok('turning it off again clears the stored choice',
     !rw.localStorage.getItem('jinbhakt:translit') &&
     rApp.isTransliterated() === false &&
     DEV.test(rBody()),
     rBody().replace(/\s+/g, ' ').slice(0, 60));
};
