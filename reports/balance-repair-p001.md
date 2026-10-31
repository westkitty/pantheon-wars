# P001 balance repair: two-player fairness (2026-10-31)

**Verdict: PARTIAL.** The single frozen candidate (E) failed independent validation and was rejected. The shipped data stays at the
release candidate `4b22c717aa09`. The engine and AI are unchanged (experimental code reverted). The only code change kept is the
simulator's `--keep-games` flag (diagnostic telemetry).

Start: `b158b1a` (clean, CI green). Machine: 4 CPUs. Every run used `tools/simulate.js` with the Hierophant AI on both sides and
bounded lookahead on (the same AI as every earlier balance report).

## Seed discipline

The seed ranges were fixed before any experiment ran:

| Range | Use |
|---|---|
| 500000, 501000 | diagnosis |
| 520000 | matched candidate development |
| 800000, 900000 | independent validation, untouched until the candidate was frozen |

The historical sets (1000, 40000, 60000, 70000, 200000, 300000) were not reused.

## 1. Diagnosis

### Sample size sets a noise floor

A full plan has 1,800 duels, so each faction plays only 360. That gives a single faction's duel rate a 95% interval of about ±5 points.
Max − min over ten such estimates is inflated by noise. On the 500000 diagnosis set, with 720 duels per faction, the shipped data measured a 13.1-point duel spread.
On the four full-plan runs on seeds 800000/900000 and earlier, it measured 14.7–20.3.
The true duel spread of the shipped data is therefore roughly 13–17 points. A change must bring the true spread to about 10 to pass reliably at 360 duels per faction.

### What does not cause it

- **Seat order is not the cause.** Duel seats measured 47–49% / 51–53% in every run.
- **The Olympian Court does not win duels through strikes.**
  - It takes 26–27 followers from its rival per duel and loses 36 (`reports/balance-repair-dev/diag-base-duel.md`).
  - Disabling Thunderbolt changes its duel rate by −2.7 (noise).

### Duel ablations

Method: the real AI, 720 matched duels per variant, seeds 501000 (`reports/balance-repair-dev/ablation-duel.txt`).

| Olympian Court (base 56.9%) | duel | Vedic Hymns (base 38.2%) | duel |
|---|---|---|---|
| without Sky & Oath (Favor every 2 turns) | 42.4 | without Agni's Fire (power) | **8.5** |
| without Grain | 44.2 | without Agni's Hearth | 30.3 |
| without Sea | 46.3 | without Varuna's Order (resistance) | 36.0 |
| without Wisdom of the City | 51.4 | without Indra's Storm | 36.3 |
| without Aegis of the Polis | 38.3 | without Ushas' Dawn | 36.7 |
| without Gift of the Grain | 37.2 | without Ushas' First Dawn | 40.6 |
| without Thunderbolt | 54.2 | without Order of Varuna (power) | 41.0 |
| without Oracle Oak | **70.0** | without Indra's Rainstorm (power) | 41.3 |

**Olympian Court.** All five economic and expansion pieces are worth 5–20 points each in duels. The largest data lever is the Sky & Oath Favor stream.

Oracle Oak is an AI value trap. The AI scores a plain `reveal` by counting hidden tiles, including empty ones, so it spends Faith uncovering
empty sea. Removing the power makes the Court far stronger, so fixing this valuation would widen the gap. It was left alone and is
recorded here.

**Vedic Hymns.** Agni's Fire carries about 30 of their ~38–43 points. Their resistance domain and their storm domain are worth nothing measurable.
Order of Varuna and Indra's Rainstorm lose games when cast. The kit has one working pillar.

### The Olympian Court's mode split

On the matched development seeds 520000 the shipped data measured:

| Mode | Olympian Court | Rank |
|---|---|---|
| Duel | 61.5% | the top |
| Three-god | 21.1% | the floor |

This is why every earlier lever moved both modes together.

With three gods the Court casts Thunderbolt more often (8.5 against 7.2 per game), yet ends with the lowest share. In `engine/ai.js` a strike's
value ignores which rival it hurts. In a duel the only rival is the leader. With three gods, hurting a trailing rival hands ground to the leader
and earns a grudge.

## 2. Candidates

Development runs used matched seeds 520000: 40 seeds per ordered duel and 3 per ordered triple. That is 5,760 games, 720 duels and 648 three-god games per faction.
Reports are in `reports/balance-repair-dev/`.

| Candidate | Change (root-cause hypothesis) | Duel spread | 3-god spread | Outcome |
|---|---|---|---|---|
| base | shipped data `4b22c717aa09` | 20.0 | 18.5 | — |
| A | resistance also raises the pressure needed to convert (engine rule) | 19.6 | 18.4 | no effect: contested towns are lopsided, the threshold almost never binds; reverted |
| B | Gift of the Grain grows at most 5 controlled towns, like Inari's Harvest | 20.0 | 18.7 | no effect: the cap almost never binds; reverted |
| C | AI discounts strikes on a rival that is not leading (×0.4) | 20.0 | 18.5 | duels unchanged by construction; Court 3-god +3.1, seats evened (31.8/35.1/33.1 → 33.0/34.4/32.6); Yoruba and Mesopotamia +3 |
| D | AI values a resistance boon by conversions it actually prevents | 21.1 | 18.8 | no duel effect (Vedic 41.5 → 40.4) |
| **E** | **C + D + Sky & Oath every 3 turns** | **12.8** | 19.8 | duel fixed on dev seeds; three-god not; frozen for validation |

E undoes part of round r8, which had raised the Court's Favor stream to make up for a weak three-god game. C was meant to address that weakness at its cause instead.

### Frozen candidate E

| Item | Value |
|---|---|
| Data hash | `abde6382dbab` |
| Data changes | `reports/balance-repair-dev/candidate-E-data.diff` |
| AI code | `reports/balance-repair-dev/candidate-E-ai.diff` (`engine/ai.js` sha256 `6d3e3124…`) |

Nothing was changed after freezing.

## 3. Independent validation

Each run was a full plan: 9,000 games, 20 seeds per ordered duel and 10 per ordered triple, plus the 200-game difficulty check. Every candidate run was matched against the shipped data on the same seeds.

| Run | Data | Overall | 3-god | Duel | Duel extremes | 3-god extremes | Seats 2p | Seats 3p | Hard vs easy | Illegal / forced |
|---|---|---|---|---|---|---|---|---|---|---|
| `balance-rc-seed800000` | shipped | 9.8 | 12.5 | **20.3** | greek 56.9 / vedic 36.7 | yoruba 39.8 / greek 27.3 | 47.5/52.5 | 33.5/33.9/32.5 | 188/200 | 0 / 0 |
| `balance-candidate-E-seed800000` | E | 13.4 | **15.8** | **15.8** | irish 58.3 / vedic 42.5 | yoruba 41.6 / greek 25.8 | 48.0/52.0 | 33.8/33.9/32.3 | 188/200 | 0 / 0 |
| `balance-rc-seed900000` | shipped | 8.9 | 12.2 | 14.7 | greek 58.1 / egyptian 43.3 | yoruba 38.9 / greek 26.7 | 47.5/52.5 | 34.7/32.8/32.5 | 193/200 | 0 / 0 |
| `balance-candidate-E-seed900000` | E | 11.2 | 14.8 | 14.4 | mexica 56.7 / egyptian 42.2 | yoruba 40.2 / greek 25.4 | 47.3/52.7 | 34.3/32.1/33.6 | 195/200 | 0 / 0 |

Full per-faction tables with 95% intervals, pairings, power use and economy are in `reports/balance-*-seed800000.md` and `-seed900000.md`.

### Per-faction duel and three-god rates (%)

| Faction | duel shipped 800k | duel E 800k | duel shipped 900k | duel E 900k | 3-god shipped 800k | 3-god E 800k | 3-god shipped 900k | 3-god E 900k |
|---|---|---|---|---|---|---|---|---|
| greek | 56.9 | 51.7 | 58.1 | 56.4 | 27.3 | 25.8 | 26.7 | 25.4 |
| norse | 50.0 | 50.8 | 46.7 | 47.8 | 30.9 | 31.0 | 32.2 | 31.1 |
| egyptian | 45.6 | 44.7 | 43.3 | 42.2 | 34.0 | 33.5 | 35.3 | 33.1 |
| mesopotamian | 51.9 | 53.1 | 53.1 | 51.4 | 32.7 | 34.6 | 31.5 | 34.6 |
| irish | 56.1 | 58.3 | 52.8 | 54.4 | 33.5 | 32.3 | 33.4 | 33.4 |
| mexica | 52.8 | 50.3 | 55.0 | 56.7 | 35.1 | 32.3 | 34.5 | 33.7 |
| hittite | 50.6 | 48.1 | 47.5 | 47.5 | 33.1 | 35.1 | 33.6 | 34.2 |
| yoruba | 50.8 | 50.6 | 47.2 | 45.6 | 39.8 | 41.6 | 38.9 | 40.2 |
| japanese | 48.6 | 50.0 | 52.5 | 51.1 | 36.0 | 35.6 | 34.7 | 35.9 |
| vedic | 36.7 | 42.5 | 43.9 | 46.9 | 31.1 | 31.4 | 32.5 | 31.8 |

### Reading

On the same seeds, E narrows the duel spread (20.3 → 15.8 and 14.7 → 14.4). It lowers the Olympian Court's duel rate by 2–5 points and raises the Vedic Hymns' by 3–6.

It also widens the three-god spread by 2.6–3.3 points both times (12.5 → 15.8, 12.2 → 14.8), and the overall spread by about 2.5–3.5. The cause:
- the Court falls further at its three-god floor (Sky & Oath feeds both modes);
- C lifts Yoruba and Mesopotamia, which strike often, at the three-god top.

On seeds 800000, E fails both the duel and the three-god target. **E does not meet the acceptance criteria and was rejected.**

The shipped data passed the duel target on one of these two sets (14.7). Single full-plan runs scatter by about ±3 points in duel spread, so
neither set alone decides anything.

## 4. Conclusions for a future pass

1. **The Olympian Court's imbalance is a mode split, not general excess.**
   - It sits at the top in duels and at the floor with three gods, in every run since r1.
   - A Court data change moves both modes together.
   - A real fix needs a lever that works differently in the two modes. Candidate C was the one found: an AI correction that touches only three-god play.
   - C alone has the right sign but is too small, and it lifts other strike users too.
2. **The Vedic Hymns' weakness is structural.** One working pillar (Agni's Fire) and two powers that are value traps. Strengthening Agni (C5a) failed validation earlier. AI valuation fixes (D) did not help. The next honest step is a redesign of one dead piece, either Varuna's Order or Indra's Storm, into a working pillar. That is a design decision, not tuning.
3. **The test itself needs more duels.** At 360 duels per faction the measured duel spread of the same data ranges from 14.7 to 20.3.
   - A gate that judges a 15-point max − min on single full-plan runs rejects data whose true spread is about 13.
   - Doubling `--duel-seeds` to 40 (720 duels per faction) roughly halves that noise for about 20% more compute.
   - Changing the gate is a decision for the project owner. This pass kept the stated gate.
4. **The AI corrections C and D are probably right on their own terms**, but each changes balance. They were not shipped alone, because shipping an unvalidated balance change is outside this assignment.

## 5. Regression

No game code or data changed. The suites were re-run on the final tree; results are in `docs/OMNI_IMPLEMENTATION_STATE.md`.
