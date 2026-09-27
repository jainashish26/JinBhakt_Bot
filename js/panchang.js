/**
 * ============================================================
 *  JinBhakt — Panchang Engine
 *  Pure-function lunar/tithi computation for Jain Digambar
 *  calendar observances.  Zero dependencies, DOM-free.
 *
 *  Exposes: window.jinbhaktPanchang
 * ============================================================
 */
(function () {
  'use strict';

  var DEG  = Math.PI / 180;
  var RAD  = 180 / Math.PI;
  var PI2  = 2 * Math.PI;

  /* Default observation point: Ujjain (traditional prime meridian). */
  var _lat = 23.18;
  var _lng = 75.77;
  var _tz  = 5.5;

  var MONTHS = [
    'चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ', 'श्रावण', 'भाद्रपद',
    'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'
  ];
  var MONTHS_LATIN = [
    'Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada',
    'Ashvina', 'Kartika', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'
  ];
  var TITHIS = [
    'प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी',
    'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी',
    'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी', 'अमावस्या/पूर्णिमा'
  ];
  var DEV_DIGITS = ['०','१','२','३','४','५','६','७','८','९'];
  var NAKSHATRAS = [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
    'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी',
    'हस्त', 'चित्रा', 'स्वाती', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
    'मूल', 'पूर्वाषाढा', 'उत्तराषाढा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
    'पूर्वा भाद्रपद', 'उत्तरा भाद्रपद', 'रेवती'
  ];

  function norm360(a) { return ((a % 360) + 360) % 360; }
  function toDevNum(n) {
    return String(n).replace(/\d/g, function (d) { return DEV_DIGITS[+d]; });
  }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- Julian Day Number (Meeus §7) ---------- */
  function toJulianDay(year, month, day, hour) {
    if (month <= 2) { year -= 1; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + day + (hour || 0) / 24.0 + B - 1524.5;
  }

  /* ---------- Lahiri (Chitrapaksha) Ayanamsa ---------- */
  function ayanamsa(jd) {
    return 23.8562 + 0.013969 * (jd - 2451545.0) / 365.25;
  }

  /* ---------- Sun apparent longitude (truncated Meeus §25) ---------- */
  function sunLongitude(jd) {
    var T  = (jd - 2451545.0) / 36525.0;
    var L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    var M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    var Mr = M * DEG;
    var C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
           + 0.000289 * Math.sin(3 * Mr);
    var sunTrue = L0 + C;
    var omega   = (125.04 - 1934.136 * T) * DEG;
    return sunTrue - 0.00569 - 0.00478 * Math.sin(omega);
  }

  /* ---------- Moon longitude (truncated Meeus §47, ~18 terms) ---------- */
  function moonLongitude(jd) {
    var T  = (jd - 2451545.0) / 36525.0;
    var Lp = norm360(218.3164477 + 481267.88123421 * T);
    var M  = norm360(357.5291092 + 35999.0502909 * T);
    var Mp = norm360(134.9633964 + 477198.8675055 * T);
    var D  = norm360(297.8501921 + 445267.1114034 * T);
    var F  = norm360(93.2720950  + 483202.0175233 * T);
    var Mr  = M  * DEG;
    var Mpr = Mp * DEG;
    var Dr  = D  * DEG;
    var Fr  = F  * DEG;
    var lon = Lp
      + 6.288774 * Math.sin(Mpr)
      + 1.274027 * Math.sin(2*Dr - Mpr)
      + 0.658314 * Math.sin(2*Dr)
      + 0.213618 * Math.sin(2*Mpr)
      - 0.185116 * Math.sin(Mr)
      - 0.114332 * Math.sin(2*Fr)
      + 0.058793 * Math.sin(2*Dr - 2*Mpr)
      + 0.057066 * Math.sin(2*Dr - Mr - Mpr)
      + 0.053322 * Math.sin(2*Dr + Mpr)
      + 0.045758 * Math.sin(2*Dr - Mr)
      - 0.040923 * Math.sin(Mr - Mpr)
      - 0.034720 * Math.sin(Dr)
      - 0.030383 * Math.sin(Mr + Mpr)
      + 0.015327 * Math.sin(2*Dr - 2*Fr)
      + 0.010980 * Math.sin(4*Dr - Mpr)
      + 0.010675 * Math.sin(4*Dr - 2*Mpr)
      + 0.010034 * Math.sin(3*Mpr)
      + 0.008548 * Math.sin(4*Dr - 2*Mr - 2*Mpr);
    return norm360(lon);
  }

  /* ---------- Sidereal longitudes ---------- */
  function sunSidereal(jd)  { return norm360(sunLongitude(jd)  - ayanamsa(jd)); }
  function moonSidereal(jd) { return norm360(moonLongitude(jd) - ayanamsa(jd)); }

  /* ---------- Sunrise UT hours (Spencer 1971, ±5 min) ---------- */
  function sunriseUT(year, month, day) {
    var d0   = new Date(Date.UTC(year, 0, 0));
    var dNow = new Date(Date.UTC(year, month - 1, day));
    var N    = Math.floor((dNow - d0) / 86400000);
    var gamma = PI2 * (N - 1) / (isLeap(year) ? 366 : 365);
    var eqtime = 229.18 * (0.000075
      + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2*gamma) - 0.040849 * Math.sin(2*gamma));
    var decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
      - 0.006758 * Math.cos(2*gamma) + 0.000907 * Math.sin(2*gamma)
      - 0.002697 * Math.cos(3*gamma) + 0.00148  * Math.sin(3*gamma);
    var latR = _lat * DEG;
    var zenith = 90.833 * DEG;
    var cosHA = (Math.cos(zenith) - Math.sin(latR) * Math.sin(decl))
              / (Math.cos(latR) * Math.cos(decl));
    cosHA = Math.max(-1, Math.min(1, cosHA));
    var ha = Math.acos(cosHA) * RAD;
    var solarNoonMin = 720 - 4 * _lng - eqtime;
    return (solarNoonMin - ha * 4) / 60;
  }

  /* ---------- Tithi at a given JD ---------- */
  function tithiAt(jd) {
    var elong = norm360(moonLongitude(jd) - sunLongitude(jd));
    var idx   = Math.floor(elong / 12);
    var paksha = idx < 15 ? 0 : 1;
    var tithiNo = (idx % 15) + 1;
    return { index: idx, paksha: paksha, tithiNo: tithiNo, elongation: elong };
  }

  /* ---------- Find most recent new moon before JD ---------- */
  function findRecentNewMoon(jd) {
    var elong  = norm360(moonLongitude(jd) - sunLongitude(jd));
    var estJD  = jd - elong * 29.53059 / 360;
    for (var i = 0; i < 15; i++) {
      var e = norm360(moonLongitude(estJD) - sunLongitude(estJD));
      if (e > 180) e -= 360;
      var corr = e / 12.19;
      estJD -= corr;
      if (Math.abs(corr) < 0.0001) break;
    }
    return estJD;
  }

  /* ---------- Purnimanta month ---------- */
  function purnimantaMonth(jd, tithiInfo) {
    var nmJD = findRecentNewMoon(jd);
    /* Ensure we found a new moon BEFORE jd; if not, look further back. */
    if (nmJD >= jd) nmJD = findRecentNewMoon(jd - 2);
    var sunSid = sunSidereal(nmJD);
    var solarSign = Math.floor(sunSid / 30);
    var amantaStarted = (solarSign + 1) % 12;
    if (tithiInfo.paksha === 0) {
      return amantaStarted;
    }
    return (amantaStarted + 1) % 12;
  }

  /* ---------- Moon phase (illumination + waxing/waning) ---------- */
  function moonPhase(tithiInfo) {
    var elong = tithiInfo.elongation;
    var illum = (1 - Math.cos(elong * DEG)) / 2;
    return { illumination: illum, waxing: elong < 180 };
  }

  /* ---------- Nakshatra ---------- */
  function nakshatraAt(jd) {
    return Math.floor(moonSidereal(jd) / (360 / 27)) % 27;
  }

  /* ---------- Samvat years ---------- */
  function samvatYears(year, monthIdx, paksha, tithiNo) {
    var vs = (monthIdx >= 7 || (monthIdx === 7 && paksha === 0)) ? year + 57 : year + 56;
    var vns = vs + 470;
    var shaka = (monthIdx > 0 || (monthIdx === 0 && paksha === 0 && tithiNo >= 1))
      ? year - 78 : year - 79;
    return { vs: vs, vns: vns, shaka: shaka };
  }

  /* ---------- Main entry: lunarDate(date) ---------- */
  function lunarDate(date) {
    var d = date || new Date();
    var year  = d.getFullYear();
    var month = d.getMonth() + 1;
    var day   = d.getDate();
    var srUT  = sunriseUT(year, month, day);
    var srJD  = toJulianDay(year, month, day, srUT);
    var ti    = tithiAt(srJD);
    var mIdx  = purnimantaMonth(srJD, ti);
    var phase = moonPhase(ti);
    var nakIdx = nakshatraAt(srJD);
    var sv    = samvatYears(year, mIdx, ti.paksha, ti.tithiNo);
    var tithiDev = TITHIS[ti.tithiNo - 1] || TITHIS[0];
    var monthDev = MONTHS[mIdx] || MONTHS[0];
    var pakshaDev = ti.paksha === 0 ? 'शुक्ल' : 'कृष्ण';
    var isoDate = year + '-' + pad2(month) + '-' + pad2(day);
    return {
      date: d, isoDate: isoDate, year: year,
      month: mIdx, monthH: monthDev, monthLatin: MONTHS_LATIN[mIdx] || '',
      paksha: ti.paksha, pakshaH: pakshaDev,
      tithiNo: ti.tithiNo, tithiH: tithiDev,
      tithiDev: toDevNum(ti.tithiNo) + ' ' + tithiDev,
      illumination: phase.illumination, waxing: phase.waxing,
      tithiIndex: ti.index,
      nakshatra: NAKSHATRAS[nakIdx] || '', nakshatraIdx: nakIdx,
      samvat: sv, sunriseJD: srJD
    };
  }

  /* ---------- Parv matcher ---------- */
  function matchParvs(ld, parvs) {
    if (!Array.isArray(parvs)) return [];
    var out = [];
    for (var i = 0; i < parvs.length; i++) {
      var p = parvs[i];
      if (parvActive(ld, p)) {
        var di = parvDayInfo(ld, p);
        out.push({
          id: p.id, h: p.h, latin: p.latin, icon: p.icon || '',
          blurb: p.blurb || '', link: p.link || null,
          day: di.day, totalDays: di.totalDays,
          isStart: di.isStart, isEnd: di.isEnd
        });
      }
    }
    return out;
  }

  function parvActive(ld, p) {
    if (!p.endTithi && !p.crossMonth) {
      return ld.month === p.month && ld.paksha === p.paksha && ld.tithiNo === p.startTithi;
    }
    if (!p.crossMonth) {
      if (ld.month !== p.month || ld.paksha !== p.paksha) return false;
      return ld.tithiNo >= p.startTithi && ld.tithiNo <= (p.endTithi || p.startTithi);
    }
    var sm = p.month, sp = p.paksha, st = p.startTithi;
    var em = p.endMonth != null ? p.endMonth : (sm + 1) % 12;
    var ep = p.endPaksha != null ? p.endPaksha : sp;
    var et = p.endTithi || 1;
    if (ld.month === sm && ld.paksha === sp && ld.tithiNo >= st) return true;
    if (ld.month === em && ld.paksha === ep && ld.tithiNo <= et) return true;
    if (sm !== em) {
      var nextM = (sm + 1) % 12;
      if (ld.month === nextM && ld.paksha === sp) return true;
    }
    return false;
  }

  function parvDayInfo(ld, p) {
    if (!p.endTithi && !p.crossMonth) {
      return { day: 1, totalDays: 1, isStart: true, isEnd: true };
    }
    var totalDays, day;
    if (!p.crossMonth) {
      totalDays = (p.endTithi || p.startTithi) - p.startTithi + 1;
      day = ld.tithiNo - p.startTithi + 1;
      return { day: day, totalDays: totalDays, isStart: day === 1, isEnd: day === totalDays };
    }
    var sm = p.month, st = p.startTithi;
    var em = p.endMonth != null ? p.endMonth : (sm + 1) % 12;
    var et = p.endTithi || 1;
    var startAbs = sm * 30 + (p.paksha === 0 ? 0 : 15) + st;
    var endAbs   = em * 30 + (p.paksha === 0 ? 0 : 15) + et;
    if (endAbs < startAbs) endAbs += 360;
    totalDays = endAbs - startAbs + 1;
    var todayAbs = ld.month * 30 + (ld.paksha === 0 ? 0 : 15) + ld.tithiNo;
    if (todayAbs < startAbs) todayAbs += 360;
    day = todayAbs - startAbs + 1;
    return { day: day, totalDays: totalDays, isStart: day === 1, isEnd: day === totalDays };
  }

  /* ---------- Kalyanak matcher ---------- */
  function matchKalyanaks(ld, data) {
    if (!data || !Array.isArray(data.tirthankaras)) return [];
    var out = [];
    var types = data.types || ['garbh', 'janma', 'tap', 'jnan', 'moksh'];
    for (var i = 0; i < data.tirthankaras.length; i++) {
      var tk = data.tirthankaras[i];
      if (!tk || !tk.k) continue;
      for (var j = 0; j < types.length; j++) {
        var type = types[j];
        var k = tk.k[type];
        if (!k) continue;
        if (ld.month === k.m && ld.paksha === k.p && ld.tithiNo === k.t) {
          out.push({
            no: tk.no, tirthankarH: tk.h, tirthankarLatin: tk.latin,
            tirthankarId: tk.id, type: type,
            typeH: (data.typeLabels && data.typeLabels[type]) || type,
            verify: !!tk.verify
          });
        }
      }
    }
    return out;
  }

  /* ---------- Convenience ---------- */
  function getTodayInfo(date, data) {
    var ld = lunarDate(date);
    return {
      lunar: ld,
      parvs: matchParvs(ld, data && data.parvs),
      kalyanaks: matchKalyanaks(ld, data && data.kalyanaks)
    };
  }

  function setLocation(latitude, longitude) {
    _lat = +latitude || 23.18;
    _lng = +longitude || 75.77;
  }

  /* ---------- Public API ---------- */
  window.jinbhaktPanchang = {
    lunarDate: lunarDate, matchParvs: matchParvs,
    matchKalyanaks: matchKalyanaks, getTodayInfo: getTodayInfo,
    setLocation: setLocation,
    toJulianDay: toJulianDay, sunLongitude: sunLongitude,
    moonLongitude: moonLongitude, ayanamsa: ayanamsa,
    sunSidereal: sunSidereal, moonSidereal: moonSidereal,
    tithiAt: tithiAt, findRecentNewMoon: findRecentNewMoon,
    sunriseUT: sunriseUT, toDevNum: toDevNum,
    MONTHS: MONTHS, MONTHS_LATIN: MONTHS_LATIN,
    TITHIS: TITHIS, NAKSHATRAS: NAKSHATRAS
  };
})();
