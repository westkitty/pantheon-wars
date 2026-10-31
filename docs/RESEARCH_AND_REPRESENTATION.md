# Research and Representation Review — the ten pantheons

This document records what research supports each pantheon in Pantheon Wars, how well it was verified, and the rules the game follows when it draws on traditions that people practise today. The citation ids (`[G1]`, `[Y3]`, …) resolve to `data/sources.json`; the in-game encyclopedia (❦ → Sources & representation) shows the same list.

## How sources were checked (read this first)
- **v0.1 sources (G1–G6, N1–N6, E1–E6, 18 records):** each page was opened and read while building v0.1. Verification field: `page opened and read (v0.1 build)`.
- **v0.2 sources (M, I, X, H, Y, J, V; 39 records):** the build environment's network policy blocked direct page fetches. Each cited URL was located with a web search and the claim was checked against the **search-index summary of that exact URL**, not against the full page. Verification field: `search-index summary of this exact URL reviewed; page not opened directly (network policy)`. Each record also has a confidence rating (high / medium / low).
- **What this means:** the v0.2 citations are real, specific URLs and the claims they support are modest (a deity's domain, a site's existence, an architectural form), but they have **not** been read in full. A reviewer with ordinary internet access should open each v0.2 link and confirm the `supports` text before a public release. This is listed as an open item in `backlog.md`.
- Wikipedia is cited only as a secondary summary and is labelled as such, with the underlying scholarly work named where the summary names it. Higher-tier sources (Oracc, CELT, INAH, UNESCO, Kokugakuin, museum records) are preferred where available.

### Re-check attempt, 2026-10-30
Direct page fetches were tried again for the v0.2 sources. The session's network policy still blocks them: name resolution failed for
`oracc.museum.upenn.edu` (M1) and `en.wikipedia.org` (V4), and no further hosts were tried after two identical failures. **All 39 v0.2
sources therefore remain search-summary-only**; none was read in full in this pass, and no source record was changed. To complete the
check, allow these hosts in the environment's network settings (or review the links on a normal connection): oracc.museum.upenn.edu,
www.religionswissenschaft.uzh.ch, courses.lumenlearning.com, celt.ucc.ie, en.wikipedia.org, meath.ie, lugares.inah.gob.mx,
archaeology.org, smarthistory.org, whc.unesco.org, open.maricopa.edu, turkisharchaeonews.net (and www.), umma.umich.edu,
d-museum.kokugakuin.ac.jp, ia600501.us.archive.org, vedicheritage.gov.in.

## Rules the game follows
1. **Symbols, not portraits.** No deity has a face, body or likeness. Emblems are abstract (a ring, a disc, a tree, a star). No sacred object or icon is reproduced; where a culture's architecture is shown (a torii-like gateway post, a pylon, a ziggurat), it is generic building form, not a copy of a specific consecrated object.
2. **Rites are invented and say so.** Game actions (raising shrines, ordaining priests, consecrating roads, swearing covenants) are strategy abstractions shared by all ten pantheons. They are never presented as how any real community worships. The encyclopedia and design page say this explicitly.
3. **Living traditions are not mocked, villainised or "defeated" as a judgment.** Every pantheon is played straight, with dignity, and with the same mechanical vocabulary. Losing a game is never framed as a tradition being false.
4. **No sacrifice mechanics for the Fifth Sun (Mexica).** No offering of people, no ritual killing, no blood economy, no wording that implies them. Its kit is wind, rain, sun and lake water. A test (`tests/content.test.js`) checks the kit text and effect types.
5. **No mixing presented as authenticity.** Where the game pairs figures from different periods or languages (Sumerian and Akkadian names; Hattian, Hurrian and Hittite deities; Egyptian figures across dynasties), the representation note says it is a game convenience.
6. **Names keep their diacritics.** Òrìṣà, Ọbàtálá, Ọ̀ṣun, Ògún, Dé Danann, Ḫepat, Tōnatiuh, Ōkuninushi are stored and displayed as Unicode; a test checks the roster names.
7. **No AI credits, no parody voice.** Text is written in a deadpan mythic register. No hate-group-adjacent symbols (for example, specific runes co-opted by extremists) are used as decoration. No spiders or spider-like motifs anywhere (a project rule, also tested).

## Pantheon by pantheon

| Pantheon | Tradition and scope | Living community? | Sources (tier) | Specific care taken |
|---|---|---|---|---|
| The Olympian Court | Archaic–Classical Greek myth | Hellenic polytheists today | G1–G6: Theoi Project, Hesiod and Homeric Hymns translations (read) | Gods shown as symbols; no temple rite depicted |
| The Hall of the Ash | Old Norse, mainly the Eddas (13th-c. Iceland) | Heathenry today | N1–N6: Britannica, Bellows' Poetic Edda (read) | Runes only as generic shapes; extremist-coded symbols excluded |
| The Ennead of the Two Lands | Egyptian, New Kingdom and later | Kemetic communities | E1–E6: Britannica, Budge's Book of the Dead (read) | Period mixing noted; Ma'at framed as order and judgment, not punishment |
| The Assembly of the Gods | Sumerian and Akkadian (Enlil, Enki/Ea, Inana/Ištar, Utu/Šamaš) | No continuous community | M1–M4 Oracc (high); M5 Univ. Zurich apkallu (medium); M6 Lumen/SUNY (medium) | Sumerian/Akkadian pairing labelled as convenience |
| The Tuatha Dé Danann | Medieval Irish texts (Cath Maige Tuired, Cormac's Glossary) | Revivalist communities | I1–I2 CELT, University College Cork (high/medium); I3–I5 Wikipedia summaries (medium); I6 Meath County Council (medium) | Gaulish and British material deliberately not merged in; medieval Christian-era transmission noted |
| The Fifth Sun | Mexica and wider Nahua (Quetzalcoatl/Ehecatl, Tlaloc, Tonatiuh, Chalchiuhtlicue) | Nahua peoples today; Mexica revivalists | X1 INAH (high); X4 Smarthistory (high); X2 Archaeology Magazine, X5 UNESCO, X3 Wikipedia (medium) | **No sacrifice mechanics**; weather, devotion and lake gardens (chinampas) only |
| The Thousand Gods of Hatti | Hittite state cult (Sun goddess of Arinna, Tarḫunna, Telipinu, Ḫepat) | No continuous community | H1–H2 Wikipedia (medium); H3 Maricopa Open Digital Press (medium); H4–H5 Turkish Archaeological News (medium) | Hattian/Hurrian/Luwian layering noted (13th-c. court) |
| The Council of the Òrìṣà | Yorùbá religion (Ọ̀ṣun, Ògún, Ọbàtálá, Ṣàngó) | **Living tradition** in West Africa and the diaspora | Y1 UNESCO Osun-Osogbo (high); Y4 UMMA object record (medium); Y2, Y3, Y5 Wikipedia (medium) | No initiation, divination (Ifá) or worship rites; no sacred emblems; powers are abstractions |
| The Shrines of the Kami | Shintō, Kojiki/Nihon shoki tradition (Amaterasu, Susanoo, Ōkuninushi, Inari) | **Living tradition** | J1–J6 Kokugakuin University Encyclopedia of Shinto (high) | No shrine rite shown as real practice; architecture generic |
| The Vedic Hymns | Rigvedic horizon (Indra, Agni, Varuṇa, Uṣas) | Hindu traditions keep the hymns | V5 Staal 1983 scan (medium); V1–V4 Wikipedia (medium); V6 IGNCA portal (low) | Explicitly not Hinduism as a whole; no living community's practice represented |

## Known weaknesses
- **Verification depth for v0.2 sources** (see above): summaries, not full reads.
- **Secondary-source share:** 13 of 39 new citations are Wikipedia summaries. They are labelled medium confidence and name the scholarship they summarise, but primary or academic sources should replace them where possible (for example Jamison & Brereton's *Rigveda* translation for V1, Barnes' *Africa's Ogun* for Y2, Brundage's *The Fifth Sun* for X3).
- **No community review.** No practitioner of any living tradition has reviewed this content. Before public release, review by Yorùbá, Shintō and Hindu readers (at minimum) is recommended.
- **Mechanics are flattening by design.** Ten traditions share one rules vocabulary (shrines, priests, Faith, Favor). That is a game abstraction and the docs say so, but it inevitably simplifies.
