# Performance: release candidate (34e542d) vs visual overhaul

Measured by `node tools/perf.js` in headless Playwright Chromium with **software rendering**, 4-core Linux container, 2026-10-30. Before = a pristine worktree of 34e542d; after = this tree. Five alternating runs each (before, after, before, after…) on the same machine, scenes, viewport, DPR and quality.lastFrameMs` over 4 s, plus the median JS heap. Raw runs: `reports/perf-visual/`. This is renderer CPU time per frame, not device frame rate.

| Scene | Before median | Before p95 | After median | After p95 | Median change | p95 change | Heap before / after (MB) |
|---|---|---|---|---|---|---|---|
| turn1 | 5.1 | 7.5 | 5 | 7.6 | -2% | +1% | 5.7 / 4.7 |
| mid16 | 7 | 11.5 | 7.3 | 10.6 | +4% | -8% | 6.2 / 6.4 |
| late30-reveal | 7.6 | 11.5 | 7.4 | 12.8 | -3% | +11% | 8.6 / 6.6 |
| late30-low | 5.4 | 8.2 | 5.4 | 8.4 | +0% | +2% | 6.7 / 9.2 |
| mobile16 | 6.1 | 9.5 | 5.9 | 8.6 | -3% | -9% | 6.3 / 6.2 |
| miracle-burst | 6.9 | 11.6 | 6.7 | 12.4 | -3% | +7% | 6.9 / 6.4 |

**Gate:** the brief treats a p95 increase above 20–25% as a failure; medians move −3% … +4% and p95 −9% … +11%, every p95 is under 13 ms (target < 33 ms), and no run logged a page error. p95 in this headless environment varies by about ±15% between runs of the same build, which is why five matched runs were used.

**Why it costs so little:** almost all of the new art lives in layers that are painted once — the static terrain (slope light, biome transitions, massifs, blurred water depth, age grade), the fog, the territory overlay and the per-settlement village sprites — and the world is still composited only inside the camera's sampled rectangle. The per-frame additions are a contact shadow and facing for each visible priest and one radial light while a miracle is active (none in Low quality or reduced motion). Two optimisations pay for them: town label plaques are rendered once into a small cache (keyed by everything they show, in 1/8 scale steps drawn at the exact scale) instead of re-rendering text every frame, and each settlement's village-sprite lookup is memoised per game state instead of rebuilding its cache key every frame.

**One-off cost:** the static terrain layer takes about 105–150 ms to build (two measurements, median of five builds each; 34e542d: 68–71 ms; `buildStatic`). It is built at game start and rebuilt at the two age changes (turns 16 and 31), so those two moments carry a single pause of roughly 0.1–0.15 s in this software-rendered environment.

**Resources:** `node tools/memory-check.js` — ten games in one page, heap 9.5 → 9.5 MB, constant canvas count. Visual caches stay bounded (village cache cleared above 400 entries and on every new map; three half-resolution screen layers).

**Limits:** headless software rendering only; real-device frame rate and GPU behaviour are **UNVERIFIED**.
