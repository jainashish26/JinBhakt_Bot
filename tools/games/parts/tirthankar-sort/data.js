/* Identity + rules for the sorting game. TIRTH data comes from the shared
   fragment, byte-identical to memory-match (tools/check-games.js enforces). */
var GAME_ID = 'tirth-sort';
var LB_KEY = 'jinbhakt:kids:leaderboard:v1';
var PREF_KEY = 'jinbhakt:kids:prefs:v1';
var LB_MAX = 20;

/** Fastest correct arrangement wins; fewer moves breaks a tie. */
var LB_CMP = function (a, b) {
  return (a.duration - b.duration) ||
         (((a.meta && a.meta.moves) || 0) - ((b.meta && b.meta.moves) || 0)) ||
         (b.ts - a.ts);
};

var COUNTS = [6, 8, 12, 18, 24];
var MODES = ['order', 'chinh', 'varna', 'moksha'];
var HINTS_MAX = 3;
var HINT_PENALTY = 15;      // seconds added per hint used

/* Balanced bucket definitions — the raw varna/moksha distributions are far
   too skewed to sort fairly, so buckets draw at most BUCKET_CAP each. */
var BUCKET_CAP = 4;
var VARNA_BUCKETS = [
  { key: 'golden', hex: '#E3B23C' },
  { key: 'red',    hex: '#C0392B' },
  { key: 'white',  hex: '#F2EDE4' },
  { key: 'blue',   hex: '#2E5FA3' },
  { key: 'dark',   hex: '#3A3A44' }
];
var MOKSHA_BUCKETS = [
  { key: 'sammend' }, { key: 'ashtapada' }, { key: 'champapuri' },
  { key: 'girnar' }, { key: 'pavapuri' }
];
