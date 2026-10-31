# Performance: v0.2 (003d1b3) vs release candidate

Measured by `node tools/perf.js` in headless Playwright Chromium with **software rendering** on a 4-core Linux container, 2026-10-30. Before = a pristine worktree of commit 003d1b3; after = this tree. Three alternating runs each (before, after, before, after…), same scenes, quality settings and machine; value = median of the three runs' per-run median / p95 of `PWRenderer.lastFrameMs` over 4 s. v0.1 figures (`reports/baseline-v0.1/`) are shown for context. This measures renderer CPU time per frame, not real-device frame rate.

| Scene | v0.1 p95 | v0.2 median | v0.2 p95 | RC median | RC p95 | p95 change vs v0.2 |
|---|---|---|---|---|---|---|
| turn1 | 18.4 | 13.7 | 19.1 | 5 | 7 | -63% |
| mid16 | 22.6 | 16.2 | 23.2 | 6.6 | 9.6 | -59% |
| late30-reveal | 22.4 | 18.7 | 26.9 | 7.4 | 10.8 | -60% |
| late30-low | 17.6 | 12.6 | 17.3 | 5.6 | 7.8 | -55% |
| mobile16 | 20.4 | 16.6 | 22.6 | 6.4 | 9.3 | -59% |
| miracle-burst | 24 | 16.2 | 23 | 7.2 | 11.3 | -51% |

**What changed.** Profiling showed the per-frame cost was not the drawing calls themselves but rasterising the full world-sized frame (1470×765) every frame, which the perspective projection then samples only in the region under the camera. World compositing is now clipped to that visible rectangle (computed with the same projection maths as the strip loop, padded for camera shake), and the full-screen sky, haze and vignette gradients are painted once into cached half-resolution layers that repaint only when their inputs change. Every layer, effect and the 40 power signatures still draw; a pixel comparison of the same frozen frame before and after shows a maximum channel difference of 6/255 (mean 0.9, no channel off by more than 8), from gradient interpolation.

**Other checks.** `node tools/qqq.js` Q05 renders complete frames after resizing to 900×700, 1920×1080, 390×844 and back; `node tools/memory-check.js` plays ten games in one page with heap 9.5 → 9.5 MB and a constant canvas count. Reduced motion and Low quality are exercised by the journeys (J09) and by the late30-low scene.

**Limits.** Headless software rendering only; no GPU and no physical phone were available, so real-device performance is **UNVERIFIED**. Headless rAF intervals are throttled and are not reported as frame rates.
