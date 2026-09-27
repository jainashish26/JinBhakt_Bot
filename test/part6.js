/**
 * Panchang engine tests — astronomical accuracy and data integrity.
 */
module.exports = async function (ctx) {
  const { window, ok, wait } = ctx;
  const P = window.jinbhaktPanchang;
  const app = window.jinbhaktApp;

  console.log('\n[20] Panchang engine — core functions');

  const jd1 = P.toJulianDay(2000, 1, 1, 12);
  ok('J2000.0 epoch = JD 2451545.0', Math.abs(jd1 - 2451545.0) < 0.01, 'got ' + jd1);

  const aya2025 = P.ayanamsa(P.toJulianDay(2025, 6, 15, 0));
  ok('Lahiri ayanamsa ~24° in 2025', aya2025 > 23.5 && aya2025 < 24.5, 'got ' + aya2025.toFixed(3));

  const jdEquinox = P.toJulianDay(2025, 3, 20, 9);
  const sunLon = P.sunLongitude(jdEquinox);
  ok('Sun ~0° (vernal equinox) Mar 20 2025', sunLon < 5 || sunLon > 355, 'got ' + sunLon.toFixed(2));

  const moonLon = P.moonLongitude(jd1);
  ok('Moon longitude in [0,360)', moonLon >= 0 && moonLon < 360, 'got ' + moonLon.toFixed(2));

  const srUT = P.sunriseUT(2026, 6, 21);
  ok('Ujjain sunrise ~0-6 UT in summer', srUT > 0 && srUT < 6, 'got ' + srUT.toFixed(2) + 'h UT');

  const ti = P.tithiAt(P.toJulianDay(2026, 11, 8, 3));
  ok('tithi index in [0,29]', ti.index >= 0 && ti.index <= 29, 'got ' + ti.index);
  ok('paksha is 0 or 1', ti.paksha === 0 || ti.paksha === 1);
  ok('tithiNo in [1,15]', ti.tithiNo >= 1 && ti.tithiNo <= 15);

  console.log('\n[21] Golden checkpoint dates (±1 day tolerance)');

  function checkFestival(name, year, month, day, eM, eP, eT) {
    var found = false, info = '';
    for (var off = -1; off <= 1; off++) {
      var d = new Date(year, month - 1, day + off);
      var ld = P.lunarDate(d);
      if (ld.month === eM && ld.paksha === eP && ld.tithiNo === eT) {
        found = true;
        info = d.toISOString().slice(0, 10) + ' → ' + ld.monthH + ' ' + ld.pakshaH + ' ' + ld.tithiNo;
        break;
      }
    }
    ok(name + ' ±1d of ' + year + '-' + month + '-' + day, found, info || 'not matched');
  }

  checkFestival('Mahavir Jayanti 2025', 2025, 4, 10, 0, 0, 13);
  checkFestival('Mahavir Jayanti 2026', 2026, 3, 31, 0, 0, 13);
  checkFestival('Mahavir Jayanti 2027', 2027, 4, 19, 0, 0, 13);
  checkFestival('Diwali 2025', 2025, 10, 21, 7, 1, 15);
  checkFestival('Diwali 2026', 2026, 11, 8, 7, 1, 15);
  checkFestival('Diwali 2027', 2027, 10, 29, 7, 1, 15);
  checkFestival('Kshamavani 2025', 2025, 9, 8, 6, 1, 1);
  checkFestival('Kshamavani 2026', 2026, 9, 26, 6, 1, 1);
  checkFestival('Dashalakshana start 2025', 2025, 8, 28, 5, 0, 5);
  checkFestival('Dashalakshana start 2026', 2026, 9, 16, 5, 0, 5);
  checkFestival('Dashalakshana end 2025', 2025, 9, 6, 5, 0, 14);
  checkFestival('Dashalakshana end 2026', 2026, 9, 25, 5, 0, 14);
  checkFestival('Akshaya Tritiya 2026', 2026, 4, 19, 1, 0, 3);
  checkFestival('Akshaya Tritiya 2027', 2027, 5, 9, 1, 0, 3);

  console.log('\n[22] Panchang data integrity');
  const data = await app.fetchPanchangData();
  ok('panchang.json loaded', !!data);
  ok('parvs array exists', Array.isArray(data && data.parvs), 'n=' + (data && data.parvs ? data.parvs.length : 0));
  ok('kalyanaks has 24 Tirthankaras', data && data.kalyanaks && data.kalyanaks.tirthankaras.length === 24,
     'got ' + (data && data.kalyanaks ? data.kalyanaks.tirthankaras.length : 0));

  if (data && data.kalyanaks) {
    var mahavir = data.kalyanaks.tirthankaras.find(function(t) { return t.id === 'mahavir'; });
    ok('Mahavir entry found', !!mahavir);
    if (mahavir) {
      ok('Mahavir Janma = Chaitra Shukla 13',
         mahavir.k.janma.m === 0 && mahavir.k.janma.p === 0 && mahavir.k.janma.t === 13);
      ok('Mahavir Moksh = Kartika Krishna 15',
         mahavir.k.moksh.m === 7 && mahavir.k.moksh.p === 1 && mahavir.k.moksh.t === 15);
    }
    var parshva = data.kalyanaks.tirthankaras.find(function(t) { return t.id === 'parshvanath'; });
    if (parshva) {
      ok('Parshvanath Janma = Pausha Krishna 10',
         parshva.k.janma.m === 9 && parshva.k.janma.p === 1 && parshva.k.janma.t === 10);
    }
    var adinath = data.kalyanaks.tirthankaras.find(function(t) { return t.id === 'rishabh'; });
    if (adinath) {
      ok('Adinath Janma = Chaitra Krishna 9',
         adinath.k.janma.m === 0 && adinath.k.janma.p === 1 && adinath.k.janma.t === 9);
    }
  }

  if (data && data.parvs) {
    var dasha = data.parvs.find(function(p) { return p.id === 'dashalakshana'; });
    ok('Dashalakshana: Bhadrapada Shukla 5–14',
       dasha && dasha.month === 5 && dasha.paksha === 0 && dasha.startTithi === 5 && dasha.endTithi === 14);
    var kshama = data.parvs.find(function(p) { return p.id === 'kshamavani'; });
    ok('Kshamavani: Ashvina Krishna 1 (purnimanta)',
       kshama && kshama.month === 6 && kshama.paksha === 1 && kshama.startTithi === 1);
  }

  console.log('\n[23] Panchang Patra rendering');
  window.location.hash = '#/';
  await wait(1200);

  const patra = window.document.querySelector('.panchang-patra');
  ok('Panchang Patra rendered on home', !!patra);
  if (patra) {
    ok('patra has title', patra.querySelector('.patra-title') &&
       /पंचांग पत्र/.test(patra.querySelector('.patra-title').textContent));
    ok('patra has SVG moon', !!patra.querySelector('.patra-moon svg'));
    ok('patra has tithi text', !!patra.querySelector('.patra-tithi') &&
       patra.querySelector('.patra-tithi').textContent.length > 0);
    ok('patra has month text', !!patra.querySelector('.patra-month'));
    ok('patra has samvat', !!patra.querySelector('.patra-samvat') &&
       /\d/.test(patra.querySelector('.patra-samvat').textContent));
    ok('patra has aria-label', !!patra.getAttribute('aria-label'));
  }

  const svgNew = app.buildMoonSVG(0.01, true);
  ok('new moon SVG dark', /#2A1A0A/.test(svgNew));
  const svgFull = app.buildMoonSVG(0.99, true);
  ok('full moon SVG bright', /#F5E6C8/.test(svgFull) && !/#2A1A0A/.test(svgFull));
  const svgHalf = app.buildMoonSVG(0.5, true);
  ok('half moon has shadow path', /path d=/.test(svgHalf));

  ok('Nakshatra table = 27', P.NAKSHATRAS.length === 27);
  ok('Month table = 12', P.MONTHS.length === 12);
  ok('Devanagari digits', P.toDevNum(2026) === '२०२६', P.toDevNum(2026));

  const nmJD = P.findRecentNewMoon(P.toJulianDay(2026, 11, 10, 12));
  const nmDate = new Date((nmJD - 2440587.5) * 86400000);
  ok('New moon finder: near Nov 8–9 2026',
     Math.abs(nmDate.getTime() - new Date(2026, 10, 9).getTime()) < 2 * 86400000,
     nmDate.toISOString().slice(0, 10));
};
