# Performance: v0.4 asset pass vs 642b779

Matched runs: `node tools/perf.js --seconds 4`, five alternating pairs, a 642b779 worktree (`before`) and this tree (`after`),
headless Chromium with software rendering (no GPU), 4 vCPU. Raw: `reports/perf-assets/{before-642b779,after-assets}-run1..5.json`.
Values are the median over five runs of each scene's per-run median and p95 renderer CPU time per frame (ms).

| Scene | median before | median after | Δ | p95 before | p95 after | Δ |
|---|---|---|---|---|---|---|
| turn1 | 4.9 | 4.8 | -2% | 6.9 | 7.1 | +3% |
| mid16 | 6.4 | 6.1 | -5% | 10.7 | 10.2 | -5% |
| late30-reveal | 7.3 | 6.5 | -11% | 11.3 | 10.0 | -12% |
| late30-low | 5.2 | 4.9 | -6% | 7.8 | 7.1 | -9% |
| mobile16 (390×844 @2) | 5.8 | 5.4 | -7% | 8.5 | 8.2 | -4% |
| miracle-burst | 6.4 | 6.3 | -2% | 11.0 | 10.0 | -9% |

Every scene stays under 12 ms p95 against the 33 ms budget. Drawing the standing objects in screen space (a few dozen drawImage calls
under a local transform) costs about what painting them into the world frame cost, and the world frame now carries less.

Rejected approach, measured: supersampling the whole world frame 2× raised p95 to 18–33 ms (mid16 29, miracle-burst 32.6) and was
reverted before any commit.

One-off sprite composition (on cache misses, not per frame), game at turn 20 with 22 towns:

| | before | after |
|---|---|---|
| all 22 village sprites | 6.5 ms | 70–79 ms (about 4.5 ms per town) |
| shrine sprites in play | 1.5 ms | 6–9 ms |
| six frames of every priest in play | 2.8 ms | 15–22 ms |

All towns rebuild only at game start and at the Twilight age change; during play a turn rebuilds the few towns that changed. The
renderer composes at most three village sprites per frame and keeps a town's previous sprite until its new one is ready, so no single
frame takes the whole rebuild. The static terrain rebuild at age changes is unchanged (105–150 ms, measured in v0.3).
Memory: `node tools/memory-check.js` (ten games in one page) stays flat. Real-device frame rates are not measured.
