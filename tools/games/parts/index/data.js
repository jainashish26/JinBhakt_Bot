/* Standalone offline hub. Mirrors the catalogue in js/kids.js so the games
   folder works on its own when opened by double-clicking. */
var GAME_ID = 'kids-hub';
var LB_KEY = 'jinbhakt:kids:leaderboard:v1';
var PREF_KEY = 'jinbhakt:kids:prefs:v1';
var LB_MAX = 20;

/** The hub never writes rows; a neutral comparator keeps the shell valid. */
var LB_CMP = function (a, b) { return a.duration - b.duration || (b.ts - a.ts); };

var GAMES = [
  { id: 'sattvic-chef',    file: 'sattvic-chef.html',    icon: '\uD83E\uDD57',
    hi: 'सात्त्विक रसोई', en: 'Sattvic Chef',
    blurbHi: 'भोजन को जैन-अनुकूल या जैन-प्रतिकूल में बाँटिए — हर उत्तर के साथ कारण भी।',
    blurbEn: 'Sort food into Jain-friendly or not — with the reason behind every answer.',
    tagHi: 'आहार · अहिंसा', tagEn: 'Food · Ahimsa', ages: '5+', scoring: 'score-desc' },
  { id: 'myth-busters',    file: 'myth-busters.html',    icon: '\uD83E\uDE94',
    hi: 'मिथक भंजन', en: 'Myth Busters',
    blurbHi: 'जैन धर्म के बारे में सत्य या मिथ्या — हर भूल पर एक छोटा स्पष्टीकरण।',
    blurbEn: 'True or false about Jainism — every miss unlocks a short correction.',
    tagHi: 'ज्ञान · श्रद्धा', tagEn: 'Knowledge · Faith', ages: '8+', scoring: 'score-desc' },
  { id: 'tirth-sort',      file: 'tirthankar-sort.html', icon: '\uD83D\uDD22',
    hi: 'तीर्थंकर क्रम', en: 'Tirthankar Sorting',
    blurbHi: 'चौबीस तीर्थंकरों को उनके क्रम, चिन्ह, वर्ण और निर्वाण स्थल से पहचानिए।',
    blurbEn: 'Place the 24 Tirthankaras by order, emblem, complexion or nirvana place.',
    tagHi: 'क्रम · चिन्ह', tagEn: 'Order · Emblem', ages: '7+', scoring: 'duration-asc' },
  { id: 'niyam-wheel',     file: 'niyam-wheel.html',     icon: '\u2638',
    hi: 'नियम चक्र', en: 'Daily Vows · Wheel',
    blurbHi: 'चक्र घुमाइए और आज का अपना एक संयम-संकल्प ग्रहण कीजिए।',
    blurbEn: 'Turn the wheel and take one vow of restraint for today.',
    tagHi: 'नियम · संकल्प', tagEn: 'Niyam · Vow', ages: '6+', scoring: 'vows-desc' },
  { id: 'niyam-lotus',     file: 'niyam-lotus.html',     icon: '\uD83E\uDEB7',
    hi: 'नियम कमल', en: 'Daily Vows · Lotus',
    blurbHi: 'श्वास लीजिए, कमल खिलने दीजिए और आज का नियम शांति से स्वीकार कीजिए।',
    blurbEn: 'Breathe, let the lotus open, and accept today’s niyam in quiet.',
    tagHi: 'श्वास · संयम', tagEn: 'Breath · Restraint', ages: '6+', scoring: 'vows-desc' },
  { id: 'memory-match',    file: 'memory-match.html',    icon: '\uD83C\uDFB4',
    hi: 'स्मृति पट्ट', en: 'Memory Match',
    blurbHi: 'पत्ते पलटिए और तीर्थंकरों को उनके चिन्ह, वर्ण और निर्वाण स्थल से मिलाइए।',
    blurbEn: 'Flip the cards and pair each Tirthankara with emblem, colour or place.',
    tagHi: 'स्मृति · पहचान', tagEn: 'Memory · Recall', ages: '6+', scoring: 'duration-asc' }
];

function gameById(id) {
  for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
  return null;
}
