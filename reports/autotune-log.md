# Balance calibration log

Each block is one `tools/autotune.js` iteration: measured overall win rate per pantheon (fixed-seed stratified sample, greedy AI), then the shrine-pressure change applied.

## Run 2026-10-29T10:25:40.291Z — iters 5, games 600, seed 7000, gain 0.9, bounds [0.9, 1.7], max step 0.12

### Iteration 1: spread overall 44.0, FFA 43.4, duel 53.1 points

| Pantheon | Overall | FFA | Duel | Pressure before → after |
|---|---|---|---|---|
| greek | 52.8% | 42.0% | 77.6% | 1.2 → 1.08 |
| norse | 59.0% | 54.5% | 69.4% | 1.35 → 1.23 |
| egyptian | 54.7% | 49.6% | 66.7% | 1.2 → 1.08 |
| mesopotamian | 29.1% | 27.3% | 33.3% | 1.25 → 1.35 |
| irish | 15.0% | 11.0% | 24.5% | 1.2 → 1.32 |
| mexica | 23.6% | 19.2% | 32.7% | 1.25 → 1.37 |
| hittite | 41.3% | 33.7% | 58.7% | 1.1 → 1.07 |
| yoruba | 40.4% | 37.5% | 46.8% | 1.2 → 1.18 |
| japanese | 42.1% | 33.7% | 60.4% | 1.2 → 1.16 |
| vedic | 25.8% | 24.0% | 29.8% | 1.25 → 1.37 |

### Iteration 2: spread overall 35.5, FFA 32.1, duel 59.2 points

| Pantheon | Overall | FFA | Duel | Pressure before → after |
|---|---|---|---|---|
| greek | 53.4% | 41.1% | 81.6% | 1.08 → 0.96 |
| norse | 52.8% | 47.3% | 65.3% | 1.23 → 1.11 |
| egyptian | 49.1% | 44.2% | 60.4% | 1.08 → 0.98 |
| mesopotamian | 29.1% | 24.5% | 39.6% | 1.35 → 1.46 |
| irish | 18.0% | 15.3% | 24.5% | 1.32 → 1.44 |
| mexica | 24.3% | 25.3% | 22.4% | 1.37 → 1.49 |
| hittite | 47.3% | 38.5% | 67.4% | 1.07 → 0.98 |
| yoruba | 40.4% | 35.6% | 51.1% | 1.18 → 1.16 |
| japanese | 40.1% | 32.7% | 56.3% | 1.16 → 1.14 |
| vedic | 29.8% | 28.8% | 31.9% | 1.37 → 1.48 |

### Iteration 3: spread overall 27.0, FFA 20.8, duel 44.9 points

| Pantheon | Overall | FFA | Duel | Pressure before → after |
|---|---|---|---|---|
| greek | 50.3% | 40.2% | 73.5% | 0.96 → 0.9 |
| norse | 44.7% | 42.0% | 51.0% | 1.11 → 1.05 |
| egyptian | 49.1% | 41.6% | 66.7% | 0.98 → 0.9 |
| mesopotamian | 36.1% | 30.0% | 50.0% | 1.46 → 1.49 |
| irish | 23.4% | 21.2% | 28.6% | 1.44 → 1.56 |
| mexica | 31.1% | 29.3% | 34.7% | 1.49 → 1.59 |
| hittite | 39.3% | 33.7% | 52.2% | 0.98 → 0.97 |
| yoruba | 39.7% | 35.6% | 48.9% | 1.16 → 1.15 |
| japanese | 43.4% | 33.7% | 64.6% | 1.14 → 1.09 |
| vedic | 27.2% | 26.0% | 29.8% | 1.48 → 1.6 |

### Iteration 4: spread overall 29.4, FFA 25.6, duel 58.3 points

| Pantheon | Overall | FFA | Duel | Pressure before → after |
|---|---|---|---|---|
| greek | 52.8% | 41.1% | 79.6% | 0.9 → 0.9 |
| norse | 48.4% | 43.8% | 59.2% | 1.05 → 0.95 |
| egyptian | 48.4% | 45.1% | 56.3% | 0.9 → 0.9 |
| mesopotamian | 36.7% | 29.1% | 54.2% | 1.49 → 1.51 |
| irish | 23.4% | 19.5% | 32.7% | 1.56 → 1.68 |
| mexica | 28.4% | 23.2% | 38.8% | 1.59 → 1.7 |
| hittite | 37.3% | 30.8% | 52.2% | 0.97 → 0.98 |
| yoruba | 38.4% | 36.5% | 42.6% | 1.15 → 1.15 |
| japanese | 42.1% | 32.7% | 62.5% | 1.09 → 1.05 |
| vedic | 27.8% | 30.8% | 21.3% | 1.6 → 1.7 |

### Iteration 5: spread overall 28.1, FFA 24.3, duel 57.1 points

| Pantheon | Overall | FFA | Duel | Pressure before → after |
|---|---|---|---|---|
| greek | 47.8% | 33.9% | 79.6% | 0.9 → 0.9 |
| norse | 48.4% | 43.8% | 59.2% | 0.95 → 0.9 |
| egyptian | 44.7% | 37.2% | 62.5% | 0.9 → 0.9 |
| mesopotamian | 35.4% | 30.9% | 45.8% | 1.51 → 1.55 |
| irish | 20.4% | 19.5% | 22.4% | 1.68 → 1.7 |
| mexica | 35.8% | 33.3% | 40.8% | 1.7 → 1.7 |
| hittite | 40.0% | 31.7% | 58.7% | 0.98 → 0.97 |
| yoruba | 38.4% | 36.5% | 42.6% | 1.15 → 1.15 |
| japanese | 43.4% | 34.6% | 62.5% | 1.05 → 1 |
| vedic | 30.5% | 32.7% | 25.5% | 1.7 → 1.7 |

### Reverted
Pressure-only calibration saturated at its bounds (old three at 0.9, weakest at 1.7, spread still 28 points), so the iteration-5 values were discarded and shrine pressures restored to their pre-run values. The gap is structural; see the ablation study in reports/balance-notes.md.
