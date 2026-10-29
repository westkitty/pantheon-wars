# Pantheon Wars — AI decision rules (v0.2)

Source: `engine/ai.js`. The AI is a pure function `nextAction(E, state) → action` for `state.current`.
It reads state and returns one action. `playTurn` loops it for the simulator. The browser calls the same function, with a short delay between actions so you can watch.

## Determinism
- No `Math.random`. **Hierophant (Hard)** is a deterministic utility maximiser. Ties break on a stable key (the action's JSON), then on tile id.
- **Acolyte (Easy)** uses a *private* PRNG seeded by `seed:ai:turn:player:actionIndex`. It never draws from the game's RNG stream, so an AI's choices cannot desynchronise the world. The same seed always reproduces the same game.
- Personality: each Hard god draws four weights in a seeded way (`seed:persona:pid`):
  - expand 0.7–1.3
  - aggression 0.6–1.4
  - explore 0.7–1.3
  - economy 0.7–1.3

  The largest weight names its archetype: **Builder**, **Zealot**, **Seer** or **Steward**. Easy gods use fixed weights (1, 0.6, 1, 0.8).

## Turn procedure (both levels)
1. **Pending event card** → choose a side (see *Events*).
1b. **Envoys waiting** → answer them (see *Diplomacy*).
2. **Action cap**: after 24 actions in one turn → end the turn. In practice it is never reached.
3. **Priest orders first.** For each priest that has arrived, or has no destination:
   - The priest stays where it stands unless the place is "done": fewer than 1 convertible mortal, or 85% of it already follows us.
   - Otherwise it is re-targeted:
     - *Hard*: the best value `convertible / (1 + 0.35·distance) / (1 + our priests already there or heading there)`, where `convertible = unaffiliated + 0.5 × rival followers`.
     - *Easy*: a random one of the 3 nearest revealed settlements that still have unaffiliated mortals.
4. **Candidate actions**: every affordable action gets a utility `u` (roughly value per 10 Faith spent; 1 Favor is valued at 6 Faith). Illegal candidates are filtered out with `E.validate`.

| Action | Value |
|---|---|
| Raise Shrine | best revealed site where we have presence: `(0.6·pop + convertible + 0.5·nearby convertible within 2) × expand`, scaled down in the last 6 turns |
| Ordain Priest | best priest target value × 0.9 × expand |
| Read Omens | `exploreNeed × hidden hexes uncovered × 0.5`, where `exploreNeed = hidden settlements / all settlements × explore` (× 0.3 in the last 10 turns) |
| Dream Vision | `exploreNeed × 8` |
| Eclipse | rival shrine within range of our shrines or priests, valued by our followers, unaffiliated mortals and its owner's followers within 2 hexes. × 2.5 if its Ward ≤ 1 (it would fall); × 0.3 if already eclipsed; × aggression |
| Faction powers | effect-by-effect valuation (reveal like an omen; ward ×6 if the shrine is about to fall; faith buffs from current income; strike/weigh from the best revealed target; Rune Hall like a shrine plus the half-price cost) |

5. **Choice**
   - **Hard**: take the highest `u`. *Saving rule*: if a shrine is the best long-term purchase and is affordable within 2 turns of income, and the best action now would spend Faith the shrine needs while being worth less than 80% of it, the AI ends its turn to save. Otherwise it acts only if `u ≥ 0.5`, then ends the turn.
   - **Easy**: a 30% chance each step to simply end the turn. Otherwise it picks a weighted-random candidate with `u > 0.15`, weight `√u`. Easy gods are therefore wasteful, short-sighted, and never save.

## v0.2 additions

### Ages
Weights shift with the age: Dawn ×1.2 explore, Zenith ×1.1 expand, Twilight ×1.15 aggression.

### New candidate actions
| Action | Value |
|---|---|
| Counter-rite | restores the struck shrine's Ward (or disperses a gathering storm): valued like the Ward it saves plus the Favor the attacker loses; urgent when the shrine would fall |
| Shrine calling | Oracle when much of the map is still hidden, Sanctuary when the shrine is threatened (`threatLevel`: visible rival shrines within 4 and priests within 3), Beacon when uncontested towns lie in reach |
| Covenant | only promises it expects to keep: protection where its shrine is safe, plenty where prosperity is already near 6, faithfulness where rival pressure is low |
| Pilgrim road | Faith per turn × turns left (capped at 14) × 0.6 + road pressure × 6 × expand |
| Retrain | a priest standing at a threatened shrine becomes a Warden |
| Priest calling | Seer when exploration is valuable and it has none; Warden for a threatened home; Emissary otherwise |

### Grudges and diplomacy
- Every god keeps a **grudge** (0–10) toward each rival: strikes, eclipses, taking its towns and broken treaties raise it; it cools over time and with festivals. Hard AI multiplies attack values against a rival by `1 + 0.12 × grudge` and divides them during an active treaty.
- **Proposals** (at most one per turn, every fourth turn per seat, never in the last 4 turns, AI-to-AI only): a truce when the rival is ahead by 10%+, grudge ≤ 3 and the god is not aggressive; a festival when economy-minded, grudge 2–6 and Faith ≥ 12.
- **Answers**: truce accepted when grudge ≤ 3, the proposer is not far ahead (≤ 1.3×) and more than 3 turns remain; festival accepted when grudge ≤ 5 and it can spare the Faith. Easy gods answer at random from their private stream.
- Border promises stop the AI from raising shrines within the promised radius (`borderBlocked`).

### Hierophant lookahead (P010)
When the choice is close (second-best candidate within 85% of the best), when any god holds 50%+ of all mortals, or in the last 2 turns, the Hierophant takes its top 3 candidates (8 on the final turn), applies each to a **private clone** of the state, plays the rest of the round with every god passing, and scores the result: own score + 0.6 × income (fading near the end) + 5% of banked Faith, minus the best rival's. A candidate that wins the game outright scores +1000 and is forced; one that loses scores −1000. The clone shares only the immutable map tiles and carries its own RNG copy, so the real game stream never advances. `tests/systems.test.js` has a trap test where the greedy choice loses 14–16 and lookahead wins 20.5–16.

### Fog honesty
Every target is chosen from what the god has revealed. Weather forecasts are read only through `E.helpers.knownFronts`, which applies the same visibility rules as the player's UI.

## Events
- **Hard** scores both sides and takes the better one:
  - Faith 1:1, Favor ×6
  - followers ×3, lost followers −3.2
  - free priest 12 when it has fewer than 4 priests, otherwise 4
  - shrine discount 12
  - ward +2 per shrine, and so on
  - a Faith cost that would go negative scores −50.
- **Easy** flips a (private, seeded) coin.

## Measured strength
From the test `hard AI beats easy AI…`, and the `--easy-check` mirror duels in the balance reports: v0.1 measured Hard beating Easy in about 80–87% of mirror duels. The v0.2 figure across all ten pantheons is in `reports/ten-pantheon-balance-final.md` (Difficulty check); 900-game tuning samples measured 186–194 of 200.
