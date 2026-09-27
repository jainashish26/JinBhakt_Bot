/* Identity for the wheel ritual. The engine in _niyam/logic.js branches on
   RITUAL; everything else (corpus, UI, storage, leaderboard) is shared. */
var RITUAL = 'wheel';
var GAME_ID = 'niyam-wheel';
var LB_KEY = 'jinbhakt:kids:leaderboard:v1';
var PREF_KEY = 'jinbhakt:kids:prefs:v1';
var VOW_KEY = 'jinbhakt:kids:vows:v1';
var LB_MAX = 20;

/** duration-asc is not meaningful for a vow ritual — rank by vows taken. */
var LB_CMP = function (a, b) {
  return (((b.meta && b.meta.vows) || 0) - ((a.meta && a.meta.vows) || 0)) ||
         (((b.meta && b.meta.streakDays) || 0) - ((a.meta && a.meta.streakDays) || 0)) ||
         (a.duration - b.duration) ||
         (b.ts - a.ts);
};
