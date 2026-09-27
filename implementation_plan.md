# Implementation Plan

## Overview

Add a **बाल शिक्षा · Kids Learning** menu section at the end of the JinBhakt navigation menu, containing six contemplative, bilingual (English / हिंदी), fully offline learning games rebuilt from the working prototypes in `Games/`.

The JinBhakt app (`index.html` + `js/*.js` + `css/*.css`) is a dependency-free, hash-routed vanilla-JS SPA that renders everything into `#main-content` and builds its menu into `#category-list`. The six prototypes are standalone single-file HTML pages with their own palettes, global CSS resets, emoji-only art, CDN font links, `alert()` dialogs and unguarded `localStorage` calls. Injecting them into the SPA would collide with `css/base.css` (`*{margin:0}`), `css/variables.css` tokens and the app's own `:root`.

**High-level approach — isolation by construction:**

1. Each game becomes **exactly one self-contained `.html` file** under a new top-level `games/` folder, with inline `<style>` and `<script>`, zero external requests, and it works by double-clicking the file (offline). The existing `Games/` prototype folder is left untouched as reference and is **not** deployed.
2. The SPA gains a new `#/kids` hub route and `#/kids/<gameId>` route. The game route renders the game inside a **same-origin `<iframe>`** in `#main-content`. Same-origin is required so the iframe shares `localStorage` with the hub's unified leaderboard; no `sandbox` attribute is used for that reason (and no game uses `alert`/`confirm`/`prompt`, so it would still work sandboxed later if desired).
3. A new `js/kids.js` UMD module (mirroring the conventions of `js/nav.js` and `js/panchang.js`) owns the game catalogue, the bilingual hub copy, and the shared leaderboard helpers. `js/app.js` consumes it.
4. A new `games/index.html` standalone hub means the whole `games/` folder is independently usable offline (double-click → menu of six games → play).
5. Every game shares one **Game Contract** (language gate → optional audience gate → optional setup gate → play → result + leaderboard), one design language drawn from `css/variables.css`, one WebAudio helper, one `prefers-reduced-motion` policy, one `localStorage` schema and one i18n dictionary shape. It is specified once here and implemented identically six times.

**Scope is deliberately large on content and small on infrastructure:** the prototypes are thin (20 foods, 20 statements, 27/108 vows, 6 memory pairs, factually wrong Tirthankara data). This plan expands every corpus, corrects every factual error, and replaces every casino-grade interaction with a temple-ritual one.

**Non-goals:** no server, no build step, no new runtime dependency, no framework, no bundler, no change to the existing prayer / reader / search / panchang behaviour, no change to `content/*.json` prayer data.

---

## Types

There is no TypeScript in this project. "Types" here means the **data shapes** every file must agree on. These are the contracts; a deviation breaks the unified leaderboard.

### T1. Game descriptor — `js/kids.js` → `GAMES[]`

```js
{
  id:       'sattvic-chef',          // kebab-case; used in hash route + leaderboard key
  file:     'games/sattvic-chef.html',
  icon:     '\uD83E\uDD57',          // decorative emoji, always aria-hidden
  hi:       'सात्त्विक रसोई',
  en:       'Sattvic Chef',
  blurbHi:  'भोजन को जैन-अनुकूल या जैन-प्रतिकूल में बाँटिए — हर उत्तर के साथ कारण।',
  blurbEn:  'Sort food into Jain-friendly or not — with the reason behind every answer.',
  tagHi:    'आहार · अहिंसा',
  tagEn:    'Food · Ahimsa',
  ages:     '5+',                    // display only
  gates:    ['lang','aud','setup'],  // which onboarding gates the game shows
  audience: true,                    // kids | adults corpora differ
  countUp:  [8, 16, 0],              // 0 === "all"; rendered as setup options
  scoring:  'score-desc',            // leaderboard sort policy — see T6
  levels:   ['kids-8','kids-16','kids-all','adults-8','adults-16','adults-all']
}
```

The six descriptors (fixed ids, in menu order):

| # | id | hi | en | file | gates | scoring |
|---|---|---|---|---|---|---|
| 1 | `sattvic-chef` | सात्त्विक रसोई | Sattvic Chef | `games/sattvic-chef.html` | lang, aud, setup | `score-desc` |
| 2 | `myth-busters` | मिथक भंजन | Myth Busters | `games/myth-busters.html` | lang, aud, setup | `score-desc` |
| 3 | `tirth-sort` | तीर्थंकर क्रम | Tirthankar Sorting | `games/tirthankar-sort.html` | lang, setup | `duration-asc` |
| 4 | `niyam-wheel` | नियम चक्र | Daily Vows · Wheel | `games/niyam-wheel.html` | lang, aud | `vows-desc` |
| 5 | `niyam-lotus` | नियम कमल | Daily Vows · Lotus | `games/niyam-lotus.html` | lang, aud | `vows-desc` |
| 6 | `memory-match` | स्मृति पट्ट | Memory Match | `games/memory-match.html` | lang, setup | `duration-asc` |

### T2. Shared preferences — `localStorage["jinbhakt:kids:prefs:v1"]`

```js
{ lang: 'hi'|'en', aud: 'kids'|'adults', sound: true|false, name: 'Aarav', lastGame: 'memory-match' }
```

Written by every game and by the hub; read on boot of every game so language, audience, name and mute persist across games and across the SPA↔iframe boundary. Always behind `try/catch`.

### T3. Shared leaderboard — `localStorage["jinbhakt:kids:leaderboard:v1"]`

```js
{
  "<gameId>": [
    {
      name:     'Aarav',              // sanitised, max 20 chars, rendered with textContent ONLY
      level:    'बालक · 16 वस्तुएँ',  // human label, in the language the player used
      levelKey: 'kids-16',            // stable, language-independent — used for grouping
      duration: 142,                  // whole seconds, first interaction -> completion
      score:    180,                  // game-specific; 0 for non-scoring games
      meta:     { correct:14, total:16, best:7, streakDays:3, vows:4, moves:22, pairs:8 },
      ts:       1790000000000         // Date.now()
    }
  ]
}
```

Max **20 entries per game**, sorted best-first using that game's `scoring` policy with `ts` descending as the final tie-break. The vow games additionally keep `localStorage["jinbhakt:kids:vows:v1"]` = `{ last:'2026-9-26', streak:5, days:{ '2026-9-26':[vowName, …] } }`.

### T4. Vow corpus — shared by `niyam-wheel.html` and `niyam-lotus.html`

Compact positional arrays (as in the prototypes — smallest payload, fastest parse). Both files carry the **identical** corpus.

```js
// CATS: 14 categories; the 1-based index is the first element of every vow row
{ ic:'\uD83C\uDF31', en:'Living Beings', hi:'जीव-दया', sn:'Sachit Niyam' }

// Vow row (7 slots) — indices: 0=cat, 1..3=English, 4..6=Hindi
[ catNo, enName, enPratigya, enTyaag, hiName, hiPratigya, hiTyaag ]
```

**Required counts (hard requirement from the brief):**

| Corpus | Prototype | Target |
|---|---|---|
| `KIDS`   | 27  | **108** |
| `ADULTS` | 108 | **216** |

Distribution over the 14 categories (sums exactly to 108 / 216):

| # | Category (en / hi) | Kids | Adults |
|---|---|---:|---:|
| 1 | Living Beings / जीव-दया | 8 | 16 |
| 2 | Food Items / भोजन पदार्थ | 8 | 18 |
| 3 | Milk·Ghee·Oil·Fried / दूध-घी-तेल-तला | 7 | 18 |
| 4 | Footwear / जूते-चप्पल | 7 | 15 |
| 5 | Snacks & Treats / नश्ता-मिठाई | 8 | 16 |
| 6 | Clothing / वस्त्र | 8 | 15 |
| 7 | Perfume / सुगंध-इत्र | 7 | 15 |
| 8 | Vehicles / वाहन | 8 | 16 |
| 9 | Seats & Beds / आसन-शय्या | 8 | 16 |
| 10 | Cosmetics / प्रसाधन | 7 | 14 |
| 11 | Sensual Pleasures / विषय-भोग | 8 | 15 |
| 12 | Travel & Direction / यात्रा-दिशा | 8 | 14 |
| 13 | Bathing & Water / स्नान-जल | 8 | 14 |
| 14 | Total Food / कुल भोजन | 8 | 14 |
| | **Total** | **108** | **216** |

Authoring rules for the corpus:
- English and Hindi are **independently composed**, never transliterations. Hindi uses correct Devanagari grammar and a gender-neutral infinitive voice ("…करना", "…से दूर रहना").
- Kids' voice: warm, first person, achievable at home or school (gentle hands, one treat, bucket bath, thank the cook, fold my clothes).
- Adults' voice: solemn vow register; includes full observances (एकाशन, द्विकाल, अयंबिल, विगई गिनती, दिशा/दूरी सीमा, आसन-शय्या सीमा, चातुर्मास अनुष्ठान).
- The adult corpus reaches 216 authentically through the traditional **count gradations** (द्रव्य गिनती 20/15/10/5; विगई 3/2/1/0; आसन 10/7/5/3/1; वाहन 5/3/2/1/0; भोजन 4/3/2/1/0; दिशा और दूरी की सीमाएँ) — genuinely distinct observances, not filler.
- Estimated payload ≈ 110 KB per game file (the prototype's 108-row `ADULTS` array is ≈ 30 KB). Both files stay well under 200 KB.

### T5. Tirthankara master record — `memory-match.html`, `tirthankar-sort.html`

Corrected, Digambar-tradition data. The prototype (`Games/Memory Card Flash Game/data.js`) is **wrong** on `aasan` (it marks 21–24 seated; traditionally only 1, 22 and 24 are) and on `moksha` (it marks all 24 as Sammed Shikharji; 1 = Ashtapada, 12 = Champapuri, 22 = Girnar, 24 = Pavapuri).

```js
{
  no: 1, en:'Rishabhanatha', hi:'ऋषभनाथ', aliasEn:'Adinatha', aliasHi:'आदिनाथ',
  chinhHi:'वृषभ',     chinhEn:'Bull',              chinhSvg:'bull',
  varnaHi:'स्वर्ण',    varnaEn:'Golden',             varnaHex:'#E3B23C', varnaKey:'golden',
  aasanHi:'पद्मासन',  aasanEn:'Seated (Padmasana)',  aasanKey:'seated',
  mokshaHi:'अष्टापद', mokshaEn:'Ashtapada',          mokshaKey:'ashtapada',
  janmaHi:'अयोध्या',  janmaEn:'Ayodhya',             janmaKey:'ayodhya',
  tradNoteHi:'', tradNoteEn:''   // present only where traditions differ
}
```

Authoritative table to be encoded, rows 1–12 (verified against Digambar sources):

| no | hi | en | chinh (hi / en / svg) | varna (hi / hex) | aasan | moksha (hi / en) | janma (hi / en) |
|---:|---|---|---|---|---|---|---|
| 1 | ऋषभनाथ | Rishabhanatha | वृषभ / Bull / `bull` | स्वर्ण `#E3B23C` | पद्मासन seated | अष्टापद / Ashtapada | अयोध्या / Ayodhya |
| 2 | अजितनाथ | Ajitanatha | हाथी / Elephant / `elephant` | स्वर्ण | कायोत्सर्ग standing | सम्मेद शिखरजी / Sammed Shikharji | अयोध्या / Ayodhya |
| 3 | सम्भवनाथ | Sambhavanatha | अश्व / Horse / `horse` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | श्रावस्ती / Shravasti |
| 4 | अभिनन्दन | Abhinandananatha | कपि / Monkey / `monkey` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | अयोध्या / Ayodhya |
| 5 | सुमतिनाथ | Sumatinatha | क्रौंच / Curlew / `curlew` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | अयोध्या / Ayodhya |
| 6 | पद्मप्रभ | Padmaprabha | लाल कमल / Red Lotus / `lotusRed` | रक्त `#C0392B` | कायोत्सर्ग | सम्मेद शिखरजी | कौशाम्बी / Kaushambi |
| 7 | सुपार्श्वनाथ | Suparshvanatha | स्वस्तिक / Swastika / `swastika` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | काशी / Varanasi |
| 8 | चन्द्रप्रभ | Chandraprabha | चन्द्रमा / Moon / `moon` | श्वेत `#F2EDE4` | कायोत्सर्ग | सम्मेद शिखरजी | चन्द्रपुरी / Chandrapuri |
| 9 | पुष्पदन्त | Pushpadanta | मकर / Makara / `makara` | श्वेत | कायोत्सर्ग | सम्मेद शिखरजी | काकन्दी / Kakandi |
| 10 | शीतलनाथ | Shitalanatha | श्रीवत्स / Shrivatsa / `shrivatsa` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | भद्रिकापुरी / Bhadrikapuri |
| 11 | श्रेयांसनाथ | Shreyansanatha | गैंडा / Rhinoceros / `rhino` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | सिंहपुरी / Simhapuri |
| 12 | वासुपूज्य | Vasupujya | महिष / Buffalo / `buffalo` | रक्त | कायोत्सर्ग | चम्पापुरी / Champapuri | चम्पापुरी / Champapuri |

Rows 13–24:

| no | hi | en | chinh (hi / en / svg) | varna (hi / hex) | aasan | moksha (hi / en) | janma (hi / en) |
|---:|---|---|---|---|---|---|---|
| 13 | विमलनाथ | Vimalanatha | वराह / Boar / `boar` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | कम्पिल्या / Kampilya |
| 14 | अनन्तनाथ | Anantanatha | बाज़ / Falcon / `falcon` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | अयोध्या / Ayodhya |
| 15 | धर्मनाथ | Dharmanatha | वज्र / Thunderbolt / `vajra` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | रत्नपुरी / Ratnapuri |
| 16 | शान्तिनाथ | Shantinatha | मृग / Deer / `deer` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | हस्तिनापुर / Hastinapur |
| 17 | कुन्थुनाथ | Kunthunatha | अज / Goat / `goat` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | हस्तिनापुर / Hastinapur |
| 18 | अरनाथ | Aranatha | मत्स्य / Fish / `fish` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | हस्तिनापुर / Hastinapur |
| 19 | मल्लिनाथ | Mallinatha | कलश / Water Pot / `kalash` | नील `#2E5FA3` | कायोत्सर्ग | सम्मेद शिखरजी | मथुरा / Mathura |
| 20 | मुनिसुव्रत | Munisuvrata | कूर्म / Tortoise / `tortoise` | श्याम `#3A3A44` | कायोत्सर्ग | सम्मेद शिखरजी | राजगृही / Rajagriha |
| 21 | नामिनाथ | Naminatha | नील कमल / Blue Lotus / `lotusBlue` | स्वर्ण | कायोत्सर्ग | सम्मेद शिखरजी | मिथिला / Mithila |
| 22 | नेमिनाथ | Neminatha | शंख / Conch / `conch` | श्याम | पद्मासन seated | गिरनार / Girnar | शौरिपुर / Shauripura |
| 23 | पार्श्वनाथ | Parshvanatha | सर्प / Serpent / `serpent` | नील | कायोत्सर्ग | सम्मेद शिखरजी | काशी / Varanasi |
| 24 | महावीर | Mahavira | सिंह / Lion / `lion` | स्वर्ण | पद्मासन seated | पावापुरी / Pavapuri | कुण्डग्राम / Kundagrama |

`tradNote` is populated for exactly four contested rows — **10** (some Digambar charts give कल्पवृक्ष / Kalpavriksha), **14** (साही / Porcupine), **18** (नन्द्यावर्त / Nandyavarta), **12** (some charts give सम्मेद शिखरजी). Notes render inside a collapsed "परंपरा भेद · Tradition notes" panel and are never a game answer.

Derived enums used for bucket sorting (counts must add to 24):
- `varnaKey`: golden **16** (1,2,3,4,5,7,10,11,13,14,15,16,17,18,21,24), red **2** (6,12), white **2** (8,9), blue **2** (19,23), dark **2** (20,22)
- `aasanKey`: standing **21**, seated **3** (1, 22, 24)
- `mokshaKey`: sammend **20**, ashtapada **1** (1), champapuri **1** (12), girnar **1** (22), pavapuri **1** (24)
- `janmaKey`: 16 distinct places (Ayodhya ×5, Hastinapur ×3, Varanasi ×2, the rest ×1)

> Because `varna` and `aasan` are heavily skewed, **bucket-sort modes draw from a balanced subset**: `varna` mode takes at most 4 per colour bucket actually present in the chosen count; `aasan` is excluded from bucket sorting and offered only as a memory-match attribute; `moksha` mode is offered only when count ≥ 8 so every non-Sammed bucket can appear.

### T6. Scoring policies — `js/kids.js` → `SCORING`

```js
'score-desc':   (a,b) => (b.score-a.score) || ((b.meta.correct||0)-(a.meta.correct||0)) || (a.duration-b.duration),
'duration-asc': (a,b) => (a.duration-b.duration) || ((a.meta.moves||0)-(b.meta.moves||0)) || (b.score-a.score),
'vows-desc':    (a,b) => ((b.meta.vows||0)-(a.meta.vows||0)) || ((b.meta.streakDays||0)-(a.meta.streakDays||0)) || (a.duration-b.duration)
```

### T7. UI dictionary shape (identical in all six games and both hubs)

```js
const UI = {
  en: { brand:'', langSwitch:'हिंदी', restart:'', back:'', soundOn:'', soundOff:'',
        s1:{ title:'Choose your language', sub:'अपनी भाषा चुनिए', en:'English', hi:'हिंदी' },
        s2:{ title:'', sub:'', kids:'Kids · Baalak', adults:'Adults · Vyask' },
        s3:{ title:'', sub:'', nameLabel:'', namePh:'', countLabel:'', modeLabel:'',
             start:'', leaderboard:'', hint:'' },
        play:{ /* every HUD label, button and hint */ },
        result:{ title:'', medal:[/*4 tiers*/], statScore:'', statAcc:'', statTime:'',
                 statBest:'', again:'', changeSetup:'', hub:'', reviewTitle:'' },
        cheers:[ /* >=5 entries, including "Sadhu! Sadhu!" style blessings */ ],
        toasts:{ correct:'', wrong:'', saved:'', streak:'', lbEmpty:'', lbCleared:'', nameNeeded:'' },
        lb:{ title:'', thRank:'', thName:'', thLevel:'', thTime:'', thScore:'',
             clear:'', confirmTitle:'', confirmYes:'', confirmNo:'' },
        foot:'' },
  hi: { /* structurally identical; independently composed Devanagari */ }
};
```

**Rule:** no visible string may appear outside `UI`. `t(key, vars)` is the only accessor and performs `{n}` / `{name}` substitution. Validation greps the render layer for hardcoded literals (see Testing).

### T8. Query-parameter bootstrap (every game)

`?lang=en|hi` pre-selects and **skips** S1 (the header pill still switches live). `?aud=kids|adults` skips S2. `?n=<count>` and `?mode=<id>` pre-fill S3. `?embed=1` hides the game's own "Back to hub" affordance because the SPA supplies one. Absent params → the full gate sequence runs. Parsed with `new URLSearchParams(location.search)` inside `try/catch`.

### T9. Sattvic Chef food corpus — `games/sattvic-chef.html`

Prototype has 20 items and 4 rule blurbs. Target: **84 items** across 12 categories, each with an independently composed `why` in both languages.

```js
{ id:'potato', cat:'root', jain:false, level:'kids', svg:'rootBulb',
  en:{ name:'Potato', why:'Digging a potato ends the whole plant and disturbs the countless tiny lives in that soil.' },
  hi:{ name:'आलू',    why:'आलू खोदने से पूरा पौधा नष्ट होता है और मिट्टी में बसे असंख्य सूक्ष्म जीवों को हानि पहुँचती है।' } }
```

| cat key | en | hi | items | jain:true | level split |
|---|---|---|---:|---:|---|
| `fruitAbove` | Above-ground fruits | ऊपर फलने वाले फल | 10 | 9 | kids |
| `vegAbove`   | Above-ground vegetables | ऊपर होने वाली सब्ज़ी | 9 | 7 | kids |
| `grain`      | Grains & flours | अन्न और आटा | 8 | 8 | kids |
| `pulse`      | Pulses, seeds & nuts | दाल, बीज और मेवा | 8 | 8 | kids |
| `dairy`      | Dairy | दुग्ध उत्पाद | 6 | 5 | kids |
| `leafy`      | Leafy greens | पत्तेदार साग | 6 | 4 | mixed |
| `root`       | Root vegetables | कंद-मूल सब्ज़ी | 9 | 0 | kids |
| `anantkay`   | Anantkāy (many-souled) | अनंतकाय | 8 | 0 | adults |
| `ekbeej`     | One-seeded fruits | एक-बीज फल | 5 | 0 | adults |
| `animal`     | Meat, fish, egg, honey | मांस, मछली, अंडा, मधु | 8 | 0 | kids |
| `fermented`  | Fermented, stale & stored | किण्वित, बासी और संचित | 8 | 0 | adults |
| `prohibited` | Alcohol, sunset food & other | मदिरा, रात्रि भोजन एवं अन्य | 9 | 0 | mixed |
| | **Total** | | **84** | **41** | |

`level` ∈ `kids` \| `adults` \| `both`. The kids' pool = items where `level !== 'adults'` (**52 items**); the adults' pool = all **84**. Round sizes 8 / 16 / all. Items whose answer depends on family custom (leafy greens on fasting days, udumbar, dairy ethics) carry a `note` field rendered as a small "कुछ परिवारों में…" / "In some families…" line, and the footer repeats the prototype's honest disclaimer to ask one's elders.

### T10. Myth Busters statement corpus — `games/myth-busters.html`

Prototype has 20 English-only statements. Target: **72 statements** (kids 30, adults 30, shared 12), each with an independently composed statement **and** correction in both languages, plus a `topic` for the review screen.

```js
{ id:'m01', aud:'kids', topic:'tirthankara', answer:false,
  en:{ s:'Lord Mahavira founded Jainism.',      x:'Mahavira was the 24th and last Tirthankara…' },
  hi:{ s:'भगवान महावीर ने जैन धर्म की स्थापना की।', x:'महावीर स्वामी चौबीसवें और अंतिम तीर्थंकर थे…' } }
```

| topic key | en | hi | count |
|---|---|---|---:|
| `tirthankara` | Tirthankaras | तीर्थंकर | 12 |
| `ahimsa` | Ahimsa & food | अहिंसा और आहार | 10 |
| `doctrine` | Anekant · Ratnatraya · Karma | अनेकान्त · रत्नत्रय · कर्म | 12 |
| `monastic` | Monks, nuns & vows | मुनि-साध्वी और व्रत | 9 |
| `symbol` | Symbols & mantras | प्रतीक और मंत्र | 8 |
| `festival` | Festivals & calendar | पर्व और संवत् | 8 |
| `scripture` | Scriptures & Acharyas | ग्रन्थ और आचार्य | 7 |
| `digambar` | Digambar tradition | दिगंबर परंपरा | 6 |
| | **Total** | | **72** |

Roughly half carry `answer:true` (affirmations that reinforce correct belief) and half `answer:false` (myths that get busted). Round sizes 10 / 20 / all. Per-question limits: Relaxed 20 s, Standard 12 s, Quick 8 s, **No timer** (new — the prototype forces 10 s on everyone, which is stressful for young children and hostile to screen readers and slow readers).

### T11. Runtime SVG art registry (shared vocabulary, duplicated per game file)

No images, no icon fonts, no emoji-only meaning. Every game builds art with a small registry of pure functions returning SVG markup strings, injected via `container.innerHTML` on an `<svg>` element:

| key | used by | description |
|---|---|---|
| `jainSwastika(size)` | all games, both hubs | 卍-form Jain Swastika with three dots (रत्नत्रय) and a crescent-plus-dot (सिद्धशिला) above it — unmistakably Jain. Built from `<path>` strokes, **never** a text glyph, so it can never be font-mirrored or RTL-flipped. |
| `lotusRosette(petals,size)` | memory-match card front, niyam-lotus | 8-fold radially symmetric rosette → mirroring is mathematically invisible. |
| `mandalaRing(rings,size)` | niyam-wheel hub centre, hub header | Concentric petal rings. |
| `diya(size)` | myth-busters result, hubs | Oil lamp with a two-frame opacity flame. |
| `bell(size)` | sound toggle | Temple घंटा for the mute button. |
| `emblem(key,size)` | memory-match, tirth-sort | 24 line-art emblems keyed by `chinhSvg`: bull, elephant, horse, monkey, curlew, lotusRed, swastika, moon, makara, shrivatsa, rhino, buffalo, boar, falcon, vajra, deer, goat, fish, kalash, tortoise, lotusBlue, conch, serpent, lion. |
| `complexionDisc(hex,size)` | memory-match | Filled disc with rim and inner highlight. |
| `silhouette(kind,size)` | memory-match, tirth-sort | `standing` (कायोत्सर्ग) / `seated` (पद्मासन) abstract, faceless meditative figure. |
| `shikhar` / `girnar` / `pavapuri` / `ashtapada` / `champapuri` | memory-match, tirth-sort | Five distinct hill-and-temple skyline motifs for the nirvana sthals. |
| `templeGate(size)` | memory-match | Generic toran gate motif for janma sthal. |
| `foodGlyph(key,size)` | sattvic-chef | 16 parametric glyphs (`fruitRound`, `fruitLong`, `rootBulb`, `rootTaper`, `leafCluster`, `grainEar`, `podSeeds`, `nutShell`, `milkJug`, `gheePot`, `honeyComb`, `eggOval`, `boneMeat`, `rotiDisc`, `bowlDal`, `mushroomCap`) tinted per category. |

All SVG uses `viewBox`, explicit fills or `currentColor`, `role="img"` with a `<title>` when meaningful, and `aria-hidden="true"` plus `focusable="false"` when decorative.

### T12. Shared game state machine (all six games)

```
boot() -> readPrefs() -> parseQuery()
   |-> state.lang ? skip S1 : show S1 (language gate)
   |-> gates has 'aud'   ? (state.aud   ? skip : show S2)
   |-> gates has 'setup' ? (state.n     ? skip : show S3)
   -> show S4 (play)  -> onFinish() -> show S5 (result + leaderboard)
```

```js
state = { lang, aud, n, mode, screen, name, sound, reduced,
          startedAt, firstMoveAt, finishedAt,
          score, correct, total, moves, best, deck, order, matched }
```

**Live language switch with zero state loss** (explicit brief requirement): `setLang(lang)` mutates `state.lang`, persists it to T2, then calls `render()` — a pure function of `state` that rebuilds only the current screen's text from `UI[lang]`. Timers keep running; the deck / board / order is untouched; scroll position is preserved. This fixes the prototypes' `setLanguage()`, which relies on the implicit global `event` object and either re-renders from scratch or throws when invoked programmatically.

### T13. Design tokens for the games (mirrors `css/variables.css`, inlined per file)

```css
:root{
  --saffron:#E8800C; --maroon:#6D1B2F; --gold:#C8860A; --cream:#FFF8F0;
  --warm:#FFFBF5; --ink:#2D1B06; --ink2:#5C3D1E; --border:#D4A574;
  --success:#2E7D32; --rose:#B23A3A; --leaf:#3F7D4F; --info:#1565C0;
  --r-sm:6px; --r-md:10px; --r-lg:16px; --r-full:9999px;
  --sh-sm:0 1px 3px rgba(45,27,6,.08); --sh-md:0 4px 12px rgba(45,27,6,.10);
  --sh-lg:0 10px 25px rgba(45,27,6,.12);
  --fast:.15s ease; --base:.25s ease; --slow:.4s ease; --ritual:.7s cubic-bezier(.2,.7,.2,1);
  --font-head:'Noto Serif Devanagari', Georgia, 'Times New Roman', serif;
  --font-body:'Noto Sans Devanagari', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

No `@import`, no `<link>` to any CDN. The Devanagari faces are used only if already installed locally (the parent page already loads them from Google Fonts, but the games must render correctly with the generic fallbacks when double-clicked offline).

**Ritual, not casino — concrete rules:**
- No neon, no rainbow gradients, no `box-shadow` glow stacks, no spinning-wheel ticking that accelerates.
- Motion: 200–700 ms, `cubic-bezier(.2,.7,.2,1)`; the largest transform on any element is `scale(1.05)`; nothing bounces past its rest position.
- Wrong answer: a 4 px, two-cycle horizontal sway plus a colour change plus an `aria-live="polite"` message — never a violent shake, never a buzzer.
- Celebration: 20–30 marigold-petal / diya-spark particles in muted temple colours drifting down with `transform: translateY() rotate()` and `opacity`; never a confetti cannon of 90 pieces.
- Sound: WebAudio `sine`/`triangle` at gain ≤ 0.08. Temple bell = fundamental + two harmonics with exponential decay. One soft tick per tap. No jingles, no drums.
- `@media (prefers-reduced-motion: reduce)` zeroes all `transition` and `animation` durations, and JS reads `matchMedia('(prefers-reduced-motion: reduce)').matches` to skip particles, shorten the wheel spin to a 400 ms fade, and skip the lotus breathing cycle.
- Animation touches **only** `transform` and `opacity` (the prototype's `@keyframes breathe { r: 120px → 175px }` and the timer bar's `width` transition are both replaced by `transform: scale()` / `scaleX()`).


---

## Files

### New files

| Path | Purpose | Approx size |
|---|---|---|
| `games/index.html` | Standalone offline hub: menu of the six games + unified leaderboard + shared prefs (name / language / sound). Works by double-clicking. Single file, inline `<style>`/`<script>`. | 30 KB |
| `games/sattvic-chef.html` | Game 1. 84-item food corpus, 12 categories, kids/adults pools, 8/16/all rounds, two bins, drag + swipe + tap + keyboard, per-item teaching card, result + review + leaderboard. | 95 KB |
| `games/myth-busters.html` | Game 2. 72 bilingual statements, 8 topics, kids/adults pools, 10/20/all rounds, 4 timer settings incl. no-timer, animated myth-bust explanation, score + accuracy + streak, result + review + leaderboard. | 90 KB |
| `games/tirthankar-sort.html` | Game 3. 24-Tirthankara master data (T5), count selector 6/8/12/18/24, four modes (`order`, `chinh`, `varna`, `moksha`), tap-swap + pointer-drag + HTML5 DnD + keyboard, 3 hints, timer, move counter, result + leaderboard + tradition-notes panel. | 85 KB |
| `games/niyam-wheel.html` | Game 4. 108 kids / 216 adult vows (T4), 14-category mandala wheel drawn as runtime SVG, category chips with counts, spin ritual with a temple bell, vow reveal, accept → streak, full collapsible list, leaderboard. | 165 KB |
| `games/niyam-lotus.html` | Game 5. Same corpus, 14-petal lotus ritual with a 4-2-6 breathing guide, same category chips, same vow reveal / accept / list / streak / leaderboard. | 165 KB |
| `games/memory-match.html` | Game 6. 24-Tirthankara master data, 6 attributes (`chinh`, `varna`, `moksha`, `aasan`, `janma`, `mixed`), pair-count selector 4/6/8/12, mirror-proof card faces, teaching toast on each match, result + full review table + leaderboard. | 95 KB |
| `games/README.md` | One page: what each file is, how to open offline, the shared localStorage keys, and the sources for the Tirthankara table. | 3 KB |
| `js/kids.js` | UMD module (same wrapper shape as `js/nav.js`): game catalogue, bilingual hub copy, leaderboard read/write/best/clear, duration formatting, name sanitising. Exposed as `window.JinBhaktKids` and as `module.exports` for Node tests. | 12 KB |
| `test/part8.js` | New jsdom test part: Kids Learning routes, menu section, hub rendering, iframe `src`, leaderboard round-trip, home banner, service-worker coverage. | 8 KB |
| `tools/check-games.js` | Node validator (`fs`/`path` only) that statically enforces the single-file contract on all seven `games/*.html` files and asserts corpus sizes. Wired into `npm run check`. | 9 KB |

### Files to modify

**`index.html`** — one line added between `js/nav.js` and `js/panchang.js`:
```html
<script src="js/kids.js" defer></script>
```
No markup change: the menu section is generated by `js/app.js` into the existing `#category-list`, and both new views render into the existing `#main-content`.

**`js/app.js`** — eight surgical changes (detailed in [Functions]):
1. Add `var Kids = window.JinBhaktKids || null;` beside the existing `var Panchang = …` (line ~44).
2. `parseHash()` (~line 934): add `kids` / `kids-game` branches **before** the generic `parts.length === 1 → category` branch.
3. `router()` (~line 957): add the two render branches.
4. `syncNavActive()` (~line 890): extend `lensMap` and add highlight logic for the kids accordion.
5. `renderLensBrowse` / `renderLensPath` / `renderLensIndex` / `renderLensMine`: each ends with `dom.categoryList.appendChild(buildKidsMenuSection())` so the section is always last in the menu.
6. `renderHomeView()` (~line 1111): append a `.kids-banner` **after** `.cat-grid` (never inside it, so the existing `.cat-grid .cat-card` count assertion stays valid).
7. `renderQuickBar()` (~line 2374): insert `{ id:'kids', icon:'🪷', label:'खेल', href:'#/kids' }` before the `menu` button, both in the fallback array and defensively when reading `state.taxonomy.quickBar`.
8. New functions `buildKidsMenuSection()`, `renderKidsView()`, `renderKidsGameView(gameId)`, `renderKidsLeaderboardPanel(scope)`, `kidsFrameSrc(game)` (~450 new lines, placed after `renderFavView()`).


**`css/components.css`** — append a new `/* ===== Kids Learning ===== */` block (~260 lines) at end of file: `.nav-kids-*`, `.kids-view`, `.kids-hero`, `.kids-grid`, `.kids-card`, `.kids-card-icon/-title/-en/-blurb/-tags`, `.kids-tag`, `.kids-banner`, `.kids-lb*`, `.kids-game-view`, `.kids-game-bar`, `.kids-game-frame`, `.kids-dialog`, plus the `prefers-reduced-motion` guard and 320 / 480 / 700 / 900 / 1200 px breakpoints.

**`css/layout.css`** — the `@media (min-width:1400px)` selector list at line 182 gains `.kids-view, .kids-game-view`. `.kids-game-frame` height is `calc(100vh - var(--header-h) - 132px)` at ≥ 900 px and `calc(100dvh - var(--header-h) - 150px)` below that, with a `min-height: 420px` floor.

**`service-worker.js`** — `CACHE_NAME` `jinbhakt-v17` → **`jinbhakt-v18`**; add `js/kids.js` to `SHELL_ASSETS` and a new `GAMES_ASSETS` array listing `./games/index.html` plus the six game files, concatenated into the install list. Games are static, so the existing cache-first branch already serves them offline; only the precache list changes.

**`content/taxonomy.json`** — the `quickBar` array gains a `kids` entry (icon `🪷`, label `खेल`, `href: "#/kids"`) inserted **before** the `menu` entry so the mobile toolbar matches the JS fallback. Nothing else changes; `lenses`, `categories`, `path`, `tirthankaras`, `festivals`, `authors` and `letters` are untouched.

**`package.json`** — `scripts.check` becomes:
```
node --check js/app.js && node --check js/kids.js && node --check js/speech.js && node --check service-worker.js && node tools/check-games.js && npm test && npm run check:stories-en
```
`npm run verify:subpath` is dropped from the chain because `tools/verify-subpath.js` does not exist in the repo — a pre-existing break, not one introduced here.

**`test/harness.js`** — add `window.eval(fs.readFileSync(path.join(ROOT, 'js', 'kids.js'), 'utf8'));` immediately after the `nav.js` eval (line ~82) so the real module is exercised.

**`test/run.js`** — the line-13 assertion changes from `cats.length` to `cats.length + 1` with the comment `// +1 = Kids Learning menu section`; and `await require('./part8.js')({ window, document, jsErrors, ok, txt, wait })` is wired in after the existing `part2.js` call (line ~101).

**`test/part3.js`** — the line-28 desktop assertion changes from `catsData.length` to `catsData.length + 1` with the same comment.

**`DEPLOY.md`** — § 2 "File Manifest" gains the `games/` block and `js/kids.js`; the "Do NOT upload" list gains `Games/` (prototypes) and `implementation_plan.md`; the service-worker section mentions `jinbhakt-v18`.

### Files to delete or move

**None.** The `Games/` prototype folder is deliberately left in place as the design reference. It is never linked from `index.html`, never listed in `service-worker.js`, and is added to DEPLOY.md's "Do NOT upload" list.


---

## Functions

### New — `js/kids.js` (UMD, exposed as `window.JinBhaktKids`)

| Function | Signature | Purpose |
|---|---|---|
| `getGames` | `() → Game[]` | The six descriptors (T1), in menu order. |
| `gameById` | `(id: string) → Game \| null` | Router lookup; `null` ⇒ fall back to the hub. |
| `hubCopy` | `(lang: 'hi'\|'en') → object` | All hub strings: title, sub, section labels, leaderboard headings, empty states, disclaimers, footer. |
| `readPrefs` | `() → {lang,aud,sound,name,lastGame}` | `try/catch` read of `jinbhakt:kids:prefs:v1`, merged over defaults `{lang:'hi',aud:'kids',sound:true,name:'',lastGame:''}`. |
| `writePrefs` | `(patch: object) → void` | Merge-and-save, `try/catch`-wrapped. |
| `lbReadAll` | `() → { [gameId]: Entry[] }` | Raw leaderboard object; always returns `{}` on any failure. |
| `lbRead` | `(gameId: string) → Entry[]` | One game's entries, sorted best-first via `SCORING[game.scoring]`. |
| `lbWrite` | `(gameId, entry) → {rank:number, isBest:boolean}` | Sanitises the name, defaults missing fields, inserts, re-sorts, trims to 20, saves. Returns the 1-based rank so the game can announce "You are #2". |
| `lbBest` | `(gameId, levelKey?) → Entry \| null` | Best overall or best within one level. |
| `lbClear` | `(gameId?) → void` | Clear one game or everything. |
| `sanitizeName` | `(raw: string) → string` | Trim, collapse whitespace, strip `< > & " ' \` / \`, cap at 20 chars. Fixes the prototypes' `innerHTML` name injection. |
| `formatDuration` | `(sec: number) → string` | `mm:ss` under an hour, `Hh Mm` above; Devanagari digits when `lang === 'hi'`. |
| `formatLevel` | `(game, entry, lang) → string` | Localised level label, falling back to `entry.level`. |
| `SCORING` | `{ 'score-desc', 'duration-asc', 'vows-desc' }` | The comparators of T6. |
| `KEYS` | `{ prefs, leaderboard, vows }` | The three storage keys, exported so every game file uses the identical literal. |

### New — `js/app.js`

| Function | Signature | Purpose |
|---|---|---|
| `buildKidsMenuSection` | `() → HTMLDetailsElement` | Builds `<details class="category-item kids-category" data-kids="1">` whose `<summary class="category-header">` holds the 🪷 icon, the label `बाल शिक्षा · Kids Learning` and a `6` count badge, and whose `.category-links` holds six `.link-pill[data-id]` anchors to `#/kids/<id>` plus one `.pill-more` to `#/kids`. Appended last in every lens. |
| `renderKidsView` | `() → void` | Hub: breadcrumb → hero (Jain Swastika SVG, title, sub) → `.kids-grid` of six `.kids-card`s → "मेरी उपलब्धि · My Progress" leaderboard summary → offline note → footer. Sets `document.title`. |
| `renderKidsGameView` | `(gameId: string) → void` | Validates with `Kids.gameById`; unknown id ⇒ `renderKidsView()`. Builds breadcrumb, `.kids-game-bar` (title, "सभी खेल" back link, "नई टैब में खोलें" anchor, reload button) and `.kids-game-frame` wrapping the `<iframe>`. Persists `lastGame`. |
| `renderKidsLeaderboardPanel` | `(scope: 'all' \| gameId) → HTMLElement` | Shared leaderboard table renderer used by the hub and by the game view's collapsible panel. Renders the name with `textContent` only. |
| `kidsFrameSrc` | `(game) → string` | `game.file + '?embed=1&lang=' + prefs.lang + (game.audience ? '&aud=' + prefs.aud : '')`. Relative, so it works on any hosting sub-path. |
| `reloadKidsFrame` | `() → void` | Re-assigns `iframe.src` with a `&_r=<ts>` cache-buster for the reload button. |


### Modified — `js/app.js`

| Function | Change |
|---|---|
| `parseHash()` | Insert **before** `if (parts.length === 1) return { type:'category', cat: parts[0] };`:<br>`if (parts[0] === 'kids') { if (parts.length >= 2) return { type:'kids-game', game: parts[1] }; return { type:'kids' }; }` |
| `router()` | Insert before the `category` branch: `else if (route.type === 'kids') { renderKidsView(); }` and `else if (route.type === 'kids-game') { renderKidsGameView(route.game); }` |
| `syncNavActive()` | Add `kids:'browse'` and `'kids-game':'browse'` to `lensMap`. Add a block that clears `.kids-category.cat-active` and its `.link-pill.active`, then — for `kids-game` — marks `details[data-kids="1"]` active, adds `.active` to `.link-pill[data-id="<game>"]` and opens the accordion on mobile; for `kids` marks only the `details` active. |
| `renderLensBrowse()`, `renderLensPath()`, `renderLensIndex()`, `renderLensMine()` | Each ends with `dom.categoryList.appendChild(buildKidsMenuSection());` so the section is always the last thing in the menu bar. |
| `renderHomeView()` | After `wrap.appendChild(grid);` insert a `.kids-banner` — an anchor to `#/kids` carrying the Swastika SVG, `बाल शिक्षा · Kids Learning`, a one-line blurb and a `6 खेल` chip. It sits **outside** `.cat-grid`. |
| `renderQuickBar()` | Add the `kids` item to the fallback array at position 4 (before `menu`), and when `state.taxonomy.quickBar` is present splice a `kids` item in before `menu` unless one already exists — so a stale cached `taxonomy.json` can never hide the feature. |
| `init()` | Extend `window.jinbhaktApp` with `getKidsGames`, `renderKidsView`, `renderKidsGameView` and `kidsFrameSrc` so the Node tests can drive them directly. |

### New — inside every `games/*.html` file (identical names, per-file scope)

`boot`, `parseQuery`, `readPrefs`, `writePrefs`, `t(key, vars)`, `setLang(lang)`, `setAud(aud)`, `showScreen(id)`, `render`, `renderS1`, `renderS2`, `renderS3`, `renderPlay`, `renderResult`, `renderLeaderboard`, `saveEntry`, `confirmDialog(msg, onYes)`, `toast(msg)`, `beep(freq, dur, type, gain)`, `chime()`, `sfx(name)`, `toggleSound`, `shuffle(arr)` (Fisher–Yates), `pick(arr)`, `nowSec`, `startClock`, `stopClock`, `particles(kind)`, and the `svgArt` registry (T11).

Game-specific: Sattvic Chef → `showCard`, `sortFood(choice)`, `nextFood`, `endRound`. Myth Busters → `showStatement`, `startTimer`, `answer(guess)`, `showFeedback`, `nextStatement`, `endRound`. Tirthankar Sort → `buildSetup`, `startRound`, `renderTiles`, `tapSwap`, `pointerDragStart/Move/End`, `dragStart/drop`, `validateAll`, `useHint`, `finishRound`. Niyam Wheel / Lotus → `renderChips`, `buildWheel` / `buildLotus`, `spin` / `bloom`, `revealVow`, `acceptVow`, `recordStreak`, `renderFullList`. Memory Match → `buildSetup`, `dealDeck`, `renderGrid`, `flipCard`, `checkMatch`, `teachPair`, `finishRound`.

### Removed

No existing function is removed. The prototypes' `setLanguage`, `startGame`, `finishGame`, `saveScore`, `renderLeaderboard`, `clearLeaderboard`, `initMemoryGame`, `initSortingGame`, `shuffleArray`, `confetti`, `beep` and `toast` are **not** carried over by name; each is reimplemented inside the relevant game file's IIFE under the shared contract (T12), with the defects of Appendix A removed.


---

## Classes

This project uses **no ES6 classes** — `js/app.js`, `js/nav.js`, `js/panchang.js`, `js/speech.js` and `js/translit.js` are all IIFE / UMD modules of plain functions, and the prototypes follow the same style. **No new class is introduced**, to stay consistent with the codebase. "Classes" below therefore means CSS classes.

### New CSS class groups

| Group | File | Members |
|---|---|---|
| Menu section | `css/components.css` | `.kids-category`, `.nav-kids-summary`, `.nav-kids-badge`, `.kids-pill-icon` |
| Hub view | `css/components.css` | `.kids-view`, `.kids-hero`, `.kids-hero-mark`, `.kids-grid`, `.kids-card`, `.kids-card-icon`, `.kids-card-title`, `.kids-card-en`, `.kids-card-blurb`, `.kids-card-tags`, `.kids-tag`, `.kids-ages`, `.kids-banner`, `.kids-banner-mark`, `.kids-banner-copy`, `.kids-banner-chip` |
| Leaderboard | `css/components.css` | `.kids-lb`, `.kids-lb-head`, `.kids-lb-table`, `.kids-lb-rank`, `.kids-lb-medal`, `.kids-lb-empty`, `.kids-lb-actions`, `.kids-lb-clear`, `.kids-lb-game`, `.kids-lb-best` |
| Game frame | `css/components.css`, `css/layout.css` | `.kids-game-view`, `.kids-game-bar`, `.kids-game-title`, `.kids-game-actions`, `.kids-frame-open`, `.kids-frame-reload`, `.kids-game-frame`, `.kids-frame` |
| Dialog | `css/components.css` | `.kids-dialog`, `.kids-dialog-card`, `.kids-dialog-actions` — replaces every `confirm()` / `alert()` |
| In-game | each `games/*.html` | `.g-wrap`, `.g-head`, `.g-pill`, `.g-iconbtn`, `.g-screen`, `.g-card`, `.g-btn`, `.g-btn-primary`, `.g-chip`, `.g-hud`, `.g-toast`, `.g-fx`, `.g-lb`, `.g-dialog`, `.is-hidden`, `.is-active`, `.is-correct`, `.is-wrong`, `.is-matched`, `.is-selected` |

### Class-name discipline

Every in-game class is prefixed `g-` or `is-`, and every game `<body>` carries `data-game="<id>"`. Combined with the `<iframe>` boundary this makes collision with `.btn`, `.card`, `.pill`, `.screen`, `.chip` and `.hidden` in `css/components.css` impossible even if a game is later inlined into the SPA.

---

## Dependencies

**No new package, no version change, no CDN, no external font, no image file, no build step.**

- Runtime: vanilla ES6+ only. `devDependencies` stay `jsdom ^28.1.0` and `pngjs ^7.0.0`.
- Browser APIs used — all baseline, all feature-detected: `localStorage` (in `try/catch`), `AudioContext` / `webkitAudioContext` (lazily created and resumed inside the first user gesture), `matchMedia('(prefers-reduced-motion: reduce)')`, `URLSearchParams`, `requestAnimationFrame`, `Element.closest`, Pointer Events with a touch fallback, HTML5 Drag and Drop with a tap-swap fallback.
- **Removed** relative to the prototypes: the Google Fonts `<link>` in `Myth Busters.html` and `Sattvic Chef.html` (offline-breaking), all emoji-only meaning, and every `alert` / `confirm` / `prompt` call.
- `service-worker.js` cache name bumps to `jinbhakt-v18` so returning users pick up `js/kids.js` and `games/*` on the next load.
- Integration requirement: games must be reachable at the **relative** path `games/<file>.html` from the app root, so sub-path hosting keeps working — the same rule DEPLOY.md already states for every other asset.


---

## Testing

### 1. Existing suite must stay green

Baseline today: **478 passed, 0 failed** (`npm test`). After this change the expectation is 478 + the new part-8 assertions, with exactly **two** existing assertions edited:

| File | Line | Before | After |
|---|---|---|---|
| `test/run.js` | 13 | `nav.length === cats.length` | `nav.length === cats.length + 1` |
| `test/part3.js` | 28 | `=== catsData.length` | `=== catsData.length + 1` |

Both receive the comment `// +1 = Kids Learning menu section`. Every other existing assertion (home card count, badge counts, reader, search, panchang, stories-en, transliteration) must pass unchanged. The `.kids-banner` is deliberately placed **outside** `.cat-grid`, and the menu section is deliberately a counted `details.category-item`, so those two edits are the complete churn.

### 2. New — `test/part8.js` (jsdom, wired into `test/run.js` after `part2.js`)

```
[27] Kids Learning — menu section
  menu section exists                  #category-list details.kids-category
  menu section is LAST in the menu bar categoryList.lastElementChild.classList.contains('kids-category')
  section lists 6 game pills           .kids-category .link-pill[data-id] length === 6
  pills use #/kids/<id> routes         /^#\/kids\/[a-z-]+$/ for all 6
  "all games" pill links to #/kids     .kids-category .pill-more[href="#/kids"]
  section present in every lens        switch to path / index / mine, re-assert lastElementChild

[28] Kids Learning — hub route
  #/kids renders the hub               .kids-view exists after the hash change
  hub shows 6 cards                    .kids-grid .kids-card length === 6
  card titles are Devanagari           /[\u0900-\u097F]/.test(.kids-card-title)
  card links are hash routes           href === '#/kids/' + id
  breadcrumb present                   .kids-view .breadcrumb
  document.title set                   /बाल शिक्षा/.test(document.title)

[29] Kids Learning — game route
  #/kids/memory-match renders a frame  .kids-frame exists
  iframe src is game file + params     src starts with 'games/memory-match.html?embed=1&lang='
  back link returns to the hub         .kids-game-bar a[href="#/kids"]
  open-in-new-tab link present         .kids-frame-open[target="_blank"]
  unknown game id falls back to hub    #/kids/nope -> .kids-view and no .kids-frame
  routing does not throw               jsErrors.length === 0

[30] Home banner + quick bar
  home still has exactly N cat cards   .cat-grid .cat-card length === cats.length
  home shows the kids banner           .kids-banner[href="#/kids"]
  quick bar has the kids entry         .quick-bar a[href="#/kids"]

[31] JinBhaktKids module
  exposes 6 games / ids are unique     getGames().length === 6 && new Set(ids).size === 6
  every game file exists on disk       fs.existsSync(game.file) for all 6
  lbWrite/lbRead round-trip            rank === 1 && isBest === true
  duration-asc sorts fastest first     two writes -> best is the shorter duration
  score-desc sorts highest first       same for a score-desc game
  leaderboard trims to 20              25 writes -> length === 20
  sanitizeName strips markup           sanitizeName('<img src=x>') contains no '<'
  sanitizeName caps at 20 chars        result.length <= 20
  lbClear(gameId) is scoped            the other game's entries survive
  survives a throwing localStorage     stub setItem to throw -> no exception escapes
```

`part8.js` receives the same `{ window, document, jsErrors, ok, txt, wait }` context as the other parts and uses `window.jinbhaktApp` / `window.JinBhaktKids`.


### 3. New — `tools/check-games.js` (static contract validator, wired into `npm run check`)

Plain Node, `fs` + `path` + `vm` only. For **each** of the seven `games/*.html` files it asserts:

```
structure
  exactly one <style> block and exactly one <script> block
  no <link ...> tag of any kind
  no <img ...> tag, no url( reference, no data:image
  no "http://" or "https://" other than the SVG XML namespace
  no "cdn", "googleapis", "unpkg", "jsdelivr", "fonts.g"
  the script body parses via `new vm.Script(src)` (syntax check, no execution)

behaviour contract
  "prefers-reduced-motion" appears in BOTH the <style> and the <script>
  every CSS @keyframes block animates only transform / opacity (regex over each block)
  no "alert(", no "confirm(", no "prompt("
  every localStorage access sits inside a try { } (brace-balance check)
  contains the literal "jinbhakt:kids:leaderboard:v1"
  contains the literal "jinbhakt:kids:prefs:v1"
  has an `en:` and an `hi:` block inside the UI dictionary
  no document.write, no eval(, no innerHTML fed by the player name

corpus sizes (located by array-literal scan, then row-counted)
  niyam-wheel + niyam-lotus : CATS === 14, KIDS === 108, ADULTS === 216
  niyam-wheel + niyam-lotus : both files carry an IDENTICAL corpus (hash match)
  tirth-sort + memory-match : TIRTH === 24 and the two tables agree byte-for-byte
  tirth-sort + memory-match : exactly 3 rows have aasanKey 'seated' (nos 1, 22, 24)
  tirth-sort + memory-match : mokshaKey 'sammend' count === 20
  sattvic-chef : FOODS >= 84, jain:true >= 40, every item has en.why and hi.why
  myth-busters : QUESTIONS >= 72, every item has en.s/en.x/hi.s/hi.x,
                 answer:true >= 25 and answer:false >= 25
  memory-match : the string "ॐ" appears nowhere in the file (A1 regression guard)
  all games    : no "卐" / "卍" text glyph — the swastika must be an SVG path

SPA wiring
  js/kids.js exists and every GAMES[i].file resolves on disk
  service-worker.js precaches all seven games/*.html and js/kids.js
  content/taxonomy.json quickBar contains id "kids" with href "#/kids"
```

Exits 1 with a grouped failure report on any miss; runs before `npm test` in the `check` chain.


### 4. Manual validation checklist (real browser — jsdom cannot cover layout, audio or motion)

- `python -m http.server 8000` → `#/kids` → each of the six cards → play to completion → a leaderboard entry appears → back to the hub → "My Progress" shows it.
- Double-click `games/index.html` on `file://` → all six games open, play and store their own leaderboard.
- Double-click each `games/<game>.html` directly → the S1 language gate appears → both languages complete a full round.
- Switch language **mid-game** in all six → the timer keeps running, the board / deck / order is untouched, every visible string changes, no console error.
- DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce" → no particles, no spin, no breathing cycle; all six remain fully playable.
- Responsive at **320 px**, 360, 480, 768, 900, 1280, 1920: no horizontal overflow (`document.scrollingElement.scrollWidth === innerWidth`), tap targets ≥ 44 px, and the iframe never clips a game's result screen.
- Keyboard-only pass on all six: `Tab` reaches every control, the `:focus-visible` ring is visible on cream, and each game's documented shortcuts work (1/2 or ←/→ to sort, T/F to answer, arrows + Enter to swap tiles, Space to spin/bloom, arrows + Enter to flip cards).
- Screen-reader pass (NVDA / VoiceOver): `aria-live="polite"` announces score, correctness and the teaching text; every SVG is either `role="img"` with a `<title>` or `aria-hidden`.
- Private-browsing window (localStorage throws) → all six play to completion with no exception and a graceful "leaderboard unavailable" note.
- Audio: the mute toggle persists across games; nothing plays before the first user gesture (no autoplay-policy warning).
- Lighthouse mobile on `#/kids`: Accessibility ≥ 95, zero console errors, zero external requests.
- `npm run check` green; `node --check js/app.js` and `node --check js/kids.js` green.

---

## Implementation Order

Numbered so that every step leaves the repo runnable and the test suite interpretable.

1. **`js/kids.js`** — catalogue, hub copy, `KEYS`, `SCORING`, prefs + leaderboard helpers. Node-only, no DOM. Verify with `node --check` and a one-off `node -e` round-trip of `lbWrite` / `lbRead`.
2. **`test/harness.js`** — eval `js/kids.js` after `nav.js`. Run `npm test`: still 478 / 0, because nothing consumes the module yet.
3. **`test/part8.js`** — write sections [31] and [32] only (module + service-worker static checks); these fail until step 11.
4. **`games/memory-match.html`** — the smallest complete game and the one carrying the mirror-proof card fix. Establishes the full shared contract (T7–T13) that the other five copy. Verify by double-clicking, in both languages, with reduced motion on and off.
5. **`games/tirthankar-sort.html`** — reuses the T5 master record verbatim from step 4; adds the count selector and the four modes.
6. **`games/index.html`** — standalone hub + unified leaderboard, consuming the exact storage schema proven in steps 4–5.
7. **`css/components.css` + `css/layout.css`** — the whole Kids Learning block.
8. **`js/app.js`** — `parseHash`, `router`, `syncNavActive`, `buildKidsMenuSection`, `renderKidsView`, `renderKidsGameView`, `renderKidsLeaderboardPanel`, `kidsFrameSrc`, `reloadKidsFrame`, the four lens hooks, the home banner, the quick-bar entry, the `window.jinbhaktApp` test hooks.
9. **`index.html`** — add the `js/kids.js` `<script defer>` tag.
10. **`content/taxonomy.json`** — add the `kids` quick-bar entry.
11. **`service-worker.js`** — bump to `jinbhakt-v18`, add `js/kids.js` and the seven game files.
12. **`test/run.js` + `test/part3.js`** — the two `+1` count edits; wire `part8.js` in and add its sections [27]–[30]. Run `npm test` → expect all green.
13. **`tools/check-games.js`** — the validator; run it against the three files built so far to prove it catches regressions before the big content files land.
14. **`games/sattvic-chef.html`** — 84-item bilingual corpus + runtime SVG food glyphs.
15. **`games/myth-busters.html`** — 72 bilingual statements + corrections, 8 topics, timer options.
16. **`games/niyam-wheel.html`** — 108 + 216 vow corpus, mandala wheel, streak, full list.
17. **`games/niyam-lotus.html`** — the same corpus (byte-identical, enforced by the validator), 14-petal lotus, breathing guide.
18. **`games/README.md`**, **`DEPLOY.md`**, **`package.json`** — docs and the `check` script.
19. **Final pass** — `npm run check`; the whole manual checklist of §4; and a fresh-profile offline run (DevTools → Application → Service workers → Offline) of `#/kids` plus all six games.


---

## Appendix A — Prototype defects that must not be carried over

| # | Prototype | Defect | Fix in the rebuild |
|---|---|---|---|
| A1 | Memory Card | The card front is `ॐ`; when a pair is matched the flipped front can render **mirrored** wherever `backface-visibility` is unsupported or the matched state re-shows the front — disrespectful. | Om removed entirely. Card fronts use a **mirror-invariant 8-fold lotus rosette SVG**. The Jain Swastika SVG and the `ह्रीं` text appear only in non-3D DOM. Each face also gets `opacity:0` after the flip, so a mirrored glyph can never be painted even if `backface-visibility` fails. |
| A2 | Memory Card / Sorting | `data.js` marks **all 24** moksha sthals as Sammed Shikharji. | Corrected: 1 अष्टापद, 12 चम्पापुरी, 22 गिरनार, 24 पावापुरी; the remaining 20 सम्मेद शिखरजी. |
| A3 | Memory Card | `data.js` marks 21–24 as seated (पद्मासन). | Corrected: only 1, 22 and 24 are seated; the other 21 are कायोत्सर्ग. |
| A4 | Memory Card | Emblems silently mix Digambar and Shvetambara lists (e.g. `Shrivatsa` for 10 alongside `Falcon` for 14). | One consistent Digambar table plus an explicit collapsed "परंपरा भेद · Tradition notes" panel for rows 10, 12, 14, 18. |
| A5 | Memory Card | `memoryDeck.sort(() => 0.5 - Math.random())` — a biased shuffle. | Fisher–Yates `shuffle()` everywhere, in all six games. |
| A6 | Memory Card | `matchedPairs === 6` is hardcoded and the pair count is not selectable. | `state.pairs` drives completion; 4 / 6 / 8 / 12 selectable before starting (explicit brief requirement). |
| A7 | Memory Card / Sorting | `setLanguage(lang)` reads the implicit global `event` → throws when called programmatically, and re-renders from scratch, losing game state. | `setLang(lang)` takes only the language, persists it and re-renders purely from `state`. |
| A8 | Memory Card / Sorting | Multi-page (`index.html` → `memory.html` / `sorting.html`) with a `sessionStorage` hand-off, `window.location.href` jumps and a `beforeunload` name write. | One file, one state machine, no navigation, no `beforeunload`. |
| A9 | Memory Card / Sorting | Unguarded `localStorage.getItem` / `setItem` / `JSON.parse`. | Every access inside `try/catch` with an in-memory fallback and a visible "leaderboard unavailable" note. |
| A10 | Memory Card / Sorting | `alert()` for name-missing / incomplete / congratulations; `confirm()` to clear the leaderboard. | In-page toast plus a `.g-dialog` modal with focus trapping and Escape-to-cancel. |
| A11 | Sorting | `renderLeaderboard` injects `entry.name` through `innerHTML` — HTML injection straight from user input. | `textContent` only, and `sanitizeName()` on write. |
| A12 | Sorting | The leaderboard stores only `{name,time,date}` — no level, no game, no score. | The full T3 entry (`level`, `levelKey`, `duration`, `score`, `meta`, `ts`). |
| A13 | Sorting | 24 tiles, fixed; no count choice. | 6 / 8 / 12 / 18 / 24 selectable, plus four modes (`order`, `chinh`, `varna`, `moksha`). |
| A14 | Sorting | Mouse-only HTML5 DnD; touch falls back to tap-swap; there is no keyboard path at all. | Pointer Events drag (works on touch), tap-swap retained, and full arrow-key + Enter reordering with `aria-live` announcements. |
| A15 | Chef / Myth Busters | Google Fonts `<link>` — breaks offline use and adds a network dependency. | System font stack only; the validator rejects any `<link>`. |

| A16 | Sattvic Chef | 20 items, English only, no language gate, no audience gate, no leaderboard, no timer. | 84 items, full en/hi, S1+S2+S3 gates, duration + level + score on the leaderboard. |
| A17 | Sattvic Chef | The swipe handler maps `dx < 0` to the left bin, but above 640 px the grid is `1fr / card / 1fr` while below 640 px it collapses to one column — the mapping silently changes meaning. | Swipe direction is bound to the bins' **measured** on-screen order at gesture time (`getBoundingClientRect().left`), both bins always show a persistent ← / → affordance, and both stay reachable by tap and keyboard in every layout. |
| A18 | Sattvic Chef | Feedback is injected with a template literal containing `f.name` and `f.why` through `innerHTML`. | Feedback nodes are built with `textContent` on created elements — the same discipline applied in all six games. |
| A19 | Myth Busters | English only; `updateHUD` computes an unused `done`; a timeout calls `answer(null)` which is then compared with `===` against a boolean. | Full en/hi; dead code removed; `answer(guess)` has an explicit `guess === null` timeout branch that never counts as correct and never corrupts the accuracy math. |
| A20 | Myth Busters | A forced 10 s per question; `setTimeout(..., TIME*600)` is an opaque magic fraction; the timer bar animates `width`. | Four timer options including **no timer**; an explicit named warn threshold; the bar animates `transform: scaleX()`. |
| A21 | Myth Busters / Chef | `confetti()` spawns 60–90 pieces in loud colours; the `shake` keyframe is violent. | 20–30 muted marigold petals; a 4 px two-cycle sway; both fully disabled under reduced motion. |
| A22 | Wheel | `setInterval` recomputes an unused variable from `getComputedStyle` every 140 ms and ticks regardless — a casino rattle plus forced layout thrash for five seconds. | Removed. One soft temple-bell chime at the start and one at the settle; no ticking. |
| A23 | Wheel | With 108 / 216 slices the wheel becomes an unreadable roulette and the label branch silently degrades to bare dots. | The wheel always shows the **14 category** sectors; the vow is then drawn from the landed category. Readable at every corpus size, and no longer a slot machine. |
| A24 | Wheel | `#wheelG` relies on `transform-box: view-box` with no fallback; Safari < 16 mis-rotates the sectors. | `transform-box: view-box; transform-origin: 200px 200px` plus a `requestAnimationFrame` SVG-`transform`-attribute fallback when `CSS.supports('transform-box','view-box')` is false. |
| A25 | Lotus | `@keyframes breathe { r: 120px → 175px }` animates the SVG `r` property — unsupported in older engines and not a transform/opacity animation. | The breathing ring animates `transform: scale()` with `transform-box: fill-box; transform-origin: center`. |
| A26 | Lotus | 8 petals cannot represent 14 categories, and the "chosen petal" is picked at random, unrelated to the vow actually drawn. | 14 petals, one per category; the petal of the **landed** category glows. |
| A27 | Lotus | A stray `</div>` closes `#scrMain` early, so the footer renders outside its section. | Validated, balanced markup; the validator checks tag nesting per file. |
| A28 | Wheel / Lotus | The footer hardcodes "Kids: 27 vows · Adults: 108 vows" — already stale inside the prototype. | Counts are computed from the corpus at render time and injected via `t('foot', {kids, adults})`. |
| A29 | Wheel / Lotus | 14 category chips overflow horizontally on a 320 px screen with no scroll affordance. | Chips wrap, and the row scrolls with `scroll-snap-type: x proximity` plus a fade mask at the trailing edge. |
| A30 | All | Per-prototype storage keys (`niyamStreak`, `niyamStreak2`, `jainTirthankarLeaderboard`, `jainQuestLB`) — nothing aggregates. | Three shared keys (T2, T3 and `jinbhakt:kids:vows:v1`) so the SPA hub and `games/index.html` show one unified record. |
| A31 | Wheel / Lotus | The streak compares `"YYYY-M-D"` string keys and recomputes "yesterday" with `setDate`, which silently resets across month and year boundaries. | `dayKey()` emits zero-padded ISO dates; the streak test compares parsed day numbers, not strings. |
| A32 | All | The `AudioContext` is created at parse time, which the autoplay policy suspends — the first tap is silent and Chrome logs a warning. | The context is created lazily **inside** the first user gesture and `resume()`d there. |
| A33 | All | Emoji carry meaning on their own (`✅🥗`, `🚫🍽️`, `🔊`), which screen readers announce as noise or not at all. | Every emoji is `aria-hidden="true"` and paired with a visible text label; state is conveyed by colour **and** shape **and** text, never colour alone. |


---

## Appendix B — Non-negotiable implementation rules

**B1. i18n.** English and Hindi are independently composed, idiomatic sentences — never transliterations or literal translations of each other. Hindi uses correct Devanagari grammar and a gender-neutral first-person infinitive voice ("…करना", "…से दूर रहना"). Every visible string — titles, hints, buttons, toasts, cheers, medals, table headers, footers, `aria-label`, `title`, `placeholder` — lives in the `UI` dictionary (T7). Cheers include "Sadhu! Sadhu!" style blessings (`साधु! साधु!`). `document.documentElement.lang` is set to `hi` or `en` on every language change.

**B2. Accessibility.** WCAG AA contrast on cream for every text/background pair. Verified against `css/variables.css`: `--color-text #2D1B06` on `--color-cream #FFF8F0` = 15.4:1; `--color-maroon #6D1B2F` on cream = 10.9:1; white on `--color-saffron #E8800C` = 3.1:1 → saffron is therefore reserved for large text and non-text UI, never small body copy. All interactive elements are real `<button>` / `<a>` with a visible `:focus-visible` ring, `min-height: 44px` under `pointer: coarse`, and no `tabindex` gymnastics. Score, correctness and teaching text are announced through one `aria-live="polite"` region. Modals trap focus and restore it on close.

**B3. Motion.** Only `transform` and `opacity`. Every animation has a `prefers-reduced-motion` off-switch in **both** CSS and JS. Nothing loops indefinitely except the breathing guide, which the user can stop at any time.

**B4. Offline / single file.** No network request of any kind. Every game must open over `file://` by double-clicking and run a complete round — including sound and leaderboard.

**B5. Respect.** No depiction of a Tirthankara's face or body — only abstract, faceless silhouettes and traditional emblems. The Om is never used as a decorative or flippable object. The Jain Swastika is drawn as SVG with its three dots (रत्नत्रय) and siddhashila crescent so it is unmistakably Jain and can never be font-mirrored. Religious symbols are never score tokens, never animated violently, and never discarded on a wrong answer.

**B6. Content honesty.** Where family or sectarian custom varies (leafy greens on fasting days, udumbar and anantkāy strictness, dairy ethics, contested emblems), the game shows a short `note` line rather than declaring one answer universally correct, and every game footer repeats: practices vary by family and tradition — always ask your elders.


---

## Appendix C — Per-game screen and interaction specification

### C1. `games/sattvic-chef.html`
- **S1** language gate → **S2** audience gate (बालक / व्यस्क) → **S3** name + round size (8 / 16 / all).
- **S4** HUD: score pill, streak pill, progress bar (`transform: scaleX`), `n / total` counter, mute toggle, language pill.
- Board: left bin "जैन-अनुकूल · Jain-friendly", centre card with a runtime `foodGlyph` SVG plus the item name, right bin "जैन-प्रतिकूल · Not Jain-friendly".
- Input: HTML5 drag-and-drop, Pointer Events swipe (direction resolved from the **measured** bin order — A17), tap-a-bin, and keys `1` / `←` = friendly, `2` / `→` = not.
- After each answer the bin flashes (`is-correct` / `is-wrong`) and a teaching card shows the item, the verdict and the `why` in the active language, then "आगे · Next".
- **S5** medal (4 accuracy tiers), stats (score, correct/total, best streak, duration), an "आज आपने क्या सीखा" review of every missed item, the leaderboard for `levelKey = <aud>-<n>`, and Play again / Change setup / All games.

### C2. `games/myth-busters.html`
- **S1** → **S2** audience → **S3** name + round size (10 / 20 / all) + timer (20 s / 12 s / 8 s / none).
- **S4** HUD: score, streak, accuracy, progress bar, timer bar (`scaleX`, `is-warn` at the named threshold), mute, language pill.
- Statement card with two large buttons `सत्य · TRUE` / `मिथ्या · FALSE`; keys `T` / `F` / `←` / `→`.
- Correct: a gentle gold glow plus a one-line reinforcement drawn from `x`. Wrong or timeout: the `.g-myth-stamp` "मिथक भंजन · MYTH BUSTED" scales in **once** (no looping rotation) over a soft radial SVG burst, then the full correction `x` slides up; both are `aria-live` announced.
- **S5** medal by accuracy, stats (points, accuracy, correct/total, best streak, duration), a review grouped by `topic`, the leaderboard, and Play again / Change setup / All games.

### C3. `games/tirthankar-sort.html`
- **S1** → **S3** name + count (6 / 8 / 12 / 18 / 24) + mode (`order` / `chinh` / `varna` / `moksha`).
- `order`: N shuffled tiles to place in canonical 1→24 sequence; a faint numeric badge appears after the first move.
- `chinh`: a fixed numbered name rail (canonical order) plus N emblem tiles to drop into the matching slot.
- `varna` / `moksha`: bucket sort into 5 colour buckets or 5 place buckets, balanced per T5.
- Input: Pointer Events drag, HTML5 DnD, tap-to-select then tap-to-swap, and arrow-key move + `Enter` to drop.
- Live validation after the first move (`is-correct` / `is-wrong` borders), a move counter, an `mm:ss` clock started on the first move, and 3 hints per round (a hint pulses one correctly-placed tile and costs 15 s).
- **S5** is reachable only when the arrangement is fully correct; it shows duration, moves and hints used, the complete 24-row reference table with all five attributes, the collapsed tradition-notes panel, the leaderboard keyed `levelKey = <mode>-<count>`, and Play again / Change setup / All games.


### C4. `games/niyam-wheel.html`
- **S1** → **S2** audience (बालक 108 / व्यस्क 216).
- Category chip row: "कोई भी · Any" plus 14 chips with live counts, wrapping and horizontally scrollable (A29).
- Mandala wheel: 14 SVG sectors in the muted temple palette, an outer decorative petal ring, a `mandalaRing` hub and a fixed top pointer. Spin = 6 s `cubic-bezier(.12,.64,.08,1)` with one bell at the start and one at the settle; a 400 ms fade under reduced motion.
- Reveal card: category badge, vow name, **प्रतिज्ञा · Pratigya**, **त्याग · Tyaag**, a random cheer from `UI[lang].cheers`, then "🙏 मैं यह नियम स्वीकार करता हूँ" / Spin again / Full list.
- Accept → `recordStreak()` (A31) plus a per-day `vows` counter, petals and a toast; the streak pill then appears in the header.
- Full list: 14 collapsible groups, every vow with Pratigya and Tyaag, and a heading count computed live (A28).
- Leaderboard: `levelKey = <aud>`, `meta.vows` = lifetime accepted count, `meta.streakDays`, `duration` = session length.

### C5. `games/niyam-lotus.html`
- Identical corpus, gates, chips, reveal card, accept/streak, full list and leaderboard to C4 — `tools/check-games.js` enforces a byte-identical corpus between the two files.
- Ritual instead of a wheel: a 14-petal lotus (A26) drawn as runtime SVG; the breathing guide ring scales 4 s in / 2 s hold / 6 s out (A25) and is always skippable; petals unfurl one after another at 70 ms intervals; the landed category's petal glows; the vow unfurls from the centre.
- Under reduced motion the lotus simply fades to its open state in 300 ms with no breathing cycle.

### C6. `games/memory-match.html`
- **S1** → **S3** name + attribute (`chinh` / `varna` / `moksha` / `aasan` / `janma` / `mixed`) + pair count (4 / 6 / 8 / 12).
- Grid of `2 × pairs` cards. Face-down = a `lotusRosette` SVG on a warm gradient (mirror-invariant — A1). Face-up = the Tirthankara name, or the attribute rendered as `emblem()` / `complexionDisc()` / the `shikhar()` family / `silhouette()` / `templeGate()` together with its text label.
- The flip is a `rotateY` on a **wrapper only**; the hidden face gets `opacity:0` after 200 ms so no glyph can ever paint mirrored (A1).
- On a match: a soft gold rim, a two-note chime, and a teaching toast naming the full fact ("श्री ऋषभनाथ · वृषभ · अष्टापद") — the game teaches, it does not merely score.
- On a miss: a 4 px two-cycle sway, then both faces return after 900 ms; input is locked during the reveal.
- Keyboard: arrow keys move a roving focus across the grid; `Enter` / `Space` flips.
- **S5** medal, stats (duration, moves, accuracy = pairs/moves), a review table of every pair played with all five attributes, the leaderboard keyed `levelKey = <attr>-<pairs>`, and Play again / Change setup / All games.

### C7. `games/index.html` and the SPA hub `#/kids`
Both render the same six cards from the same catalogue shape and the same unified leaderboard: best entry per game (name, level, duration), a total-plays count, a per-game clear button and a clear-all button behind a `.kids-dialog` confirmation. The SPA hub additionally links each card to `#/kids/<id>`; the standalone hub links to the relative file. Only the SPA hub shows the "Open in new tab" and "Reload" controls around the iframe.

---

## Appendix D — Risks and mitigations

| Risk | Mitigation |
|---|---|
| The 108 + 216 vow corpus is the largest single authoring effort and could stall the whole feature. | The Implementation Order lands the three knowledge games and the full SPA integration **first** (steps 1–13), so `#/kids` is shippable and tested before a single vow is written. The two vow games are steps 16–17 and are independent of each other. |
| `iframe` + `localStorage` behaves differently under `file://` (Firefox gives each file an opaque origin). | The SPA hub only ever runs over HTTP(S) — the app already refuses to boot from `file://` (`showFatal`). Standalone double-click use degrades to a per-file leaderboard, which is acceptable and documented in `games/README.md`. All storage is `try/catch`-wrapped either way. |
| A 5th quick-bar button crowds a 320 px screen. | `@media (max-width:380px)` sets `.quick-bar-btn { min-width:0; flex:1 1 0; padding:6px 2px; }` and shortens the label to `खेल`; verified at 320 px in the manual checklist. |
| The menu section changes two existing test counts. | Both edits are listed explicitly in §Testing with the exact line numbers and the `+1` comment, so the churn is intentional and reviewable. |
| Two files carrying a 324-row corpus can drift apart. | `tools/check-games.js` hashes both corpora and fails the build if they differ; same for the two Tirthankara tables. |
| Emoji-only meaning breaks screen readers and offline glyph coverage. | Every emoji is `aria-hidden` and paired with a text label; all meaningful art is runtime SVG (T11). |
| Service-worker cache staleness hides the new feature from returning users. | `CACHE_NAME` bumps to `jinbhakt-v18`, which the existing `activate` handler uses to purge every older cache. |

