# Balance working notes (P001–P003)

Fixed-seed stratified samples, greedy Hierophant (`--no-lookahead`) for speed; seed 7000. "Spread" = max − min faction win rate (points).
Each faction appears in ~225 games per 900-game sample, so a single rate carries roughly ±6 points of 95% uncertainty.

| Step | Change (rationale) | Games | Overall | FFA | Duel |
|---|---|---|---|---|---|
| s0 | First ten-faction run, v0.1 numbers for the original three | 600 | 68.0 | 66.2 | 75.0 |
| t1 | Trim original economy domains tuned for a 3-god world (grain .12→.08, sun .2→.12, inundation .2→.14, order 1.35→1.25, sea .2→.15); raise water/terrain Faith for new kits; Irish/Hittite shrine Faith 3 | 600 | 51.5 | 44.5 | 67.3 |
| diag | `tools/diagnose.js`: every god ends with 1,300–2,400 unspent Faith → the limit is expansion opportunity, not income. Towns are ≥3 hexes apart, so a radius-2 shrine never reaches a neighbour; expansion runs on priests. | | | | |
| t2 | Expand powers that did not expand now do so within their specified identity: Assembly of Lugh, Hands of Creation and Agni's Fire raise a priest; Gardens of Chalchiuhtlicue reaches 4 hexes at 60% cost; Court of Arinna radius 3 | 600 | 50.0 | 45.9 | 65.3 |
| t3 | Assembly of Lugh was creating Wardens (walk 1, stay home): calling is now the caster's choice, Emissary by default | 600 | 44.0 | 43.4 | 53.1 |
| auto | `tools/autotune.js` (shrine pressure only) saturated at its bounds; values discarded (see autotune-log.md) | 5×600 | 28.1 | 24.3 | 57.1 |
| ablation | `tools/ablate.js greek`: Greece is *stronger* without Oracle of the Oak → the AI over-bought exploration (forecast had a value floor). AI fix: forecast and threat-reveal never carry a cast | | | | |
| t4 | AI exploration valuation fixed | 900 | 37.0 | 33.3 | 55.6 |
| t5 | Thunderbolt scatters rival priests to their nearest shrine (its own text) instead of destroying them; Irish enclosure radius 3; pressure up for weakest (fire altar, ziggurat, twin temple 1.4); Norse hall 1.25; Feather .35→.30 | 900 | 23.8 | 20.6 | 54.2 |
| t6 | Aegis 11 Faith / cd 5; base priest cap 1→2 (surplus Faith becomes expansion; Faith domains start to matter) | 900 | 24.5 | 27.0 | 36.1 |
| t7 | Gift of the Grain cd back to 6; Irish 0.95; Norse 1.15; Star of Inanna 4 followers / 2 Favor; Zenith 8 Faith; courtyard 1.3; ziggurat 1.5 | 900 | 20.4 | 20.0 | 31.9 |

| t8 | Seat compensation (P002): later seats start with +2 Faith per seat in three-god games, +4 for the second god in duels (`start.seatFaithBonus`, `seatFaithBonusDuel`; the duel value was measured separately: +2 left the first seat at 55.6%, +4 gave 49.4%). Shrine pressure: twin temple 1.55, fire altar 1.5, ziggurat 1.6, kami shrine and pylon 1.12 | 900 | 20.1 | 24.3 | 41.7 |
| t9 | Weak kits get stronger levers than pressure: Zenith of Tonatiuh lasts 3 turns, Mexica waters .24, Indra's Rainstorm takes 3 followers, Indra's storm ×1.4, Agni's hearth from shrine age 4, Star of Inanna sways 5; columned temple 1.15 | 900 | 17.7 | 21.3 | 30.6 |
| t10 | P003: Barque of Re also raises Faith income (×1.15, 3 turns, cost 8) and Crossing of Utu grants 1 Favor; Sages of Eridu 9 Faith; columned temple 1.18 → Egypt overshoots to 54% | 900 | 27.5 | 23.8 | 44.4 |
| t11 | Barque back to 10 Faith, ×1.1 for 2 turns | 900 | 21.1 | 21.4 | 34.7 |
| t12 | Pylon 1.05, fire altar 1.6 (shrine pressure is a weak lever: ±0.1 moves a faction by less than the sampling error) | 900 | 20.7 | 20.8 | 36.1 |

Seat bias after t8–t12 (900-game samples): duel first seat 50–54%, three-god seats 32–35% each — inside sampling error of even.
Barque of Re left the least-used list after t10 (it was 1.08 casts/game); Crossing of Utu also left it.
Tuning stopped at t12. The ≤15-point spread target is **not met** on greedy samples: Egypt (~50%) and the Irish (~46%) lead,
Vedic (~29%) and Greek three-god play (~22%) trail. Duel spread (36 points over ~72 duels per faction) carries roughly ±11 points of uncertainty per rate.

Superseded notes from t7 — Open after t7: seat 1 wins 59% of duels and 40% of three-god games (P002); Mexica and Vedic trail (27–30% overall);
least-used powers: Barque of Re (1.1/game) and Crossing of Utu (1.5/game) (P003).

## Final full-plan run (Hierophant with lookahead, 9000 games, `reports/ten-pantheon-balance-final.md`)
Spread overall **17.8**, FFA **21.2**, duel **25.0** points. Seats: duel 47.3 / 52.7% (CIs 45.0–49.6 / 50.4–55.0), three-god 33.4 / 32.1 / 34.4%.
Lookahead narrows the spread compared with the greedy samples (20.7 / 20.8 / 36.1 at t12). Hierophant beats Acolyte 93.0% [88.6–95.8].
Barque of Re is now cast 10.83 times per game and Crossing of Utu 11.08: both are at their cooldown limit, which suggests the cooldown, not
value, now caps them; watch for over-valuation in the next pass. Least used: Gardens of Chalchiuhtlicue 3.09/game. No power is unused.

## Release-candidate tuning (2026-10-30)

Method. Dev seed sets only: `--plan full --seed 40000` (and 60000 as an unseen check), lookahead on, 4 seeds per ordered duel (8 from r3)
and 1 per ordered triple. The reference seeds of the 9000-game baseline (1000–9999) were not used until the final validation, so that
run is held out. Spreads are max − min of point estimates; with 144 duels per faction a duel rate carries about ±8 points, with 216
three-god games about ±6.

Diagnosis (`tools/ablate.js`, 54 games per mode and variant, greedy AI): several powers make their own pantheon *weaker* when present —
Flight of the Ravens (Norse duel 50→80% without it), Oracle of the Oak (Greek 50→59 / 30→37), Ushas (Vedic FFA 33→41), Order of Varuna
and Indra's Rainstorm (Vedic duel 39→48 / 39→50), Thunderbolt in three-god games (Greek 30→39). Sea & Shaking Earth is the Greek domain
that matters most in three-god games (30→19 without it); Rune Hall carries the Norse kit (50→0 without it).

Two AI corrections were tried and **rejected** with evidence (same dev seeds):

| Candidate | Overall | FFA | Duel | Notes |
|---|---|---|---|---|
| dev baseline (data and AI of 003d1b3) | 19.8 | 24.1 | 16.7 | |
| AI: exploration saturation + three-god leader focus | 29.2 | 33.3 | 27.8 | Norse FFA 44→52, Egypt FFA 36→24 |
| AI: exploration saturation only | 25.3 | 25.5 | 27.8 | Greek and Irish duels up, Vedic down |

Both made the AI waste less but widened the gaps (the strong kits gained most), so the AI was left exactly as committed.

Data rounds (dev seeds 40000 unless noted; every text that names a number was updated with it and is checked by `tests/content.test.js`):

| Round | Change | Overall | FFA | Duel |
|---|---|---|---|---|
| r1 | Sky & Oath Favor every 3 turns; Aegis 9 Faith; Indra's Rainstorm also converts 1; Rune Hall 60% cost; Yoruba water .14 | 13.2 | 16.7 | 33.3 |
| r2 | Aegis back to 11; Rune Hall 55%; Yoruba water .12 and roads +0.4; Agni's Fire 9; Sages of Eridu 8; Gardens 50% | 13.5 | 21.3 | 29.2 |
| r3 | (8 duel seeds from here) Aegis 10; Gardens 55%; Varuna base resistance 1.25; Yoruba roads 60% cost | 11.1 | 19.9 | 19.4 |
| r4 | Sea coastal pressure .25; Feather 27%; Yoruba roads half cost; Japanese harvest .12 | 10.6 | 14.8 | 36.1 |
| r5 | Thunderbolt 2 silenced / 2 converted; Gift of the Grain ×1.4; Yoruba water .14 | 12.8 | 24.5 | 14.6 |
| r6 | Sea .35; Feather 25% | 11.4 | 14.4 | 18.1 |
| r7 | Japanese bonds of the land .08 (checked on seeds 60000) | 14.7 | 22.2 | 12.5 |
| **r8** | **Sky & Oath every 2 turns; Barque of Re 12 Faith** — seeds 40000 | 6.1 | 14.4 | 15.3 |
| r8 | same data, seeds 60000 | 9.2 | 16.2 | 21.5 |
| r9 | Thunderbolt converts 1; Barque 11 — rejected (40000: 9.2 / 19.0 / 19.4; 60000: 8.6 / 15.7 / 23.6), reverted to r8 | | | |

Candidate chosen: r8 (data hash `4b22c717aa09`). The persistent bottleneck is the Olympian Court's mode split: 20–25% in three-god
games against 48–64% in duels in every round and seed set. Levers that raise its three-god rate (Favor, coastal pressure) also raise its
duel rate, and the duel-weighted levers tried (Thunderbolt's conversion) did not move its duels.
Text drift fixed alongside: eleven domain and power texts showed numbers from before earlier tuning (e.g. Indra's Rainstorm "2 rival
followers" while the rule took 3; Order "35%" while the rule gave 25%); a new test now fails on any such mismatch.
