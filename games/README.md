# Kids Learning · बाल शिक्षा

Six contemplative, bilingual (English / हिंदी), **fully offline** learning games.

Each game is **exactly one self-contained `.html` file** — inline `<style>` and `<script>`,
no CDN, no external fonts, no images, no frameworks, no build step. Every one of them runs
by double-clicking the file.

| File | Game | Gate sequence | Records ranked by |
|---|---|---|---|
| `index.html` | Standalone hub + unified leaderboard | language | — |
| `sattvic-chef.html` | सात्त्विक रसोई · Sattvic Chef | language → audience → setup | highest score |
| `myth-busters.html` | मिथक भंजन · Myth Busters | language → audience → setup | highest score |
| `tirthankar-sort.html` | तीर्थंकर क्रम · Tirthankar Sorting | language → setup | fastest time |
| `niyam-wheel.html` | नियम चक्र · Daily Vows (Wheel) | language → audience | most vows kept |
| `niyam-lotus.html` | नियम कमल · Daily Vows (Lotus) | language → audience | most vows kept |
| `memory-match.html` | स्मृति पट्ट · Memory Match | language → setup | fastest time |

## Opening them

**On their own** — double-click `games/index.html` (or any single game) and play. Works with no
server and no internet connection.

**Inside the app** — the `बाल शिक्षा · Kids Learning` menu section at the end of the sidebar
links to `#/kids` (the hub) and `#/kids/<gameId>` (a game rendered in a same-origin `<iframe>`).
The app passes `?embed=1&lang=…&aud=…`, which skips the game's own language and audience gates
because the hub has already answered them; the header pill still switches language live.

## On-device storage

Nothing leaves the device. Three `localStorage` keys, always wrapped in `try/catch` so a
private-browsing window degrades gracefully instead of throwing:

| Key | Contents |
|---|---|
| `jinbhakt:kids:prefs:v1` | `{ lang, aud, sound, name, lastGame }` |
| `jinbhakt:kids:leaderboard:v1` | `{ "<gameId>": [ {name, level, levelKey, duration, score, meta, ts} ] }` |
| `jinbhakt:kids:vows:v1` | `{ last, streak, days: { "<yyyy-mm-dd>": [vow names] } }` (vow games only) |

Each game keeps at most **20** rows, sorted best-first by that game's own policy. Player names
are sanitised (markup stripped, capped at 20 characters) and always rendered with `textContent`,
never `innerHTML`.

Because the iframe is same-origin, records written inside a game are immediately visible to the
app's hub and to `games/index.html`. Under `file://` some browsers give each file an opaque
origin, so the standalone hub may show a separate record set from a game opened directly — this
is a browser restriction, not a bug, and every game still plays normally.

## Content

- **Daily vows** — 14 categories, **108** kids' vows and **216** adults' vows. The two vow games
  carry a byte-identical corpus (enforced by the validator).
- **Sattvic Chef** — **97** foods across 12 categories, each with an independently written
  reason in both languages. The kids' pool excludes the stricter adult-only observances.
- **Myth Busters** — **72** statements across 8 topics, roughly half true and half false, each
  with a correction in both languages. Four timer settings including **no timer**.
- **Tirthankar games** — the 24 Tirthankaras with emblem, complexion, posture, nirvana place and
  birth place. Only #1 (अष्टापद), #12 (चम्पापुरी), #22 (गिरनार) and #24 (पावापुरी) attained moksha
  outside सम्मेद शिखरजी, and only #1, #22 and #24 are traditionally shown seated. Rows where
  Digambar and Shvetambara conventions differ carry a `tradNote` shown in a collapsed panel —
  never as a scored answer.

English and Hindi are **independently composed** throughout, never transliterations of one
another. Hindi uses a gender-neutral infinitive voice for vows ("…करना", "…से दूर रहना").

## Accessibility and motion

- All art is SVG generated at runtime — no images, no icon fonts. Every emoji is `aria-hidden`
  and paired with a text label.
- The Om is deliberately **not** used as a card face or decorative object. Card fronts carry an
  8-fold symmetric lotus rosette, which cannot read as mirrored under any transform. The Jain
  Swastika is drawn from SVG paths (with its three रत्नत्रय dots and siddhashila crescent) so no
  font or RTL rule can ever flip it.
- Animation touches **only** `transform` and `opacity`. Every game honours
  `prefers-reduced-motion` in both CSS and JS — no particles, no spin, no breathing cycle.
- No `alert` / `confirm` / `prompt` anywhere; confirmations use an in-page dialog with focus
  trapping and Escape-to-cancel.
- Each game is fully playable by keyboard, and score, correctness and teaching text are
  announced through an `aria-live="polite"` region.

## Maintenance

The games are generated from small authored parts by a dev-time assembler, exactly as
`tools/build-katha.js` generates content:

```
npm run build:games      # regenerate every games/*.html
npm run check:games      # enforce the single-file + corpus contract
```

Parts live in `tools/games/parts/<game>/` (`title.txt`, `desc.txt`, `lang.txt`, `body.html`,
`extra.css`, `data.js`, `ui.js`, `logic.js`). Shared fragments — the stylesheet, storage and
audio helpers, the SVG art library, the toast/dialog/particle shell and the leaderboard — are
extracted from `memory-match.html` by `tools/games/_extract.js` into `tools/games/_shared.js`, so
all seven files stay consistent. The two vow games share `parts/_vows.js`; the two Tirthankara
games share the same `T_ROWS` table.

**The emitted `games/*.html` files are the shipped artefact.** They are committed, standalone and
never reference the assembler at runtime.

## Tradition note

Rooted in the Digambar Jain tradition. Dietary and observance customs vary considerably between
families and lineages, so every game states this in its footer and marks genuinely variable
items with a short "family note" rather than declaring one answer universally correct. Always
ask your elders.
