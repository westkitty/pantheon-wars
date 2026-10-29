# Pantheon Wars — Art Direction (v0.2, the ten pantheons)

Pantheon Wars ships no image, font or audio files. Every visual is drawn by code at runtime (`ui/art.js`, `ui/render.js`) and every sound is synthesised (`ui/audio.js`). This keeps the game offline, small and free of third-party art, and it means art is reviewable as source. `data/asset-manifest.json` lists every drawing id, where it is drawn and what uses it. `node tools/assets.js` renders all of them into QA contact sheets in `reports/atlas/`.

## Pillars
1. **The world is a model on a table, seen by a god.** A 2.5D perspective strip projection of extruded hex terrain. The camera looks down from the heavens; a horizon, haze and high clouds sit behind the world.
2. **Symbols, never portraits.** Deities appear only as emblems and effects: a thunderbolt wreath, an ash tree, a winged sun, an eight-pointed star, a cauldron ring, sun-rain-water, a storm-sun disc, river rings, a rising field, a flame dawn. No god has a face. No sacred icon is reproduced.
3. **Readable first, beautiful second.** Every state change has a shape, not only a colour: heraldic patterns on territory, distinct shrine silhouettes, condition overlays and text callouts. Colour-only information is not allowed.
4. **Pixel craft at small sizes.** Sprites are drawn at native pixel resolution (14×20 priests, 44×50 shrines, 48×48 icons, 160×90 event scenes) and scaled with nearest-neighbour filtering.
5. **Deadpan mythic tone.** Text and imagery take the gods seriously. There is no parody, gore or horror, and no spiders or spider-like motifs anywhere.

## Faction identity kit
Each pantheon owns a unique **emblem**, **palette** (primary, secondary, accent, glow), **heraldic pattern**, **atmosphere**, **architecture**, **shrine family** and **priest family**. `tools/validate-data.js` rejects duplicates and checks contrast between the secondary colour and the map.

| Pantheon | Emblem | Pattern | Atmosphere | Village architecture | Shrine |
|---|---|---|---|---|---|
| The Olympian Court | thunderbolt wreath | meander | Olympian daylight | whitewashed walls, red gables, columns | columned temple |
| The Hall of the Ash | ash tree | chevron | ash-hall embers and frost | timber walls, steep slate roofs, hearth smoke | timber hall |
| The Ennead of the Two Lands | winged sun | horizontal bars | river light of the Two Lands | flat-roofed mudbrick, palms | pylon temple |
| The Assembly of the Gods | eight-pointed star | grid | star-lit river plain | flat mudbrick, stepped terraces | ziggurat precinct |
| The Tuatha Dé Danann | cauldron ring | dots | hearth smoke and mist | round houses, thatch, wattle fences | assembly enclosure |
| The Fifth Sun | sun, rain and water | zigzag | high sun and lake light | whitewashed flat roofs, painted bands | twin-shrine temple |
| The Thousand Gods of Hatti | storm and sun disc | cross | stone, storm and sun disk | grey stone, flat roofs | court of Arinna |
| The Council of the Òrìṣà | river rings | waves | river warmth and forge glow | red-earth walls, hipped roofs, carved posts | courtyard shrine |
| The Shrines of the Kami | rising field | vertical bars | first light | pale walls, dark steep roofs, gateway posts | honden |
| The Vedic Hymns | flame and dawn | rings | fire and dawn | thatched houses, hearth fires | fire altar |

Atmosphere is a screen-space grade (sky top/mid colours, light tint, mote colour) applied for the viewing god. It never hides information.

## World
- **Terrain:** extruded hex columns with painted top faces, side faces shaded by height, ambient occlusion, cliff shadows and seeded micro-decor (grass tufts, stones, reeds, snow). Static terrain is cached to an offscreen layer; only animated layers redraw.
- **Relief and water:** height drives column depth; deep water, shallows and coast foam animate on two drifting pattern layers. Reduced motion stops the drift.
- **Biomes and climate:** grass, plains, forest, hills, mountains, desert, marsh and water. Weather fronts draw their own overlays: drought cracks and haze, storm rain and wind streaks, seasonal rain, frost, sky omens.
- **Sky progression:** the sky colour moves through the 45 turns — dawn gold in the Dawn age, high clear light in the Zenith, deepening dusk and violet in the Twilight.
- **Fog theatre:** fog is soft and cross-fades; newly revealed hexes unveil with a short per-tile reveal instead of popping.

## Settlements
- **Layered villages:** each town draws houses in the architecture of its *patrons* (the gods who have held it, in order), so a town that changed hands shows mixed styles.
- **Growth tiers:** five tiers by population; a town that has lost three or more people since its peak shows ruined houses (decline).
- **Routes and travellers:** pilgrim roads draw as dashed paths with small travellers when consecrated; cut roads fade.
- **Landmarks:** wind summit, spring, sacred grove and standing stones (32×28 sprites) with a holder ring.
- **Persistent marks:** scorch (strikes), blossoms (blessings), fallen trees (storms), cracked earth (drought), ruins (toppled shrines, cheaper to rebuild) and covenant stones. Most fade with time.

## Shrines: ten families × seven conditions × three callings
Conditions: **healthy, fortified** (Ward above base: posts and banners), **eclipsed** (darkened with a crescent), **damaged** (cracks), **nearly toppled** (tilted, broken), **ruined** (rubble mark), **restored** (scaffold and garlands). Callings add a visible element: **Oracle** (an eye-light), **Sanctuary** (a low wall), **Beacon** (a flame on a mast). See `reports/atlas/shrines-conditions.png` and `shrine-specs.png`.

## Priests: ten families × three callings × four frames
Each family has its own dress silhouette (chiton, cloak, linen, fringed robe, brat, tilmatli, long robe, agbada, kariginu, dhoti) in the pantheon palette. Callings change the held object and stance: **Emissary** (staff), **Seer** (raised light), **Warden** (shield). Four walk frames. See `reports/atlas/priests.png`.

## Powers: forty signatures in three beats
Every power has its own VFX id (`ui/render.js` `VFX`) choreographed in three beats: **gather** (light or particles converge on the target), **release** (the effect lands: bolt, wave, bloom, wings, ring, flood), **aftermath** (residue and a text callout naming the power). Camera shake and white flashes are capped and disabled by *Flashes: off*; *Reduced motion* shortens every beat to a still frame and a callout. Captured frames: `reports/atlas/vfx/`.

## Interface
- **HUD:** dark glass panels with a gilded hairline, serif display type (system stacks only), sans UI text. Laid out for 1440×900 and reflowed at 390×844 (power bar scrolls, place panel docks above it, every touch target ≥ 44 px).
- **Influence overlay:** per-town pressure numbers and source lines from the viewer's *redacted* view, so it never reveals hidden rival shrines.
- **Event illustrations:** 19 procedural 160×90 scenes, each tinted by the current age.
- **Tapestry:** the end-of-age commemorative weave (1600×1000) — territory as woven cells in each pantheon's pattern, a devotion timeline across the three ages, and the decisive moments of the verified Chronicle. Exportable as PNG and JSON.

## Accessibility rules for art
Patterned borders (on by default) · high-contrast mode · reduced motion and no-flash options · every audio cue has an on-screen equivalent · screen-reader round summaries · no information carried by colour alone.
