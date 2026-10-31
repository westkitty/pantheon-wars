# Pantheon Wars — Art Direction (v0.5, the ten pantheons)

Pantheon Wars ships no image, font or audio files. Every visual is drawn by code at runtime (`ui/art.js`, `ui/render.js`) and every sound is synthesised (`ui/audio.js`). This keeps the game offline, small and free of third-party art, and it means art is reviewable as source. `data/asset-manifest.json` lists every drawing id, where it is drawn and what uses it. `node tools/assets.js` renders all of them into QA contact sheets in `reports/atlas/`.

## Pillars
1. **The world is a model on a table, seen by a god.** A 2.5D perspective strip projection of extruded hex terrain. The camera looks down from the heavens; a horizon, haze and high clouds sit behind the world.
2. **Symbols, never portraits.** Deities appear only as emblems and effects: a thunderbolt wreath, an ash tree, a winged sun, an eight-pointed star, a cauldron ring, sun-rain-water, a storm-sun disc, river rings, a rising field, a flame dawn. No god has a face. No sacred icon is reproduced.
3. **Readable first, beautiful second.** Every state change has a shape, not only a colour: heraldic patterns on territory, distinct shrine silhouettes, condition overlays and text callouts. Colour-only information is not allowed.
4. **Pixel craft at small sizes.** Standing objects are authored at 2× their world size in `ui/kits.js` (villages 144×104, shrines 88×100, priests 28×40, landmarks 32×28 world from 64×56) and drawn in screen space, so at normal zoom one source pixel is about one screen pixel; icons (48×48) and event scenes (160×90) remain 1× pixel art scaled with nearest-neighbour filtering.
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

## v0.3 visual finish — "a living mythological atlas"
Target: miniature civilisations on carved land under a moving sky, lit by a single sun, with every divine act answered by the land.
Precedents studied for principles only (nothing copied): tactical readability first (every state has a shape, effects never hide a
target), a coherent hex landscape that reads as one terrain rather than tiles, and diorama lighting (one key light, soft contact
shadows, warm/cool contrast). Canvas guidance followed: pre-render static work to offscreen canvases, avoid per-frame gradients for
full-screen layers, clip to what is shown.

What changed in the running game (all in `ui/render.js` and `ui/style.css`; no new files, fonts or images):

| Area | Before | Now | Cost per frame |
|---|---|---|---|
| Light | fixed diagonal gradient on every hex | one upper-left key light; each hex's top shaded by its slope against its neighbours (cool when it faces away, warm when it faces the light); the whole land is regraded per age — warm Dawn, neutral Zenith, violet Twilight — and the static layer rebuilds at the two age changes | none (static, `AGE_LIGHT`) |
| Terrain | flat colour per hex, dark outline | neighbouring biomes bleed across shared edges; outlines faint seams | none |
| Mountains | one cone stamped per hex | ranges composed from their neighbours: the heart of a range rises as one dominant wide peak, its edges break into foothills, others carry 1–3 asymmetric peaks; lit and shaded faces, secondary ridges, strata, scree, cast shadow, snow by altitude and climate | none |
| Plains, desert | heavy diagonal stripes, bright scribbles | quieter furrows in varying directions, softer dune ripples | none |
| Water | each hex filled with its depth colour (visible steps) | depth painted per hex then blurred into one continuous shallow-to-deep material under the coast | none |
| Fog | grey-brown smoke | a painted cloud sea: cool hollows, shadowed undersides, cream sunlit crowns, a gilded rim where the known world ends | none (fog is cached) |
| Territory | heavy stripes and thick double lines | lighter fill and heraldic pattern (pattern kept for colour-blind play), a soft inner band of the realm colour, a thin dark edge and the patterned accent line; high-contrast mode unchanged | none (overlay cached) |
| Settlements | 64×48 sprite, small houses on bare ground | 72×52: worn plaza and lanes, well or fountain from tier 3, directional contact shadows, lit wall edges, roof verges and ridges, doors and windows; windows glow at Twilight; Greek columns on large houses, Japanese upturned eaves, Norse gable horns, Mesopotamian stepped terrace, Mexica painted bands, Hittite stone courses, Yoruba posts; tiers, decline ruins and layered patronage kept | cached per settlement state |
| Shrines | constant glow | light pools brighten at Dawn and strongly at Twilight, so shrines carry the light as the age darkens | unchanged |
| Priests | floating sprite | contact shadow, faces the way it walks, a gentle idle breath (none in reduced motion) | negligible |
| Miracles | motif + screen tint | every power also has a world-light envelope: the land dims as the power gathers, a pool of the power's colour lights the terrain as it lands, then an afterglow; force scales with the power (flash/shake/wide); off in Low quality and reduced motion | one gradient while active |
| Reveal sweeps | hard-edged rectangle (Barque of Re, Crossing of Utu, Breath of Quetzalcoatl) | feathered travelling light that rises and fades | same |
| Labels | grey boxes | engraved plaques with gilded hairlines and a drop shadow, rendered once per label state into a cache | lower than before (text no longer re-rendered every frame) |
| UI | — | one material language: gilded inner hairline and engraved corner marks on panels and sheets; cooldowns as a sweep plus a small badge; faith meter label inside the bar; consistent pressed, focus and disabled states; framed event art; 44 px top-bar targets on any touch screen | CSS |

Ten-pantheon identity in gameplay is carried by architecture (village kits and shrine families), territory colour and heraldic
pattern, priest families, the per-pantheon atmosphere grade, and each power's own colour in its world-light pool.

## v0.4 asset production — the standing-object library rebuilt
The v0.3 pass changed rendering; v0.4 rebuilds the art itself. New source: `ui/kits.js` (original procedural source art, about 470 lines;
no image files). The old 14×20 priests, 44×50 shrines and 32×28 landmarks were removed from `ui/art.js`, and the village painter
(`ARCH` table plus inline drawing in `ui/render.js`) was replaced by the kit composer.

**Why 2× and screen space.** The world is rasterised into a 1-unit-per-pixel frame and magnified 2–3.4× by the perspective strips, so
no sprite could show more than one pixel of detail per world unit. Supersampling the whole frame doubled frame cost (p95 up to 33 ms,
rejected). Instead, standing objects and airborne effects are drawn after the strips, each through the local affine projection at
its own anchor (`localAffine`): same place, same size, same depth order, but rasterised at screen resolution. Ground light, rings and
sweeps stay in the world frame under the towns.

**Materials and light.** One light, upper left. Every building is an oblique box (lit front, shaded side receding up-right, lit top)
with a surface texture per material: ashlar, polygonal masonry, mudbrick courses, render, timber planks, wattle, plaster with timber
frame. Roofs: gable (tile courses, sunlit ridge, eave shadow), temple front (pediment), hip with deep eaves, conical thatch (strokes,
cylindrical shading), barrel thatch. Every building and figure gets a one-pixel dark silhouette (`outlined`) so it reads on any
terrain, and a cast shadow to the lower right.

| Kit | House | Civic monument (tier 3+, larger at 5) | Enclosure (tier 4+) | Props |
|---|---|---|---|---|
| Greek | whitewashed box, red tile gable | marble temple front: stylobate, fluted columns, pediment | stone wall | cypress, column, jar |
| Norse | low timber longhouse under a turf roof to the ground, crossed gable horns, snow when cold | great hall, carved gable, double horns | palisade | pine, woodpile |
| Egyptian | mudbrick block, cornice, roof-terrace shelter | battered pylon gate, relief bands, flagstaff | mudbrick wall | date palms, canal |
| Mesopotamian | adobe with niched buttresses | three-stage terrace with stair and top shrine | mudbrick wall | reeds, palm |
| Irish | round wattle house, conical thatch | great round hall with porch | earth bank | broadleaf, standing stone, fence |
| Mexica | whitewashed flat roof, painted bands | stepped platform, twin stair, two small temples (form only; no rite shown) | painted wall | maize, canal, jar |
| Hittite | grey stone over a socle, beam ends | gate between crenellated towers | stone wall | stelae |
| Yoruba | red-earth walls, hipped roof on carved posts | compound round a courtyard with rain basin | earth wall | broadleaf, jar |
| Japanese | plaster and timber frame on a plinth, hip roof, upturned eaves | raised hall, two-tier roof | hedge | pine, gateway |
| Vedic | adobe under barrel thatch | open hall sheltering the three fires (round, square, half-round) | thorn fence | fire altar, hearth |

Neutral towns use three land kits (mud, timber, tile). **Villages** place plots on rings round a plaza (lanes lead out, a well from
tier 3), keep the space behind the shrine clear and move the monument left when a shrine stands, and spread the newest patron's kit
outward from the plaza. **Shrines** (ten families × seven conditions × three callings) change structure by condition: damaged = a breach
in the roof, a fallen member, cracks and debris; nearly toppled = lean, roof mostly gone, shoring timbers; fortified = a wall, towers,
gate and banners in the family's own material; ruined = footings and stumps of that architecture (burnt timbers for timber families);
restored = scaffold poles with cross-ties, a ladder and garlands; eclipsed = darkened with a cold rim and an occluded sun disc.
**Priests** have a flared robe with folds, lit face, garment signature per family, and six frames: idle, four walk frames driven by the
distance covered (no foot sliding, no hop), and a gesture. Callings read by silhouette: staff and pennant, lantern crook, shield and spear.

Not reauthored in v0.4 (still v0.3 art): terrain decor (trees, mountains, desert, marsh, water), roads and travellers, the forty power
icons and other UI icons, emblems, event illustrations, tapestry, and the VFX motifs (they are now drawn at screen resolution, which
sharpens them, but their shapes are unchanged).

## v0.5 — finishing the remaining art families
New source files (original procedural art; no image files): `ui/terrain-art.js` (terrain features), `ui/vfx-art.js` (forty power
manifestations). Reworked in place: `ui/art.js` (minted icons and emblems, five redrawn icon glyphs, event scene compositions),
`ui/kits.js` (pilgrims), `ui/render.js` (integration, roads, smoke).

| Family | What changed | Source | How it reaches the game |
|---|---|---|---|
| Terrain features | Forest stands (conifers with tiered lit/shaded crowns and snow in the cold, broadleaves with clustered canopies, birches, undergrowth, stand shadow); mountain massifs (broken ridgelines with shoulders and notches, lit and shaded faces, hollow shadow, gullies, strata, cliff bands, broken snow caps, scree fans; separate forms for the heart, middle and foothill edge of a range); hill knolls (grassy relief, rock outcrops, shrubs, dry and green). 2×, one-pixel outline, cast shadow; a seeded pool of 8 variants per family and climate (up to 88 sprites, built on first use and shared across games) | `ui/terrain-art.js` | Baked at 1× into the static layer (overview zoom, Low quality, fog border, highlighted tiles) and drawn at 2× in screen space at normal zoom over the baked copy, under all towns, shrines and priests |
| Power manifestations | All forty powers have their own authored form and motion (see table below); the old shared motifs no longer play for faction powers. Anticipation, world light and aftermath keep the three-beat choreography. Reduced motion holds each power's own form still for 0.9 s with the ring and label | `ui/vfx-art.js` | Drawn live in screen space round the target |
| Icons | Every icon is minted: doubled on its pixel grid, lit edge toward the light, shaded edge away from it, one-pixel dark silhouette. Five weak glyphs redrawn (raven, crow omen, feather, iron road, order rope) | `ui/art.js` `mint`, `ICONS` | Power bar, place panel, title gallery, encyclopedia |
| Emblems | 64 px medallion: bevelled metal rim lit from the upper left, deep field, minted device | `ui/art.js` `emblem` | Top bar, hand-off, events, victory, Chronicle, tapestry |
| Event scenes | All nineteen recomposed in depth with a setting that follows the subject (coast, river plain, lake, terraces, mountains, forest, town, meadow, plain): sky with the age's sun or moon and cloud bands, a hazy far range, a mid-ground with its own features and a settlement (lit windows at Twilight), the subject, and a framing foreground. The subjects themselves are the v0.3 drawings | `ui/art.js` `sceneBack`, `sceneFront` | Event card |
| Roads and travellers | Roads are worn into the land: smoothed through the hex centres, dark verge, packed earth, pale crown and pebbles, cairns at both ends lit while open. Three pilgrims per open road (hooded cloak, the owner's colour as a sash, bundle and staff, four walk frames by distance, facing their direction), some walking each way | `ui/render.js` `drawRoutes`, `ui/kits.js` `pilgrim` | Screen space, depth-sorted with towns and priests |
| Smoke | Soft puffs that swell, drift and thin out instead of square pixels | `ui/render.js` | Towns |

Power manifestations (each also keeps its own anticipation, world-light colour and aftermath):

| Pantheon | Explore | Expand | Exploit | Exterminate |
|---|---|---|---|---|
| Olympian Court | an oak of light grows; leaves spiral out | a faceted bronze-rimmed shield dome rises | a wave of ripening grain runs outward | a branching bolt, impact flash, scorch |
| Hall of the Ash | two ravens beat out and back | a stone rises; carved strokes burn in | sun through a rain cloud, a bow over the fields | a hammer wheels down a thunder arc, ground cracks |
| Ennead | the sun's boat crosses the sky | two great wings unfold over a stepped seat | a black-earth mound sprouts | a balance tips with a feather on one pan |
| Assembly of the Gods | the sun crosses on a high arc, waters glint | three clay tablets rise and stack | a fountain bursts, rings run out | an eight-pointed star descends and sets |
| Tuatha Dé Danann | mist rolls in, three crows rise | a ring of fires lights one by one | a cauldron steams toward the towns | two rings turn against each other |
| Fifth Sun | spiralling gusts sweep with streamers | a reed-bound garden plot rises from the lake | a cloud lets down a curtain of rain | the zenith sun pins the town in a shaft; heat shimmer |
| Thousand Gods of Hatti | a banded disc turns; an omen bird crosses | dressed stones fly in and lock into a gate | flowers open in a widening ring; bees | a storm wall rolls in and throws lightning |
| Council of the Òrìṣà | a river mirror opens with rings | clay shards fly together into a vessel | sparks fountain from an anvil and run along the roads | a stone falls on twin bolts |
| Shrines of the Kami | a fan of first light opens | red posts rise, beams drop onto them | flooded plots light up, rice stands | a dark vortex tightens, lit from inside |
| Vedic Hymns | night draws back like a curtain from a rose horizon | a flame climbs into a tall standing fire | a golden cord loops round the land, waters settle | a cloud wall breaks into a forked downpour |

Still v0.3 art after v0.5: flat ground decoration (grass, plains furrows, desert dunes, marsh, tundra), water and coast, the weather
overlays, the subjects inside the event scenes, the rite icons other than the five redrawn glyphs, the heraldic patterns, the tapestry.
