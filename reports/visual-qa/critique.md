# Visual critique of the release candidate (34e542d) and what was done

Captured from real games at turn 14 (seeds 31–33, desktop 1440×900, High quality) in a pristine worktree of 34e542d. The before/after
contact sheets are `pantheons.jpg`, `ages.jpg` and `vfx.jpg` in this folder (see `manifest.json`).

## Ratings of the release candidate (1 = weak, 5 = strong)
| Aspect | Score | Evidence |
|---|---|---|
| World composition | 3 | strong camera and horizon, but the map reads as separate hexes |
| Landscape richness | 3 | micro-decor present; biomes meet with hard edges |
| Architecture | 3 | ten distinct kits, but houses tiny on bare ground |
| Shape and silhouette | 2 | mountains are one repeated cone |
| Material and lighting | 2 | one diagonal gradient on every hex regardless of slope; ages change only the sky |
| Animation | 3 | smoke, banners, priest hops; priests float without shadows |
| Power spectacle | 3 | 40 distinct motifs, but the land itself never responds; reveal sweeps are hard-edged rectangles |
| Weather and atmosphere | 3 | weather distinguishable (weather QA); fog muddy grey-brown |
| Readability | 4 | patterns, labels, targets clear; territory stripes heavy |
| UI hierarchy | 3 | coherent; cooldown digits cover icons; faith meter label overlaps |
| Faction identity | 4 | emblem, pattern, palette, architecture, priests, atmosphere |
| Mobile | 3 | usable at 390×844; tablet top-bar targets 38 px |
| Coherence | 3 | good parts that do not yet feel like one lit world |

## Ten highest-impact deficiencies → fix (source)
1. Fog reads as smoke; hard-edged pale rectangles appear when rivals cast reveal-band powers → painted cloud sea with a gilded rim (`buildPatterns`, `buildFog`); feathered sweep (`drawFx` case `band`).
2. Hexes read as separate tiles → biome edge transitions and faint seams (`drawTile`).
3. Mountains are stamped cones → 1–3 asymmetric peaks per hex with lit/shaded faces, ridges, strata, scree, cast shadow (`drawDecor` mountains).
4. No light direction on the land → slope light against neighbours and one key light; age grade baked into the static layer and rebuilt per age (`AGE_LIGHT`, `buildStatic`, `setState`).
5. Settlements small on bare ground → plaza, lanes, well, directional contact shadows, lit edges, roof verges, doors and windows, Twilight window light (`village`).
6. Territory stripes and double borders heavy → lighter fill and pattern, soft inner band, single dark edge plus patterned accent (`buildOverlay`).
7. Shallow water steps hex by hex → blurred depth layer (`buildStatic`).
8. Labels are grey boxes → engraved plaques with gilded hairlines and drop shadow (`drawBanners`).
9. Miracles do not touch the land → world-light envelope per cast, force scaled by the power (`playVfx`, `drawFx` case `worldlight`).
10. Cooldown digits cover icons; meter label overlaps; tablet targets 38 px → badge cooldowns, label inside the bar, 44 px on coarse pointers (`ui/style.css`).
