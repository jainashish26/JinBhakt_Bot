/**
 * ============================================================
 *  JinBhakt — Devanagari ⇄ Roman transliteration + phonetic
 *  search folding.
 *
 *  Dependency-free. Works in the browser (window.jinbhaktTranslit)
 *  and in Node (module.exports) so it can be unit-tested.
 *
 *  Why this exists
 *  ---------------
 *  Visitors type Hindi/Sanskrit titles in English letters using any
 *  of a dozen romanization habits ("SamaySar", "samaysar",
 *  "samayasar", "Smysar"). The catalogue stores Devanagari. To make
 *  those meet, every title is rendered into several Latin forms and
 *  then crushed into a phonetic key that ignores the spelling
 *  differences people actually make.
 * ============================================================
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.jinbhaktTranslit = api;
})(typeof window !== 'undefined' ? window
  : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ---------------------------------------------------------
   * Devanagari tables
   * ------------------------------------------------------- */
  var VIRAMA = '\u094D';
  var ANUSVARA = '\u0902';
  var CHANDRA = '\u0901';
  var VISARGA = '\u0903';
  var AVAGRAHA = '\u093D';
  var NUKTA = '\u093C';
  var OM = '\u0950';

  /** Base consonant letters — no inherent vowel. */
  var CONS = {
    'क': 'k',   'ख': 'kh',  'ग': 'g',   'घ': 'gh',  'ङ': 'n',
    'च': 'ch',  'छ': 'chh', 'ज': 'j',   'झ': 'jh',  'ञ': 'n',
    'ट': 't',   'ठ': 'th',  'ड': 'd',   'ढ': 'dh',  'ण': 'n',
    'त': 't',   'थ': 'th',  'द': 'd',   'ध': 'dh',  'न': 'n',
    'प': 'p',   'फ': 'ph',  'ब': 'b',   'भ': 'bh',  'म': 'm',
    'य': 'y',   'र': 'r',   'ल': 'l',   'ळ': 'l',   'व': 'v',
    'श': 'sh',  'ष': 'sh',  'स': 's',   'ह': 'h',
    'क़': 'k',  'ख़': 'kh', 'ग़': 'g',  'ज़': 'z',  'ड़': 'r',
    'ढ़': 'r',  'फ़': 'f',  'य़': 'y',  'ऱ': 'r',  'ऴ': 'l'
  };

  /** Independent vowels. */
  var VOWEL = {
    'अ': 'a',  'आ': 'aa', 'इ': 'i',  'ई': 'ee', 'उ': 'u',
    'ऊ': 'oo', 'ऋ': 'ri', 'ॠ': 'ri', 'ऌ': 'li', 'ॡ': 'li',
    'ए': 'e',  'ऐ': 'ai', 'ओ': 'o',  'औ': 'au',
    'ऑ': 'o',  'ऍ': 'e',  'ऎ': 'e',  'ऒ': 'o'
  };

  /** Dependent vowel signs (matras). */
  var MATRA = {
    'ा': 'aa', 'ि': 'i',  'ी': 'ee', 'ु': 'u',  'ू': 'oo',
    'ृ': 'ri', 'ॄ': 'ri', 'ॢ': 'li', 'े': 'e',  'ै': 'ai',
    'ो': 'o',  'ौ': 'au', 'ॉ': 'o',  'ॅ': 'e',  'ॊ': 'o',
    'ॎ': 'e',  'ॏ': 'o'
  };

  /** Consonant + virama + consonant clusters that need a bespoke spelling. */
  var CLUSTER = {
    'ज्ञ': 'gy',   // jña  →  "gy"  (people write gyan, not jnan)
    'ज्ञ': 'gy',
    'क्ष': 'ksh'   // kṣa  →  "ksh"
  };

  /** Labials — anusvara assimilates to "m" before these. */
  var LABIAL = { p: 1, ph: 1, b: 1, bh: 1, m: 1 };


  /* ---------------------------------------------------------
   * IAST (International Alphabet of Sanskrit Transliteration)
   *
   * Purely compositional — no schwa deletion, no cluster
   * heuristics.  Each Devanagari letter maps to a fixed Latin
   * form; the output is losslessly reversible to Devanagari by
   * any standard back-converter.
   *
   * Anusvara is assimilated to the following consonant's place
   * of articulation (keyed off the DEVANAGARI letter, not the
   * romanised output, so ट/त are distinguishable).  Candrabindu
   * is always ṃ and is never assimilated.
   *
   * Prakrit hiatus: an independent इ immediately after a
   * consonant that carries its inherent 'a' renders as ï, so
   * that havaï (हवइ) is not confused with havi (हवि).
   * ------------------------------------------------------- */

  var CONS_IAST = {
    'क': 'k',   'ख': 'kh',  'ग': 'g',   'घ': 'gh',  'ङ': 'ṅ',
    'च': 'c',   'छ': 'ch',  'ज': 'j',   'झ': 'jh',  'ञ': 'ñ',
    'ट': 'ṭ',   'ठ': 'ṭh',  'ड': 'ḍ',   'ढ': 'ḍh',  'ण': 'ṇ',
    'त': 't',   'थ': 'th',  'द': 'd',   'ध': 'dh',  'न': 'n',
    'प': 'p',   'फ': 'ph',  'ब': 'b',   'भ': 'bh',  'म': 'm',
    'य': 'y',   'र': 'r',   'ल': 'l',   'व': 'v',
    'श': 'ś',   'ष': 'ṣ',   'स': 's',   'ह': 'h',
    'ळ': 'ḷ',
    // Nukta forms — stored with the base letter; looked up after NUKTA.
    'क़': 'q',  'ख़': 'ḵh', 'ग़': 'ġ',  'ज़': 'z',
    'ड़': 'ṛ',  'ढ़': 'ṛh', 'फ़': 'f',  'य़': 'ẏ',
    'ऱ': 'r',   'ऴ': 'ḷ'
  };

  var VOWEL_IAST = {
    'अ': 'a',  'आ': 'ā', 'इ': 'i',  'ई': 'ī', 'उ': 'u',
    'ऊ': 'ū',  'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ', 'ॡ': 'ḹ',
    'ए': 'e',  'ऐ': 'ai', 'ओ': 'o',  'औ': 'au',
    'ऑ': 'ŏ',  'ऍ': 'ĕ',  'ऎ': 'e',  'ऒ': 'o'
  };

  var MATRA_IAST = {
    'ा': 'ā', 'ि': 'i',  'ी': 'ī', 'ु': 'u',  'ू': 'ū',
    'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ',
    'े': 'e',  'ै': 'ai', 'ो': 'o',  'ौ': 'au',
    'ॉ': 'ŏ',  'ॅ': 'ĕ',  'ॊ': 'o',  'ॎ': 'e',  'ॏ': 'o'
  };

  /**
   * Place-of-articipation class for every consonant.  Anusvara
   * assimilates to the matching nasal before stops; before
   * semivowels/sibilants/h it resolves to 'n' (default) or 'ṃ'
   * (strict IAST).
   *
   * Values: 'ṅ' velar, 'ñ' palatal, 'ṇ' retroflex, 'n' dental,
   *         'm' labial, '~' semivowel/sibilant/h (needs strict check).
   */
  var NASAL_CLASS = {};
  'कखगघङ'.split('').forEach(function (c) { NASAL_CLASS[c] = 'ṅ'; });
  'चछजझञ'.split('').forEach(function (c) { NASAL_CLASS[c] = 'ñ'; });
  'टठडढण'.split('').forEach(function (c) { NASAL_CLASS[c] = 'ṇ'; });
  'तथदधन'.split('').forEach(function (c) { NASAL_CLASS[c] = 'n'; });
  'पफबभम'.split('').forEach(function (c) { NASAL_CLASS[c] = 'm'; });
  'यरलळवशषसह'.split('').forEach(function (c) { NASAL_CLASS[c] = '~'; });


  /* ---------------------------------------------------------
   * Romanization
   * ------------------------------------------------------- */

  /** Phonetic weight of a consonant onset: "sh"/"bh"/"kh" count as ONE sound. */
  function soundLen(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c === 'h' && i > 0 && /[a-z]/.test(str.charAt(i - 1))) continue;
      n++;
    }
    return n;
  }

  /** How many consonant sounds would collide if this syllable lost its schwa. */
  function nextOnsetLen(pieces, from) {
    var n = 0;
    for (var i = from + 1; i < pieces.length; i++) {
      var pc = pieces[i];
      if (pc.t !== 'c') break;          // a vowel/literal ends the onset
      n += soundLen(pc.v);
      if (!pc.vir) break;               // this consonant carries a vowel
    }
    return n;
  }

  /**
   * Assemble one word out of its syllable pieces.
   * mode 'full'  -> every inherent schwa kept    (समयसार -> samayasaara)
   * mode 'hindi'-> schwa deletion + cluster repair (समयसार -> samysaar)
   * mode 'alt'  -> Ohala's alternating rule, counted from the right
   *                (समयसार -> samaysaar, ऋषभ -> rishab)
   * mode 'bare' -> every inherent schwa dropped  (समयसार -> smsaar)
   */
  function buildWord(pieces, mode) {
    var consPos = [];
    var syllPos = [];
    var i;
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].t === 'c') consPos.push(i);
      if (pieces[i].t === 'c' || pieces[i].t === 'v') syllPos.push(i);
    }
    var total = consPos.length;
    var startsCons = total > 0 && pieces[0].t === 'c';

    /** 1-based syllable position counted from the RIGHT (for the 'alt' rule). */
    var rightPos = {};
    for (i = 0; i < syllPos.length; i++) rightPos[syllPos[i]] = syllPos.length - i;

    var out = '';
    for (i = 0; i < pieces.length; i++) {
      var pc = pieces[i];
      if (pc.t !== 'c') { out += pc.v; continue; }

      var vowel;
      if (pc.vir) {
        vowel = '';                                   // explicit half-consonant
      } else if (pc.m) {
        vowel = pc.m;                                 // real matra — always kept
      } else {
        var j = consPos.indexOf(i);
        var keep;
        if (mode === 'full') keep = true;
        else if (mode === 'bare') keep = false;
        else if (j === total - 1) keep = false;       // word-final schwa always goes
        else if (j === 0 && startsCons) keep = true;  // initial syllable is protected
        else if (mode === 'alt') keep = (rightPos[i] % 2 === 0);
        else keep = (soundLen(pc.v) + nextOnsetLen(pieces, i)) > 2;  // cluster repair
        vowel = keep ? 'a' : '';
      }
      out += pc.v + vowel;
    }
    return out;
  }

  /**
   * Devanagari (mixed with Latin) -> readable Roman text.
   * Anything that is not a letter is treated as a word separator.
   */
  function romanize(input, mode) {
    var s = String(input == null ? '' : input);
    mode = mode || 'hindi';
    var out = '';
    var pieces = [];
    var lastVowel = '';

    function flush() {
      if (!pieces.length) return;
      var w = buildWord(pieces, mode);
      pieces = [];
      lastVowel = '';
      if (w) out += w + ' ';
    }

    var i = 0;
    while (i < s.length) {
      var ch = s.charAt(i);
      var nx = s.charAt(i + 1);
      var n2 = s.charAt(i + 2);
      var code = s.charCodeAt(i);

      if (ch === OM) { pieces.push({ t: 's', v: 'om' }); lastVowel = 'o'; i++; continue; }

      // consonant + virama + consonant  ->  known cluster spelling
      if (nx === VIRAMA && n2 && CLUSTER[ch + VIRAMA + n2]) {
        pieces.push({ t: 's', v: CLUSTER[ch + VIRAMA + n2] });
        lastVowel = '';
        i += 3;
        continue;
      }

      if (CONS[ch]) {
        if (nx === VIRAMA) {
          pieces.push({ t: 'c', v: CONS[ch], vir: true });
          lastVowel = '';
          i += 2;
        } else if (nx && MATRA[nx]) {
          pieces.push({ t: 'c', v: CONS[ch], m: MATRA[nx] });
          lastVowel = MATRA[nx];
          i += 2;
        } else {
          pieces.push({ t: 'c', v: CONS[ch] });
          lastVowel = 'a';
          i++;
        }
        continue;
      }

      if (MATRA[ch]) { pieces.push({ t: 's', v: MATRA[ch] }); lastVowel = MATRA[ch]; i++; continue; }
      if (VOWEL[ch]) { pieces.push({ t: 'v', v: VOWEL[ch] }); lastVowel = VOWEL[ch]; i++; continue; }

      if (ch === VIRAMA) {                            // stray virama -> half the last consonant
        for (var k = pieces.length - 1; k >= 0; k--) {
          if (pieces[k].t === 'c') { pieces[k].vir = true; pieces[k].m = null; break; }
        }
        i++;
        continue;
      }

      if (ch === ANUSVARA || ch === CHANDRA) {
        var nas = 'n';
        if (lastVowel === 'o' || lastVowel === 'oo' || lastVowel === 'u') nas = 'm';
        else if (nx && LABIAL[CONS[nx]]) nas = 'm';
        pieces.push({ t: 's', v: nas });
        lastVowel = nas;
        i++;
        continue;
      }

      if (ch === VISARGA) { pieces.push({ t: 's', v: 'h' }); lastVowel = ''; i++; continue; }
      if (ch === NUKTA || ch === AVAGRAHA) { i++; continue; }

      if (code >= 0x0966 && code <= 0x096F) {         // Devanagari digits
        pieces.push({ t: 's', v: String(code - 0x0966) });
        i++;
        continue;
      }
      if (code >= 0x0900 && code <= 0x097F) { i++; continue; }   // any other mark: ignore

      if (/[A-Za-z0-9]/.test(ch)) {                   // Latin / digits pass through
        pieces.push({ t: 's', v: ch });
        lastVowel = ch.toLowerCase();
        i++;
        continue;
      }

      flush();                                        // separator
      i++;
    }
    flush();
    return out.replace(/\s+/g, ' ').trim();
  }

  /* ---------------------------------------------------------
   * IAST romanization — purely compositional, no heuristics
   * ------------------------------------------------------- */

  /**
   * Find the next Devanagari consonant after position `from` in `s`,
   * skipping viramas, nukta, matras and anusvara/candrabindu.
   * Returns the consonant character, or '' if none found.
   */
  function nextConsonant(s, from) {
    for (var j = from; j < s.length; j++) {
      var c = s.charAt(j);
      if (CONS[c]) return c;
      if (c === VIRAMA || c === NUKTA || c === ANUSVARA || c === CHANDRA) continue;
      if (MATRA[c] || MATRA_IAST[c]) continue;
      if (VOWEL[c] || VOWEL_IAST[c]) return '';
      if (/[\s.,;:!?।\u0964\u0965]/.test(c)) return '';
    }
    return '';
  }

  /**
   * Devanagari → IAST.  Purely compositional: every Devanagari
   * letter maps to a fixed IAST form.  No schwa deletion, no
   * cluster table, no vowel-length heuristics.
   *
   * opts.anusvara  'strict' → ṃ before semivowels/sibilants/h;
   *                anything else → 'n' (the user's rule).
   */
  function romanizeIAST(input, opts) {
    var s = String(input == null ? '' : input);
    if (!s) return '';
    opts = opts || {};
    var strict = opts.anusvara === 'strict';

    var out = '';
    var i = 0;
    // Track whether the last output ended with a vowel sound — used for
    // the Prakrit hiatus rule: an independent इ right after any vowel
    // sound (from a consonant's inherent 'a', a matra, or an independent
    // vowel) becomes ï.
    var lastEndedVowel = false;

    while (i < s.length) {
      var ch = s.charAt(i);

      // ॐ → oṃ
      if (ch === OM) { out += 'oṃ'; lastEndedVowel = true; i++; continue; }

      // Consonant
      if (CONS[ch] || CONS_IAST[ch]) {
        var base = CONS_IAST[ch] || CONS[ch];
        var ci = i + 1;

        // Nukta
        if (s.charAt(ci) === NUKTA) {
          var nuktaKey = ch + NUKTA;
          if (CONS_IAST[nuktaKey]) base = CONS_IAST[nuktaKey];
          ci++;
        }

        // Virama: half-consonant, no inherent 'a'
        if (s.charAt(ci) === VIRAMA) {
          out += base;
          lastEndedVowel = false;
          i = ci + 1;
          continue;
        }

        // Matra
        if (s.charAt(ci) && (MATRA_IAST[s.charAt(ci)] || MATRA[s.charAt(ci)])) {
          var matraVal = MATRA_IAST[s.charAt(ci)] || MATRA[s.charAt(ci)];
          out += base + matraVal;
          lastEndedVowel = true;
          i = ci + 1;
          continue;
        }

        // Inherent 'a'
        out += base + 'a';
        lastEndedVowel = true;
        i = ci;
        continue;
      }

      // Independent vowel
      if (VOWEL_IAST[ch] || VOWEL[ch]) {
        var vow = VOWEL_IAST[ch] || VOWEL[ch];
        // Prakrit hiatus: independent इ after any vowel sound → ï
        if (ch === '\u0907' && lastEndedVowel) vow = '\u0069\u0308'; // ï (NFD: i + diaeresis)
        out += vow;
        lastEndedVowel = true;
        i++;
        continue;
      }

      // Stray matra
      if (MATRA[ch] || MATRA_IAST[ch]) {
        out += MATRA_IAST[ch] || MATRA[ch];
        lastEndedVowel = true;
        i++;
        continue;
      }

      // Anusvara — assimilation keyed off the DEVANAGARI letter
      if (ch === ANUSVARA) {
        var nasal = '\u1e43'; // ṃ (default: word-final / pre-vowel)
        var nc = nextConsonant(s, i + 1);
        if (nc) {
          var cls = NASAL_CLASS[nc];
          if (cls && cls !== '~') {
            nasal = cls;
          } else if (cls === '~') {
            nasal = strict ? '\u1e43' : 'n';
          }
        }
        out += nasal;
        lastEndedVowel = false;
        i++;
        continue;
      }

      // Candrabindu — always ṃ, never assimilated
      if (ch === CHANDRA) {
        out += '\u1e43';
        lastEndedVowel = false;
        i++;
        continue;
      }

      if (ch === VISARGA) { out += '\u1e25'; lastEndedVowel = false; i++; continue; } // ḥ
      if (ch === AVAGRAHA) { out += "'"; lastEndedVowel = false; i++; continue; }
      if (ch === VIRAMA) { lastEndedVowel = false; i++; continue; }
      if (ch === NUKTA) { i++; continue; }

      // Devanagari digits
      if (ch >= '\u0966' && ch <= '\u096F') {
        out += String(ch.charCodeAt(0) - 0x0966);
        lastEndedVowel = false;
        i++;
        continue;
      }

      if (ch === '\u0964' || ch === '\u0965') {
        out += (ch === '\u0965') ? '||' : '.';
        lastEndedVowel = false;
        i++;
        continue;
      }

      if (ch === '\u0970') { i++; continue; }
      if (ch >= '\u0900' && ch <= '\u097F') { lastEndedVowel = false; i++; continue; }

      out += ch;
      lastEndedVowel = false;
      i++;
    }

    out = out.replace(/[ \t]+([.,;:!?|])/g, '$1');
    out = out.replace(/  +/g, ' ').trim();
    if (typeof out.normalize === 'function') out = out.normalize('NFC');
    return out;
  }

  /**
   * Strip IAST diacritics from a string, returning plain ASCII.
   * Used by fold() so that pasted IAST queries reach the same
   * entries as ASCII queries.
   */
  function stripIast(str) {
    var s = String(str == null ? '' : str);
    if (typeof s.normalize === 'function') {
      return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s;
  }

  /** Vowel-length tidy-up used only for on-screen romanization. */
  var DISPLAY_RULES = [
    ['aa', 'a'], ['ee', 'i'], ['ii', 'i'], ['oo', 'u'], ['uu', 'u']
  ].sort(function (a, b) { return b[0].length - a[0].length; });

  /**
   * Pretty, human-readable romanization for display in search results.
   * opts.style  'iast' → IAST output; anything else → the existing
   *             ASCII-with-short-vowels form.
   */
  function display(input, opts) {
    opts = opts || {};
    if (opts.style === 'iast') {
      var s = romanizeIAST(input);
      if (!s) return '';
      // Capitalize first letter of each word — the regex must cover
      // Latin Extended-A (ā ī ū ṛ etc.) and Latin Extended Additional
      // (ṇ ṭ ḍ ś ṣ ḥ ṃ ṅ ñ etc.) in the U+1E00–U+1EFF range.
      return s.replace(/\s+/g, ' ').trim()
        .replace(/(^|\s)([a-z\u00c0-\u024f\u1e00-\u1eff])/g, function (m, sp, c) {
          return sp + c.toUpperCase();
        });
    }
    var s = romanize(input, 'alt');
    if (!s) return '';
    s = applyRulesWith(s.toLowerCase(), DISPLAY_RULES);
    return s
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(^|\s)([a-z])/g, function (m, sp, c) { return sp + c.toUpperCase(); });
  }

  /* ---------------------------------------------------------
   * Whole-passage transliteration (reader "English Transliterate")
   * ------------------------------------------------------- */

  /**
   * Devanagari punctuation that has to survive as a readable ASCII mark.
   * romanize() treats every non-letter as a word separator and drops it,
   * so these are handled outside the letter runs.
   */
  var DEV_PUNCT = {
    '\u0964': '.',      // danda         ।
    '\u0965': '||'      // double danda  ॥
  };

  /** Is this code point a Devanagari letter / matra / digit (not punctuation)? */
  function isDevLetter(code) {
    return (code >= 0x0900 && code <= 0x0963) ||    // vowels, consonants, marks, ॐ
           (code >= 0x0966 && code <= 0x096F) ||    // digits
           (code >= 0x0971 && code <= 0x097F);      // extended letters
  }

  /**
   * Devanagari body text -> readable Roman text.
   *
   * Unlike romanize(), this keeps the shape of the passage: whitespace,
   * line breaks, Latin words, digits and punctuation all pass through
   * untouched and only the Devanagari runs are rewritten. That is what
   * makes it safe to run over an already-rendered prayer, node by node.
   *
   *   'देख्या मैंने नेमिजी प्यारा ॥टेक॥'
   *      -> 'Dekhya maine nemiji pyara ||Tek||'
   *
   * opts.mode        romanization mode (default 'alt' — the natural Hindi reading).
   *                  Ignored when opts.style is 'iast'.
   * opts.vowels      'short' (default) folds long vowels the way display() does,
   *                  so the reader and the search subtitles agree: "Bhagvan",
   *                  "Sitalnath". 'long' keeps them: "Bhagvaan", "Sheetalnaath".
   *                  Ignored when opts.style is 'iast'.
   * opts.capitalize  capitalise the first letter of the result (default true —
   *                  the reader paints one line per call, so verses keep
   *                  looking like verses instead of one long lowercase run)
   * opts.style       'iast' → IAST output (no schwa deletion, no vowel
   *                  shortening, diacritics preserved); anything else → the
   *                  existing ASCII form.
   */
  function transliterateText(input, opts) {
    var s = String(input == null ? '' : input);
    if (!s) return '';
    opts = opts || {};

    // IAST path — purely compositional, no schwa deletion or vowel shortening
    if (opts.style === 'iast') {
      var out2 = '';
      var run2 = '';

      function flushIAST() {
        if (!run2) return;
        out2 += romanizeIAST(run2);
        run2 = '';
      }

      for (var j = 0; j < s.length; j++) {
        var ch2 = s.charAt(j);
        var code2 = s.charCodeAt(j);
        if (isDevLetter(code2)) { run2 += ch2; continue; }
        flushIAST();
        if (DEV_PUNCT[ch2]) { out2 += DEV_PUNCT[ch2]; continue; }
        if (code2 === 0x0970) continue;
        out2 += ch2;
      }
      flushIAST();

      out2 = out2.replace(/[ \t]+([.,;:!?|])/g, '$1');

      if (opts.capitalize !== false) {
        out2 = out2.replace(/(^|\n)([ \t]*)([a-z\u00c0-\u024f\u1e00-\u1eff])/g, function (m, nl, sp, c) {
          return nl + sp + c.toUpperCase();
        });
      }
      return out2;
    }

    // ASCII path — the existing engine
    var mode = opts.mode || 'alt';
    var shorten = opts.vowels !== 'long';

    var out = '';
    var run = '';

    function flush() {
      if (!run) return;
      var w = romanize(run, mode);
      if (w && shorten) w = applyRulesWith(w.toLowerCase(), DISPLAY_RULES);
      out += w;
      run = '';
    }

    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var code = s.charCodeAt(i);

      if (isDevLetter(code)) { run += ch; continue; }

      flush();                                   // a non-letter ends the word

      if (DEV_PUNCT[ch]) { out += DEV_PUNCT[ch]; continue; }
      if (code === 0x0970) continue;             // abbreviation sign — drop
      out += ch;                                 // space, newline, Latin, digit, mark
    }
    flush();

    out = out.replace(/[ \t]+([.,;:!?])/g, '$1');    // "gavaai ." -> "gavaai."

    if (opts.capitalize !== false) {
      // Sentence-initial letters only: the first one, plus the first one on
      // every following line. An already-capitalised word is left alone
      // ("Already" must not become "ALready"). The reader paints one line per
      // call, so verse lines keep their capitals either way.
      out = out.replace(/(^|\n)([ \t]*)([a-z])/g, function (m, nl, sp, c) {
        return nl + sp + c.toUpperCase();
      });
    }
    return out;
  }

  /* ---------------------------------------------------------
   * Phonetic folding
   * ------------------------------------------------------- */

  /** Longest-match-first rewrite table: erases spelling variance, not identity. */
  var FOLD_RULES = [
    ['ksh', 'ks'], ['sh', 's'], ['chh', 'c'], ['ch', 'c'],
    ['aa', 'a'], ['ee', 'i'], ['ii', 'i'], ['oo', 'u'], ['uu', 'u'],
    ['ai', 'e'], ['au', 'o'],
    ['th', 't'], ['dh', 'd'], ['bh', 'b'], ['gh', 'g'], ['kh', 'k'],
    ['ph', 'p'], ['jh', 'j'],
    ['w', 'v'], ['z', 'j'], ['q', 'k'], ['f', 'p'], ['x', 'ks']
  ].sort(function (a, b) { return b[0].length - a[0].length; });

  function applyRulesWith(s, rules) {
    var guard = 0;
    var changed = true;
    while (changed && guard++ < 6) {
      changed = false;
      var out = '';
      var i = 0;
      while (i < s.length) {
        var hit = null;
        for (var r = 0; r < rules.length; r++) {
          var key = rules[r][0];
          if (s.charAt(i) === key.charAt(0) && s.substr(i, key.length) === key) {
            hit = rules[r];
            break;
          }
        }
        if (hit) {
          out += hit[1];
          i += hit[0].length;
          if (hit[1] !== hit[0]) changed = true;
        } else {
          out += s.charAt(i);
          i++;
        }
      }
      s = out;
    }
    return s;
  }

  function applyRules(s) {
    return applyRulesWith(s, FOLD_RULES);
  }

  function stripMarks(s) {
    if (typeof s.normalize === 'function') {
      return s.normalize('NFD').replace(/[\u0300-\u036f\u093c\u0951-\u0954]/g, '');
    }
    return s;
  }

  /**
   * Canonical phonetic key of ANY string (Devanagari, Latin or mixed).
   * "Vaasupujya", "वासुपूज्य" and "Baasupoojya" all land on "vasupujy".
   */
  function fold(str) {
    // Strip IAST diacritics first so that pasted IAST queries
    // (e.g. "ṇamo arihantāṇaṃ") reach the same entries as ASCII
    // queries ("namo arihantanam").
    var s = stripIast(stripMarks(String(str == null ? '' : str))).toLowerCase();
    s = s.replace(/[\u0966-\u096f]/g, function (d) { return String(d.charCodeAt(0) - 0x0966); });
    s = s.replace(/[\u0900-\u097f\u200b-\u200f\u2060\ufeff]/g, ' ');
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    if (!s) return '';
    return applyRules(s).replace(/\s+/g, ' ').trim();
  }

  /**
   * Consonant-only skeleton of an already-folded string.
   * Absorbs every remaining vowel habit: "Bhagwaan" / "Bhagvan" -> "bgn".
   */
  function skeleton(folded) {
    return String(folded || '')
      .split(/\s+/)
      .map(function (w) {
        return w
          .replace(/[aeiou]/g, '')
          .replace(/m/g, 'n')      // nasal variance (onkaar / omkaar)
          .replace(/v/g, 'b')      // v / w / b variance
          .replace(/(.)\1+/g, '$1');
      })
      .filter(Boolean)
      .join(' ');
  }

  /** Script-preserving normalisation: drops punctuation, keeps Devanagari + Latin. */
  function devNorm(str) {
    var s = String(str == null ? '' : str);
    s = s.replace(/[\u200b-\u200f\u2060\ufeff\u093c\u0951-\u0954]/g, '');
    s = s.replace(/[\u0966-\u096f]/g, function (d) { return String(d.charCodeAt(0) - 0x0966); });
    s = s.replace(/[^A-Za-z0-9\u0900-\u097f]+/g, ' ');
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function hasDevanagari(str) {
    return /[\u0900-\u097f]/.test(String(str == null ? '' : str));
  }

  /* ---------------------------------------------------------
   * Edit distance (bounded — bails out early)
   * ------------------------------------------------------- */
  function levenshtein(a, b, max) {
    a = String(a || '');
    b = String(b || '');
    if (a === b) return 0;
    if (max === undefined) max = 3;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (!la) return lb;
    if (!lb) return la;

    var prev = new Array(lb + 1);
    var cur = new Array(lb + 1);
    var j, i, tmp;
    for (j = 0; j <= lb; j++) prev[j] = j;

    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i;
      var ca = a.charAt(i - 1);
      for (j = 1; j <= lb; j++) {
        var cost = ca === b.charAt(j - 1) ? 0 : 1;
        var v = prev[j] + 1;
        var d = cur[j - 1] + 1;
        var sb = prev[j - 1] + cost;
        if (d < v) v = d;
        if (sb < v) v = sb;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }

  /* ---------------------------------------------------------
   * Search-side helpers
   * ------------------------------------------------------- */
  function pushUnique(list, value) {
    if (!value) return;
    for (var i = 0; i < list.length; i++) if (list[i] === value) return;
    list.push(value);
  }

  /** All Latin spellings a single string should be findable by. */
  function latinVariants(text) {
    var t = String(text == null ? '' : text);
    var list = [];
    if (!t) return list;
    pushUnique(list, fold(romanize(t, 'alt')));
    pushUnique(list, fold(romanize(t, 'hindi')));
    pushUnique(list, fold(romanize(t, 'full')));
    pushUnique(list, fold(t));
    pushUnique(list, fold(romanize(t, 'bare')));
    return list;
  }

  /**
   * A searchable field. `w` is the importance penalty (0 = the title itself).
   * Returns null for empty input so callers can skip cheaply.
   */
  function buildField(text, w) {
    var t = String(text == null ? '' : text).trim();
    if (!t || t === 'TBC#') return null;
    var dn = devNorm(t);
    var lts = latinVariants(t);
    if (!dn && !lts.length) return null;

    var sks = [];
    for (var i = 0; i < lts.length && sks.length < 3; i++) {
      var sk = skeleton(lts[i]);
      if (sk && sks.indexOf(sk) === -1) sks.push(sk);
    }

    return {
      w: w || 0,
      dn: dn,
      lts: lts,
      sk: sks.join(' '),
      words: (lts[0] || '').split(' ').filter(Boolean)
    };
  }

  /** Query-side counterpart of buildField. */
  function analyzeToken(raw) {
    var t = String(raw == null ? '' : raw).trim();
    if (!t) return null;
    var dn = devNorm(t);
    var lts = latinVariants(t);
    if (!dn && !lts.length) return null;
    return {
      raw: t,
      dn: dn,
      lt: lts[0] || '',
      lts: lts,
      sk: skeleton(lts[0] || '')
    };
  }

  return {
    romanize: romanize,
    romanizeIAST: romanizeIAST,
    display: display,
    transliterateText: transliterateText,
    fold: fold,
    stripIast: stripIast,
    skeleton: skeleton,
    devNorm: devNorm,
    hasDevanagari: hasDevanagari,
    levenshtein: levenshtein,
    latinVariants: latinVariants,
    buildField: buildField,
    analyzeToken: analyzeToken,
    soundLen: soundLen
  };
});
