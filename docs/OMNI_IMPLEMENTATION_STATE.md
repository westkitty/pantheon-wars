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

NEXT ACTION: review PR #1. The remaining release gate is the duel balance spread (16.1 > 15): the next step is a duel-only lever for the
Olympian Court or Vedic validated on a fresh held-out seed set (e.g. `--seed 200000`), then the 39 v0.2 sources need a full read on an
unrestricted connection, and a person needs to listen to the audio. Do not merge or deploy without the owner's decision.
