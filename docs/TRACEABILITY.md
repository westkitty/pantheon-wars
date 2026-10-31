# Traceability — P001–P050 and A001–A010

Status key: **PASS** = implemented and the acceptance oracle is directly evidenced by a test, tool run or capture listed here. **PARTIAL** = implemented, but part of the oracle is not met or not proven. **UNVERIFIED** = implemented, proof not possible in this environment. Evidence paths are relative to the repository root. All runs: Linux container, Node 22, Playwright Chromium (software rendering), 4 CPU cores, 2026-10-29 (v0.2) and 2026-10-30 (release candidate and visual finish).

## Systems P001–P025

| ID | Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|---|
| P001 | Ten-faction balance (≤15 pp per mode) | `data/*.json` tuning (v0.2 t1–t12, release candidate r1–r9), `tools/simulate.js`, `tools/ablate.js` | three independent 9000-game runs of the shipped data: held-out 1000+ (`reports/ten-pantheon-balance-release-candidate.md`), fresh 200000+ (`reports/balance-independent-validation.md`), 300000+ (`reports/balance-rc-on-seed300000.md`); rejected candidate C5a (`reports/balance-candidate-validation.md`); `reports/balance-notes.md` | **PARTIAL** — overall 11.5 / 9.3 / 10.3 and FFA 14.2 / 12.0 / 13.7 pass; duel 16.1 / 18.9 / 18.3 fail (Olympian Court 56–60% vs Vedic 39–41% in duels, persistent across seed sets); the bounded repair (C5a) did not reproduce on untouched seeds and was reverted |
| P002 | First-seat advantage | `rules.start.seatFaithBonus`/`seatFaithBonusDuel`, `engine/engine.js` newGame | release-candidate "Seat order" table with Wilson CIs; counterfactual history in `reports/balance-notes.md` t8 | PASS — duel seats 48.6% [46.3–50.9] / 51.4% [49.1–53.7] (was 47.3 / 52.7); three-god 33.9 / 32.7 / 33.4%; v0.1 first-seat bias was 53.5–59% |
| P003 | Every power a credible choice | `data/powers.json`, AI valuation `engine/ai.js` | `tests/powers.test.js`; release-candidate power usage table | PASS — all 40 powers used, least 3.18 casts/game (Gardens of Chalchiuhtlicue); Barque of Re 1.08/game in v0.1 tuning → 10+ now |
| P004 | Three ages | `rules.ages`, `ageOf`, age mods, AI `ageWeights`, sky progression | `tests/systems.test.js` P004; HUD age label; `reports/screens/e2e/` turn 16/30 captures | PASS |
| P005 | Settlement memory | `remember`, `patrons`, trust | P005 test; panel "Memory of …" | PASS |
| P006 | Mortal needs | needs drift, hunger/unrest | P006 test; panel need bars with explanations | PASS |
| P007 | Covenants | `covenant`/`abandon` actions, kept/broken resolution | P007 test; panel covenant buttons with confirm; e2e used 11 covenants by real input | PASS |
| P008 | Counter-rites | `counterRite`, threat window, storm dispersal | P008 test; e2e 2 counter-rites via panel; HUD threat alert | PASS |
| P009 | AI grudges and identity | `grudge`, archetypes, `grudgeMult` | P009 tests (grudge + archetypes); envoys modal shows grudge | PASS |
| P010 | Bounded Hierophant lookahead | `engine/ai.js` `lookahead` | P010 trap test (greedy 14–16 loss → lookahead 20.5–16 win, real game untouched) | PASS |
| P011 | Diplomacy-lite | `propose`/`answer`, treaties | P011 test; envoys modal; e2e 3 proposals by real input | PASS |
| P012 | Shrine specializations | `specialize`, `rules.specs` | P012 test; shrine art shows calling (`reports/atlas/shrine-specs.png`) | PASS |
| P013 | Priest roles | `rules.roles`, `retrain` | P013 test; priest sprites per calling (`reports/atlas/priests.png`) | PASS |
| P014 | Pilgrimage routes | `genRoutes`, `route`, `resolveRoutes` | P014 test; road rendering and travellers | PASS |
| P015 | Sacred geography | `genLandmarks` (own RNG stream) | P015 test; `reports/atlas/landmarks.png` | PASS |
| P016 | Omen and climate system | weather fronts, `knownFronts` | P016 test (forecast → active → consequence → recovery, hidden until known) | PASS |
| P017 | Persistent consequences | `addMark`, marks layer | P017 test; marks rendered | PASS |
| P018 | Original audio identity | `ui/audio.js` (synthesised per-pantheon motifs, cues, ambience, volume/mute) | J11 (`tools/journeys.js`): no AudioContext before a user gesture, ten motifs, each motif plus cues renders a non-silent unclipped signal through the real bus graph (OfflineAudioContext), one context across four games, hidden tab suspends and visible resumes, mute persists across reload | lifecycle PASS; **perceived sound quality UNVERIFIED** (no listening test possible) |
| P019 | Ten-pantheon researched content | `data/factions|domains|powers|shrines|sources.json` | engine data tests; P019 domain differential (all 40 domains); `tests/content.test.js` (now also checks every number in rules text against the rule) | **PARTIAL** — the 39 v0.2 sources remain search-summary-only: a re-check on 2026-10-30 was blocked by the network policy (hosts listed in `docs/RESEARCH_AND_REPRESENTATION.md`) |
| P020 | Authored scenarios | `data/scenarios.json` (6) | P020/P021 test (start, success and failure reachable, deterministic); QQQ: all six start with objective shown | PASS |
| P021 | Alternative victories | `altCheck` | P021 test; QQQ objective banners | PASS |
| P022 | Onboarding and accessible UX | tutorial, previews, SR summaries, keymap, patterns, contrast, reduced motion/flash, 44 px targets | QQQ tutorial progression + SR text; J08 phone targets; J09 remap/reduced motion; keyboard-only title start | PASS |
| P023 | Versioned save and continue | `ui/storage.js` | `tests/persistence.test.js` (restore, refusal of damaged/foreign/newer/tampered, atomic slots, quota, cross-tab); J04 save → reload → continue, hashes equal; J05 export/import | PASS |
| P024 | Hot-seat and async challenge | handoff blackout, challenge export/import, short code | persistence P024 test; J07 handoff hides the previous god; `tools/qqq.js` Q01 (no previous-god text in the live region, toasts, alerts or panel, including at the round turnover — regression for a defect fixed in this pass) | PASS |
| P025 | Chronicle of Ages | `ui/chronicle.js` reconstruct + UI | persistence P025 test (per-turn hash match); J06 (0 mismatches, scrub) | PASS |

## Visual, asset and UX P026–P050

| ID | Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|---|
| P026 | Visual bible | `docs/ART_DIRECTION.md` | document | PASS |
| P027 | Ten atmospheres | `PWArt.ATMOS` × 10 | `reports/screens/atlas/` (10 desktop + 10 phone, contact sheet); v0.3: per-age land grade baked into the static layer (`AGE_LIGHT`), `reports/visual-qa/ages.jpg`, Q06 checks the regrade | PASS |
| P028 | Olympian architecture kit | `ARCH.greek`, columned temple | atlas sheets; Greek captures | PASS |
| P029 | Norse architecture kit | `ARCH.norse`, timber hall | atlas sheets; Norse captures | PASS |
| P030 | Egyptian monumental kit | `ARCH.egyptian`, pylon temple | atlas sheets; Egyptian captures | PASS |
| P031 | Layered architecture | villages composed by `PWArt.village` (`ui/kits.js`) from ten 2× architectural kits by patron history (`villageStyle`) | `reports/atlas/villages.png` (each kit's last cell mixes an older patron's houses); `reports/visual-qa/close.jpg`; v0.7: town life in the patron culture's own form (`drawTownLife`) — `reports/visual-qa/towns.jpg`, `close.jpg`, motion in `motion.jpg`; QQQ Q14 | PASS |
| P032 | Growth tiers | 5 tiers + decline ruins | v0.4: ring plots round a plaza, civic monument from tier 3, kit enclosure from tier 4, roofless houses in decline, lit windows at Twilight, snow in cold climates; `reports/atlas/villages.png` (10 kits × 5 tiers + night/decline/mixed), `reports/visual-qa/pantheons.jpg`, `close.jpg`; v0.6: growth and decline play a dust-and-ring transition with a caption (QQQ Q11) | PASS |
| P033 | Route art and travellers | `drawRoutes` | captures (roads visible in atlas); v0.5: worn-earth roads with verge, crown, pebbles and cairns; three 2× pilgrims per open road (`ui/kits.js` `pilgrim`, four walk frames by distance) — `reports/visual-qa/close.jpg` | PASS |
| P034 | Landmark art | `LM` × 4 (`ui/kits.js`, 64×56 at 2×) | `reports/atlas/landmarks.png` | PASS |
| P035 | Terrain biomes | static terrain painter | captures; v0.3 biome edge transitions and quieter plains/desert; v0.5: forest stands and hill knolls from the 2× terrain library (`ui/terrain-art.js`), baked at 1× and drawn at 2× at normal zoom — `reports/visual-qa/biomes.jpg` (every land type, before/after), `reports/atlas/terrain.png`. Flat ground decor (plains, grassland, desert, marsh, tundra) unchanged; v0.6: flat ground (grassland, plains, desert, tundra with wet, cold and shore variants) from `ui/terrain-art.js` `ground`; ridged hills — `reports/visual-qa/biomes.jpg`, `reports/atlas/terrain.png` | PASS |
| P036 | Topographic relief | extruded columns, AO, cliff shadows | captures; v0.3 slope light against neighbours, massif mountains; v0.5: mountain massifs reauthored (ridgelines, faces, cliffs, strata, snow caps, scree; heart/middle/edge forms; 8 seeded variants per class) — `reports/visual-qa/biomes.jpg` | PASS |
| P037 | Coast and water | two water layers, shallows, foam | captures; v0.3 blurred continuous water depth; v0.6: authored wave field and swells, wet-sand shore band — `reports/visual-qa/biomes.jpg` (sea, deep); v0.7: water material (per-age depth palette, seabed in the shallows, sky reflection, key-light sheen, current lines) — `reports/visual-qa/water.jpg` (three zooms, before/after) | PASS |
| P038 | Sky across 45 turns | `skyFor` | e2e turn 3/16/30 captures; v0.3 land regrade per age (Dawn warm, Zenith neutral, Twilight violet) plus lit windows and stronger shrine light at Twilight | PASS |
| P039 | Weather visuals | `drawWeather` | `tools/weather-qa.js` → `reports/weather-qa/{weather-atlas.png,manifest.json}`: all five kinds × desktop, reduced motion, phone; each differs from clear weather and from every other kind (closest pair rains/omen 1.3–2.2 mean RGB difference, told apart by glyph); HUD controls stay on top; v0.6: every kind redrawn on the ground (rain slant and splashes, storm gusts, drought shimmer and cracks, frost rime and crystals, omen motes) — `reports/visual-qa/weather.jpg` (staged, before/after), motion in `reports/visual-qa/motion.jpg`; QQQ Q10 | PASS (automated); readability on a physical phone not judged by a person |
| P040 | Scars and blessings | marks layer | render code; P017 test for state | PASS |
| P041 | Shrine condition language | `SH` × `CONDITIONS` (7), `ui/kits.js` 88×100 at 2×: structural damage (breaches, fallen members, shoring), family-material fortification, scaffold restoration, architecture-specific ruins | `reports/atlas/shrines-conditions.png` (70), `shrine-specs.png` (30); `reports/visual-qa/sprites.jpg` (before/after); v0.6: raised, damaged, nearly toppled, ruined, fortified and restored play their own transition (`siteTransitions`) — `reports/visual-qa/motion.jpg`; QQQ Q11 | PASS |
| P042 | Ten priest families | `DRESS` × 3 callings × 6 frames (`ui/kits.js`, 28×40 at 2×; idle, four-frame walk driven by distance, gesture) | `reports/atlas/priests.png` (180 renders); `reports/visual-qa/walk.jpg` (in-game walk) | PASS |
| P043 | Forty power signatures | `VFX` ids, unique per power | powers test (unique ids); `reports/atlas/vfx/*.png` (40); `reports/visual-qa/vfx.jpg` (all 40 at three beats, after); v0.5: every faction power has its own authored manifestation (`ui/vfx-art.js`, forty painters) — `reports/atlas/vfx-motifs.png` (three moments each), `reports/visual-qa/vfx-compare.jpg` (before/after at 0.75 s); QQQ Q09 proves all forty end | PASS |
| P044 | Three-beat choreography | `playVfx` gather/release/aftermath | render code; VFX frames; reduced-motion path; v0.3 world-light envelope per cast (dim → coloured light pool → afterglow, force-scaled); reduced-motion and Low-quality cues checked by Q07; v0.5: manifestations replace the shared motifs inside the same gather/release/aftermath beats; reduced motion holds each power's own form still | PASS |
| P045 | Influence flow visualization | influence layer from redacted state | layer toggle (`I`); SR readout | PASS |
| P046 | Patterned boundaries and heraldry | `PATTERNS` × 10, overlay | atlas sheet `emblems-patterns.png`; settings toggle; v0.3 lighter fill and pattern with a soft inner band; high-contrast unchanged; v0.5: emblems re-made as minted 64 px medallions — `reports/visual-qa/icons.jpg`; v0.6: the ten patterns redesigned as motifs — `reports/visual-qa/heraldry.jpg` (over four grounds, before/after) | PASS |
| P047 | Fog as discovery theatre | per-tile reveal cross-fade | J02 omen by click reveals hexes; captures; v0.3 painted cloud-sea fog with gilded rim; feathered reveal sweep | PASS |
| P048 | Event illustration anthology | `eventArt` × 19 arts × 3 ages | `reports/atlas/event-art.png`, `event-art-ages.png`; validator art check; v0.5: all nineteen scenes recomposed in depth with subject-specific settings — `reports/visual-qa/events.jpg` (before/after), `reports/atlas/event-art.png`; v0.6: all nineteen subjects redrawn — `reports/visual-qa/events.jpg`; QQQ Q12 covers all scenes in all three ages | PASS |
| P049 | Unified HUD | topbar, power bar, panel, End Turn, alerts | J01–J09 captures at 1440×900 and 390×844; v0.3 unified material layer (frames, cooldown badges, meter label, states, 44 px touch targets on tablets); v0.5: minted icons (outline and bevel) and five redrawn glyphs — `reports/visual-qa/icons.jpg`; devices before/after `reports/visual-qa/devices.jpg` (1440×900, 1024×768, 390×844) | PASS |
| P050 | Tapestry and export | `renderTapestry`, PNG + JSON | J06; `reports/sample-tapestry.png`, `reports/sample-chronicle.json`; v0.6: woven textile, pattern border bands, cartouche, embroidered map — `reports/visual-qa/tapestry.jpg` (exported image of one finished game, before/after); J06 downloads PNG and JSON | PASS |

## Connective A001–A010

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| A001 | Ten-faction gallery and rival composer | J01 (10 cards, search, compare, pick by click, every pantheon starts); keyboard grid navigation (QQQ) | PASS |
| A002 | Schema validation and registry | `tools/validate-data.js` (with art registry); `tests/content.test.js` A002; engine refuses unknown effect types | PASS |
| A003 | Mode/scenario/challenge records | `newGame` mode normalisation; save record `cfg.mode`; persistence tests across modes | PASS |
| A004 | Causality and history | log entries with stable ids (`state.seq`), actor, targets, visibility (`logVisible`); Chronicle per-turn hashes | PASS |
| A005 | Source-backed encyclopedia | `ui/encyclopedia.js`; J09 (10 pantheon sections) | PASS |
| A006 | Save/replay backwards compatibility | `engine/legacy/`; persistence A006 test; J10 (v0.1 file → legacy Chronicle at 6a3687d9) | PASS |
| A007 | Content authorship | `tests/content.test.js` (no AI credits, Unicode names, no spiders, no Mexica sacrifice wording) | PASS |
| A008 | Camera/picking lifecycle | J02 click picks the targeted hex; J08 touch tap selects; e2e 183 real-input actions, 0 rejected; Q03 two-finger pinch zooms; Q05 complete frames after resizes | PASS |
| A009 | Representation review | `docs/RESEARCH_AND_REPRESENTATION.md` | PASS (document); community review not performed |
| A010 | Offline distribution proof | `tools/offline-proof.js` → `reports/offline-proof.json` PASS (file:// and local server, 0 external requests); `data/asset-manifest.json` provenance | PASS |
