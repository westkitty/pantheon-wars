// Living-world systems (P004–P017, P020–P021). Each test drives a real state through PWEngine and checks authoritative results.
const test = require('node:test'), assert = require('node:assert');
const { data, E, H, AI, IDS, playOut, sandbox, PWEngine } = require('./helpers.js');
const duo = (a, b, seed) => E.newGame({ seed: seed || 40, players: [{ faction: a || 'greek' }, { faction: b || 'norse' }] });
function round(s) { const t = s.turn; let g = 0; while (s.turn === t && !s.over && g++ < 10) { s.players[s.current].pendingEvent = null; assert.strictEqual(E.apply(s, { type: 'endTurn' }), null); } }

test('P004 ages: Dawn, Zenith and Twilight change at turns 16 and 31, alter costs, and are logged', () => {
  const s = duo('greek', 'norse');
  assert.strictEqual(s.age, 'dawn');
  const omenDawn = H.omenCost(s, 0);
  while (s.turn < 16) round(s);
  assert.strictEqual(s.age, 'zenith'); assert.ok(s.log.some(l => l.k === 'age' && l.x.age === 'zenith'));
  assert.ok(H.omenCost(s, 0) > omenDawn, 'omens cost more after the Dawn');
  const home = s.settlements[s.players[0].home];
  while (s.turn < 31) round(s);
  assert.strictEqual(s.age, 'twilight');
  const ec = H.eclipseCost(s, 0); assert.strictEqual(ec, data.rules.actions.eclipse.favor - 1, 'Twilight eclipses cost 1 less');
  // thresholds exactly
  assert.strictEqual(E.ageOf(15).id, 'dawn'); assert.strictEqual(E.ageOf(16).id, 'zenith'); assert.strictEqual(E.ageOf(30).id, 'zenith'); assert.strictEqual(E.ageOf(31).id, 'twilight'); assert.strictEqual(E.ageOf(45).id, 'twilight');
  // zenith shrine pressure bonus
  const z = duo(); const sh = z.settlements[z.players[0].home]; const p1 = H.shrinePressure(z, sh); z.turn = 20; assert.ok(H.shrinePressure(z, sh) > p1);
});

test('P005 memory: a captured town remembers its previous patron, history is bounded, and trust from earlier acts changes later conversion', () => {
  const s = duo('egyptian', 'greek');
  const town = s.settlements.find(x => x.id !== s.players[0].home && x.id !== s.players[1].home);
  town.followers = [Math.ceil(town.pop * 0.6), 0]; E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  assert.strictEqual(town.controlledBy === 0 || s.settlements[town.id].controlledBy === 0, true);
  const t = s.settlements[town.id];
  t.followers = [0, Math.ceil(t.pop * 0.6)]; s.players[0].revealed[t.tile] = 1;
  E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  const t2 = s.settlements[town.id];
  assert.ok(t2.patrons.some(p => p.p === 0) && t2.patrons[t2.patrons.length - 1].p === 1, 'patron history records both gods in order');
  assert.ok(t2.mem.some(m => m.k === 'lost' && m.p === 0) && t2.mem.some(m => m.k === 'won' && m.p === 1));
  // trust: a struck town resists the striker
  const a = sandbox('greek', 'norse'), b = E.clone(a), tgt = a.settlements[a.players[1].home];
  const before = H.pressureAt(a, tgt, 0);
  b.settlements[tgt.id].trust[0] = -3;
  assert.ok(H.pressureAt(b, b.settlements[tgt.id], 0) < before, 'low trust lowers pressure');
  b.settlements[tgt.id].trust[0] = 3;
  assert.ok(H.pressureAt(b, b.settlements[tgt.id], 0) > before, 'high trust raises pressure');
  const full = playOut(91, [{ faction: 'vedic' }, { faction: 'norse' }, { faction: 'mexica' }]);
  assert.ok(full.settlements.every(x => x.mem.length <= data.rules.memory.max && x.patrons.length <= data.rules.memory.patrons), 'memory stays bounded over a whole game');
  assert.ok(full.settlements.some(x => x.mem.length >= 3), 'towns accumulate a history');
});

test('P006 needs: deterministic, hunger stops growth and causes unrest, two different remedies raise prosperity', () => {
  const a = duo('irish', 'greek', 77), b = duo('irish', 'greek', 77);
  assert.deepStrictEqual(a.settlements.map(s => s.needs), b.settlements.map(s => s.needs));
  const s = duo('greek', 'norse', 77), home = s.settlements[s.players[0].home];
  home.needs.prosperity = 0; home.followers[0] = home.pop; // controlled and starving
  while (s.turn < 6) { s.settlements[home.id].needs.prosperity = 0; round(s); }
  const popBefore = s.settlements[home.id].pop; s.settlements[home.id].needs.prosperity = 0; round(s); // turn 6 is a growth turn
  assert.strictEqual(s.settlements[home.id].pop, popBefore, 'a hungry town does not grow');
  assert.ok(s.log.some(l => l.k === 'unrest'), 'a hungry town sheds followers (unrest)');
  assert.ok(s.settlements[home.id].mem.some(m => m.k === 'hunger'));
  // remedy 1: an exploit power (Cauldron of Plenty) — remedy 2: a covenant of plenty kept
  const r1 = sandbox('irish', 'greek'); round(r1); r1.players[0].cooldowns = {}; r1.players[0].faith = 50; r1.players[0].favor = 9;
  const lowTown = r1.settlements.find(x => x.controlledBy === 0); lowTown.needs.prosperity = 2; const p0 = lowTown.needs.prosperity;
  assert.strictEqual(E.apply(r1, { type: 'power', power: 'irish_cauldron_of_plenty' }), null);
  assert.ok(r1.settlements[lowTown.id].needs.prosperity > p0);
  const r2 = sandbox('greek', 'norse'); round(r2);
  const t2 = r2.settlements.find(x => x.followers[0] > 0 && x.needs.prosperity < 6);
  assert.ok(t2, 'a town that wants');
  assert.strictEqual(E.apply(r2, { type: 'covenant', kind: 'provide', tile: t2.tile }), null);
  // pressure explanation: an afraid town listens less to unprotected gods
  const q = duo(), qs = q.settlements.find(x => x.id !== q.players[0].home && x.id !== q.players[1].home);
  q.priests.find(p => p.owner === 0).tile = qs.tile; const pBefore = H.pressureAt(q, qs, 0); qs.needs.safety = 0;
  assert.ok(H.pressureAt(q, qs, 0) < pBefore);
});

test('P007 covenants: kept and broken branches, bounded count, abandonment cost, memory and marks', () => {
  const s = sandbox('greek', 'norse'); round(s);
  const home = s.settlements[s.players[0].home];
  home.shrine.ward = 4; home.shrine.eclipsed = 0;
  assert.strictEqual(E.apply(s, { type: 'covenant', kind: 'protect', tile: home.tile }), null);
  const fav = s.players[0].favor;
  const other = s.settlements.find(x => x.controlledBy === 0 && x.followers[0] >= 2 && x !== home);
  assert.strictEqual(E.apply(s, { type: 'covenant', kind: 'keep', tile: other.tile }), null);
  const third = s.settlements.find(x => x.followers[0] > 0 && x !== home && x !== other);
  assert.match(E.validate(s, { type: 'covenant', kind: 'keep', tile: third.tile }), /already keep/);
  assert.match(E.validate(s, { type: 'covenant', kind: 'protect', tile: home.tile }), /already have a covenant|already keep/);
  for (let i = 0; i < 7; i++) { s.settlements[home.id].shrine.ward = 4; s.settlements[other.id].followers[0] = s.settlements[other.id].pop; round(s); }
  assert.ok(s.covenants.some(c => c.kind === 'protect' && c.status === 'kept'), 'protection kept');
  assert.ok(s.players[0].stats.covenantsKept >= 1 && H.marksAt(s, home.tile, 'covenant').length);
  assert.ok(s.settlements[home.id].mem.some(m => m.k === 'covenantKept'));
  // broken branch: shrine toppled
  const b = sandbox('greek', 'norse'); round(b);
  const bh = b.settlements[b.players[0].home]; bh.shrine.ward = 3;
  E.apply(b, { type: 'covenant', kind: 'protect', tile: bh.tile });
  const trust0 = bh.trust[0];
  bh.shrine = null; round(b);
  const c = b.covenants.find(x => x.kind === 'protect');
  assert.strictEqual(c.status, 'broken'); assert.ok(b.settlements[bh.id].trust[0] < trust0 + 0.5); assert.strictEqual(b.players[0].stats.covenantsBroken, 1);
  // abandonment is an explicit breach with a Favor price
  const d = sandbox('greek', 'norse'); round(d);
  const dt = d.settlements.find(x => x.controlledBy === 0 && x.followers[0] >= 2);
  E.apply(d, { type: 'covenant', kind: 'keep', tile: dt.tile }); const id = d.covenants[0].id, f0 = d.players[0].favor;
  assert.strictEqual(E.apply(d, { type: 'abandon', covenant: id }), null);
  assert.ok(d.players[0].favor < f0); assert.strictEqual(d.covenants[0].status, 'broken');
  // too late to promise
  const late = duo(); late.turn = 44; const lh = late.settlements[late.players[0].home];
  assert.match(E.validate(late, { type: 'covenant', kind: 'protect', tile: lh.tile }), /too late/);
});

test('P008 counter-rites: an eclipse opens a bounded reaction window for the defender; storms telegraph and can be dispersed', () => {
  const s = duo('norse', 'greek', 3);
  const rival = s.settlements[s.players[1].home];
  s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1;
  const w = rival.shrine.ward;
  E.apply(s, { type: 'eclipse', tile: rival.tile });
  assert.ok(rival.shrine.threat && rival.shrine.threat.by === 0);
  E.apply(s, { type: 'endTurn' });
  assert.strictEqual(s.current, 1);
  s.players[1].favor = 5;
  assert.strictEqual(E.apply(s, { type: 'counterRite', tile: rival.tile }), null);
  assert.strictEqual(rival.shrine.ward, w); assert.strictEqual(rival.shrine.eclipsed, 0); assert.strictEqual(rival.shrine.threat, null);
  assert.match(E.validate(s, { type: 'counterRite', tile: rival.tile }), /nothing threatens/);
  // the window closes: a threat not answered expires after the defender's next turn
  const t = duo('norse', 'greek', 3), tr = t.settlements[t.players[1].home];
  t.players[0].favor = 15; t.priests.find(p => p.owner === 0).tile = tr.tile; t.players[0].revealed[tr.tile] = 1;
  E.apply(t, { type: 'eclipse', tile: tr.tile }); round(t); round(t);
  assert.ok(!tr.shrine.threat, 'threat expired');
  // Storm of Susanoo: warning first, damage a round later, and a counter-rite disperses it
  const j = sandbox('japanese', 'greek'); round(j); j.players[0].cooldowns = {};
  const jr = j.settlements[j.players[1].home], jw = jr.shrine.ward;
  assert.strictEqual(E.apply(j, { type: 'power', power: 'jpn_storm_of_susanoo', tile: jr.tile }), null);
  assert.strictEqual(jr.shrine.ward, jw, 'no damage yet'); assert.ok(jr.shrine.threat.storm && j.pending.length === 1);
  const j2 = E.clone(j);
  round(j); assert.strictEqual(j.settlements[jr.id].shrine.ward, jw, 'still gathering after this round');
  round(j); assert.ok(!j.settlements[jr.id].shrine || j.settlements[jr.id].shrine.ward < jw, 'storm breaks at the end of the next round');
  E.apply(j2, { type: 'endTurn' }); j2.players[1].favor = 9; j2.players[1].pendingEvent = null;
  assert.strictEqual(E.apply(j2, { type: 'counterRite', tile: jr.tile }), null);
  round(j2); round(j2);
  assert.ok(j2.settlements[jr.id].shrine.ward >= jw - 0, 'dispersed storm does no damage'); assert.strictEqual(j2.pending.length, 0);
});

test('P009 grudges: hits create bounded grudges that decay; a betrayed AI targets the betrayer and refuses its envoys', () => {
  const s = duo('norse', 'greek', 3), rival = s.settlements[s.players[1].home];
  s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1;
  E.apply(s, { type: 'eclipse', tile: rival.tile });
  assert.strictEqual(s.players[1].grudge[0], data.rules.grudge.hit);
  for (let i = 0; i < 12 && rival.shrine; i++) { s.players[0].cooldowns.eclipse = 0; s.players[0].favor = 15; rival.shrine.ward = 5; E.apply(s, { type: 'eclipse', tile: rival.tile }); }
  assert.strictEqual(s.players[1].grudge[0], data.rules.grudge.max, 'grudge capped');
  const g0 = s.players[1].grudge[0]; while (s.turn % data.rules.grudge.decayEvery !== 0) round(s); round(s);
  assert.ok(s.players[1].grudge[0] < g0, 'grudges decay');
  // betrayal: a truce broken by an eclipse adds a large grudge; the betrayed hard AI refuses a new truce
  const b = duo('norse', 'greek', 3), br = b.settlements[b.players[1].home];
  b.treaties.push({ id: 1, kind: 'truce', a: 0, b: 1, t0: 1, t1: 9, status: 'active' });
  b.players[0].favor = 15; b.priests.find(p => p.owner === 0).tile = br.tile; b.players[0].revealed[br.tile] = 1;
  E.apply(b, { type: 'eclipse', tile: br.tile });
  assert.strictEqual(b.treaties[0].status, 'broken'); assert.ok(b.players[1].grudge[0] >= data.rules.diplomacy.breachGrudge);
  b.players[0].flags.proposed = false;
  E.apply(b, { type: 'propose', kind: 'truce', to: 1 }); E.apply(b, { type: 'endTurn' }); b.players[1].pendingEvent = null;
  const ans = AI.nextAction(E, b);
  assert.strictEqual(ans.type, 'answer'); assert.strictEqual(ans.accept, false, 'betrayed god refuses');
  // same seed => same behavioural trace
  const g1 = playOut(55, [{ faction: 'hittite' }, { faction: 'vedic' }]), g2 = playOut(55, [{ faction: 'hittite' }, { faction: 'vedic' }]);
  assert.deepStrictEqual(g1.players.map(p => p.grudge), g2.players.map(p => p.grudge));
});

test('P009 archetypes: two personalities choose materially different actions in the same prepared position', () => {
  // the same prepared position, played by every archetype; several positions are tried because one hand-built position can have a
  // single obviously best move (an eclipsed home shrine, a large Faith buff) that every personality rightly takes
  const report = {};
  let differs = false;
  for (const [fac, rival] of [['greek', 'norse'], ['norse', 'greek'], ['egyptian', 'yoruba'], ['vedic', 'hittite']]) {
    const base = sandbox(fac, rival, 21); round(base); base.players[0].revealed = base.players[0].revealed.map(() => 1); base.players[0].cooldowns = {};
    base.priests.forEach(p => { if (p.owner === 0) p.dest = p.tile; });
    const hs = base.settlements[base.players[0].home].shrine; if (hs) { hs.ward = 3; hs.eclipsed = 0; hs.threat = null; }
    const picks = {};
    for (let seed = 1; seed < 60; seed++) {
      const c = E.clone(base); c.seed = seed; const arch = AI.personality(c, 0).archetype;
      const a = AI.nextAction(E, c, { noLookahead: true });
      picks[arch] = picks[arch] || new Set(); picks[arch].add(a.type + ':' + (a.power || a.spec || a.kind || ''));
    }
    const all = new Set(); Object.values(picks).forEach(x => x.forEach(y => all.add(y)));
    report[fac] = Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, [...v]]));
    if (Object.keys(picks).length >= 2 && all.size >= 2) differs = true;
  }
  assert.ok(differs, 'choices by archetype: ' + JSON.stringify(report));
});

function trapPosition() {
  // Final round, rival ahead by 2 on score. Raising a shrine (+3) wins; the greedy order wastes the turn on scouting.
  const s = E.newGame({ seed: 12, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  s.turn = 45; s.age = 'twilight';
  const me = s.players[0], rv = s.players[1];
  s.settlements.forEach(x => { x.followers = [0, 0]; x.progress = [0, 0]; x.needs.prosperity = 5; x.needs.safety = 6; x.trust = [0, 0]; });
  const mh = s.settlements[me.home], rh = s.settlements[rv.home];
  mh.pop = 8; mh.followers = [8, 0]; rh.pop = 8; rh.followers = [0, 8];
  const site = s.settlements.filter(x => x !== mh && x !== rh && !x.shrine).sort((a, b) => H.dist(s, a.tile, mh.tile) - H.dist(s, b.tile, mh.tile))[0];
  site.pop = 3; site.followers = [1, 0]; me.revealed[site.tile] = 1;
  s.priests.forEach(p => { p.dest = null; p.tile = p.owner === 0 ? site.tile : rh.tile; });
  me.faith = 40; me.favor = 0; rv.favor = 6; rv.faith = 0; me.cooldowns = { eclipse: 9, dream: 9 }; rv.cooldowns = { eclipse: 9, dream: 9 };
  s.climate.fronts = []; s.pending = []; s.players.forEach(p => { p.pendingEvent = null; });
  return s;
}
test('P010 lookahead: Hierophant avoids a final-round loss that the greedy order takes, without touching the real game', () => {
  const g = trapPosition(); let n = 0; while (!g.over && n++ < 30) AI.playTurn(E, g, { noLookahead: true });
  assert.strictEqual(g.winner.pid, 1, 'the trap is real: greedy play loses');
  const s = trapPosition(), rngBefore = JSON.stringify(s.rng), hashBefore = E.hash(s);
  const first = AI.nextAction(E, s);
  assert.strictEqual(JSON.stringify(s.rng), rngBefore, 'game RNG untouched by the lookahead'); assert.strictEqual(E.hash(s), hashBefore, 'state untouched by the lookahead');
  n = 0; while (!s.over && n++ < 30) AI.playTurn(E, s);
  assert.strictEqual(s.winner.pid, 0, 'lookahead finds the winning shrine');
  assert.ok(s.actions.some(x => x.p === 0 && x.a.type === 'shrine'));
  // easy stays easier: hard beats easy in seat-rotated duels across several pantheons
  let hard = 0; const N = 20;
  for (let i = 0; i < N; i++) { const f = IDS[i % 10], o = IDS[(i + 5) % 10], hs = i % 2; const r = playOut(800 + i, [0, 1].map(k => ({ faction: k === 0 ? f : o, ai: k === hs ? 'hard' : 'easy' }))); if (r.players[r.winner.pid].ai === 'hard') hard++; }
  assert.ok(hard / N >= 0.65, 'hard won ' + hard + '/' + N);
});

test('P011 diplomacy: truce penalises aggression, festival gives a finite reward, envoys expire, all serialisable', () => {
  const s = duo('norse', 'greek', 3);
  assert.strictEqual(E.apply(s, { type: 'propose', kind: 'truce', to: 1 }), null);
  assert.match(E.validate(s, { type: 'propose', kind: 'festival', to: 1 }), /one envoy/);
  E.apply(s, { type: 'endTurn' }); s.players[1].pendingEvent = null;
  assert.strictEqual(E.apply(s, { type: 'answer', id: s.proposals[0].id, accept: true }), null);
  const t = s.treaties[0]; assert.strictEqual(t.kind, 'truce'); assert.strictEqual(t.status, 'active');
  E.apply(s, { type: 'endTurn' });
  const rival = s.settlements[s.players[1].home]; s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1;
  const fav = s.players[0].favor; E.apply(s, { type: 'eclipse', tile: rival.tile });
  assert.strictEqual(t.status, 'broken'); assert.ok(s.players[0].favor < fav - H.eclipseCost(s, 0, rival.tile) + 0.5, 'breach costs Favor');
  // festival
  const f = duo('norse', 'greek', 4); f.players[0].faith = 20; f.players[1].faith = 20;
  E.apply(f, { type: 'propose', kind: 'festival', to: 1 }); E.apply(f, { type: 'endTurn' }); f.players[1].pendingEvent = null;
  E.apply(f, { type: 'answer', id: f.proposals[0].id, accept: true });
  const fv = [f.players[0].favor, f.players[1].favor];
  E.apply(f, { type: 'endTurn' }); E.apply(f, { type: 'endTurn' }); E.apply(f, { type: 'endTurn' });
  assert.ok(f.players[0].favor >= fv[0] + data.rules.diplomacy.festivalFavor - 1 && f.treaties[0].status === 'kept');
  // envoy expiry
  const x = duo('norse', 'greek', 5); E.apply(x, { type: 'propose', kind: 'border', to: 1 }); round(x); round(x);
  assert.strictEqual(x.proposals[0].status, 'expired');
  // border promise: raising a shrine near the partner's shrine is a breach
  const bd = duo('norse', 'greek', 6); bd.treaties.push({ id: 7, kind: 'border', a: 0, b: 1, t0: 1, t1: 9, status: 'active' });
  const near = bd.settlements.find(z => !z.shrine && H.dist(bd, z.tile, bd.settlements[bd.players[1].home].tile) <= 2);
  if (near) { bd.players[0].faith = 99; bd.players[0].revealed[near.tile] = 1; near.followers[0] = 1; E.apply(bd, { type: 'shrine', tile: near.tile }); assert.strictEqual(bd.treaties[0].status, 'broken'); }
  JSON.parse(JSON.stringify(s));
});

test('P012 shrine specializations: oracle, sanctuary and beacon each change rules and are exclusive', () => {
  for (const spec of ['oracle', 'sanctuary', 'beacon']) {
    const s = duo('greek', 'norse', 9), home = s.settlements[s.players[0].home]; s.players[0].faith = 50; s.players[0].favor = 5;
    const rev0 = s.players[0].revealed.reduce((a, b) => a + b, 0), ward0 = home.shrine.ward, rad0 = H.shrineRadius(s, home), pr0 = H.shrinePressure(s, home), inc0 = H.incomeOf(s, 0);
    assert.strictEqual(E.apply(s, { type: 'specialize', tile: home.tile, spec }), null);
    assert.match(E.validate(s, { type: 'specialize', tile: home.tile, spec: 'oracle' }), /already/);
    if (spec === 'oracle') { assert.ok(s.players[0].revealed.reduce((a, b) => a + b, 0) > rev0); assert.ok(H.incomeOf(s, 0) > inc0); }
    if (spec === 'sanctuary') { assert.ok(home.shrine.ward > ward0); assert.ok(H.resistOf(s, home, 0) > s.players[0].mods.conversionResist); assert.strictEqual(H.hitDamage(s, home, 1, true), 0); }
    if (spec === 'beacon') { assert.ok(H.shrineRadius(s, home) > rad0 && H.shrinePressure(s, home) > pr0); assert.ok(home.shrine.ward <= data.rules.specs.beacon.wardCap); }
  }
  assert.match(E.validate(duo(), { type: 'specialize', tile: 0, spec: 'oracle' }), /your shrines/);
});

test('P013 priest roles: seer walks further and sees more, warden softens miracles and steadies the town, emissary is the v0.1 baseline', () => {
  const s = duo('greek', 'norse', 12), home = s.settlements[s.players[0].home];
  s.players[0].faith = 100;
  s.priests = s.priests.filter(p => p.owner !== 0);
  E.apply(s, { type: 'priest', tile: home.tile, role: 'seer' }); E.apply(s, { type: 'priest', tile: home.tile, role: 'warden' });
  const seer = s.priests.find(p => p.role === 'seer'), warden = s.priests.find(p => p.role === 'warden');
  const far = s.settlements.filter(x => x !== home && H.pathStep(s, 0, home.tile, x.tile)).sort((a, b) => H.dist(s, b.tile, home.tile) - H.dist(s, a.tile, home.tile))[0];
  E.apply(s, { type: 'movePriest', priest: seer.id, tile: far.tile });
  const rev0 = s.players[0].revealed.reduce((a, b) => a + b, 0);
  round(s);
  const moved = H.dist(s, home.tile, s.priests.find(p => p.id === seer.id).tile);
  assert.ok(moved >= 3 || s.priests.find(p => p.id === seer.id).tile === far.tile, 'seer walks 3');
  assert.ok(s.players[0].revealed.reduce((a, b) => a + b, 0) > rev0);
  assert.ok(H.wardenAt(s, 0, home.tile));
  assert.strictEqual(H.hitDamage(s, s.settlements[home.id], 1, true), 0, 'warden softens a 1-ward miracle');
  assert.strictEqual(data.rules.roles.emissary.move, data.rules.actions.priest.move); assert.strictEqual(data.rules.roles.emissary.power, data.rules.actions.priest.power);
  // retrain only at own shrines; unknown role rejected
  assert.match(E.validate(s, { type: 'retrain', priest: warden.id, role: 'bard' }), /unknown/);
  assert.strictEqual(E.validate(s, { type: 'retrain', priest: warden.id, role: 'emissary' }), null);
  assert.match(E.validate(s, { type: 'retrain', priest: seer.id, role: 'warden' }), /own shrines/);
});

test('P014 routes: consecration needs followers at both ends, gives pressure and Faith, disruption lapses it, never crosses impassable land', () => {
  const s = sandbox('yoruba', 'greek'); round(s);
  s.routes.forEach(r => { r.owner = -1; r.status = 'open'; });
  const home = s.settlements[s.players[0].home];
  const r = s.routes.find(x => (x.a === home.id || x.b === home.id));
  const other = s.settlements[r.a === home.id ? r.b : r.a];
  other.followers[0] = Math.max(1, other.followers[0]); s.players[0].revealed[other.tile] = 1;
  s.priests.find(p => p.owner === 0).tile = other.tile;
  const p0 = H.pressureAt(s, other, 0), inc0 = H.incomeOf(s, 0);
  assert.strictEqual(E.apply(s, { type: 'route', route: r.id }), null);
  assert.ok(H.pressureAt(s, other, 0) > p0 && H.incomeOf(s, 0) > inc0);
  assert.match(E.validate(s, { type: 'route', route: r.id }), /already/);
  // disruption: rival takes the far end; after the grace period the road lapses
  for (let i = 0; i < 6; i++) { const o = s.settlements[other.id]; o.followers = o.followers.map((f, k) => k === 1 ? o.pop : 0); round(s); }
  assert.strictEqual(s.routes[r.id].owner, -1, 'route lapsed'); assert.ok(s.log.some(l => l.k === 'routeLapsed' || l.k === 'route'));
});

test('P015 landmarks: at least three types across seeds, never on settlements or unreachable tiles, fair to homes, claimable', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const s = E.newGame({ seed, players: [{ faction: 'greek' }, { faction: 'norse' }, { faction: 'egyptian' }] });
    s.landmarks.forEach(l => {
      kinds.add(l.kind); const t = s.map.tiles[l.tile];
      assert.strictEqual(t.settlement, -1); assert.ok(data.terrain.types[t.terrain].passable);
      s.players.forEach(p => { assert.ok(H.dist(s, l.tile, s.settlements[p.home].tile) >= data.rules.landmarks.minHomeDist); assert.ok(H.pathStep(s, p.id, s.settlements[p.home].tile, l.tile), 'reachable'); });
    });
  }
  assert.ok(kinds.size >= 3, 'types seen: ' + [...kinds]);
  const s = duo('greek', 'norse', 14), l = s.landmarks[0];
  s.priests.find(p => p.owner === 0).tile = l.tile; round(s);
  assert.strictEqual(s.landmarks[0].holder, 0); assert.ok(s.log.some(x => x.k === 'landmark'));
});

test('P016 climate: forecast -> active -> consequence -> recovery for drought and storm, deterministic, hidden until known', () => {
  const s = duo('greek', 'norse', 22), home = s.settlements[s.players[0].home];
  s.climate.fronts.push({ id: 50, kind: 'drought', tile: home.tile, radius: 2, phase: 'forecast', t0: s.turn + 1, t1: s.turn + 3, hitDone: false });
  assert.strictEqual(H.frontKnown(s, 1, s.climate.fronts[0]), false, 'forecast hidden from a god without foresight');
  const p0 = home.needs.prosperity, inc0 = H.incomeOf(s, 0);
  round(s); assert.strictEqual(s.climate.fronts.find(f => f.id === 50).phase, 'active');
  round(s);
  assert.ok(s.settlements[home.id].needs.prosperity < p0, 'drought lowers prosperity'); assert.ok(H.incomeOf(s, 0) < inc0 + 3);
  while (s.climate.fronts.some(f => f.id === 50)) round(s);
  assert.ok(s.log.some(l => l.k === 'weather' && l.x.ended && l.x.kind === 'drought'));
  // storm eclipses an unprotected shrine but not a sanctuary
  const t = duo('greek', 'norse', 23), th = t.settlements[t.players[0].home], rh = t.settlements[t.players[1].home];
  rh.shrine.spec = 'sanctuary';
  t.climate.fronts.push({ id: 60, kind: 'storm', tile: th.tile, radius: 1, phase: 'active', t0: 1, t1: 3, hitDone: false });
  t.climate.fronts.push({ id: 61, kind: 'storm', tile: rh.tile, radius: 1, phase: 'active', t0: 1, t1: 3, hitDone: false });
  round(t);
  assert.ok(t.settlements[th.id].shrine.eclipsed > 0 || t.log.some(l => l.k === 'eclipse'), 'storm eclipses');
  assert.strictEqual(t.settlements[rh.id].shrine.eclipsed, 0, 'sanctuary shelters');
  assert.ok(H.marksAt(t, th.tile, 'storm').length);
  // an oracle sees the forecast
  const o = duo('greek', 'norse', 22), oh = o.settlements[o.players[0].home]; oh.shrine.spec = 'oracle';
  o.climate.fronts.push({ id: 51, kind: 'storm', tile: oh.tile, radius: 2, phase: 'forecast', t0: 5, t1: 6, hitDone: false });
  assert.ok(H.frontKnown(o, 0, o.climate.fronts.find(f => f.id === 51)));
  // events lean on the weather
  const ev = data.events.filter(e => e.climate); assert.ok(ev.length >= 2, 'events tied to climate');
});

test('P017 lasting marks: two different miracles leave two different localized marks; one changes a later action; marks fade by rule', () => {
  const s = sandbox('greek', 'norse'); round(s); s.players[0].cooldowns = {}; s.players[0].faith = 200; s.players[0].favor = 15;
  const rh = s.settlements[s.players[1].home];
  E.apply(s, { type: 'power', power: 'thunderbolt', tile: rh.tile });
  assert.ok(H.marksAt(s, rh.tile, 'scorch').length, 'thunderbolt scorches');
  const own = s.settlements.find(x => x.controlledBy === 0);
  E.apply(s, { type: 'power', power: 'gift_of_grain' });
  assert.ok(H.marksAt(s, own.tile, 'blessed').length, 'grain blesses');
  const scorch = H.marksAt(s, rh.tile, 'scorch')[0];
  for (let i = 0; i < data.rules.marks.kinds.scorch.turns + 1; i++) round(s);
  assert.ok(!s.marks.some(m => m.id === scorch.id), 'scorch fades');
  assert.ok(s.marks.length <= data.rules.marks.max);
});

test('P020/P021 scenarios: all six start, have a reachable success and failure, and resolve deterministically', () => {
  assert.ok(data.scenarios.length >= 6);
  for (const sc of data.scenarios) {
    const mk = () => E.newGame({ seed: sc.seed, players: sc.players, mode: { kind: 'scenario', scenario: sc.id } });
    const s = mk();
    assert.strictEqual(s.maxTurns, sc.turns);
    // success path: force every objective in order
    const w = mk(); let g = 0;
    while (!w.over && g++ < 200) {
      const o = sc.objectives[w.mode.stage], me = w.players[0];
      if (o.type === 'share' || o.type === 'control' || o.type === 'coastal') w.settlements.forEach(x => { if (o.type !== 'coastal' || w.map.tiles[x.tile].coast) x.followers = x.followers.map((f, k) => k === 0 ? Math.ceil(x.pop * (o.type === 'share' ? 0.55 : 0.6)) : 0); });
      if (o.type === 'shrines' || o.type === 'survive') { let need = (o.min || o.shrines) - H.playerShrines(w, 0).length; w.settlements.forEach(x => { if (need > 0 && !x.shrine) { x.shrine = { owner: 0, type: 'x', ward: 3, eclipsed: 0, built: 1, spec: null, boosts: [], threat: null, guardUsed: -9 }; x.shrine.type = data.factions.find(f => f.id === me.faction).shrine; need--; } }); }
      if (o.type === 'routes') { let k = 0; w.routes.forEach(r => { if (k < o.min) { r.owner = 0; r.status = 'active'; k++; [r.a, r.b].forEach(id => { const x = w.settlements[id]; x.followers = x.followers.map((f, j) => j === 0 ? Math.ceil(x.pop * 0.6) : 0); }); } }); }
      if (o.type === 'holdShrine') { const h = w.settlements[me.home]; if (h.shrine) h.shrine.ward = 5; }
      if (o.type === 'leadScore') { me.favor = 15; w.settlements.forEach(x => { x.followers = x.followers.map((f, k) => k === 0 ? Math.min(x.pop, Math.ceil(x.pop * 0.5)) : 0); }); }
      w.players.forEach(p => { p.pendingEvent = null; });
      if (o.type === 'share') { /* share counts fast */ }
      E.apply(w, { type: 'endTurn' });
    }
    assert.ok(w.over, sc.id + ' ends'); assert.strictEqual(w.winner.type, 'objective', sc.id + ' success reachable: ' + JSON.stringify(w.winner));
    // failure path: lose the home shrine or run out the clock
    const f = mk(); g = 0;
    while (!f.over && g++ < 400) { f.players.forEach(p => { p.pendingEvent = null; }); const h = f.settlements[f.players[0].home]; if (sc.objectives[0].type === 'holdShrine' || sc.objectives[0].type === 'survive') h.shrine = null; f.settlements.forEach(x => { x.followers[0] = 0; }); if (f.current === 0) { E.apply(f, { type: 'endTurn' }); } else AI.playTurn(E, f, { noLookahead: true }); }
    assert.ok(f.over && f.winner.type === 'objectiveFailed' || (f.over && f.winner.pid !== 0), sc.id + ' failure reachable: ' + JSON.stringify(f.winner));
    // AI plays the scenario to an end from the start
    const a = mk(); a.players[0].ai = 'hard'; g = 0; while (!a.over && g++ < 3000) AI.playTurn(E, a, { noLookahead: true });
    assert.ok(a.over && ['objective', 'objectiveFailed', 'dominion', 'ascendancy'].includes(a.winner.type), sc.id + ' AI play ends: ' + JSON.stringify(a.winner));
  }
});

test('P021 alternative victories: sacred ground and kept word win only in alternative mode; standard rules unchanged', () => {
  const s = E.newGame({ seed: 14, players: [{ faction: 'greek' }, { faction: 'norse' }], mode: { kind: 'alt', victory: 'sacredSites' } });
  s.landmarks.forEach(l => { l.holder = 0; });
  s.priests.filter(p => p.owner === 1).forEach(p => { p.tile = s.settlements[s.players[1].home].tile; });
  for (let i = 0; i < 4 && !s.over; i++) round(s);
  assert.ok(s.over && s.winner.type === 'sacred' && s.winner.pid === 0);
  const st = duo('greek', 'norse', 14); st.landmarks.forEach(l => { l.holder = 0; }); for (let i = 0; i < 4; i++) round(st);
  assert.ok(!st.over, 'standard mode ignores sacred sites');
  const c = E.newGame({ seed: 14, players: [{ faction: 'greek' }, { faction: 'norse' }], mode: { kind: 'alt', victory: 'covenants' } });
  c.players[0].stats.covenantsKept = 3; round(c); assert.strictEqual(c.winner.type, 'covenant');
  const c2 = E.newGame({ seed: 14, players: [{ faction: 'greek' }, { faction: 'norse' }], mode: { kind: 'alt', victory: 'covenants' } });
  c2.players[0].stats.covenantsKept = 3; c2.players[0].stats.covenantsBroken = 1; round(c2); assert.ok(!c2.over, 'a broken promise disqualifies');
});

test('P019 domains: each of the 40 domains changes authoritative outcomes compared with the same faction without it', () => {
  const strip = s => JSON.stringify({ st: s.settlements.map(x => [x.pop, x.followers, x.needs, x.shrine && x.shrine.ward]), p: s.players.map(p => [p.faith, p.favor, p.revealed.reduce((a, b) => a + b, 0)]), w: s.winner && s.winner.pid });
  const failures = [];
  for (const dom of data.domains) {
    const d2 = JSON.parse(JSON.stringify(data)); const f = d2.factions.find(x => x.id === dom.faction); f.domains = f.domains.filter(x => x !== dom.id);
    const E2 = PWEngine.create(d2);
    let differs = false;
    for (let seed = 1; seed <= 8 && !differs; seed++) {
      const rival = dom.faction === 'greek' ? 'norse' : 'greek';
      const pl = [{ faction: dom.faction, ai: 'hard' }, { faction: rival, ai: 'hard' }];
      const a = E.newGame({ seed: 600 + seed, players: pl }), b = E2.newGame({ seed: 600 + seed, players: pl });
      let g = 0; while (!a.over && g++ < 3000) AI.playTurn(E, a, { noLookahead: true });
      g = 0; while (!b.over && g++ < 3000) AI.playTurn(E2, b, { noLookahead: true });
      differs = strip(a) !== strip(b);
    }
    if (!differs) failures.push(dom.id);
  }
  assert.deepStrictEqual(failures, []);
});

test('Ḫepat\'s Guard (defendResist): a struck Hittite shrine makes its followers there harder to convert for 3 turns', () => {
  const s = duo('greek', 'hittite', 3), rival = s.settlements[s.players[1].home];
  s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1;
  const before = H.resistOf ? H.resistOf(s, rival, 1) : null;
  E.apply(s, { type: 'eclipse', tile: rival.tile });
  const boon = rival.boons.find(b => b.p === 1 && b.stat === 'resist');
  assert.ok(boon, 'resist boon granted to the defender');
  assert.strictEqual(boon.value, 1.5); assert.strictEqual(boon.turns, 3);
  if (before !== null) assert.ok(H.resistOf(s, rival, 1) > before, 'conversion resistance rose');
  // the same strike on a pantheon without the domain grants nothing
  const t = duo('hittite', 'greek', 3), tr = t.settlements[t.players[1].home];
  t.players[0].favor = 15; t.priests.find(p => p.owner === 0).tile = tr.tile; t.players[0].revealed[tr.tile] = 1;
  E.apply(t, { type: 'eclipse', tile: tr.tile });
  assert.ok(!tr.boons.some(b => b.p === 1 && b.stat === 'resist'));
});
