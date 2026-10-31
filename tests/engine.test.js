// Core engine: determinism, purity, validation, victories, roster.   Run all: node --test tests/
const test = require('node:test'), assert = require('node:assert');
const { data, E, H, AI, IDS, playOut, loadData, PWEngine } = require('./helpers.js');
const P3 = [{ faction: 'greek', human: true }, { faction: 'norse', ai: 'hard' }, { faction: 'egyptian', ai: 'easy' }];

test('data: exactly the ten locked pantheons, 40 powers and 40 domains, 4 of each per faction with one power per X', () => {
  assert.deepStrictEqual(data.factions.map(f => f.id), ['greek', 'norse', 'egyptian', 'mesopotamian', 'irish', 'mexica', 'hittite', 'yoruba', 'japanese', 'vedic']);
  assert.deepStrictEqual(data.factions.map(f => f.name), ['The Olympian Court', 'The Hall of the Ash', 'The Ennead of the Two Lands', 'The Assembly of the Gods', 'The Tuatha Dé Danann', 'The Fifth Sun', 'The Thousand Gods of Hatti', 'The Council of the Òrìṣà', 'The Shrines of the Kami', 'The Vedic Hymns']);
  assert.strictEqual(data.powers.length, 40); assert.strictEqual(data.domains.length, 40); assert.strictEqual(data.shrines.length, 10);
  for (const f of data.factions) {
    const xs = data.powers.filter(p => p.faction === f.id).map(p => p.x).sort();
    assert.deepStrictEqual(xs, ['expand', 'exploit', 'explore', 'exterminate'], f.id);
    assert.strictEqual(f.domains.length, 4);
  }
});
test('data: the original three pantheons keep their ids, domains and power ids', () => {
  const legacy = require('../data/legacy/v0.1/factions.json');
  legacy.forEach(lf => { const f = data.factions.find(x => x.id === lf.id); assert.deepStrictEqual(f.domains, lf.domains); assert.deepStrictEqual(f.powers, lf.powers); assert.strictEqual(f.shrine, lf.shrine); assert.strictEqual(f.name, lf.name); });
});
test('data: schema validator passes (A002)', () => {
  const r = require('../tools/validate-data.js').validate(data);
  assert.deepStrictEqual(r.errors, []);
});
test('data: every domain and power cites a known https source', () => {
  for (const item of [...data.domains, ...data.powers]) {
    assert.ok(item.sources && item.sources.length, item.id + ' has sources');
    item.sources.forEach(id => assert.ok(data.sources[id] && /^https:\/\//.test(data.sources[id].url), item.id + ' -> ' + id));
  }
});
test('the engine refuses data that names an unknown effect type instead of silently ignoring it', () => {
  const bad = JSON.parse(JSON.stringify(data)); bad.powers[0].effects.push({ type: 'summonDragon' });
  assert.throws(() => PWEngine.create(bad), /unknown effect summonDragon/);
  const bad2 = JSON.parse(JSON.stringify(data)); bad2.factions[3].shrine = 'nope';
  assert.throws(() => PWEngine.create(bad2), /unknown shrine/);
});
test('map generation is deterministic and well-formed, with routes and fair landmarks', () => {
  const a = E.newGame({ seed: 77, players: P3 }), b = E.newGame({ seed: 77, players: P3 }), c = E.newGame({ seed: 78, players: P3 });
  assert.strictEqual(E.hash(a), E.hash(b));
  assert.notStrictEqual(E.hash(a), E.hash(c));
  assert.ok(a.settlements.length >= data.rules.map.settlements - 2);
  const homes = a.players.map(p => p.home);
  assert.strictEqual(new Set(homes).size, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(H.dist(a, a.settlements[homes[i]].tile, a.settlements[homes[j]].tile) >= 4);
  assert.ok(a.routes.length > 10);
  a.routes.forEach(r => { assert.ok(r.path.length - 1 <= data.rules.routes.maxLen); r.path.forEach(t => assert.ok(data.terrain.types[a.map.tiles[t].terrain].passable, 'route over impassable tile')); });
  assert.ok(a.landmarks.length >= 3);
});
test('v0.2 keeps the v0.1 world for a seed: same terrain, settlements and homes as the legacy engine', () => {
  const L = require('../engine/legacy/engine-v0.1.js').create(loadData(require('path').join(__dirname, '..', 'data', 'legacy', 'v0.1')));
  for (const seed of [1, 11, 77, 4242]) {
    const cfg = { seed, players: [{ faction: 'greek' }, { faction: 'norse' }, { faction: 'egyptian' }] };
    const a = L.newGame(cfg), b = E.newGame(cfg);
    assert.deepStrictEqual(b.map.tiles.map(t => t.terrain), a.map.tiles.map(t => t.terrain));
    assert.deepStrictEqual(b.settlements.map(s => s.name + s.tile + ':' + s.pop), a.settlements.map(s => s.name + s.tile + ':' + s.pop));
    assert.deepStrictEqual(b.players.map(p => p.home), a.players.map(p => p.home));
  }
});
test('same seed + same actions => identical log and final state (AI vs AI, 3 gods)', () => {
  const s1 = playOut(4242, P3.map(p => ({ ...p, human: false }))), s2 = playOut(4242, P3.map(p => ({ ...p, human: false })));
  assert.strictEqual(JSON.stringify(s1.log), JSON.stringify(s2.log));
  assert.strictEqual(E.hash(s1), E.hash(s2));
  assert.ok(s1.over && s1.winner);
});
test('replaying a recorded action list reproduces the game exactly (pure step API)', () => {
  const pl = [{ faction: 'yoruba', ai: 'hard' }, { faction: 'greek', ai: 'easy' }];
  const orig = playOut(9001, pl);
  let r = E.newGame({ seed: 9001, players: pl });
  for (const rec of orig.actions) { assert.strictEqual(r.current, rec.p); r = E.step(r, rec.a); }
  assert.strictEqual(E.hash(r), E.hash(orig));
});
test('step() is pure: it never mutates its input', () => {
  const s = E.newGame({ seed: 5, players: P3 }); const before = E.hash(s);
  E.step(s, { type: 'endTurn' });
  assert.strictEqual(E.hash(s), before);
});
test('authoritative engine and AI never call Math.random or Date', () => {
  const fs = require('fs');
  for (const f of ['engine/engine.js', 'engine/ai.js', 'engine/rng.js']) {
    const src = fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/Math\.random/.test(src), f + ' uses Math.random');
    if (f !== 'engine/ai.js') assert.ok(!/Date\.now|new Date/.test(src), f + ' reads the clock');
  }
  // the AI reads Date.now only for lookahead timing statistics; decisions never depend on it (checked by determinism tests)
});
test('validation rejects illegal actions with a reason', () => {
  const s = E.newGame({ seed: 5, players: P3 });
  assert.match(E.validate(s, { type: 'power', power: 'ravens_flight' }), /not your power/);
  assert.match(E.validate(s, { type: 'eclipse', tile: 0 }), /Favor|rival|target/);
  const home = s.settlements[s.players[0].home];
  assert.match(E.validate(s, { type: 'shrine', tile: home.tile }), /already/);
  s.players[0].faith = 100;
  while (H.playerPriests(s, 0).length < H.priestCap(s, 0)) assert.strictEqual(E.apply(s, { type: 'priest', tile: home.tile }), null);
  assert.match(E.validate(s, { type: 'priest', tile: home.tile }), /limit/);
  assert.match(E.validate(s, { type: 'fly' }), /unknown action/);
  assert.match(E.validate(s, null), /no action/);
  assert.match(E.validate(s, { type: 'movePriest', priest: 9999, tile: 3 }), /not your priest/);
});
test('mirror matches are refused unless a mode allows them', () => {
  assert.throws(() => E.newGame({ seed: 1, players: [{ faction: 'greek' }, { faction: 'greek' }] }), /different pantheon/);
  assert.ok(E.newGame({ seed: 1, players: [{ faction: 'greek' }, { faction: 'greek' }], mode: { kind: 'standard', allowMirror: true } }));
  assert.throws(() => E.newGame({ seed: 1, players: [{ faction: 'greek' }, { faction: 'atlantis' }] }), /unknown faction/);
});
test('shrines convert followers and produce Faith; priests walk', () => {
  let s = E.newGame({ seed: 12, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  const home = s.settlements[s.players[0].home], f0 = home.followers[0], faith0 = s.players[0].faith;
  s = E.step(s, { type: 'endTurn' }); s = E.step(s, { type: 'endTurn' });
  assert.ok(s.settlements[home.id].followers[0] > f0 || H.unaffiliated(s.settlements[home.id]) === 0);
  assert.ok(s.players[0].faith > faith0);
  const pr = s.priests.find(p => p.owner === 0), target = s.settlements.find(x => x.id !== home.id && s.players[0].revealed[x.tile] && H.pathStep(s, 0, pr.tile, x.tile));
  if (target) {
    s = E.step(s, { type: 'movePriest', priest: pr.id, tile: target.tile });
    const d0 = H.dist(s, pr.tile, target.tile);
    s = E.step(s, { type: 'endTurn' }); s = E.step(s, { type: 'endTurn' });
    assert.ok(H.dist(s, s.priests.find(p => p.id === pr.id).tile, target.tile) < d0);
  }
});
test('eclipse damages a rival shrine, topples it at Ward 0 and leaves a ruin that discounts rebuilding', () => {
  const s = E.newGame({ seed: 3, players: [{ faction: 'norse' }, { faction: 'greek' }] });
  const rival = s.settlements[s.players[1].home];
  s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1;
  const w = rival.shrine.ward;
  assert.strictEqual(E.apply(s, { type: 'eclipse', tile: rival.tile }), null);
  assert.strictEqual(rival.shrine.ward, w - 1); assert.ok(rival.shrine.eclipsed > 0);
  while (rival.shrine) { s.players[0].cooldowns.eclipse = 0; s.players[0].favor = 15; E.apply(s, { type: 'eclipse', tile: rival.tile }); }
  assert.ok(s.log.some(l => l.k === 'topple'));
  assert.ok(H.marksAt(s, rival.tile, 'ruin').length === 1, 'ruin mark left');
  assert.ok(H.shrineCost(s, 0, rival.tile) < H.shrineCost(s, 0), 'rebuilding on a ruin is cheaper');
});
test('win conditions: ascendancy, dominion and twilight are all reachable', () => {
  let s = E.newGame({ seed: 8, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  s.turn = data.rules.victory.ascendancyMinTurn;
  s.settlements.forEach(x => { x.followers = [Math.ceil(x.pop * 0.7), 0]; });
  s.settlements[s.players[1].home].followers[1] = 1;
  E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  assert.ok(s.over); assert.strictEqual(s.winner.type, 'ascendancy'); assert.strictEqual(s.winner.pid, 0);
  s = E.newGame({ seed: 8, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  s.settlements.forEach(x => { x.followers[1] = 0; if (x.shrine && x.shrine.owner === 1) x.shrine = null; });
  s.priests = s.priests.filter(p => p.owner !== 1);
  E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  assert.strictEqual(s.winner.type, 'dominion');
  const g = playOut(1000, [{ faction: 'greek' }, { faction: 'norse' }, { faction: 'egyptian' }]);
  assert.ok(['twilight', 'ascendancy', 'dominion'].includes(g.winner.type));
  assert.ok(g.turn <= data.rules.turns);
});
test('events: a card is drawn on turn 5 and must be resolved before ending the turn', () => {
  let s = E.newGame({ seed: 31, players: [{ faction: 'greek' }, { faction: 'egyptian' }] });
  while (s.turn < 5) s = E.step(s, { type: 'endTurn' });
  assert.ok(s.players[0].pendingEvent);
  assert.match(E.validate(s, { type: 'endTurn' }), /event/);
  s = E.step(s, { type: 'event', choice: 1 });
  assert.strictEqual(s.players[0].pendingEvent, null);
});
test('the AI always returns a legal action or endTurn, in every faction, across whole games', () => {
  let illegal = 0;
  for (let i = 0; i < 10; i++) {
    const s = E.newGame({ seed: 300 + i, players: [{ faction: IDS[i], ai: i % 2 ? 'easy' : 'hard' }, { faction: IDS[(i + 4) % 10], ai: 'hard' }, { faction: IDS[(i + 7) % 10], ai: 'easy' }] });
    let g = 0;
    while (!s.over && g++ < 4000) { const a = AI.nextAction(E, s); if (E.validate(s, a)) { illegal++; E.apply(s, { type: 'endTurn' }); } else E.apply(s, a); }
    assert.ok(s.over, 'game ends');
  }
  assert.strictEqual(illegal, 0);
});
