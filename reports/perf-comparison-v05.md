# Performance: v0.5 finishing pass vs 2b240d2

Five alternating matched pairs, `node tools/perf.js --seconds 4`: a 2b240d2 worktree (`before`) and this tree (`after`), headless
Chromium with software rendering (no GPU), 4 vCPU. Raw: `reports/perf-v05/{before-2b240d2,after-v05}-run1..5.json`. Values are the
median over five runs of each scene's per-run median and p95 renderer CPU time per frame (ms); time to state is page load to a ready
game (ms); heap in MB where Chromium reports it.

| Scene | median before | after | Δ | p95 before | after | Δ | time to state before | after | heap before | after |
|---|---|---|---|---|---|---|---|---|---|---|
| turn1 | 4.8 | 4.8 | 0% | 6.7 | 7.3 | +9% | 710 | 750 | 5.5 | 4.6 |
| mid16 | 6.3 | 7.2 | +14% | 9.7 | 10.9 | +12% | 672 | 666 | 6.4 | 5.8 |
| late30-reveal | 6.6 | 7.5 | +14% | 11.9 | 12.2 | +3% | 686 | 693 | 8.1 | 7.6 |
| late30-low | 4.8 | 5.5 | +15% | 7.1 | 8.4 | +18% | 604 | 652 | 8.2 | 7.7 |
| mobile16 (390×844 @2) | 5.2 | 6.1 | +17% | 8.1 | 9.1 | +12% | 606 | 702 | 6.6 | 6.6 |
| miracle-burst | 6.1 | 7.4 | +21% | 10.9 | 11.7 | +7% | 732 | 715 | 6.4 | 6.4 |

- p95 rises 3–18% per scene, inside the 20% budget; every scene stays at or under 12.2 ms against the 33 ms hard budget.
- Median frame cost rises 0–21%; miracle-burst's median (+21%) is just over 20%. The cost comes from the 2× terrain features drawn
  in screen space at normal zoom (one image per visible forest, hill or mountain tile), the live power manifestations and the
  pilgrims. Glows use one cached sprite per colour instead of a gradient per frame (that change brought the burst scene's p95 back
  from about +30%).
- One-off: building every terrain variant (136 sprites) takes 110 ms (0.8 ms each). A game builds only the variants its map uses, on
  first sight, and they are shared by later games.
- Memory: `node tools/memory-check.js` (ten games in one page) stays flat.
- These are software-rendered CPU timings, not frame rates on a physical device.
