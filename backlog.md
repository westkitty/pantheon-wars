# Pantheon Wars — iteration backlog (after v0.2, the ten pantheons)

Ordered by value. Items from the v0.1 backlog that v0.2 delivered: the Mesopotamian, Irish and Mexica pantheons (and four more), seat compensation, diplomacy-lite, hot-seat and challenge files, lit villages and sky progression, Hierophant lookahead, patterned borders, screen-reader summaries, rebindable keys and the in-game encyclopedia.

1. **Reach the ≤15-point faction spread.** The final ten-pantheon run (`reports/ten-pantheon-balance-final.md`) is the measured state. Shrine pressure proved a weak lever (`reports/balance-notes.md` t8–t12). Next candidates: per-faction economy audit with `tools/diagnose.js`, then domain/power ablations (`tools/ablate.js`) for the leaders and the trailers, re-running the full plan after each accepted change.
2. **Open and read every v0.2 source in full.** The 39 v0.2 citations were checked against search-index summaries only (network policy). Replace Wikipedia summaries with the scholarship they cite where possible (Jamison & Brereton; Barnes; Brundage; Gray).
3. **Community review** of the living-tradition pantheons (Òrìṣà, Kami, Vedic) by practitioners before any public release.
4. **Undo within a turn.** `step` is pure, so keeping the turn's states makes a one-step undo cheap; the Chronicle already proves the reconstruction.
5. **AI envoys to human gods.** The AI currently proposes only to other AI gods; human players propose and answer.
6. **Online asynchronous play.** Challenge files and the short code exist; a share URL that carries `{seed, config, actions}` compressed would remove the file step.
7. **Localization.** All player text lives in `data/*.json`, `ui/app.js` and `ui/encyclopedia.js`; extract UI strings to a table.
8. **Performance on low-end phones.** Measure with a throttled CPU profile; the auto quality switch exists but the low path could drop the second water layer and weather particles entirely.
9. **More Trials.** The scenario format (`data/scenarios.json`) supports staged objectives; one Trial per pantheon would teach each kit.
10. **Event card gallery in the encyclopedia with age variants side by side.**
