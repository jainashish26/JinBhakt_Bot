# ☸ जिनभक्त — JinBhakt

### *जय जिनेन्द्र बन्धु*

> **An offline-first Jain devotional Progressive Web App (PWA)** — prayers, aarti, stotra, granth, katha, bhajan, chalisa and more, all in Hindi with English transliteration. Zero dependencies. Zero build step. Works without internet.

[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-6D1B2F.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.0.0-E8800C.svg?style=for-the-badge)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-8B5E3C.svg?style=for-the-badge)]()
[![Offline](https://img.shields.io/badge/Offline-First-2E7D32.svg?style=for-the-badge)]()
[![Vanilla JS](https://img.shields.io/badge/JS-Vanilla%20ES6%2B-F5E6C8.svg?style=for-the-badge)]()

---

## 📖 About

**JinBhakt** (जिनभक्त) is a comprehensive digital companion for Jain devotees. It houses **2,000+ devotional texts** across 11 categories — from daily prayers and aarti to sacred granths and inspirational katha — all accessible offline on any device. Built with pure vanilla JavaScript, it requires **no frameworks, no build tools, no server runtime, and no database**.

Rooted in the **Digambar Jain tradition**, the app serves as a complete prayer library, a learning tool for children, and a daily worship guide — installable as a native-like app on phones, tablets, and desktops.

---

## ✨ Features

### 🙏 Devotional Content Library

| Category | Hindi | Items | Description |
|----------|-------|-------|-------------|
| 🎵 Bhajan | भजन | **1,318** | Devotional songs and hymns |
| 🙏 Pooja | पूजा | **120** | Worship rituals and procedures |
| 📚 Katha | कथा-कोश | **114** | Stories from the Aradhana Katha Kosh |
| 📖 Stories (EN) | — | **114** | English translations of katha stories |
| 📖 Granth | ग्रन्थ | **127** | Sacred texts (Samaysaar, Pravachansaar, Dravyasamgrah, etc.) |
| 📜 Stotra | स्तोत्र | **60** | Hymns including Bhaktamar Stotra |
| 🎵 Stuti | स्तुति | **64** | Devotional praise compositions |
| 🙏 Bhakti | भक्ति | **52** | Core mantras and devotion songs |
| 🪔 Aarti | आरती | **45** | Aarti prayers for Tirthankaras |
| 📖 Chalisa | चालीसा | **27** | Forty-verse devotional poems |
| 📋 Reference | सन्दर्भ | **13** | Reference tables (Gati-Agati, Gunsthan, etc.) |

> **Total: 2,054 text files** across 11 categories, all available offline.

### 🔍 Intelligent Search

- **Phonetic search** — type Hindi/Sanskrit names in any romanization style ("SamaySar", "samaysar", "Smysar") and find the right prayer
- **Devanagari search** — search directly in Hindi script
- **Fuzzy matching** — Levenshtein distance-based tolerance for spelling variations
- **Instant results** — search across the entire catalogue in real-time
- **Keyboard shortcut** — press `/` to focus search from anywhere

### 🔤 Transliteration Engine

- **Devanagari ⇄ Roman** — toggle any prayer between Hindi script and Roman letters
- **IAST support** — International Alphabet of Sanskrit Transliteration (ṇ, ā, ś, ṃ, etc.)
- **ASCII mode** — simplified romanization for quick reading
- **Persistent preference** — your choice survives navigation and reloads
- **DOM-preserving** — tables, headings, and verse formatting stay intact during conversion

### 🔊 Text-to-Speech

- **Hindi narration** (hi-IN) — listen to any prayer read aloud using the Web Speech API
- **Voice auto-detection** — picks the best available Hindi voice on your device
- **Bilingual labels** — button text switches between Hindi/English based on reader mode
- **Start/Stop control** — play and pause narration at any time

### 🪔 Panchang Engine (पञ्चाङ्ग)

- **Astronomical computation** — pure-function lunar/tithi calculation based on Meeus algorithms
- **Jain Digambar calendar** — tithi, nakshatra, var, and festival observances
- **Lahiri Ayanamsa** — Chitrapaksha sidereal zodiac computation
- **Moon phase display** — visual lunar phase with CSS-only rendering
- **Default observation point** — Ujjain (traditional prime meridian)

### 🪷 Kids Learning (बाल शिक्षा) — 6 Offline Games

| Game | Hindi | Ages | Description |
|------|-------|------|-------------|
| 🥗 Sattvic Chef | सात्त्विक रसोई | 5+ | Sort food into Jain-friendly or not (97 items, 12 categories) |
| 🪔 Myth Busters | मिथक भंजन | 8+ | True/false quiz about Jainism (72 bilingual statements) |
| 🔢 Tirthankar Sort | तीर्थंकर क्रम | 7+ | Arrange the 24 Tirthankaras by order, emblem, or complexion |
| ☸ Daily Vows · Wheel | नियम चक्र | 6+ | Spin the wheel and take a daily vow (108 kids / 216 adults vows) |
| 🪷 Daily Vows · Lotus | नियम कमल | 6+ | Breathing ritual + daily vow acceptance |
| 🎴 Memory Match | स्मृति पट्ट | 6+ | Match Tirthankaras with emblems, colours, and places |

- **Fully bilingual** — independently composed Hindi and English (not transliterations)
- **On-device leaderboard** — per-game records stored locally (max 20 per game)
- **Vow streak tracking** — daily vow games track consecutive days
- **Zero external dependencies** — each game is a single self-contained `.html` file
- **Works by double-click** — no server needed to play

### 🧭 4-Lens Navigation

| Lens | Hindi | Icon | Description |
|------|-------|------|-------------|
| **Daily Path** | क्रम | 🪔 | Traditional daily worship sequence |
| **Browse** | विषय | 📚 | Category-based exploration with sub-groups |
| **Index** | अ–क्ष | 🔤 | Devanagari akshar-mala letter-based lookup |
| **Mine** | मेरे | ⭐ | Favorites, recent reads, and settings |

### ⭐ Favorites & Personal Collection

- **Star any prayer** — bookmark your most-recited prayers
- **Grouped by category** — favorites organized in a dedicated view
- **Persistent storage** — favorites survive reloads via `localStorage`
- **Quick access** — dedicated `#/fav` route and sidebar shortcut

### 📱 Progressive Web App (PWA)

- **Installable** — "Add to Home Screen" on Android, iOS, and desktop
- **Offline-first** — service worker precaches the app shell and content
- **Smart caching** — network-first for metadata, cache-first for static text files
- **Standalone display** — launches like a native app (no browser chrome)
- **Versioned cache** — automatic old-cache purging on updates

### 📐 Responsive & Accessible Design

- **Mobile-first** — optimized for phones, scales to tablets and desktops
- **WCAG AA compliant** — sacred saffron + maroon palette meets contrast requirements
- **Keyboard navigable** — full keyboard support (Tab, Enter, Escape, arrow keys)
- **ARIA landmarks** — proper roles, labels, and live regions throughout
- **`prefers-reduced-motion`** — all animations honor the user's motion preference
- **Semantic HTML** — proper heading hierarchy, landmark regions, and focus management

---

## 🏗️ Architecture

```
JinBhakt_Bot/
├── index.html                  # SPA entry point
├── manifest.json               # PWA manifest
├── service-worker.js           # Offline cache engine
│
├── css/
│   ├── variables.css           # Design tokens (colors, spacing, typography)
│   ├── base.css                # Resets and base typography
│   ├── layout.css              # Responsive layout rules
│   └── components.css          # Component styles
│
├── js/
│   ├── app.js                  # Main SPA (routing, views, search, reader)
│   ├── nav.js                  # 4-lens navigation engine
│   ├── speech.js               # Text-to-speech (Web Speech API)
│   ├── translit.js             # Devanagari ⇄ Roman transliteration
│   ├── panchang.js             # Lunar/astronomical engine (Meeus-based)
│   └── kids.js                 # Kids Learning catalogue + leaderboard
│
├── games/                      # 6 self-contained offline HTML games
│   ├── index.html              # Standalone hub + leaderboard
│   ├── sattvic-chef.html
│   ├── myth-busters.html
│   ├── tirthankar-sort.html
│   ├── niyam-wheel.html
│   ├── niyam-lotus.html
│   └── memory-match.html
│
├── content/
│   ├── categories.json         # Category definitions
│   ├── taxonomy.json           # Navigation taxonomy (lenses, groups, festivals)
│   ├── panchang.json           # Festival/observance data
│   ├── *.json                  # Content manifests (bhajan, granth, katha, etc.)
│   ├── misc/                   # Reference data (Tirthankaras, temples, etc.)
│   └── text/                   # 2,054 lazy-loaded prayer body files
│
├── img/                        # Icons and branding
├── tools/                      # Build-time scripts
├── test/                       # Automated test suite
└── prototypes/                 # Game design prototypes
```

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- **No Node.js required** to run the app (only for development/testing)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jainashish26/JinBhakt_Bot.git
cd JinBhakt_Bot

# Option A: Python (usually pre-installed)
python -m http.server 8000

# Option B: Node.js (npx, no install)
npx serve -l 8000

# Open in browser → http://localhost:8000
```

> **HTTPS is required** for PWA features (service worker, installability). Use a reverse proxy or a host like GitHub Pages / Netlify for production.

### Deployment

JinBhakt is **pure static** — deploy by copying files to any HTTPS-capable static host:

- **GitHub Pages** — push to `gh-pages` branch
- **Netlify / Vercel** — connect the repo, zero config
- **Any web server** — Apache, Nginx, Caddy, IIS

See [DEPLOY.md](DEPLOY.md) for the complete deployment guide with server configuration, MIME types, and troubleshooting.

---

## 🛠️ Development

### Setup

```bash
npm install          # Install dev dependencies (jsdom, pngjs)
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the automated test suite |
| `npm run check` | Full lint + test + sub-path verification |
| `npm run serve` | Start a local dev server (Python) |
| `npm run build:katha` | Regenerate katha content files |
| `npm run build:stories-en` | Regenerate English story content |
| `npm run build:games` | Regenerate all game HTML files |
| `npm run check:games` | Validate single-file + corpus contracts |
| `npm run check:stories-en` | Validate English story content |
| `npm run icons` | Generate PWA icons |

### Testing

```bash
npm test             # Run all tests
npm run check        # Full validation suite
```

The test suite covers:
- ✅ Service worker precache integrity
- ✅ Manifest + HTML asset integrity
- ✅ Content data integrity (all categories)
- ✅ Navigation and routing
- ✅ Search functionality (phonetic + Devanagari)
- ✅ Reader view and transliteration
- ✅ Speech synthesis module
- ✅ Keyboard shortcuts
- ✅ Mobile/desktop layouts
- ✅ Kids Learning hub and games

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vanilla ES6+** | Zero runtime dependencies; no framework churn |
| **Hash-routed SPA** | Works on any static host, no server config needed |
| **Lazy content loading** | 2,054 JSON files loaded on demand, not upfront |
| **Service Worker** | Offline-first; app works without any network |
| **Single-file games** | Each game is one `.html` — portable, double-clickable |
| **IIFE modules** | Each JS file is a self-contained module with a window API |
| **localStorage** | Favorites, prefs, and leaderboard stay on-device |
| **CSS custom properties** | Consistent theming via design tokens |

---

## 🎨 Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Saffron | `#E8800C` | Primary brand, headers, accents |
| Maroon | `#6D1B2F` | High-contrast text |
| Gold | `#C8860A` | Highlights, icons |
| Cream | `#FFF8F0` | Page background |
| Warm White | `#FFFBF5` | Card/panel backgrounds |
| Text | `#2D1B06` | Body text (WCAG AAA on cream) |

### Typography

| Role | Font Stack |
|------|-----------|
| Headings | Noto Serif Devanagari, Georgia, serif |
| Body | Noto Sans Devanagari, system-ui, sans-serif |
| Latin (reader) | Segoe UI, system-ui, sans-serif |
| IAST | Charis SIL, Gentium Plus, Noto Serif |

---

## 📚 Sacred Texts Included

The Granth category includes major Jain scriptures:

| Text | Author | Tradition |
|------|--------|-----------|
| समयसार (Samaysaar) | Acharya Kundkund | Digambar |
| प्रवचनसार (Pravachansaar) | Acharya Kundkund | Digambar |
| द्रव्यसंग्रह (Dravyasamgrah) | Acharya Nemichandra | Digambar |
| आत्मानुशासन (Atmanushasan) | Acharya Gunbhadra | Digambar |
| सन्मतितर्क (Sanmati-Tarka) | Acharya Siddhasen | Digambar |
| And 122+ more sacred texts... | | |

---

## 📖 Reference Data

The `content/misc/` directory includes structured reference data:

- 🏛️ **Jain Temples** — prominent temples across India
- 🙏 **24 Tirthankaras** — complete data with emblems, complexions, nirvana places
- 📿 **Jain Acharyas** — lineage of spiritual teachers
- 🎉 **Festivals** — major Jain observances and festivals
- 🔢 **Jain Ganit** — numerical tables and concepts
- 📿 **Mantras** — sacred mantras and their significance
- ✨ **Kalyanaks** — auspicious events in a Tirthankara's life
- 📖 **Jain Gyan** — foundational knowledge articles
- 📖 **Granths** — index of sacred texts
- ✍️ **Authors** — notable Jain authors and scholars

---

## 🌐 Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 80+ | ✅ Full support |
| Firefox 75+ | ✅ Full support |
| Safari 13+ | ✅ Full support |
| Samsung Internet | ✅ Full support |
| iOS Safari 13+ | ✅ Full support (PWA via Add to Home Screen) |

---

## 📜 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

```
Copyright (C) 2024 JinBhakt

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

---

## 🙏 Tradition Note

> Rooted in the **Digambar Jain tradition**. Dietary customs, observance practices, and ritual details vary considerably between families and lineages. Content is presented as a reference and devotional aid — always consult your elders and spiritual guides for guidance specific to your tradition.

---

## 🤝 Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports
- 📝 Content corrections (typo fixes, transliteration improvements)
- ✨ New features
- 🌐 Translations
- 📖 Additional prayers or texts

Please open an issue or submit a pull request on [GitHub](https://github.com/jainashish26/JinBhakt_Bot).

---

## 📬 Contact

- **GitHub**: [github.com/jainashish26/JinBhakt_Bot](https://github.com/jainashish26/JinBhakt_Bot)

---

<div align="center">

### 🙏 *णमो अरिहंताणं* 🙏

**May this app serve as a humble instrument in the service of Jain Dharma.**

*जय जिनेन्द्र बन्धु*

</div>
