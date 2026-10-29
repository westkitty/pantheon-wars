// Run: node --test tests/*.test.js
const test = require('node:test'), assert = require('node:assert');
const loadData = require('../tools/load-data.js');
const PWEngine = require('../engine/engine.js'), AI = require('../engine/ai.js');
const data = loadData(), E = PWEngine.create(data), H = E.helpers;
const P3 = [{ faction: 'greek', human: true }, { faction: 'norse', ai: 'hard' }, { faction: 'egyptian', ai: 'easy' }];

function playOut(seed, players) {
  let s = E.newGame({ seed, players });
  while (!s.over) AI.playTurn(E, s);
  return s;
}

test('data: 12 powers, 4 per faction, one of each X', () => {
  assert.strictEqual(data.powers.length, 12);
  for (const f of data.factions) {
    const xs = data.powers.filter(p => p.faction === f.id).map(p => p.x).sort();
    assert.deepStrictEqual(xs, ['expand', 'exploit', 'explore', 'exterminate']);
    assert.strictEqual(f.domains.length, 4);
  }
});
test('data: every domain and power cites a known source', () => {
  for (const item of [...data.domains, ...data.powers]) {
    assert.ok(item.sources && item.sources.length, item.id + ' has sources');
    item.sources.forEach(id => assert.ok(data.sources[id] && /^https:\/\//.test(data.sources[id].url), item.id + ' -> ' + id));
  }
});
test('map generation is deterministic and well-formed', () => {
  const a = E.newGame({ seed: 77, players: P3 }), b = E.newGame({ seed: 77, players: P3 }), c = E.newGame({ seed: 78, players: P3 });
  assert.strictEqual(E.hash(a), E.hash(b));
  assert.notStrictEqual(E.hash(a), E.hash(c));
  assert.ok(a.settlements.length >= data.rules.map.settlements - 2);
  const homes = a.players.map(p => p.home);
  assert.strictEqual(new Set(homes).size, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(H.dist(a, a.settlements[homes[i]].tile, a.settlements[homes[j]].tile) >= 4);
});
test('same seed + same actions => identical log and final state (AI vs AI, 3 gods)', () => {
  const s1 = playOut(4242, P3.map(p => ({ ...p, human: false }))), s2 = playOut(4242, P3.map(p => ({ ...p, human: false })));
  assert.strictEqual(JSON.stringify(s1.log), JSON.stringify(s2.log));
  assert.strictEqual(E.hash(s1), E.hash(s2));
  assert.ok(s1.over && s1.winner);
});
test('replaying a recorded action list reproduces the game exactly (pure step API)', () => {
  const orig = playOut(9001, [{ faction: 'egyptian', ai: 'hard' }, { faction: 'greek', ai: 'easy' }]);
  let r = E.newGame({ seed: 9001, players: [{ faction: 'egyptian', ai: 'hard' }, { faction: 'greek', ai: 'easy' }] });
  for (const rec of orig.actions) { assert.strictEqual(r.current, rec.p); r = E.step(r, rec.a); }
  assert.strictEqual(E.hash(r), E.hash(orig));
});
test('step() is pure: it never mutates its input', () => {
  const s = E.newGame({ seed: 5, players: P3 }); const before = E.hash(s);
  E.step(s, { type: 'endTurn' });
  assert.strictEqual(E.hash(s), before);
});
test('validation rejects illegal actions with a reason', () => {
  const s = E.newGame({ seed: 5, players: P3 });
  assert.match(E.validate(s, { type: 'power', power: 'ravens_flight' }), /not your power/);
  assert.match(E.validate(s, { type: 'eclipse', tile: 0 }), /Favor|rival|target/);
  const home = s.settlements[s.players[0].home];
  assert.match(E.validate(s, { type: 'shrine', tile: home.tile }), /already/);
  assert.strictEqual(E.apply(s, { type: 'priest', tile: home.tile }), null); // cap = 1 + 1 shrine = 2, one exists
  s.players[0].faith = 100;
  assert.match(E.validate(s, { type: 'priest', tile: home.tile }), /limit/);
});
test('shrines convert followers and produce Faith; priests walk', () => {
  let s = E.newGame({ seed: 12, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  const home = s.settlements[s.players[0].home], f0 = home.followers[0], faith0 = s.players[0].faith;
  s = E.step(s, { type: 'endTurn' }); s = E.step(s, { type: 'endTurn' });
  assert.ok(home.followers[0] <= s.settlements[home.id].followers[0]);
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
test('eclipse damages a rival shrine, topples it at Ward 0', () => {
  const s = E.newGame({ seed: 3, players: [{ faction: 'norse' }, { faction: 'greek' }] });
  const rival = s.settlements[s.players[1].home];
  s.players[0].favor = 15; s.priests.find(p => p.owner === 0).tile = rival.tile; s.players[0].revealed[rival.tile] = 1; // a priest stands at the rival shrine
  const w = rival.shrine.ward;
  assert.strictEqual(E.apply(s, { type: 'eclipse', tile: rival.tile }), null);
  assert.strictEqual(rival.shrine.ward, w - 1); assert.ok(rival.shrine.eclipsed > 0);
  s.players[0].cooldowns.eclipse = 0;
  while (rival.shrine) { s.players[0].cooldowns.eclipse = 0; s.players[0].favor = 15; E.apply(s, { type: 'eclipse', tile: rival.tile }); }
  assert.ok(s.log.some(l => l.k === 'topple'));
});
test('every one of the 12 powers can be validly invoked in some reachable state', () => {
  for (const pw of data.powers) {
    const fac = pw.faction, s = E.newGame({ seed: 21, players: [{ faction: fac }, { faction: fac === 'greek' ? 'norse' : 'greek' }] });
    const me = s.players[0]; me.faith = 200; me.favor = 15;
    s.players[0].revealed = s.players[0].revealed.map(() => 1);
    const rivalHome = s.settlements[s.players[1].home];
    s.priests.find(p => p.owner === 0).tile = rivalHome.tile;
    rivalHome.followers[0] = 1; rivalHome.followers[1] = Math.min(rivalHome.followers[1], rivalHome.pop - 1);
    const candidates = [undefined, ...s.map.tiles.map(t => t.id)];
    const tile = candidates.find(t => !E.validate(s, { type: 'power', power: pw.id, tile: t }));
    assert.ok(tile !== undefined || pw.target === 'none', pw.id + ' has a valid target');
    assert.strictEqual(E.apply(s, { type: 'power', power: pw.id, tile }), null, pw.id);
    assert.ok(me.cooldowns[pw.id] > 0);
  }
});
test('win conditions: ascendancy, dominion and twilight are all reachable', () => {
  // ascendancy: hand one god 70% of all mortals
  let s = E.newGame({ seed: 8, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  s.turn = data.rules.victory.ascendancyMinTurn;
  s.settlements.forEach(x => { x.followers = [Math.ceil(x.pop * 0.7), 0]; });
  s.settlements[s.players[1].home].followers[1] = 1;
  E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  assert.ok(s.over); assert.strictEqual(s.winner.type, 'ascendancy'); assert.strictEqual(s.winner.pid, 0);
  // dominion: rival has nothing
  s = E.newGame({ seed: 8, players: [{ faction: 'greek' }, { faction: 'norse' }] });
  s.settlements.forEach(x => { x.followers[1] = 0; if (x.shrine && x.shrine.owner === 1) x.shrine = null; });
  s.priests = s.priests.filter(p => p.owner !== 1);
  E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' });
  assert.strictEqual(s.winner.type, 'dominion');
  // twilight: full AI game reaching turn 45 without other wins
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
test('hard AI beats easy AI in mirror duels more often than not', () => {
  let hard = 0, n = 24;
  for (let i = 0; i < n; i++) {
    const f = ['greek', 'norse', 'egyptian'][i % 3], hs = i % 2;
    const s = playOut(700 + i, [0, 1].map(k => ({ faction: f, ai: k === hs ? 'hard' : 'easy' })));
    if (s.players[s.winner.pid].ai === 'hard') hard++;
  }
  assert.ok(hard / n > 0.6, 'hard won ' + hard + '/' + n);
});

test('a new pantheon can be added purely as data and plays full games (backlog: data-only pantheons)', () => {
  const data = JSON.parse(JSON.stringify(loadData()));
  const id = 'testland';
  const doms = ['sky_oath', 'order', 'inundation', 'thunder'].map((d, i) => Object.assign({}, data.domains.find(x => x.id === d), { id: id + '_d' + i, faction: id }));
  const pows = ['barque_of_re', 'throne_of_isis', 'rain_and_sun', 'hammer_thunder'].map((p, i) => Object.assign({}, data.powers.find(x => x.id === p), { id: id + '_p' + i, faction: id }));
  const shrine = Object.assign({}, data.shrines[0], { id: id + '_shrine', faction: id, art: 'ziggurat' });
  data.domains.push(...doms); data.powers.push(...pows); data.shrines.push(shrine);
  data.factions.push(Object.assign({}, data.factions[0], { id, name: 'Test Assembly', emblem: 'eight_pointed_star', shrine: shrine.id, domains: doms.map(d => d.id), powers: pows.map(p => p.id) }));
  const E2 = PWEngine.create(data);
  for (let g = 0; g < 6; g++) {
    const s = E2.newGame({ seed: 900 + g, players: [{ faction: id, ai: 'hard' }, { faction: g % 2 ? 'norse' : 'egyptian', ai: 'hard' }] });
    let guard = 0; while (!s.over && guard++ < 5000) AI.playTurn(E2, s);
    assert.ok(s.over, 'game finished');
    const used = Object.keys(s.players[0].stats.powers).length;
    assert.ok(used >= 2, 'the new pantheon used its own powers (' + used + ')');
  }
});
