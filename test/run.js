const { boot, ok, txt, wait, stats } = require('./harness.js');

(async function run() {
  console.log('\n=== JinBhakt functional test ===');
  const { window, document, jsErrors } = await boot('#/');

  console.log('\n[1] Boot + sidebar nav');
  ok('no uncaught JS errors on boot', jsErrors.length === 0, jsErrors.join(' | '));
  const nav = document.querySelectorAll('#category-list details.category-item');
  ok('nav renders 10 accordions', nav.length === 10, 'got ' + nav.length);
  ok('nav has home shortcut', !!document.querySelector('.nav-home-link[href="#/"]'));

  const badges = {};
  nav.forEach(d => { badges[d.dataset.cat] = txt(d.querySelector('.cat-count')); });
  ok('aarti badge = 5', badges.aarti === '5', 'got ' + badges.aarti);
  ok('bhakti badge = 2', badges.bhakti === '2', 'got ' + badges.bhakti);
  ok('stotra badge = 0', badges.stotra === '0', 'got ' + badges.stotra);
  ok('pooja badge = 167', badges.pooja === '167', 'got ' + badges.pooja);

  const pills = document.querySelectorAll('details[data-cat="aarti"] .link-pill:not(.pill-more)');
  ok('aarti nav lists 5 pills', pills.length === 5, 'got ' + pills.length);
  ok('pills use hash routes', pills[0] && /^#\/aarti\/.+/.test(pills[0].getAttribute('href')),
     pills[0] && pills[0].getAttribute('href'));
  ok('pill label is Hindi name', pills[0] && /आरती/.test(txt(pills[0])), pills[0] && txt(pills[0]));
  ok('stotra shows coming-soon note', !!document.querySelector('details[data-cat="stotra"] .cat-empty'));
  ok('bhakti shows "+N" pill', !!document.querySelector('details[data-cat="bhakti"] .pill-more'));

  console.log('\n[2] Home view');
  ok('hero heading renders', /जय जिनेन्द्र/.test(txt(document.querySelector('.home-hero h2'))),
     txt(document.querySelector('.home-hero h2')));
  const cards = document.querySelectorAll('.cat-grid .cat-card');
  ok('home shows 10 cards', cards.length === 10, 'got ' + cards.length);
  ok('cards link to hash routes', cards[0] && /^#\//.test(cards[0].getAttribute('href')),
     cards[0] && cards[0].getAttribute('href'));
  ok('empty cats get muted style', !!document.querySelector('.cat-card-empty'));
  ok('readable cards show a peek title', !!document.querySelector('.cat-card-peek'));
  ok('stat reports 1620 readable', /1620/.test(txt(document.querySelector('.hero-stat'))),
     txt(document.querySelector('.hero-stat')));

  console.log('\n[3] Category view');
  window.location.hash = '#/aarti';
  await wait(350);
  ok('category title = aarti', /आरती/.test(txt(document.querySelector('.cat-view-title'))),
     txt(document.querySelector('.cat-view-title')));
  const items = document.querySelectorAll('.item-list:not(.item-list-soon) .item-link');
  ok('lists 5 readable items', items.length === 5, 'got ' + items.length);
  const soon = document.querySelectorAll('.item-list-soon .item-row-disabled');
  ok('lists 0 pending titles', soon.length === 0, 'got ' + soon.length);
  ok('breadcrumb present', !!document.querySelector('.breadcrumb'));

  console.log('\n[4] Reader view');
  window.location.hash = items[0].getAttribute('href').slice(1);
  await wait(350);
  ok('reader title renders', /पंच.*परमेष्ठी/.test(txt(document.querySelector('.reader-title'))),
     txt(document.querySelector('.reader-title')));
  const body = document.querySelector('#prayer-body');
  ok('prayer body populated', !!body && txt(body).length > 100, 'len=' + (body ? txt(body).length : 0));
  ok('body keeps <br> breaks', !!body && body.querySelectorAll('br').length > 3,
     'brs=' + (body ? body.querySelectorAll('br').length : 0));
  ok('meta shows 1 / 5', /1 \/ 5/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));
  ok('speak button rendered', !!document.querySelector('#btn-speak[data-action="speak"]'));
  ok('list button links to category', !!document.querySelector('.reader-actions a[href="#/aarti"]'));
  const navBtns = document.querySelectorAll('.reader-nav .nav-btn:not(.nav-btn-placeholder)');
  ok('first item: next only', navBtns.length === 1 && navBtns[0].classList.contains('nav-next'),
     'count=' + navBtns.length);

  console.log('\n[5] Prev / Next');
  window.location.hash = document.querySelector('.reader-nav .nav-next').getAttribute('href').slice(1);
  await wait(350);
  ok('advanced to 2 / 5', /2 \/ 5/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));
  ok('both nav buttons present',
     document.querySelectorAll('.reader-nav .nav-btn:not(.nav-btn-placeholder)').length === 2);
  window.location.hash = document.querySelector('.reader-nav .nav-prev').getAttribute('href').slice(1);
  await wait(350);
  ok('prev returns to 1 / 5', /1 \/ 5/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));

  await require('./part2.js')({ window, document, jsErrors, ok, txt, wait });

  const s = stats();
  console.log('\n======================================');
  console.log('  PASSED: ' + s.pass + '    FAILED: ' + s.fail);
  console.log('======================================');
  if (s.fail) { console.log('\nFailures:'); s.problems.forEach(p => console.log('  - ' + p)); }
  process.exit(s.fail ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
