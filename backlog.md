# Pantheon Wars — iteration backlog (after v0.1)

Ordered by value. "Data-only" means it needs **no engine or UI code**: you add entries to `data/*.json`, run `node tools/bundle-data.js`, `node tools/build-docs.js` and the balance harness. The engine already supports every effect type these items use, and the renderer draws any faction from its palette, emblem key and shrine key. (A brand-new emblem or shrine *shape* is one small function in `ui/art.js` or `ui/render.js`. Until it exists, an unknown emblem falls back to a palette-coloured disc and an unknown shrine to a palette-tinted temple. `tests/engine.test.js` includes a test that adds a fourth pantheon purely as data and plays full games with it.)

1. **Data-only pantheon: Mesopotamian ("The Assembly of the Gods").**
   - Domains: Enlil (wind and authority), Enki/Ea (fresh water and craft), Inanna/Ishtar (the morning and evening star), Shamash/Utu (sun and justice).
   - Powers: `revealBand` (Shamash's daily crossing), `spawnPriest` + `buff priestMult` (Enki's apkallu sages), `waterFaith`, and `shrineHit`.
   - Sources to cite: ETCSL (Oxford) translations, Britannica entries. *Data only.*
2. **Close the FFA/duel gap for the Olympian Court.** It measures about 21–24% in three-god FFA but 53–59% in duels (`reports/balance-after*.md`). Candidates: Sky & Oath Favor every 3 turns in FFA only, or move pressure from Sea to Grain. Re-run 3000 games and require every mode within 15 pp.
3. **Seat compensation.** The first seat wins 53–60% of duels. The engine already reads `rules.start.seatFaithBonus`, but plain Faith bonuses swung results chaotically because 20 starting Faith sits just below the 24-Faith shrine price. Try instead: later seats start with +1 revealed radius or a 10% shrine discount.
4. **Data-only pantheon: Celtic/Gaulish and Irish ("The Tuatha Dé Danann").**
   - Domains: the Dagda (abundance; the cauldron), Brigid (poetry, smithcraft, healing), Lugh (many skills), the Morrígan (prophecy).
   - Powers reuse `popTarget`, `buff faithMult`, `reveal`, `weigh`.
   - Cite primary-text translations (CELT, University College Cork) and Britannica. *Data only.*
5. **Data-only pantheon: Mesoamerican, Mexica ("The Fifth Sun").**
   - Domains: Quetzalcoatl (wind, learning), Tlaloc (rain), Tonatiuh (sun), Chalchiuhtlicue (waters).
   - Handle with particular care: present cosmology and agriculture, and no sacrifice mechanics.
   - Consult sources by Indigenous and Mexican scholars. *Data only.*
6. **Diplomacy-lite.** Truces and shared festivals between gods, and an AI that remembers who eclipsed it. Requires engine work.
7. **Hot-seat and asynchronous play.** Serialise `{seed, players, actions}` into a share URL, so a replay or move list can be pasted and re-simulated deterministically. The hash check already exists.
8. **Visual: true lit sprites.** Per-tile normal-mapped lighting with a moving sun across the 45 turns (dawn → dusk → twilight on the final turns), and denser villages that grow with population. Settlement shapes per pantheon (whitewashed poleis, longhouses, mudbrick towns).
9. **AI: lookahead for Hierophant.** A one-round rollout over the top 3 candidates (`E.step` is pure and cheap), plus a "Rival" difficulty that adapts its personality to the leader.
10. **Accessibility and UX:**
    - colour-blind palettes (patterned territory borders)
    - a screen-reader summary of each round
    - rebindable keys
    - an in-game encyclopedia that reads `docs/design.html` sections
    - an undo for the last action within a turn (cheap, because `step` is pure)
