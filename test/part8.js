const fs = require('fs');
const path = require('path');

/**
 * Part 8 — Kids Learning (बाल शिक्षा)
 * Menu section, #/kids hub, #/kids/<game> frame, home banner, quick bar,
 * the JinBhaktKids module contract, and service-worker coverage.
 */
module.exports = async function (ctx) {
  const { window, document, jsErrors, ok, txt, wait } = ctx;
  const app = window.jinbhaktApp;
  const Kids = window.JinBhaktKids;

  console.log('\n[27] Kids Learning — menu section');
  window.location.hash = '#/';
  await wait(400);

  const catList = document.getElementById('category-list');
  const section = catList.querySelector('details.kids-category');
  ok('menu section exists', !!section);
  ok('menu section is LAST in the menu bar',
     catList.lastElementChild === section,
     catList.lastElementChild && catList.lastElementChild.className);
  ok('menu section carries data-kids', section && section.getAttribute('data-kids') === '1');

  const gamePills = section ? section.querySelectorAll('.link-pill[data-id]') : [];
  ok('section lists 6 game pills', gamePills.length === 6, 'got ' + gamePills.length);
  ok('pills use #/kids/<id> routes',
     Array.from(gamePills).every(a => /^#\/kids\/[a-z-]+$/.test(a.getAttribute('href'))),
     gamePills[0] && gamePills[0].getAttribute('href'));
  ok('section has an "all games" pill',
     !!(section && section.querySelector('.pill-more[href="#/kids"]')));
  ok('section badge shows 6',
     section && txt(section.querySelector('.cat-count')) === '6',
     section && txt(section.querySelector('.cat-count')));

  // the section must survive a lens switch and stay last
  const lensIds = ['path', 'index', 'mine', 'browse'];
  for (const lens of lensIds) {
    const tab = document.querySelector('.lens-tab[data-lens="' + lens + '"]');
    if (!tab) { ok('lens tab present: ' + lens, false); continue; }
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await wait(60);
    ok('kids section last in lens "' + lens + '"',
       catList.lastElementChild && catList.lastElementChild.classList.contains('kids-category'),
       catList.lastElementChild && catList.lastElementChild.className);
  }

  console.log('\n[28] Kids Learning — hub route');
  window.location.hash = '#/kids';
  await wait(400);
  const hub = document.querySelector('.kids-view');
  ok('#/kids renders the hub', !!hub);
  const cards = document.querySelectorAll('.kids-grid .kids-card');
  ok('hub shows 6 cards', cards.length === 6, 'got ' + cards.length);
  ok('card titles are Devanagari',
     !!document.querySelector('.kids-card-title') &&
     /[\u0900-\u097F]/.test(txt(document.querySelector('.kids-card-title'))),
     document.querySelector('.kids-card-title') && txt(document.querySelector('.kids-card-title')));
  const ids = Kids.getGames().map(g => g.id);
  ok('card links are #/kids/<id>',
     Array.from(cards).every((c, i) => c.getAttribute('href') === '#/kids/' + ids[i]),
     cards[0] && cards[0].getAttribute('href'));
  ok('hub breadcrumb present', !!document.querySelector('.kids-view .breadcrumb'));
  ok('hub hero has the swastika SVG',
     !!document.querySelector('.kids-hero-mark svg'));
  ok('document.title set', /बाल शिक्षा|Kids Learning/.test(document.title), document.title);
  ok('hub leaderboard panel rendered', !!document.querySelector('.kids-lb'));
  ok('hub offline note rendered', document.querySelectorAll('.kids-note').length >= 1);

  console.log('\n[29] Kids Learning — game route');
  window.location.hash = '#/kids/memory-match';
  await wait(400);
  const frame = document.querySelector('.kids-frame');
  ok('#/kids/memory-match renders an iframe', !!frame);
  ok('iframe src is the game file + params',
     frame && /^games\/memory-match\.html\?embed=1&lang=(hi|en)/.test(frame.getAttribute('src')),
     frame && frame.getAttribute('src'));
  ok('iframe has a title', frame && (frame.getAttribute('title') || '').length > 0);
  ok('iframe is not sandboxed (shares localStorage)',
     frame && !frame.hasAttribute('sandbox'));
  ok('back link returns to the hub',
     !!document.querySelector('.kids-game-bar a[href="#/kids"], .breadcrumb a[href="#/kids"]'));
  ok('open-in-new-tab link present',
     !!document.querySelector('.kids-frame-open[target="_blank"]'));
  ok('reload button present', !!document.getElementById('kids-reload'));
  ok('game breadcrumb names the game',
     /स्मृति पट्ट|Memory Match/.test(txt(document.querySelector('.crumb-current'))),
     txt(document.querySelector('.crumb-current')));

  window.location.hash = '#/kids/does-not-exist';
  await wait(350);
  ok('unknown game id falls back to the hub',
     !!document.querySelector('.kids-view') && !document.querySelector('.kids-frame'));
  ok('no JS errors while routing kids screens', jsErrors.length === 0,
     jsErrors.slice(0, 2).join(' | '));

  console.log('\n[30] Home banner + quick bar');
  window.location.hash = '#/';
  await wait(450);
  const cats = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'categories.json'), 'utf8'));
  ok('home still has exactly ' + cats.length + ' category cards',
     document.querySelectorAll('.cat-grid .cat-card').length === cats.length,
     'got ' + document.querySelectorAll('.cat-grid .cat-card').length);
  const banner = document.querySelector('.kids-banner');
  ok('home shows the kids banner', !!banner);
  ok('banner links to #/kids', banner && banner.getAttribute('href') === '#/kids');
  ok('banner is OUTSIDE .cat-grid', banner && !banner.closest('.cat-grid'));
  ok('banner has the swastika SVG', !!document.querySelector('.kids-banner-mark svg'));
  ok('quick bar has the kids entry', !!document.querySelector('.quick-bar a[href="#/kids"]'));
  ok('quick bar keeps the menu button last',
     (() => {
       const b = document.querySelectorAll('.quick-bar .quick-bar-btn');
       return b.length > 0 && b[b.length - 1].getAttribute('data-action') === 'open-nav';
     })());

  console.log('\n[31] JinBhaktKids module contract');
  ok('module is exposed', !!Kids);
  ok('exposes 6 games', Kids.getGames().length === 6, 'got ' + Kids.getGames().length);
  ok('game ids are unique', new Set(ids).size === 6);
  ok('every game file exists on disk',
     Kids.getGames().every(g => fs.existsSync(path.join(__dirname, '..', g.file))),
     Kids.getGames().filter(g => !fs.existsSync(path.join(__dirname, '..', g.file)))
       .map(g => g.file).join(','));
  ok('every game has both languages',
     Kids.getGames().every(g => g.hi && g.en && g.blurbHi && g.blurbEn));
  ok('gameById finds a known id', !!Kids.gameById('memory-match'));
  ok('gameById returns null for an unknown id', Kids.gameById('nope') === null);
  ok('hubCopy has en + hi', !!Kids.hubCopy('en').title && !!Kids.hubCopy('hi').title);
  ok('KEYS exposes the three shared storage keys',
     Kids.KEYS.prefs === 'jinbhakt:kids:prefs:v1' &&
     Kids.KEYS.leaderboard === 'jinbhakt:kids:leaderboard:v1' &&
     Kids.KEYS.vows === 'jinbhakt:kids:vows:v1');

  // sanitising
  ok('sanitizeName strips markup',
     Kids.sanitizeName('<img src=x onerror=alert(1)>').indexOf('<') < 0,
     Kids.sanitizeName('<img src=x>'));
  ok('sanitizeName caps at 20 chars',
     Kids.sanitizeName('a'.repeat(60)).length <= 20,
     Kids.sanitizeName('a'.repeat(60)).length);
  ok('sanitizeName collapses whitespace',
     Kids.sanitizeName('  a   b  ') === 'a b', JSON.stringify(Kids.sanitizeName('  a   b  ')));

  // formatting
  ok('formatDuration mm:ss', Kids.formatDuration(90, 'en') === '1:30', Kids.formatDuration(90, 'en'));
  ok('formatDuration Devanagari digits',
     Kids.formatDuration(90, 'hi') === '\u0967:\u0969\u0966', Kids.formatDuration(90, 'hi'));
  ok('formatDuration over an hour',
     Kids.formatDuration(3700, 'en') === '1h 1m', Kids.formatDuration(3700, 'en'));
  ok('formatDuration clamps negatives', Kids.formatDuration(-5, 'en') === '0:00');

  // leaderboard round-trip (uses jsdom's real localStorage)
  Kids.lbClear();
  const w1 = Kids.lbWrite('memory-match', {
    name: 'Aarav', level: 'Chinh · 6 pairs', levelKey: 'chinh-6',
    duration: 90, score: 0, meta: { moves: 20, pairs: 6 }
  });
  ok('lbWrite returns rank 1 for the first entry', w1.rank === 1 && w1.isBest === true,
     JSON.stringify(w1));
  const w2 = Kids.lbWrite('memory-match', {
    name: 'Beena', level: 'Chinh · 6 pairs', levelKey: 'chinh-6',
    duration: 60, score: 0, meta: { moves: 18, pairs: 6 }
  });
  ok('duration-asc ranks the faster round first',
     w2.rank === 1 && Kids.lbBest('memory-match').name === 'Beena',
     Kids.lbBest('memory-match').name);
  ok('lbRead returns both entries sorted', Kids.lbRead('memory-match').length === 2);
  ok('lbBest scoped to a levelKey', Kids.lbBest('memory-match', 'chinh-6').name === 'Beena');
  ok('lbBest returns null for an unused levelKey', Kids.lbBest('memory-match', 'varna-4') === null);

  // score-desc policy
  Kids.lbWrite('sattvic-chef', { name: 'A', levelKey: 'kids-8', duration: 40, score: 100, meta: { correct: 6 } });
  Kids.lbWrite('sattvic-chef', { name: 'B', levelKey: 'kids-8', duration: 55, score: 180, meta: { correct: 8 } });
  ok('score-desc ranks the higher score first',
     Kids.lbBest('sattvic-chef').name === 'B', Kids.lbBest('sattvic-chef').name);

  // vows-desc policy
  Kids.lbWrite('niyam-wheel', { name: 'C', levelKey: 'adults', duration: 300, score: 0, meta: { vows: 3, streakDays: 2 } });
  Kids.lbWrite('niyam-wheel', { name: 'D', levelKey: 'adults', duration: 900, score: 0, meta: { vows: 9, streakDays: 5 } });
  ok('vows-desc ranks the greater vow count first',
     Kids.lbBest('niyam-wheel').name === 'D', Kids.lbBest('niyam-wheel').name);

  // trimming
  for (let i = 0; i < 25; i++) {
    Kids.lbWrite('myth-busters', { name: 'P' + i, levelKey: 'kids-10', duration: 100 + i, score: i, meta: {} });
  }
  ok('leaderboard trims to ' + Kids.LB_MAX,
     Kids.lbRead('myth-busters').length === Kids.LB_MAX,
     'got ' + Kids.lbRead('myth-busters').length);

  // scoped clear
  Kids.lbClear('myth-busters');
  ok('lbClear(gameId) clears only that game',
     Kids.lbRead('myth-busters').length === 0 && Kids.lbRead('memory-match').length === 2);
  Kids.lbClear();
  ok('lbClear() clears everything', Object.keys(Kids.lbReadAll()).length === 0);

  // prefs
  Kids.writePrefs({ lang: 'en', name: 'Aarav', aud: 'adults' });
  const pf = Kids.readPrefs();
  ok('prefs round-trip', pf.lang === 'en' && pf.name === 'Aarav' && pf.aud === 'adults',
     JSON.stringify(pf));
  ok('prefs sanitise the name on write', Kids.writePrefs({ name: '<b>Evil</b>' }).name.indexOf('<') < 0);
  ok('prefs ignore unknown keys', Kids.writePrefs({ bogus: 1 }).bogus === undefined);
  Kids.writePrefs({ lang: 'hi', name: '', aud: 'kids' });


  console.log('\n[32] Service worker + packaging coverage');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  ok('cache bumped past v17', /jinbhakt-v(1[89]|[2-9]\d)/.test(sw),
     (sw.match(/jinbhakt-v\d+/) || ['none'])[0]);
  ok('js/kids.js precached', sw.indexOf('./js/kids.js') >= 0);
  const gameFiles = ['index.html', 'sattvic-chef.html', 'myth-busters.html',
    'tirthankar-sort.html', 'niyam-wheel.html', 'niyam-lotus.html', 'memory-match.html'];
  gameFiles.forEach(f => {
    ok('service worker precaches games/' + f, sw.indexOf('./games/' + f) >= 0);
  });
  ok('GAMES_ASSETS concatenated into the install list',
     /SHELL_ASSETS\.concat\(CONTENT_ASSETS\)\.concat\(GAMES_ASSETS\)/.test(sw));

  const tax = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'taxonomy.json'), 'utf8'));
  const kidsQb = (tax.quickBar || []).filter(q => q.id === 'kids')[0];
  ok('taxonomy quickBar has a kids entry pointing at #/kids',
     !!kidsQb && kidsQb.href === '#/kids', kidsQb ? kidsQb.href : 'absent');
  ok('taxonomy quickBar keeps the menu button last',
     tax.quickBar[tax.quickBar.length - 1].id === 'menu');

  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok('index.html loads js/kids.js', /<script src="js\/kids\.js" defer><\/script>/.test(indexHtml));
  ok('js/kids.js loads before js/app.js',
     indexHtml.indexOf('js/kids.js') < indexHtml.indexOf('js/app.js'));

  ok('no JS errors across the whole Kids Learning suite', jsErrors.length === 0,
     jsErrors.slice(0, 2).join(' | '));
};

