# Performance: v0.7 (water, town life, effect cost) vs fc8eb8a

Five alternating matched pairs, `node tools/perf.js --seconds 4`: a fc8eb8a worktree (`before`) and this tree (`after`), headless Chromium,
software rendering, 4 vCPU, same seeds, scenes, viewports, DPR and quality. Raw: `reports/perf-v07/{before-fc8eb8a,after-v07}-run1..5.json`.
Median over five runs of each scene's per-run median and p95 renderer CPU time per frame (ms).

| Scene | median before | after | Δ | p95 before | after | Δ | time to state before | after |
|---|---|---|---|---|---|---|---|---|
| turn1 | 5.0 | 5.0 | 0% | 7.5 | 6.3 | -16% | 744 | 757 |
| mid16 | 7.4 | 7.8 | +5% | 11.3 | 12.6 | +12% | 636 | 708 |
| late30-reveal | 7.7 | 8.3 | +8% | 11.9 | 12.8 | +8% | 656 | 649 |
| late30-low | 5.3 | 5.6 | +6% | 7.3 | 8.4 | +15% | 665 | 640 |
| mobile16 (390×844 @2) | 6.6 | 6.6 | 0% | 9.3 | 9.6 | +3% | 713 | 648 |
| miracle-burst | 7.7 | 7.9 | +3% | 12.7 | 12.8 | +1% | 616 | 652 |

## Miracle-burst diagnosis
Profiled component by component in the benchmark scene (`.work`-style harness: the scene's own setup, `R.render` timed per part):
- The scene does **not** play any of the forty authored manifestations: it fires `addFx('bolt' | 'topple' | 'reveal')` on six towns,
  about 300 short-lived fx objects (eclipse, dust, mote, ring, spark). The earlier attribution to "live vector painting of the forty
  powers" was wrong for this benchmark.
- Medians (ms, d6b9393 → fc8eb8a): drawScreen 8.6 → 9.0 (perspective strips and screen-space objects), world compose 0.40 → 0.60,
  screen-space objects 0.94 → 1.06 (101 objects, 43 terrain features), effects 0.74 → 0.92, weather 0.06 → 0.17. The v0.5–v0.6 cost is
  spread across the screen-space terrain pass, airborne effects drawn at screen resolution, roads/pilgrims and weather — no single hotspot.
- Fix applied: the per-object / per-effect local projection now uses the closed-form derivative of the perspective instead of three
  `project()` calls and three object allocations each (about 400 calls per frame in this scene).

## Result
- The closed-form projection paid for the new town life (+1% p95, +3% median on the burst scene against fc8eb8a), but **did not recover
  the earlier regression**: the burst scene remains about 20–25% slower in median than before v0.5. Recovering it would mean drawing
  airborne effects or terrain features at lower resolution, which would undo the v0.4–v0.6 art; that trade was not made.
- All scenes stay at or under 12.8 ms p95 (hard budget 33 ms); p95 changes against fc8eb8a are −16% … +15% (inside the 20% budget).
- The water corrective passes (lighter reflection, luminous shallows) change only the static layer, built once per age, not per frame.
- Memory: `node tools/memory-check.js` — heap 9.5 → 9.5 MB over ten games, canvases stable.
- Software-rendered CPU timings; no physical-device frame rates.
