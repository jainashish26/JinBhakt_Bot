module.exports = async function (ctx) {
  const { window, document, ok, txt, wait, jsErrors } = ctx;
  const app = window.jinbhaktApp;

  console.log('\n[11] Mobile drawer');
  const toggle = document.getElementById('menu-toggle');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('drawer opens', document.body.classList.contains('nav-open'));
  ok('aria-expanded true', toggle.getAttribute('aria-expanded') === 'true');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('drawer closes', !document.body.classList.contains('nav-open'));
  ok('aria-expanded false', toggle.getAttribute('aria-expanded') === 'false');

  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  document.getElementById('body-overlay')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('overlay click closes drawer', !document.body.classList.contains('nav-open'));

  console.log('\n[12] Desktop mode (>=900px)');
  const desk = await require('./harness.js').boot('#/aarti', false);
  const d = desk.document;
  ok('desktop: no drawer open', !d.body.classList.contains('nav-open'));
  ok('desktop: nav has 10 accordions',
     d.querySelectorAll('#category-list details.category-item').length === 10);
  ok('desktop: category view rendered', !!d.querySelector('.cat-view-title'));
  ok('desktop: 5 item links',
     d.querySelectorAll('.item-list:not(.item-list-soon) .item-link').length === 5);
  ok('desktop: no runtime errors', desk.jsErrors.length === 0,
     desk.jsErrors.slice(0, 2).join(' | '));

  console.log('\n[12b] Granth subcategories + lazy scripture content');
  window.location.hash = '#/granth';
  await wait(400);
  ok('granth category view rendered', /ग्रन्थ/.test(txt(document.querySelector('.cat-view-title'))),
     txt(document.querySelector('.cat-view-title')));
  const subTitles = Array.from(document.querySelectorAll('.cat-view .subcat-title')).map(n => txt(n));
  ok('granth grouped into 3 subcategories', subTitles.length === 3, subTitles.join(' | '));
  ok('subcategories include टीका and गाथा',
     subTitles.some(s => /टीका/.test(s)) && subTitles.some(s => /गाथा/.test(s)), subTitles.join(' | '));
  const granthLinks = document.querySelectorAll('.cat-view .item-list:not(.item-list-soon) .item-link');
  ok('granth lists 127 readable scriptures', granthLinks.length === 127, 'got ' + granthLinks.length);
  // Open the first scripture and confirm its body is lazily fetched + rendered.
  window.location.hash = granthLinks[0].getAttribute('href').slice(1);
  await wait(1800);
  const gBody = document.getElementById('prayer-body');
  ok('granth reader title renders',
     !!document.querySelector('.reader-title') && txt(document.querySelector('.reader-title')).length > 0);
  ok('granth body lazily populated (>200 chars)', !!gBody && txt(gBody).length > 200,
     'len=' + (gBody ? txt(gBody).length : 0));
  ok('granth content memoised after load',
     Object.keys(app.state.contentCache).some(k => k.indexOf('granth/') === 0),
     Object.keys(app.state.contentCache).join(','));

  console.log('\n[13] Speech wiring');
  window.location.hash = '#/aarti/पंच_परमेष्ठी_आरती_पण्डित_द्यानतराय';
  await wait(350);
  const speak = document.getElementById('btn-speak');
  ok('getCurrentText returns prayer text', app.getCurrentText().length > 100,
     'len=' + app.getCurrentText().length);
  speak.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(250);
  ok('speaking state entered', speak.classList.contains('is-speaking'),
     'class=' + speak.className);
  ok('aria-pressed true while speaking', speak.getAttribute('aria-pressed') === 'true');
  ok('button label switches to stop', /रोकें/.test(txt(speak)), txt(speak));
  speak.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(200);
  ok('stop clears speaking state', !speak.classList.contains('is-speaking'),
     'class=' + speak.className);
  ok('aria-pressed false after stop', speak.getAttribute('aria-pressed') === 'false');
  ok('button label switches back to play', /सुनें/.test(txt(speak)), txt(speak));

  console.log('\n[14] Keyboard shortcuts');
  const key = (k, mod) => window.document.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: k, bubbles: true, ctrlKey: !!mod }));
  key('/');
  await wait(120);
  ok('"/" focuses search', document.activeElement && document.activeElement.id === 'search-input',
     document.activeElement && document.activeElement.id);
  key('Escape');
  await wait(120);
  ok('Escape blurs search',
     document.activeElement !== document.getElementById('search-input'));

  key('Home');
  await wait(200);
  ok('Home key goes to #/', window.location.hash === '#/', window.location.hash);

  console.log('\n[15] Console health');
  const real = jsErrors.filter(e =>
    !/SW registration|serviceWorker|Not implemented|scroll|Could not parse CSS/i.test(e));
  ok('no unexpected runtime errors', real.length === 0, real.slice(0, 3).join(' | '));

  require('./part4.js')(ctx);
};
