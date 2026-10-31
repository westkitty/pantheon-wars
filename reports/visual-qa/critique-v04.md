# v0.4 asset pass — adversarial review against 642b779

Evidence: `reports/visual-qa/{pantheons,ages,close,sprites,walk,vfx}.jpg` (same seeds, cameras and states before and after; `before` is
a worktree at 642b779), native atlases `reports/atlas/{villages,shrines-conditions,shrine-specs,priests,landmarks}.png`.

| Question | Answer | Evidence |
|---|---|---|
| Are the ten architectural kits genuinely different in shape and construction? | Yes. Each kit has its own house form, roof type, material texture, civic monument, enclosure and props (temple front, longhouse and hall, pylon gate, stepped terrace, round houses, twin-stair platform, tower gate, courtyard compound, raised hall with two-tier roof, open hall over three fires). They are not recolours. | `atlas/villages.png`, `close.jpg` |
| Are the new shrines visibly better than their predecessors? | Yes at normal and close zoom: double the source resolution, material textures, outlines, and conditions that change the structure (breaches, fallen members, shoring, family-material walls, scaffolds, architecture-specific ruins). | `sprites.jpg`, `atlas/shrines-conditions.png` |
| Are priests recognisable and animated properly? | Faction (garment and headwear) and calling (staff and pennant, lantern crook, shield and spear) read at gameplay size. The walk is four frames advanced by distance, with no hop and no sliding; the figure faces its direction; idle breath is half a pixel. | `atlas/priests.png`, `walk.jpg` |
| Consistent scale? | Houses 11–17 source px wide (6–8 world), monuments 28–38 (14–19 world), shrines 44×50 world as before, priests 14×20 world as before. One light, one outline weight, one shadow direction. | atlases |
| Does the landscape feel authored? | Unchanged from v0.3 in this pass: terrain decor, roads and water were not reauthored. | — |
| Small sprites readable? | Yes: the one-pixel silhouette outline keeps buildings distinct on every terrain; roof colour and form identify the culture. | `close.jpg` |
| Are the divine powers individually memorable? | Not improved as art in this pass. The airborne effects are now drawn at screen resolution, which sharpens them, but their motifs are the v0.3 shapes. | `vfx.jpg` |
| Does ordinary gameplay look more polished? | At normal (1.9) and close (3.2) zoom, yes: towns and shrines are clearly better made and more distinct. At the overview scale of `pantheons.jpg` the change is modest. | `pantheons.jpg`, `close.jpg` |
| Clutter rather than quality? | One risk: dense tier-5 towns are busy at overview zoom. Mitigated by ring plots, a clear space behind the shrine and moving the monument aside when a shrine stands. | `close.jpg` |
| Interaction or performance regressions? | None measured: same gameplay hash, journeys, QQQ and offline proof pass; renderer p95 within run-to-run noise (`reports/perf-comparison-assets.md`). | below |

Repair pass performed after the first review: the shrine hid the new civic monument (both stood at the back of the plaza) — the composer
now moves the monument to the left and keeps plots out from behind the shrine when a town has one; the Norse hall's side roof read as a
slash and was widened.

Verdict for the asset-production criteria: **PARTIAL.** Delivered: standing-object library (10 kits, villages, 10 shrine families × 7
conditions × 3 callings, 10 priest families × 3 callings × 6 frames, 4 landmarks) rebuilt at 2× and integrated at screen resolution.
Not delivered: environment source art, the 40 VFX motifs, icons, emblems, event illustrations and tapestry elements, and no review by a
person on a real device.
