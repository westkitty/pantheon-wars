# Pantheon Wars v0.2 — The Ten Pantheons

A small browser 4X strategy game. You are a god competing for worshippers on a hex world of mortal settlements.
- **Ten pantheons** inspired by real traditions, each with four domains, four powers (explore, expand, exploit, exterminate), its own shrine family, priests, emblem, heraldic pattern, architecture and atmosphere: the Olympian Court, the Hall of the Ash, the Ennead of the Two Lands, the Assembly of the Gods, the Tuatha Dé Danann, the Fifth Sun, the Thousand Gods of Hatti, the Council of the Òrìṣà, the Shrines of the Kami and the Vedic Hymns.
- 45 turns in three ages (Dawn, Zenith, Twilight). One human against one or two AI gods, or two to three humans at one screen (hot-seat).
- Mortals have prosperity, safety, trust and memory. Gods swear covenants, answer attacks with counter-rites, send envoys, consecrate pilgrim roads, claim holy places, give shrines and priests callings, and live with the weather.
- Standard play, two alternative victories (Sacred Ground, The Kept Word) and six authored Trials.
- Saves, autosave, export/import, challenge files, a Chronicle that replays any finished game turn by turn, and an end-of-age tapestry you can save as PNG and JSON.
- All content is data (`data/*.json`). The rules engine is deterministic and seeded; an AI-vs-AI balance harness is included.

## Play
Open **`index.html`** in Chrome, Edge or Firefox; double-clicking the file works. The game is entirely offline: no network requests, no external libraries, no image or font files. All art is drawn by code, and all sound effects, ambience and the generated score are synthesised by code (`reports/offline-proof.json`).
An optional **recorded soundtrack** of twenty pieces is directed by `ui/music.js` when its files are installed in `audio/music/`. Those files are not in this repository until redistribution rights are confirmed: see `audio/README.md`. Without them the generated score plays and nothing else changes. Cue sheet and evidence: `reports/soundtrack.md`.

- On the title screen pick a pantheon (search, Random, or Compare two), the match (Standard, Sacred Ground, Kept Word, Trials), one or two rivals (or let the seed choose them), rival skill (Acolyte = easy, Hierophant = hard), hot-seat humans and a world seed. **Continue** resumes the autosave.
- **Click** a place to inspect its people, needs, history and every action you can take there.
- **Priests:** click your priest's place twice (or press **Send**), then click a destination.
- **Keys** (remappable in Settings): `1`–`9` rites and powers · `Enter` end turn · `Esc` cancel · `WASD`/arrows pan · wheel or `+`/`−` zoom · `L` log · `E` encyclopedia · `V` envoys · `I` influence layer · `M` menu · `H` help · `Home` jump home.
- **Touch:** drag to pan, pinch to zoom, tap to select.
- **Settings:** graphics quality, reduced motion, no flashes, patterned borders, high contrast, sound levels, soundtrack (recorded or generated), screen-reader round summaries, action previews, key bindings.
- **URL options:** `?seed=42&faction=yoruba&rivals=norse,vedic&diff=easy&mode=scenario:two_rivers&hotseat=2&autostart=1&quality=low`

Rules, all 40 powers and the sources: **`docs/design.html`** (also in-game: ❦ Encyclopedia). AI rules: **`docs/ai.md`**. Art: **`docs/ART_DIRECTION.md`**. Research and representation: **`docs/RESEARCH_AND_REPRESENTATION.md`**. Requirement traceability: **`docs/TRACEABILITY.md`**.

## Develop (Node 18+; developed on Node 22)
```
node --test tests/*.test.js                 # engine, powers, systems, persistence and content tests
node tools/validate-data.js                 # schema, sources, art registry (A002)
node tools/bundle-data.js                   # REQUIRED after editing data/*.json (writes data/data.js and data/legacy-data.js)
node tools/build-docs.js                    # regenerate docs/design.html from data
node tools/simulate.js --plan full --duel-seeds 20 --ffa-seeds 10 --label ten-final --out reports/ten-pantheon-balance-final
node tools/simulate.js --games 900 --seed 7000 --no-lookahead --label sample --out reports/sample   # quick stratified sample
node tools/journeys.js                      # browser journeys J01–J10 (Playwright + Chromium)
node tools/screenshots.js --seed 11 --faction greek --rivals 2 --diff easy   # full game by real input + Node replay hash check
node tools/screen-atlas.js                  # ten-pantheon screenshot atlas (desktop + phone)
node tools/assets.js                        # asset manifest + QA contact sheets
node tools/perf.js --label after --out reports/perf-after-run1.json     # frame-time sampler
node tools/offline-proof.js                 # file:// and local static server, no external requests
node tools/bundle-data.js --check && node tools/build-docs.js --check   # generated files match their sources
node tools/balance-smoke.js                 # fast fixed-seed integrity sample (AI legality, every pantheon plays)
node tools/weather-qa.js                    # every weather kind distinguishable, controls on top (reports/weather-qa/)
node tools/memory-check.js                  # ten games in one page: heap and canvases stay flat
node tools/qqq.js                           # adversarial checks: hot-seat privacy, blocked storage, pinch, resize, age caches, reduced-motion cues
node tools/visual-qa.js --before <old checkout>   # before/after atlas from real games: pantheons, ages, close zoom, sprites, walk, VFX (reports/visual-qa/)
```
Browser tools use Playwright's Chromium. `npm ci` installs the pinned dev-only version (`package.json`); the game itself has no dependencies. `tools/screenshots.js` also accepts `PUPPETEER=/path/to/puppeteer-core`.

**CI** (`.github/workflows/ci.yml`) runs on pull requests into `main` and pushes to the working branch: the Node tests, the data validator, the bundle sync checks and the balance smoke in one job; the browser journeys, the real-input game with its Node replay check, the offline proof, weather QA, the memory check and the adversarial checks in another. `.github/workflows/balance-full.yml` runs the full 9000-game plan on demand.

## Layout
| Path | What |
|---|---|
| `index.html`, `ui/style.css` | shell, title gallery, HUD, modals (1440×900 and 390×844 layouts) |
| `ui/app.js` | UI controller; every change goes through `PWEngine.step` |
| `ui/render.js` | 2.5D world renderer, weather, marks, villages, fog theatre, 40 VFX signatures |
| `ui/art.js` | procedural pixel art: emblems, patterns, icons, atmospheres, event scenes |
| `ui/kits.js` | 2× standing-object art: ten architectural kits and the village composer, shrines × 7 conditions × 3 callings, priests × 3 callings × 6 frames, landmarks |
| `ui/audio.js`, `ui/storage.js`, `ui/chronicle.js`, `ui/encyclopedia.js` | synthesised sound, versioned saves, Chronicle and tapestry, encyclopedia |
| `ui/music.js`, `audio/soundtrack.json` (`.js`), `tools/prepare-soundtrack.js` | recorded-soundtrack director, manifest, preparation (recordings themselves local only, `audio/README.md`) |
| `engine/engine.js`, `engine/ai.js`, `engine/rng.js` | deterministic rules, AI, PRNG (UMD: browser and Node) |
| `engine/legacy/` | frozen v0.1 engine and AI for replaying v0.1 files |
| `data/*.json` | rules, factions, domains, powers, shrines, events, scenarios, terrain, sources; `data/legacy/v0.1/` frozen v0.1 data; `data/asset-manifest.json` |
| `reports/` | balance reports and tuning history, perf before/after, journeys, atlas, screenshots, sample Chronicle and tapestry |
| `docs/` | design page, AI, art direction, research and representation, traceability, implementation ledger |

## Sources
Every domain, power and shrine cites ids such as `[G1]` or `[Y3]` that resolve to `data/sources.json`. The 18 v0.1 sources (Theoi, Britannica, sacred-texts translations) were opened and read. The 39 v0.2 sources were checked against search-index summaries of each exact URL because the build environment blocked direct page fetches; each record says so in its `verification` field. See `docs/RESEARCH_AND_REPRESENTATION.md`. The mechanics are original abstractions; they do not describe worship practice.
