#!/usr/bin/env node
// Generates docs/design.html from data/*.json so the design page can never drift from the shipped numbers.
const fs = require('fs'), path = require('path'), d = require('./load-data.js')();
const R = d.rules, A = R.actions, src = d.sources;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cite = ids => (ids || []).map(id => `<a href="#src-${id}" class="cite">[${id}]</a>`).join(' ');
const cost = c => [c.faith ? c.faith + ' Faith' : '', c.favor ? c.favor + ' Favor' : ''].filter(Boolean).join(' + ') || 'free';
const fac = id => d.factions.find(f => f.id === id);
const X = ['explore', 'expand', 'exploit', 'exterminate'];
const pct = v => Math.round(v * 100) + '%';
// the in-game encyclopedia glossary is the single source for system explanations (read from ui/encyclopedia.js in a sandbox)
const GLOSSARY = (() => { const sb = {}; sb.self = sb; require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ui', 'encyclopedia.js'), 'utf8'), sb); return sb.PWEncyclopedia.GLOSSARY; })();
const glossary = GLOSSARY.map(g => `<div><b>${esc(g[0])}</b><br>${esc(g[1])}</div>`).join('');
const scenarios = (d.scenarios || []).map(sc => `<li><b>${esc(sc.name)}</b> (${esc(sc.kind)}, ${sc.turns} turns; ${sc.players.map(p => esc(fac(p.faction).shortName)).join(' vs ')}) — ${esc(sc.text)}</li>`).join('');

const powersRows = X.map(x => d.powers.filter(p => p.x === x).map(p => `<tr><td><b>${esc(p.name)}</b><br><small>${esc(fac(p.faction).tradition)}</small></td><td class="x x-${x}">${x}</td><td>${esc(p.text)}</td><td>${cost(p.cost)}</td><td>${p.cooldown}</td><td>${esc(p.inspiredBy)} ${cite(p.sources)}</td></tr>`).join('')).join('');
const factionBlocks = d.factions.map(f => `
<section class="faction" style="--c:${f.palette.secondary};--a:${f.palette.accent}">
  <h3>${esc(f.name)} <small>${esc(f.tradition)} · ${esc(f.deityTitle)}</small></h3>
  <p>${esc(f.blurb)} ${cite(f.sources)}</p>
  <table><tr><th>Domain</th><th>Effect (exact rule)</th><th>Inspired by</th></tr>
  ${f.domains.map(id => { const m = d.domains.find(x => x.id === id); return `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.text)}</td><td>${esc(m.inspiredBy || '')} ${cite(m.sources)}</td></tr>`; }).join('')}
  </table>
  <p class="small">Shrine: <b>${esc(d.shrines.find(s => s.id === f.shrine).name)}</b> (Faith ${d.shrines.find(s => s.id === f.shrine).faith}/turn, pressure ${d.shrines.find(s => s.id === f.shrine).pressure}, radius ${d.shrines.find(s => s.id === f.shrine).radius}, Ward ${d.shrines.find(s => s.id === f.shrine).ward}). Emblem: <i>${esc(f.emblem.replace(/_/g, ' '))}</i>, a symbol, never a portrait of a deity.</p>
</section>`).join('');
const sourcesList = Object.keys(src).filter(k => k[0] !== '_').map(k => { const s = src[k]; return `<li id="src-${k}"><b>[${k}]</b> ${esc(s.title)} — ${esc(s.publisher || '')}. <a href="${esc(s.url)}">${esc(s.url)}</a><br><small>Used for: ${esc(s.supports || '')}${s.verification ? ' · Verification: ' + esc(s.verification) : ''}${s.accessed ? ' · accessed ' + esc(s.accessed) : ''}</small></li>`; }).join('');
const events = d.events.map(e => `<li><b>${esc(e.title)}</b> — ${esc(e.text)} <small>(${e.choices.map(c => esc(c.label)).join(' / ')})</small></li>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pantheon Wars Design</title>
<style>
body{margin:0;background:#0f121a;color:#e9e1cc;font:16px/1.6 "Palatino Linotype",Palatino,Georgia,serif}
main{max-width:980px;margin:0 auto;padding:32px 22px 80px}
h1{font-size:48px;letter-spacing:.06em;margin:0;color:#f3d98e}h2{color:#f3d98e;border-bottom:1px solid #6a5426;padding-bottom:4px;margin-top:42px}
h3{color:#fff2cc;margin-bottom:4px}h3 small{color:#a99e84;font-size:14px;font-weight:normal}
a{color:#9fd2ff}a.cite{font-size:12px;text-decoration:none;color:#e2b33c}
table{border-collapse:collapse;width:100%;font:14px/1.45 system-ui,sans-serif;margin:10px 0}th,td{border-bottom:1px solid #2c3242;padding:6px 8px;vertical-align:top;text-align:left}th{color:#d8b25a;font-weight:600}
.x{font-variant:small-caps;font-weight:700}.x-explore{color:#9fd2ff}.x-expand{color:#f3d98e}.x-exploit{color:#a8e88a}.x-exterminate{color:#ff9f8f}
.faction{border-left:4px solid var(--c);padding:2px 0 2px 16px;margin:22px 0}
.small,small{font-size:13px;color:#a99e84}.note{background:#1a1f2b;border:1px solid #6a5426;border-radius:6px;padding:12px 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.grid div{background:#161b26;border:1px solid #2c3242;border-radius:6px;padding:12px}
code{background:#1a1f2b;padding:1px 5px;border-radius:3px;font-size:14px}img{max-width:100%;border:1px solid #2c3242;border-radius:4px}
</style></head><body><main>
<p class="small"><a href="../index.html">← Play</a> · generated from <code>data/*.json</code> by <code>tools/build-docs.js</code></p>
<h1>Pantheon Wars</h1>
<p><i>Version 0.2 design: the ten pantheons.</i> A small 4X strategy game. You are a god, and the map is the mortal world: ${R.map.width}×${R.map.height} hexes holding ${R.map.settlements} settlements. One human and one or two AI gods compete for worshippers over <b>${R.turns} turns</b>. Every pantheon, domain, power, shrine and event is data in <code>data/*.json</code>. The engine is deterministic and seeded, so a seed plus a list of actions reproduces a game exactly.</p>

<div class="note"><b>A note on respect.</b> The ten pantheons come from real traditions. Several are living religions today (Òrìṣà devotion in Yorùbá communities and the diaspora, Shintō, Hindu traditions that keep the Vedic hymns), and others have modern revivalist communities (Hellenic polytheists, Heathens, Kemetics, Celtic and Mexica revivalists). The game treats their gods as powerful, dignified and sincere, never as jokes or villains. Deities are represented only by <i>symbols</i>: a thunderbolt wreath, an ash tree, a winged sun, river rings, a rising field. There are no portraits, no caricatures and no reproductions of sacred icons, and invented game rites are never presented as real practice. The Fifth Sun has no sacrifice mechanics. See <a href="RESEARCH_AND_REPRESENTATION.md">RESEARCH_AND_REPRESENTATION.md</a>. Runes used as art are common, general-purpose shapes; symbols that hate groups have co-opted are deliberately avoided. Rules are original game abstractions <i>inspired by</i> the cited descriptions. They do not claim to describe historical or modern worship. Every mythic reference carries a citation; the full list is at the bottom.</div>

<h2>The four Xs</h2>
<div class="grid">
<div><b class="x x-explore">Explore</b><br>The world starts hidden in cloud. <b>Read Omens</b> (${A.omen.faith} Faith, once per turn) lifts the fog in radius ${A.omen.radius} around a hex within ${A.omen.range} of what you already know. A <b>Dream Vision</b> (${A.dream.favor} Favor, cooldown ${A.dream.cooldown}) reveals the nearest hidden settlement. Priests reveal the land they walk through. Each pantheon also has an explore power.</div>
<div><b class="x x-expand">Expand</b><br><b>Raise a Shrine</b> (${A.shrine.faith} Faith +${A.shrine.faithStep} for each shrine you already own) in a revealed settlement where you have followers, a priest, or territory. Shrines project conversion pressure ${R.conversion.falloff.join(' / ')} × strength at distance 0/1/2/3 within their reach. <b>Ordain Priests</b> (${A.priest.faith} Faith; cap = ${R.economy.maxPriestsBase} + ${R.economy.maxPriestsPerShrine} per shrine). They walk ${A.priest.move} hexes a turn and preach with pressure ${A.priest.power}.</div>
<div><b class="x x-exploit">Exploit</b><br>Each follower yields ${R.economy.faithPerFollower} Faith per turn, plus domain bonuses for terrain and water, plus each shrine's own Faith. Winning a settlement (at least half its people follow you) grants ${R.economy.favorOnControl} Favor and +${R.conversion.controlMomentum} pressure momentum there. Settlements grow every ${R.growth.everyTurns} turns.</div>
<div><b class="x x-exterminate">Exterminate</b><br>Conversion first absorbs unaffiliated mortals, then takes rival followers. Taking one costs ${R.conversion.rivalCost}× the effort (scaled by the rival's resistance), and only where your pressure exceeds theirs. <b>Eclipse</b> (${A.eclipse.favor} Favor, cooldown ${A.eclipse.cooldown}, range ${A.eclipse.range}) silences a rival shrine for ${A.eclipse.duration} turns and removes ${A.eclipse.wardDamage} Ward; at 0 Ward the shrine falls. Miracles strike or weigh hearts.</div>
</div>

<h2>Resources</h2>
<p><b>Faith</b> is the everyday currency. It is earned each round and spent on shrines, priests, omens and most powers. <b>Favor</b> (cap ${R.economy.favorCap}) is the attention of the heavens. It is scarce, earned by winning settlements and through some domains, and spent on dream visions, eclipses and the great miracles. The top bar's <i>faith meter</i> fills toward the cost of your next shrine.</p>

<h2>Turn structure</h2>
<ol><li>Each god in seat order takes any number of actions, then ends its turn. An event card is drawn on turn ${R.events.firstTurn} and every ${R.events.everyTurns} turns after, and must be resolved first.</li>
<li>When the last god ends its turn, the round resolves in a fixed order:
<ol>
<li>priests walk (callings, roads, frost)</li>
<li>sacred landmarks are claimed</li>
<li>conversion (the god who acts first rotates each turn)</li>
<li>control, Favor and pilgrim roads</li>
<li>Faith income</li>
<li>growth</li>
<li>prosperity and safety</li>
<li>cooldowns, buffs and eclipses tick down</li>
<li>weather fronts gather, arrive and pass</li>
<li>covenants, envoys and delayed strikes</li>
<li>grudges cool</li>
<li>elimination</li>
<li>victory check (including scenario and alternative goals), then the age changes if due</li>
</ol></li></ol>

<h2>Win conditions</h2>
<ul>
<li><b>Ascendancy</b>: from turn ${R.victory.ascendancyMinTurn}, at the end of a round, at least ${pct(R.victory.ascendancyShare)} of all mortals follow you.</li>
<li><b>Dominion</b>: every rival is forgotten (no followers, shrines or priests).</li>
<li><b>Twilight Judgment</b>: when turn ${R.turns} ends, the highest devotion score wins. Score = followers ×${R.victory.score.followers} + shrines ×${R.victory.score.shrines} + settlements controlled ×${R.victory.score.settlements} + Favor ×${R.victory.score.favor}.</li>
</ul>

<h2>Systems of version 0.2</h2>
<p>Every rule below is also in the in-game encyclopedia (❦), generated from the same text.</p>
<div class="grid">${glossary}</div>

<h2>The ${d.powers.length} divine powers</h2>
<p>Each pantheon has one power for each X.</p>
<table><tr><th>Power</th><th>X</th><th>Effect</th><th>Cost</th><th>CD</th><th>Inspired by</th></tr>${powersRows}</table>

<h2>Pantheons and domains</h2>${factionBlocks}

<h2>Event cards (${d.events.length})</h2><ul>${events}</ul>

<h2>Trials (${(d.scenarios || []).length} scenarios)</h2><ul>${scenarios}</ul>

<h2>Engine, AI and balance</h2>
<ul><li>The engine is in <code>engine/engine.js</code>. It has no DOM access, and all randomness comes from a mulberry32 stream stored in the state. <code>step(state, action)</code> is pure, and <code>hash(state)</code> fingerprints the result.</li>
<li>The AI has two levels, <b>Acolyte</b> (easy) and <b>Hierophant</b> (hard). Its rules are in <a href="ai.md">docs/ai.md</a>.</li>
<li>Balance: <a href="../reports/ten-pantheon-balance-final.md">ten-pantheon final report</a> · <a href="../reports/balance-notes.md">tuning history</a> · v0.1 reports: <a href="../reports/balance-before.md">before</a>, <a href="../reports/balance-after.md">after</a>, <a href="../reports/balance-after-3000.md">3000-game confirmation</a>.</li>
<li>Art direction: <a href="ART_DIRECTION.md">ART_DIRECTION.md</a> · traceability: <a href="TRACEABILITY.md">TRACEABILITY.md</a>.</li></ul>

<h2>Sources</h2><ol class="small" style="list-style:none;padding:0">${sourcesList}</ol>
<p class="small">${esc(src._note || '')}</p>
</main></body></html>`;
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'design.html'), html);
console.log('wrote docs/design.html (' + html.length + ' bytes)');
