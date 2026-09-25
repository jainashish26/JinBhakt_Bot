module.exports = async function (ctx) {
  const { window, document, ok, txt, wait } = ctx;

  console.log('\n[6] Table content (Namokar Mantra)');
  window.location.hash = '#/bhakti/Namokar-Mahamantra';
  await wait(400);
  ok('title = Namokar Mahamantra', /णमोकार मंत्र/.test(txt(document.querySelector('.reader-title'))),
     txt(document.querySelector('.reader-title')));
  const tbl = document.querySelector('#prayer-body table');
  ok('TABLE element preserved', !!tbl);
  ok('table has >=5 rows', !!tbl && tbl.querySelectorAll('tr').length >= 5,
     'rows=' + (tbl ? tbl.querySelectorAll('tr').length : 0));
  ok('header text intact', !!tbl && /प्राकृत/.test(tbl.textContent));
  ok('table has no leftover attributes',
     !!tbl && Array.from(tbl.querySelectorAll('*')).every(n => n.attributes.length === 0));
  ok('table wrapped for horizontal scroll', !!document.querySelector('#prayer-body .table-scroll'));

  console.log('\n[7] Sanitizer security (real sanitizeHTML)');
  const app7 = window.jinbhaktApp;
  const inj = '<p>ok</p><script>window.__pwn=1<\/script>' +
              '<img src=x onerror="window.__pwn=2"><a href="javascript:alert(1)">x</a>' +
              '<div onclick="window.__pwn=3">c</div><iframe src="http://evil"></iframe>' +
              '<style>body{display:none}</style><b>bold</b>' +
              '<table><tr><td bgcolor="red" onmouseover="x()">cell</td></tr></table>' +
              '<!-- secret comment -->';
  const clean = app7.sanitizeHTML(inj);
  ok('sanitizeHTML exposed', typeof app7.sanitizeHTML === 'function');
  ok('script tag removed', !/<script/i.test(clean), clean.slice(0, 90));
  ok('img onerror removed', !/onerror/i.test(clean));
  ok('onclick attr removed', !/onclick/i.test(clean));
  ok('onmouseover attr removed', !/onmouseover/i.test(clean));
  ok('javascript: href removed', !/javascript:/i.test(clean));
  ok('iframe removed', !/<iframe/i.test(clean));
  ok('style tag removed', !/<style/i.test(clean));
  ok('html comments removed', !/secret comment/.test(clean));
  ok('bgcolor attr stripped', !/bgcolor/i.test(clean));
  ok('safe tags kept', /<b>/.test(clean) && /<p>/.test(clean) && /<td>/.test(clean), clean);
  ok('text content preserved', /bold/.test(clean) && /cell/.test(clean));

  console.log('\n[8] Unavailable item deep link');
  window.location.hash = '#/aarti/आरती_बाहुबली_भगवान';
  await wait(350);
  ok('shows being-prepared state', !!document.querySelector('.empty-state'));
  ok('no empty prayer body', !document.querySelector('#prayer-body'));
  ok('still offers a list link', !!document.querySelector('.empty-state a[href="#/aarti"]'));

  console.log('\n[9] Unknown routes');
  window.location.hash = '#/aarti/Does_Not_Exist_XYZ';
  await wait(350);
  ok('shows not-found state', /नहीं मिली/.test(txt(document.querySelector('.empty-state h2'))),
     txt(document.querySelector('.empty-state h2')));
  window.location.hash = '#/nonexistentcat';
  await wait(350);
  ok('unknown category falls back to home', !!document.querySelector('.home-hero'));

  console.log('\n[10] Search over full catalogue');
  const app = window.jinbhaktApp;
  ok('jinbhaktApp exposed', !!app && typeof app.getCurrentText === 'function');
  ok('index covers all 1854 items', app.state.searchIndex.length === 1854,
     'got ' + app.state.searchIndex.length);

  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results-box');

  input.value = 'आरती';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(500);
  let res = box.querySelectorAll('.search-result-item');
  ok('Hindi query returns results', res.length > 0, 'got ' + res.length);
  ok('results are hash links', !!res[0] && /^#\//.test(res[0].getAttribute('href')),
     res[0] && res[0].getAttribute('href'));
  ok('readable ranked above pending', !!res[0] && !res[0].classList.contains('result-pending'));
  ok('results show category badge', !!res[0] && !!res[0].querySelector('.result-cat'));

  input.value = 'namokar';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(500);
  res = box.querySelectorAll('.search-result-item');
  ok('English name also matches', res.length >= 1, 'got ' + res.length);

  input.value = 'zzzqqqxxx';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(500);
  ok('no-match message shown', /कोई परिणाम नहीं/.test(txt(box)), txt(box).slice(0, 60));

  input.value = '';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(350);
  ok('clearing query hides box', box.classList.contains('hidden'));

  await require('./part3.js')(ctx);
};
