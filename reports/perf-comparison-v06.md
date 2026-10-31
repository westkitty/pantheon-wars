# Performance: v0.6 completion pass vs d6b9393

Five alternating matched pairs, `node tools/perf.js --seconds 4`: a d6b9393 worktree (`before`) and this tree (`after`), headless Chromium,
software rendering, 4 vCPU. Raw: `reports/perf-v06/{before-d6b9393,after-v06}-run1..5.json`. Median over five runs of each scene's per-run
median and p95 renderer CPU time per frame (ms); time to state = page load to a ready game (ms).

| Scene | median before | after | Δ | p95 before | after | Δ | time to state before | after |
|---|---|---|---|---|---|---|---|---|
| turn1 | 4.8 | 5.0 | +4% | 6.1 | 6.7 | +10% | 686 | 714 |
| mid16 | 6.9 | 7.5 | +9% | 10.1 | 10.6 | +5% | 630 | 615 |
| late30-reveal | 7.4 | 7.6 | +3% | 11.8 | 11.5 | -3% | 651 | 621 |
| late30-low | 5.3 | 5.2 | -2% | 7.3 | 7.1 | -3% | 623 | 650 |
| mobile16 (390×844 @2) | 5.8 | 6.3 | +9% | 8.7 | 8.7 | 0% | 681 | 633 |
| miracle-burst | 7.2 | 7.6 | +6% | 11.2 | 12.4 | +11% | 640 | 653 |

- Every scene stays at or under 12.4 ms p95 (hard budget 33 ms); changes against d6b9393 are −3% … +11% p95 and −2% … +9% median, inside
  the 20% budget.
- **The miracle-burst regression is not repaired.** v0.5 raised that scene's median about 21% over 2b240d2; replacing the world light's
  per-frame gradients with cached sprites did not bring it back, and v0.6 adds about 6% more (weather and transition drawing, more
  ground detail in the static layer is free per frame). The remaining cost is the live vector painting of the forty manifestations; it
  was not reduced in this pass.
- Static layer: the flat-ground library adds its sprite builds (about 0.8 ms each, built once per variant and shared) to the first
  static build of a game; time to state is unchanged within noise.
- Memory: `node tools/memory-check.js` — heap 9.5 → 9.5 MB over ten games, canvases stable.
- Software-rendered CPU timings only; no physical-device frame rates.
