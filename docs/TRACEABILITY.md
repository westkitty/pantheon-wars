# Traceability — P001–P050 and A001–A010

Status key: **PASS** = implemented and the acceptance oracle is directly evidenced by a test, tool run or capture listed here. **PARTIAL** = implemented, but part of the oracle is not met or not proven. **UNVERIFIED** = implemented, proof not possible in this environment. Evidence paths are relative to the repository root. All runs: Linux container, Node 22, Playwright Chromium (software rendering), 4 CPU cores, 2026-10-29.

## Systems P001–P025

| ID | Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|---|
| P001 | Three-player (and ten-faction) balance | `data/*.json` tuning t1–t12, `tools/simulate.js`, `tools/diagnose.js`, `tools/ablate.js` | `reports/ten-pantheon-balance-final.{json,md}` (ordered duels and FFA by faction, seat, opponent, Wilson 95% CIs, reproducible seeds); history `reports/balance-notes.md`; v0.1 baseline `reports/baseline-v0.1/` | PARTIAL — measured (9000 games, lookahead on): spread overall 17.8 pp, FFA 21.2 pp, duel 25.0 pp; target ≤15 pp per mode not met. Leaders Yoruba 44.8% / Norse 44.7%, trailers Greek 27.1% / Vedic 28.5% |
| P002 | First-seat advantage | `rules.start.seatFaithBonus`/`seatFaithBonusDuel`, `engine/engine.js` newGame | final report "Seat order" table with CIs; counterfactual (no bonus: duel seat 1 55.6% at +2, 53.5% v0.1) in `reports/balance-notes.md` t8 | PASS with residual bias reported — duel seat 1 47.3% [45.0–49.6], seat 2 52.7% [50.4–55.0]; three-god seats 33.4 / 32.1 / 34.4%. Before: v0.1 53.5% first seat (3000 games), 59% in the t7 sample; the remaining 2.7-point lean to seat 2 is smaller than the bias it replaced |
| P003 | Every power a credible choice | `data/powers.json` (Barque of Re Faith buff, Crossing of Utu Favor, priced/ranged fixes), AI valuation `engine/ai.js` | `tests/powers.test.js` (legal target, distinct state change, AI can choose every power, unique icon/VFX); final report "Power usage"; power tooltips in power bar and encyclopedia | PASS — all 40 powers used (min 3.09/game, Gardens of Chalchiuhtlicue); Barque of Re 1.08 → 10.83/game, Crossing of Utu 1.58 → 11.08/game |
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
| P018 | Original audio identity | `ui/audio.js` (synthesised per-pantheon motifs, cues, ambience, volume/mute) | settings journey J09 (volume persists); cue counters in `PW.audio`; audible output not verifiable headless | UNVERIFIED (audible quality) |
| P019 | Ten-pantheon researched content | `data/factions|domains|powers|shrines|sources.json` | engine data tests; P019 domain differential (all 40 domains change outcomes); `tests/content.test.js`; `docs/RESEARCH_AND_REPRESENTATION.md` | PARTIAL (39 v0.2 sources verified at search-summary level only) |
| P020 | Authored scenarios | `data/scenarios.json` (6) | P020/P021 test (start, success and failure reachable, deterministic); QQQ: all six start with objective shown | PASS |
| P021 | Alternative victories | `altCheck` | P021 test; QQQ objective banners | PASS |
| P022 | Onboarding and accessible UX | tutorial, previews, SR summaries, keymap, patterns, contrast, reduced motion/flash, 44 px targets | QQQ tutorial progression + SR text; J08 phone targets; J09 remap/reduced motion; keyboard-only title start | PASS |
| P023 | Versioned save and continue | `ui/storage.js` | `tests/persistence.test.js` (restore, refusal of damaged/foreign/newer/tampered, atomic slots, quota, cross-tab); J04 save → reload → continue, hashes equal; J05 export/import | PASS |
| P024 | Hot-seat and async challenge | handoff blackout, challenge export/import, short code | persistence P024 test; J07 handoff hides the previous god | PASS |
| P025 | Chronicle of Ages | `ui/chronicle.js` reconstruct + UI | persistence P025 test (per-turn hash match); J06 (0 mismatches, scrub) | PASS |

## Visual, asset and UX P026–P050

| ID | Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|---|
| P026 | Visual bible | `docs/ART_DIRECTION.md` | document | PASS |
| P027 | Ten atmospheres | `PWArt.ATMOS` × 10 | `reports/screens/atlas/` (10 desktop + 10 phone, contact sheet) | PASS |
| P028 | Olympian architecture kit | `ARCH.greek`, columned temple | atlas sheets; Greek captures | PASS |
| P029 | Norse architecture kit | `ARCH.norse`, timber hall | atlas sheets; Norse captures | PASS |
| P030 | Egyptian monumental kit | `ARCH.egyptian`, pylon temple | atlas sheets; Egyptian captures | PASS |
| P031 | Layered architecture | villages drawn by patron history (`villageStyle`) | render code; mixed-style towns visible in late captures | PASS |
| P032 | Growth tiers | 5 tiers + decline ruins | render code (`tier`, `decline`) | PASS |
| P033 | Route art and travellers | `drawRoutes` | captures (roads visible in atlas) | PASS |
| P034 | Landmark art | `LANDMARKS` × 4 | `reports/atlas/landmarks.png` | PASS |
| P035 | Terrain biomes | static terrain painter | captures | PASS |
| P036 | Topographic relief | extruded columns, AO, cliff shadows | captures | PASS |
| P037 | Coast and water | two water layers, shallows, foam | captures | PASS |
| P038 | Sky across 45 turns | `skyFor` | e2e turn 3/16/30 captures | PASS |
| P039 | Weather visuals | `drawWeather` | render code; captured only when a front is visible | PARTIAL (no dedicated capture per weather kind) |
| P040 | Scars and blessings | marks layer | render code; P017 test for state | PASS |
| P041 | Shrine condition language | `SHRINES` × `CONDITIONS` (7) | `reports/atlas/shrines-conditions.png` (70 renders) | PASS |
| P042 | Ten priest families | `PRIEST_STYLES` × 3 callings × 4 frames | `reports/atlas/priests.png` (120 renders) | PASS |
| P043 | Forty power signatures | `VFX` ids, unique per power | powers test (unique ids); `reports/atlas/vfx/*.png` (40) | PASS |
| P044 | Three-beat choreography | `playVfx` gather/release/aftermath | render code; VFX frames; reduced-motion path | PASS |
| P045 | Influence flow visualization | influence layer from redacted state | layer toggle (`I`); SR readout | PASS |
| P046 | Patterned boundaries and heraldry | `PATTERNS` × 10, overlay | atlas sheet `emblems-patterns.png`; settings toggle | PASS |
| P047 | Fog as discovery theatre | per-tile reveal cross-fade | J02 omen by click reveals hexes; captures | PASS |
| P048 | Event illustration anthology | `eventArt` × 19 arts × 3 ages | `reports/atlas/event-art.png`, `event-art-ages.png`; validator art check | PASS |
| P049 | Unified HUD | topbar, power bar, panel, End Turn, alerts | J01–J09 captures at 1440×900 and 390×844 | PASS |
| P050 | Tapestry and export | `renderTapestry`, PNG + JSON | J06; `reports/sample-tapestry.png`, `reports/sample-chronicle.json` | PASS |

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
| A008 | Camera/picking lifecycle | J02 click picks the targeted hex; J08 touch tap selects; e2e 164 real-input actions, 0 rejected | PASS |
| A009 | Representation review | `docs/RESEARCH_AND_REPRESENTATION.md` | PASS (document); community review not performed |
| A010 | Offline distribution proof | `tools/offline-proof.js` → `reports/offline-proof.json` PASS (file:// and local server, 0 external requests); `data/asset-manifest.json` provenance | PASS |
