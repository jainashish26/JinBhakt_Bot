const fs = require('fs');
const path = require('path');
const { boot, ok, txt, wait, stats } = require('./harness.js');

(async function run() {
  console.log('\n=== JinBhakt functional test ===');
  const { window, document, jsErrors } = await boot('#/');

  console.log('\n[1] Boot + sidebar nav');
  ok('no uncaught JS errors on boot', jsErrors.length === 0, jsErrors.join(' | '));
  const cats = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'categories.json'), 'utf8'));
  const nav = document.querySelectorAll('#category-list details.category-item');
  // +1 = the Kids Learning menu section, always appended last
  ok('nav renders ' + (cats.length + 1) + ' accordions', nav.length === cats.length + 1, 'got ' + nav.length);
  ok('nav has home shortcut', !!document.querySelector('.nav-home-link[href="#/"]'));

  const badges = {};
  nav.forEach(d => { badges[d.dataset.cat] = txt(d.querySelector('.cat-count')); });
  ok('aarti badge = 45', badges.aarti === '45', 'got ' + badges.aarti);
  ok('bhakti badge = 52', badges.bhakti === '52', 'got ' + badges.bhakti);
  ok('stotra badge = 60', badges.stotra === '60', 'got ' + badges.stotra);
  ok('stuti badge = 64', badges.stuti === '64', 'got ' + badges.stuti);
  ok('chalisa badge = 27', badges.chalisa === '27', 'got ' + badges.chalisa);
  ok('pooja badge = 120', badges.pooja === '120', 'got ' + badges.pooja);

  const pills = document.querySelectorAll('details[data-cat="aarti"] .link-pill:not(.pill-more)');
  ok('aarti nav lists 45 pills', pills.length === 45, 'got ' + pills.length);
  ok('pills use hash routes', pills[0] && /^#\/aarti\/.+/.test(pills[0].getAttribute('href')),
     pills[0] && pills[0].getAttribute('href'));
  ok('pill label is Hindi name', pills[0] && /आरती/.test(txt(pills[0])), pills[0] && txt(pills[0]));
  const emptyCats = Array.from(nav).filter(d => d.querySelector('.cat-empty')).map(d => d.dataset.cat);
  ok('every category has readable content', emptyCats.length === 0, 'empty: ' + emptyCats.join(','));
  const stotraPills = document.querySelectorAll('details[data-cat="stotra"] .link-pill:not(.pill-more)');
  ok('stotra nav lists 60 pills', stotraPills.length === 60, 'got ' + stotraPills.length);
  ok('aarti shows "+N" pill for its pending title',
     !!document.querySelector('details[data-cat="aarti"] .pill-more'));
  ok('granth shows "+N" pill', !!document.querySelector('details[data-cat="granth"] .pill-more'));

  console.log('\n[2] Home view');
  ok('hero heading renders', /जय जिनेन्द्र/.test(txt(document.querySelector('.home-hero h2'))),
     txt(document.querySelector('.home-hero h2')));
  const cards = document.querySelectorAll('.cat-grid .cat-card');
  ok('home shows ' + cats.length + ' cards', cards.length === cats.length, 'got ' + cards.length);
  ok('cards link to hash routes', cards[0] && /^#\//.test(cards[0].getAttribute('href')),
     cards[0] && cards[0].getAttribute('href'));
  ok('no category card is empty', document.querySelectorAll('.cat-card-empty').length === 0,
     'empty cards: ' + document.querySelectorAll('.cat-card-empty').length);
  ok('readable cards show a peek title', !!document.querySelector('.cat-card-peek'));
  // Derive expected readable count from manifests on disk
  let expectedReadable = 0;
  cats.forEach(c => {
    const arr = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', c.id + '.json'), 'utf8'));
    expectedReadable += arr.filter(i => i.hasContent === true).length;
  });
  ok('stat reports ' + expectedReadable + ' readable',
     new RegExp(String(expectedReadable)).test(txt(document.querySelector('.hero-stat'))),
     txt(document.querySelector('.hero-stat')));

  console.log('\n[3] Category view');
  window.location.hash = '#/aarti';
  await wait(350);
  ok('category title = aarti', /आरती/.test(txt(document.querySelector('.cat-view-title'))),
     txt(document.querySelector('.cat-view-title')));
  const items = document.querySelectorAll('.item-list:not(.item-list-soon) .item-link');
  ok('lists 45 readable items', items.length === 45, 'got ' + items.length);
  const soon = document.querySelectorAll('.item-list-soon .item-row-disabled');
  ok('lists 1 pending title', soon.length === 1, 'got ' + soon.length);
  ok('breadcrumb present', !!document.querySelector('.breadcrumb'));
  ok('aarti grouped by subcategory',
     document.querySelectorAll('.cat-view .subcat-title').length === 3,
     'subs=' + document.querySelectorAll('.cat-view .subcat-title').length);

  console.log('\n[4] Reader view');
  window.location.hash = items[0].getAttribute('href').slice(1);
  await wait(350);
  ok('reader title renders', /नन्दीश्वर.*आरती/.test(txt(document.querySelector('.reader-title'))),
     txt(document.querySelector('.reader-title')));
  const body = document.querySelector('#prayer-body');
  ok('prayer body populated', !!body && txt(body).length > 100, 'len=' + (body ? txt(body).length : 0));
  ok('body keeps <br> breaks', !!body && body.querySelectorAll('br').length > 3,
     'brs=' + (body ? body.querySelectorAll('br').length : 0));
  ok('meta shows 1 / 45', /1 \/ 45/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));
  ok('speak button rendered', !!document.querySelector('#btn-speak[data-action="speak"]'));
  ok('list button links to category', !!document.querySelector('.reader-actions a[href="#/aarti"]'));
  const navBtns = document.querySelectorAll('.reader-nav .nav-btn:not(.nav-btn-placeholder)');
  ok('first item: next only', navBtns.length === 1 && navBtns[0].classList.contains('nav-next'),
     'count=' + navBtns.length);

  console.log('\n[5] Prev / Next');
  window.location.hash = document.querySelector('.reader-nav .nav-next').getAttribute('href').slice(1);
  await wait(350);
  ok('advanced to 2 / 45', /2 \/ 45/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));
  ok('both nav buttons present',
     document.querySelectorAll('.reader-nav .nav-btn:not(.nav-btn-placeholder)').length === 2);
  window.location.hash = document.querySelector('.reader-nav .nav-prev').getAttribute('href').slice(1);
  await wait(350);
  ok('prev returns to 1 / 45', /1 \/ 45/.test(txt(document.querySelector('.reader-meta'))),
     txt(document.querySelector('.reader-meta')));

  await require('./part2.js')({ window, document, jsErrors, ok, txt, wait });

  await require('./part8.js')({ window, document, jsErrors, ok, txt, wait });

  const s = stats();
  console.log('\n======================================');
  console.log('  PASSED: ' + s.pass + '    FAILED: ' + s.fail);
  console.log('======================================');
  if (s.fail) { console.log('\nFailures:'); s.problems.forEach(p => console.log('  - ' + p)); }
  process.exit(s.fail ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
