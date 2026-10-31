# Pantheon Wars — OMNI implementation state (durable work ledger)

Resume instruction for any agent: read this file top to bottom, then `docs/TRACEABILITY.md`, verify the repo/branch/working tree,
and continue from the latest **NEXT ACTION**. Do not commit, push or deploy without explicit user authorization.

## Protected behaviour (must keep working)
- Original three IDs `greek`, `norse`, `egyptian` and their 12 power IDs; double-clickable `index.html` over `file://`; no network requests.
- Deterministic `PWEngine.step` (pure); seeded RNG only; AI never touches the game RNG.
- v0.1 saves/replays: replayed by the frozen read-only legacy player `engine/legacy/*-v0.1.js` + `data/legacy/v0.1/`.

## Phase log

### Phase 0 — Fingerprint (2026-10-29)
- Repository: `westkitty/pantheon-wars`, remote `origin https://github.com/westkitty/pantheon-wars`; working branch `claude/vibrant-feynman-x1fjq9`;
  inspected HEAD `4556ece3ce95b331f30050dd423d6b865dc2d243` (equal to `main`); working tree clean at start.
- Environment: Linux cloud container, Node v22.22.0, 4 CPUs, pre-installed Playwright Chromium (headless, software rendering, no GPU).
  `puppeteer-core` and `/usr/bin/google-chrome` from the v0.1 notes do NOT exist here; tools now use Playwright.
- Network: direct HTTP fetches to source sites are blocked by the session's network policy (curl CONNECT 403, WebFetch DNS refusal).
  Web *search* works, so source claims were checked against search-index summaries of the cited pages (labelled per source in `data/sources.json`).
- Tests on unmodified v0.1: `node --test tests/*.test.js` → 14/14 pass (4.6 s).
- Browser baseline on unmodified v0.1 (pristine copy, Playwright adapter): real-input full game seed 11, Greek vs 2 Acolytes:
  Twilight victory T45, 334 actions, 0 rejected inputs, browser hash `6a3687d9` == Node replay `6a3687d9` (matches the v0.1 notes).
  Recorded action list saved as `tests/fixtures/v0.1-e2e-seed11.json`; report `reports/baseline-v0.1/e2e-report.json`.
- Frozen legacy player: `engine/legacy/engine-v0.1.js`, `engine/legacy/ai-v0.1.js`, `data/legacy/v0.1/*.json`; replaying the fixture gives `6a3687d9`.
- Performance baseline (v0.1, 3 runs, `node tools/perf.js --root <pristine copy>`): `reports/baseline-v0.1/perf-before-run{1,2,3}.json`.
  Median-of-runs renderer CPU ms per frame (median / p95): turn1 12.5/18.4, mid16 15.7/22.6, late30-reveal 16.5/22.4,
  late30-low 13.1/17.6, mobile16 14.9/20.4, miracle-burst 16.0/24.0. Software rendering; not a device benchmark.
- Note: a pure-Node AI replay of the e2e seed does NOT reproduce the browser game (UI ordains priests without `dest`), so the
  browser action list, not an AI re-run, is the legacy fixture.

NEXT ACTION: Phase 1 — author ten-faction data and sources; extend engine effect vocabulary.

### Phase 1 + engine part of Phases 3–4 (2026-10-29)
- Data: 10 factions (locked ids/names), 40 domains, 40 powers (unique icon + vfx ids), 10 shrine families, 19 events
  (12 original + 7 tradition-specific, climate tags), 6 scenarios, 57 sources (`data/sources.json`, each with verification + confidence).
- Engine v0.2.0 (`engine/engine.js`): ages, mortal needs, trust/memory/patrons, covenants, counter-rites, delayed (telegraphed) miracles,
  diplomacy (truce/festival/border), grudges, shrine specializations, priest roles, pilgrim routes (generated, consecrated, disrupted,
  lapsing), sacred landmarks (separate RNG stream; v0.1 world layout of every seed preserved), deterministic weather fronts,
  lasting marks, alternative victories, scenario objectives, `E.preview`. Unknown effect/target/domain types throw at `create`.
- AI (`engine/ai.js`): values every effect type (`AI.VALUED`), all new actions, grudge/treaty-aware targeting, archetypes,
  bounded Hierophant lookahead on private clones (map shared, RNG copied) that triggers on close calls, final turns and near-ascendancy.
- Bugs found by tests and fixed: Shrine of the Land range 2 could never be cast (settlements ≥3 apart) → 3; storm/delayed eclipses
  were erased by the same round's timers (round order changed: timers before weather/delayed miracles); route disruption had not
  been implemented; growth powers left no blessing marks; hunger did not stop domain growth.
- Tests: `node --test tests/*.test.js` → 40/40 pass (29.5 s) — engine, powers (all 40), systems (P004–P021), domains differential (all 40).
- `node tools/validate-data.js` → PASS.

NEXT ACTION: generalize tools/simulate.js to ten factions (stratified, CIs, seat bias), run a smoke balance pass; then UI.

### Phase 5–7: simulator, tuning, player shell, browser proof (2026-10-29)
- Simulator `tools/simulate.js` (ten factions, full plan, Wilson CIs, seat table, pairs, power usage, AI integrity, difficulty check).
  Tuning history t1–t12 in `reports/balance-notes.md`; seat compensation (`start.seatFaithBonus` 2, `seatFaithBonusDuel` 4) took the
  duel first seat from 55.6% to ~50–54% and three-god seats to 32–35% each. Faction spread target (≤15 pp) NOT met in samples (~18–21 pp).
- Player shell rewritten (`index.html`, `ui/style.css`, `ui/app.js`) with `ui/storage.js`, `ui/chronicle.js`, `ui/audio.js`, `ui/encyclopedia.js`.
- Browser: `tools/journeys.js` J01–J10 all pass (`reports/journeys.json`); `tools/screenshots.js` (Playwright via `tools/pw-shim.js`)
  full real-input game, 0 rejected inputs, browser hash == Node replay; `tools/screen-atlas.js` 20 shots + contact sheet;
  `tools/assets.js` 171 manifest items, 9 sheets + 40 VFX frames; `tools/offline-proof.js` PASS.
- QQQ bugs fixed: town-memory text crashed the panel (eager object-literal evaluation of every memory kind) → lazy template, journeys J03/J04
  regression; v0.1 import crashed (legacy state fed to v0.2 power bar) → live state stays empty while a legacy Chronicle is open, J10 regression;
  attack suggestions offered on towns with no rival → filtered; score lines indistinguishable (gold accents) → secondary colours;
  Yoruba "Hands that Shape" never triggered in measured games (Ward below 2) → below 3, P019 regression.
- Docs: README, docs/design.html (generated), docs/ai.md, docs/ART_DIRECTION.md, docs/RESEARCH_AND_REPRESENTATION.md, backlog.md, NOTES.md.

DONE (see entry below).

### Final verification (2026-10-29)
- Final balance: 9000 games, `reports/ten-pantheon-balance-final.{json,md}` — spread 17.8 / 21.2 / 25.0 pp (overall / FFA / duel), target ≤15 not met;
  seats duel 47.3/52.7, three-god 33.4/32.1/34.4; Hierophant beats Acolyte 93.0%.
- Perf after: `reports/perf-after-run{1,2,3}.json`, comparison `reports/perf-comparison.md` (p95 +2.5 to +7.2 ms vs v0.1; all < 33 ms, software rendering).
- `node --test tests/*.test.js` 53/53; `tools/validate-data.js` PASS; `tools/journeys.js` 10/10; `tools/screenshots.js` deterministic (bcc9e229 both), 0 rejected;
  `tools/offline-proof.js` PASS.
- Traceability: `docs/TRACEABILITY.md`.

NEXT ACTION (superseded 2026-10-30 — kept as history): awaiting the owner's authorization to commit and push branch `claude/vibrant-feynman-x1fjq9`.
The owner authorized it on 2026-10-29: committed as `003d1b3`, pushed to origin, draft PR https://github.com/westkitty/pantheon-wars/pull/1 (target main).
Remaining work if continued: faction spread to ≤15 pp (backlog #1), full reads of v0.2 sources (#2), community review (#3), device perf.

### Release-readiness uplift (2026-10-30)
Baseline: `003d1b3` on `claude/vibrant-feynman-x1fjq9`, draft PR #1 (not merged, not deployed). Fresh baseline at 003d1b3: 53/53 tests,
validator PASS, journeys 10/10, real-input game deterministic (`bcc9e229` browser = Node), offline proof PASS.
- **CI** (`214b560`, pushed): `.github/workflows/ci.yml` (engine/data/bundle-sync/balance-smoke job + browser job with pinned
  Playwright 1.63.0 via `package.json`/`package-lock.json`) and on-demand `balance-full.yml`. First GitHub run: all 4 jobs green
  (push and pull_request runs). Later additions in this pass: weather QA, memory check and QQQ in the browser job.
- **Balance**: ablations showed explore powers and some attacks are AI value traps; two AI corrections (exploration saturation,
  three-god leader focus) were measured on dev seeds and rejected (they widened spreads); AI left unchanged. Data rounds r1–r9 on dev
  seeds 40000/60000; r8 chosen (data hash `4b22c717aa09`). Held-out validation on the baseline's own seeds
  (`reports/ten-pantheon-balance-release-candidate.md`): spread overall 17.8 → 11.5, FFA 21.2 → 14.2, duel 25.0 → 16.1 —
  **duel still 1.1 points over the ≤15 target** (Olympian Court 56.4% vs Vedic 40.3%). Seats 48.6/51.4 and 33.9/32.7/33.4.
- **Performance**: world compositing clipped to the camera's sampled rectangle; sky/haze/vignette gradients cached at half resolution.
  Matched 3-run benchmark vs a 003d1b3 worktree: renderer p95 −51% to −63% in every scene (e.g. turn 1 19.1 → 7.0 ms, mid-game
  23.2 → 9.6 ms, phone 22.6 → 9.3 ms); pixel difference of a frozen frame ≤ 6/255. `reports/perf-comparison-release-candidate.md`.
  Headless software rendering only; device performance UNVERIFIED.
- **Defects fixed**: hot-seat round-turnover leaked the previous human's private round summary into the screen-reader live region
  (`ui/app.js`; regression `tools/qqq.js` Q01, which fails on 003d1b3); eleven domain/power texts showed numbers from before earlier
  tuning (regression in `tests/content.test.js`, which fails on 003d1b3's data). Test fixtures made robust where data tuning removed the
  situation they relied on (P019 differential widened to 8 seeds plus a direct Ḫepat's Guard test; archetype test over four positions).
- **Verification gaps**: P018 lifecycle automated (J11) but perceived audio quality UNVERIFIED; P019 re-check blocked by the network
  policy (all 39 v0.2 sources still search-summary-only); P039 now covered by `tools/weather-qa.js`.
- Final local run on the release candidate: 55/55 tests; validator PASS; bundles in sync; balance smoke PASS; journeys 11/11; real-input
  game deterministic (`47cef0c2` browser = Node, 0 rejected inputs); offline proof PASS; weather QA PASS; memory check PASS; QQQ 5/5.
- Screenshot PNGs under `reports/screens/` were left as captured at 003d1b3 (the renderer change is pixel-equivalent); their JSON
  reports were refreshed.

NEXT ACTION (superseded 2026-10-30 by the entry below — kept as history): review PR #1. The remaining release gate is the duel balance spread (16.1 > 15): the next step is a duel-only lever for the
Olympian Court or Vedic validated on a fresh held-out seed set (e.g. `--seed 200000`), then the 39 v0.2 sources need a full read on an
unrestricted connection, and a person needs to listen to the audio. Do not merge or deploy without the owner's decision.

### Balance re-validation and visual finish (2026-10-30, third pass)
Start: `34e542d` on `claude/vibrant-feynman-x1fjq9`, draft PR #1, CI green on 34e542d, clean tree.
- **Balance — PARTIAL.** Independent fresh-seed validation of the release candidate (seeds 200000+, 9000 games,
  `reports/balance-independent-validation.md`): spread overall 9.3, FFA 12.0, duel **18.9** (Olympian Court 57.5% vs Vedic 38.6%,
  non-overlapping 95% intervals). Bounded repair on dev seeds 70000 (candidates C1, C3, C4, C5a, C5b); best candidate C5a (Indra's
  Rainstorm converts 2 / 3-turn boon; Agni's Fire preaching ×2.0) improved the dev duel spread 21.8 → 17.6 but **did not reproduce** on
  untouched seeds 300000 against a matched run of the unchanged data (duel 20.3 vs 18.3; `reports/balance-candidate-validation.md`,
  `reports/balance-rc-on-seed300000.md`). C5a rejected and reverted: shipped data unchanged (`4b22c717aa09`). Three independent seed
  sets now give duel spreads 16.1 / 18.9 / 18.3. Details: `reports/balance-notes.md`.
- **Visual finish — `ui/render.js`, `ui/style.css` (no new files, fonts or images):** slope-aware key light and per-age land grade
  (static layer rebuilt at age changes), biome transitions, massif mountains, blurred continuous water depth, painted cloud-sea fog
  with gilded rim, lighter territory with inner band, larger villages with plaza, lanes, contact shadows, roof light, doors and
  windows that glow at Twilight, grounded and facing priests, stronger shrine light at Twilight, engraved label plaques, a world-light
  envelope on every power cast, feathered reveal sweeps, and a unified UI material layer (gilded hairline frames, cooldown badges, meter
  label, consistent states, 44 px targets on touch). Critique and evidence: `reports/visual-qa/critique.md`; art notes in
  `docs/ART_DIRECTION.md` ("v0.3 visual finish").
- **Gameplay neutrality:** with the visual changes and the release-candidate data, the real-input full game reproduces `47cef0c2`
  (browser = Node replay), the same hash as before the visual pass; v0.1 replay still `6a3687d9` (J10 + unit test).
- **Performance** (`reports/perf-comparison-visual.md`, matched 5-run vs a 34e542d worktree): renderer median −3% … +4%, p95 −9% … +11% per scene, all
  under 13 ms; static terrain build 68–71 → 105–150 ms (once per game start and at the two age changes); memory flat over ten games.
- **Defect found by the new QA and fixed:** the age regrade never ran (renderer compared map objects by identity; engine states are new
  each step) — caught by `tools/qqq.js` Q06, fixed by matching the map by seed and size. New checks: Q06 (age caches), Q07 (reduced-motion
  and Low-quality power cues); tablet top-bar targets raised to 44 px on touch screens.
- Tooling: `tools/visual-qa.js` (before/after atlas from real games: ten pantheons, three ages, 40 power signatures at three beats).

NEXT ACTION: the only failing gate is the duel balance spread (16–19 points over three seed sets). A fix needs a mechanic that weakens
the Olympian Court in duels without weakening its already-low three-god play (e.g. an explicit, documented two-god rule), validated on a
fresh seed set; then a person should review the visuals and audio on real devices. Do not merge or deploy without the owner's decision.
- Final run on the finished tree (2026-10-30): 55/55 tests; validator PASS; bundles in sync; balance smoke PASS; journeys 11/11; real-input
  game `47cef0c2` = Node replay, 0 rejected inputs; offline PASS; weather QA PASS; memory flat (9.5 → 9.5 MB); QQQ 7/7; visual QA atlas
  regenerated (`reports/visual-qa/`). Self-assessment of the visual gate: **PARTIAL** — the in-game world is materially richer (ranges,
  water, fog, light, towns, miracle light, UI) at no measurable per-frame cost, but at overview zoom it remains an evolution of the same
  look rather than a transformative AAA change, and no person has reviewed it on a real device.

### Asset-first visual uplift (2026-10-30, fourth pass)
Start: `642b779` on `claude/vibrant-feynman-x1fjq9`, draft PR #1, CI green, clean tree. Gameplay data unchanged (`4b22c717aa09`); P001
stays PARTIAL (no balance work in this pass).
- **Problem addressed:** v0.3 changed rendering, not the art. The world frame is rasterised at one pixel per world unit and magnified
  2–3.4×, so no sprite could carry detail. Full 2× supersampling was measured (p95 up to 33 ms) and rejected.
- **Rendering change that makes source art count:** standing objects (towns, shrines, priests, landmarks) and airborne effects are drawn
  after the perspective strips in screen space, each under the local affine projection at its anchor (`localAffine`, `drawObjects`,
  `blit2`); ground effects stay in the world frame.
- **New source art — `ui/kits.js`:** ten architectural kits plus three land kits (house, civic monument, enclosure, props, material
  textures, roofs), the village composer (ring plots, lanes, plaza and well, monument, enclosure, decline, Twilight, snow, layered
  patronage, shrine-aware layout), ten shrine families × seven structural conditions × three callings (88×100), ten priest families ×
  three callings × six frames (28×40; distance-driven walk, gesture), four landmarks (64×56), one-pixel silhouette outlines. The old
  small sprites (`ui/art.js` priests, shrines, landmarks; `ARCH` and the village painter in `ui/render.js`) were removed.
- **Not reauthored:** terrain decor, roads, icons, emblems, event art, tapestry and the VFX motifs.
- **Evidence:** `reports/atlas/{villages,shrines-conditions,shrine-specs,priests,landmarks}.png`; before/after
  `reports/visual-qa/{pantheons,ages,close,sprites,walk,vfx}.jpg`; review `reports/visual-qa/critique-v04.md`;
  performance `reports/perf-comparison-assets.md` (p95 −12% … +3%, all under 12 ms; village composition about 4.5 ms per town, at most
  three per frame).
- **Verdict:** asset production PARTIAL — the standing-object library is materially better at normal and close zoom; environment,
  VFX, icons and event art remain v0.3; no real-device or human review.

NEXT ACTION: a person reviews the towns, shrines and priests on real devices; a further pass reauthors terrain decor and the forty VFX
motifs; the duel balance gap needs its own focused pass. Do not merge or deploy without the owner's decision.

### Finishing pass: terrain, forty manifestations, icons, events, roads (2026-10-31, fifth pass)
Start: `2b240d2`, draft PR #1, clean tree, CI green on the engine job (browser job still running at start). Gameplay data unchanged
(`4b22c717aa09`); P001 stays PARTIAL.
- **Terrain features (`ui/terrain-art.js`, new):** forest stands, mountain massifs (heart, middle, edge forms) and hill knolls at 2×,
  seeded pools of 8 variants per family and climate. Baked at 1× into the static layer and drawn at 2× in screen space at normal
  zoom, under every object; tiles on the fog border or carrying a highlight (target, selection, hover, path) keep the baked copy.
- **Forty power manifestations (`ui/vfx-art.js`, new):** one authored painter per power, drawn live in screen space inside the
  existing three beats; reduced motion holds each power's own form still. Glows use cached sprites.
- **Icons and emblems (`ui/art.js`):** minting pass (doubled, lit and shaded edges, one-pixel silhouette) for every icon and emblem;
  five weak glyphs redrawn; emblems as bevelled 64 px medallions; downscales are smoothed.
- **Event scenes (`ui/art.js`):** all nineteen recomposed in depth with subject-specific settings; subjects are the earlier drawings.
- **Roads and travellers:** worn-earth roads with verge, crown, pebbles and cairns; 2× pilgrims (`ui/kits.js`) in screen space.
  Chimney smoke as soft puffs.
- **New checks:** QQQ Q08 (staggered town rebuilds never leave an obsolete sprite), Q09 (all forty effects end).
- **Evidence:** `reports/atlas/{terrain,vfx-motifs,power-icons,emblems-patterns,event-art}.png`; before/after vs 2b240d2 in
  `reports/visual-qa/{biomes,devices,icons,events,vfx-compare,pantheons,ages,close,sprites,walk}.jpg`; performance
  `reports/perf-comparison-v05.md` (p95 +3% … +18%, all ≤ 12.2 ms; median up to +21% in the burst scene).
- **Not done (PARTIAL):** flat ground decor (plains, grassland, desert, marsh, tundra), water and coast, weather overlays, vegetation
  sway and other environmental micro-animation, construction feedback beyond the restored-shrine scaffold, the subjects inside the
  event scenes, rite icons other than the five redrawn glyphs, heraldic patterns, tapestry. No human or real-device review.

### Completing the remaining families (2026-10-31, sixth pass)
Start: `d6b9393`, draft PR #1, CI green (4/4), clean tree. Gameplay data unchanged (`4b22c717aa09`); P001 stays PARTIAL.
- **Flat ground and hills (`ui/terrain-art.js`):** grassland, plains, desert and tundra detail at 2× with wet (moisture), cold
  (temperature) and shore (coast) variants, 10 seeded variants each, baked at 1× into the static layer; hills rebuilt as ridged rises
  (12 variants per climate). The game has no marsh terrain; wetland detail comes from high-moisture grassland.
- **Water and coast (`ui/render.js`):** authored wave field and swells; wet-sand and pebble shore band along every coast.
- **Weather (`ui/render.js` `drawWeather`):** all five kinds redrawn on the ground; still versions under reduced motion and Low quality.
- **Motion:** forest canopies sway in screen space, harder under rain and storm fronts (`windAt`).
- **Transitions (`siteTransitions`):** raised, restored, damaged, nearly toppled, ruined, fortified, growth, decline, change of hands —
  consecutive turns, same viewer only; captions only under reduced motion.
- **Event subjects:** all nineteen redrawn to show their event. **Icons:** six more redrawn (eleven in all); audit in
  `docs/ART_DIRECTION.md`. **Heraldry:** ten patterns redesigned. **Tapestry:** woven textile, pattern borders, cartouche, embroidered map.
- **Performance:** world light uses cached sprites. Numbers: `reports/perf-comparison-v06.md`.
- **Defect found and fixed:** transition captions fired for a multi-turn jump (a loaded save would have shown a burst of captions);
  now limited to consecutive turns.
- **New checks:** QQQ Q10 (weather lifecycle), Q11 (transitions, reduced motion, hot-seat), Q12 (art registry coverage), Q13 (terrain
  drawn under objects).
- **Evidence (before/after vs d6b9393):** `reports/visual-qa/{biomes,weather,heraldry,events,icons,tapestry,devices,pantheons,ages,close,vfx-compare}.jpg`,
  motion sequences `reports/visual-qa/motion.jpg`, atlases `reports/atlas/{terrain,event-art,emblems-patterns,power-icons}.png`.
- **Still open:** water depth material, lanterns and street activity, banners beyond the waving flag, real-device and human review.

### Final polish: water, town life, effect cost (2026-10-31, seventh pass)
Start: `fc8eb8a`, draft PR #1, clean tree (CI engine jobs green, browser jobs running at start). Gameplay data unchanged; P001 PARTIAL.
- **Water material:** per-age six-step depth palette, seabed through the shallows, sky reflection toward the horizon, key-light sheen,
  current lines; two corrective passes after visual comparison: the first version made the shallows read greyer than before (a warm
  reflection mixed into teal, sand patches too opaque), fixed with a lighter reflection and an additive turquoise glow in the shallows.
- **Town life (`drawTownLife`):** people, lanterns, culture-specific cloth and hearths on the town's front ground, by tier, decline,
  shrine damage, weather and quality; still under reduced motion; visual only (QQQ Q14).
- **Effect cost:** profiled the burst benchmark (it never plays the forty manifestations; the cost is spread over the screen-space
  passes); closed-form local projection. Burst scene +3% median / +1% p95 against fc8eb8a; the v0.5 regression is not recovered
  (`reports/perf-comparison-v07.md`).
- **Real devices:** UNVERIFIED — no hardware available; handoff in `reports/visual-qa/device-review.md`.
- **Evidence (before/after vs fc8eb8a):** `reports/visual-qa/{water,towns,burst,close,ages,devices,weather}.jpg`, town-life frames in
  `motion.jpg`.

### Forty-power performance audit (2026-10-31, eighth pass)
Start: `6e3f629`. No gameplay, data or art change.
- `tools/perf-powers.js` casts every faction power through `PW.act` on a deterministic fixture and measures its full visual lifecycle by
  phase, against the same scene's idle frames; `--smoke` runs in CI (all forty must cast, dispatch and end). `tools/perf-powers-report.js`
  pools runs into `reports/perf-powers.md`.
- Result: 40/40 casts in HEAD, 2b240d2 and 34e542d; 0 effects left. The forty manifestations add 0.6 ms p95 per frame (median over
  powers; worst 3.5 ms); worst cast p95 21.1 ms. The regression since 34e542d is the idle scene (13.7 vs 11.8 ms p95), not the effects.
- One optimization tried and rejected (path batching: −88% extra fills, no measurable time gain); details in `reports/perf-powers-findings.md`.
- Harness defect found and fixed: back-to-back rendering without yielding produced ~200 ms flushes; frames now yield like play.

### Recorded soundtrack (2026-10-31, ninth pass)
Start: `05a80b8`. No gameplay, data, balance or art change. The game's RNG is untouched: take choice uses the director's own generator.
- **Source:** 20 MP3s from the owner's Drive folder "macbook > pantheon music", copied privately and only read; the Drive originals were not modified.
  Analysis: 48 kHz stereo, ~128 kb/s, −14.2 to −19.1 LUFS, true peak ≤ −0.1 dBTP, through-composed arcs with quiet endings (`reports/soundtrack.md`).
- **Assets:** `tools/prepare-soundtrack.js` removes the cover-art stream by stream copy (audio packets byte-identical, 68.65 → 51.87 MiB)
  and writes `audio/soundtrack.json`/`.js` (provenance, SHA-256, loudness, gain ≤ 0 dB, in/loopIn/out points, cue, alternate take).
- **Rights:** public redistribution not established. `audio/music/` is git-ignored and the binaries are not committed. The manifest and code are.
  The approval needed is stated in `audio/README.md`.
- **Director:** `ui/music.js` uses HTMLAudioElements (Web Audio routing of media elements is silent under `file://`).
  - Moods: title, faction, exploration, expansion, omens, conflict (hysteresis), intervention, twilight, end.
  - Transitions: 4 s crossfades, continuation into the alternate take at `out`, and a ducked miracle accent that never restarts the bed.
  - Hot-seat: the covered screen gets the public age bed only, and each god's signals are kept separately.
  - Lifecycle: nothing loads before a gesture; paused while muted, at zero volume or hidden; elements released after use.
  - Fallback: the generated motif yields while a recording plays and returns when none can.
  - Settings: Recorded/Generated, persisted.
- **Evidence:** `tools/soundtrack-check.js` 39/39 file://, 39/39 HTTP (full decode of all 20), 7/7 without recordings. Offline proof now
  lists optional soundtrack requests separately. CI runs the check in its no-recordings form.
- **Not verified:** listening quality (no audio output here), browsers other than Chromium, real devices.

### Soundtrack delivered: recordings committed (2026-10-31, tenth pass)
Start: `5ae1fa8`. The creator authorized inclusion and distribution with the game ("I made them myself. They can be used.").
The scope is recorded in `audio/README.md`: ownership stays with the creator, and no separate music licence is granted.
- **Recordings:** the 20 game files are committed in `audio/music/` (54,384,646 bytes); `.gitignore` no longer excludes them.
- **Verification** (`reports/soundtrack-verify.json`), all 20 files:
  - Drive ID and size, against the Drive listing; the files are unmodified since upload.
  - Source SHA-256 and output SHA-256, against the manifest.
  - Identical audio packets between source and output, a single MP3 stream, the duration, and a full error-checked decode.
  - Re-running the preparation reproduces 20/20 files byte for byte.
- **New tool:** `tools/soundtrack-integrity.js` (no ffmpeg; runs in CI).
- **`tools/soundtrack-check.js`:**
  - It now fails if a committed recording is missing.
  - Its fallback runs on a temporary copy without `audio/music/` (`--without-recordings`).
  - Checks added: restarts, save/load, return to the title, and element release.
- **Test filters:** journeys and screenshots no longer excuse failed recording loads. The offline proof excuses only cancelled (`ERR_ABORTED`) recording loads.
- **CI:** integrity, then the recorded check over file:// and HTTP, then the isolated fallback.
