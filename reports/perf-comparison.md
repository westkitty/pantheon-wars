# Performance before / after (renderer CPU time per frame)

Measured by `node tools/perf.js` (Playwright Chromium, headless, **software rendering**, 4-core container). Before = pristine v0.1 copy (`reports/baseline-v0.1/perf-before-run{1,2,3}.json`); after = v0.2 (`reports/perf-after-run{1,2,3}.json`). Value = median of the three runs' per-run median / p95 of `PWRenderer.lastFrameMs` over 4 s. Headless rAF is throttled to 30 fps here, so frame *interval* is not a device result; this is a CPU-cost comparison, not a device benchmark.

| Scene | Before median | Before p95 | After median | After p95 | Δ p95 |
|---|---|---|---|---|---|
| turn1 | 12.5 | 18.4 | 15.6 | 21.5 | +3.1 |
| mid16 | 15.7 | 22.6 | 19.4 | 26.4 | +3.8 |
| late30-reveal | 16.5 | 22.4 | 22.3 | 27.8 | +5.4 |
| late30-low | 13.1 | 17.6 | 14.1 | 20.1 | +2.5 |
| mobile16 | 14.9 | 20.4 | 18.4 | 24.8 | +4.4 |
| miracle-burst | 16 | 24 | 20.2 | 31.2 | +7.2 |

**Reading.** v0.2 draws much more per frame (patron-layered villages, weather, marks, routes and travellers, landmarks, influence layer, per-tile fog reveal, forty three-beat signatures), and its renderer CPU cost is higher in every high-quality scene. Every high-quality p95 stays under the 33 ms (30 fps) line in this software-rendered environment, and the Low setting (late30-low) stays near the v0.1 cost. The auto-quality switch drops to Low after a sustained 90-frame average above 24 ms. No GPU or real phone was available, so device performance is **UNVERIFIED**.
