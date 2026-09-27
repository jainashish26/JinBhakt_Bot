/* Identity for the lotus ritual. The engine in _niyam/logic.js branches on
   RITUAL; everything else (corpus, UI, storage, leaderboard) is shared. */
var RITUAL = 'lotus';
var GAME_ID = 'niyam-lotus';
var LB_KEY = 'jinbhakt:kids:leaderboard:v1';
var PREF_KEY = 'jinbhakt:kids:prefs:v1';
var VOW_KEY = 'jinbhakt:kids:vows:v1';
var LB_MAX = 20;

/** Vow rituals rank by vows taken, not by speed. */
var LB_CMP = function (a, b) {
  return (((b.meta && b.meta.vows) || 0) - ((a.meta && a.meta.vows) || 0)) ||
         (((b.meta && b.meta.streakDays) || 0) - ((a.meta && a.meta.streakDays) || 0)) ||
         (a.duration - b.duration) ||
         (b.ts - a.ts);
};
