# Pantheon Wars v0.1

A small browser 4X strategy game. You are a god competing for worshippers on a hex world of mortal settlements.
- Three pantheons inspired by real traditions, each with cited sources: the Olympian Court (Greek), the Hall of the Ash (Norse) and the Ennead of the Two Lands (Egyptian).
- 45 turns; one human against one or two AI gods.
- All content is data (`data/*.json`). The rules engine is deterministic and seeded, and an AI-vs-AI balance harness is included.

## Play
Open **`index.html`** in Chrome, Edge or Firefox; double-clicking the file works. The game is entirely offline: there are no network requests and no external libraries, and all art is procedural.

- Pick a pantheon, one or two rivals, rival skill (Acolyte = easy, Hierophant = hard) and a world seed. Then press **Begin the Age**.
- **Click** a place to inspect it.
- **Priests:** click your priest's hex, press **Send** (or click the hex again), then click a destination.
- **Keys:**
  - `1`–`9` divine powers
  - `Enter` end turn
  - `Esc` cancel
  - `WASD`/arrows to pan
  - wheel or `+`/`−` to zoom
  - `L` turn log
  - `H` help
  - `Home` jump to your capital
- **Touch:** drag to pan, pinch to zoom, tap to select.
- **Graphics:** ⚙ → Graphics quality (Auto drops to Low if frames exceed 24 ms). `prefers-reduced-motion` is honoured.
- **URL options:** `?seed=42&faction=norse&rivals=2&diff=easy&autostart=1&quality=low`

The design page with rules, all 12 powers and the sources is **`docs/design.html`**. The AI rules are in **`docs/ai.md`**.

## Develop (Node 18+; developed on Node 24)
```
node --test tests/*.test.js                       # 14 engine tests (determinism, replay, powers, victories, data-only pantheon)
node tools/simulate.js --games 1000 --seed 1000 --label after --easy-check 150 --out reports/balance-after
node tools/simulate.js --games 1000 --seed 1000 --label before --data reports/data-before --out reports/balance-before
node tools/diff-data.js reports/data-before       # what tuning changed
node tools/bundle-data.js                         # REQUIRED after editing data/*.json (writes data/data.js for file:// use)
node tools/build-docs.js                          # regenerate docs/design.html from data
node tools/screenshots.js --seed 11 --faction greek --rivals 2 --diff easy --out screenshots
```
`tools/screenshots.js` drives headless Chrome through a whole game using real clicks and keypresses. It captures every UI state plus mobile and reduced-motion views, then replays the recorded actions in Node to confirm the final state hash matches. It needs `puppeteer-core` (dev only, not shipped); set `PUPPETEER=/path/to/puppeteer-core` and `CHROME=/path/to/chrome`.

## Layout
| Path | What |
|---|---|
| `index.html`, `ui/style.css` | shell and HUD (top resource bar, side panel, power bar with cooldown sweeps, End Turn, minimap, log, event card, victory) |
| `ui/render.js` | the 2.5D world renderer: extruded, lit hex terrain cached to an offscreen layer, warped through a perspective camera, with fog, haze, water, clouds and FX |
| `ui/art.js` | procedural pixel art: emblems, power icons, event-card scenes |
| `ui/app.js` | UI controller; every change goes through `PWEngine.step` |
| `engine/engine.js`, `engine/ai.js`, `engine/rng.js` | deterministic rules, AI, PRNG (UMD: browser and Node) |
| `data/*.json` | rules, factions, domains, powers, shrines, events, terrain, sources (`data/data.js` is generated) |
| `reports/` | balance reports before and after tuning, a 3000-game confirmation, and the pre-tuning data snapshot |
| `screenshots/` | headless-Chrome captures and `e2e-report.json` |
| `backlog.md` | ten next steps, including data-only pantheons |
| `NOTES.md` | build status notes |

## Sources
Every domain and power cites ids such as `[G1]` that resolve to `data/sources.json`. Theoi Project and Britannica pages are cited, plus Bellows' Poetic Edda and Budge's Book of the Dead at sacred-texts.com. All of them were opened and read while building. See `docs/design.html#src-G1` onward. The mechanics are original abstractions; they do not describe worship practice.
