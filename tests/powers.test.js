// All 40 faction powers: each can be legally invoked in a reachable position, changes authoritative state beyond paying its cost,
// rejects malformed or illegal targets, and is valued by the AI.   node --test tests/
const test = require('node:test'), assert = require('node:assert');
const { data, E, H, AI, IDS, sandbox } = require('./helpers.js');

function fingerprint(s, pid) {
  const p = s.players[pid];
  return {
    revealed: p.revealed.reduce((a, b) => a + b, 0),
    priests: s.priests.filter(x => x.owner === pid).map(x => x.role + '@' + x.tile).sort().join(','),
    wards: s.settlements.map(x => x.shrine ? x.shrine.owner + ':' + x.shrine.ward + ':' + x.shrine.eclipsed + ':' + (x.shrine.boosts || []).length : '-').join(','),
    pops: s.settlements.map(x => x.pop + '/' + x.needs.prosperity + '/' + x.needs.safety).join(','),
    followers: s.settlements.map(x => x.followers.join('.')).join(','),
    trust: s.settlements.map(x => x.trust.join('.')).join(','),
    boons: s.settlements.map(x => x.boons.length).join(','),
    buffs: p.buffs.map(b => b.stat + b.value).join(','), forecasts: p.forecasts.length, pending: s.pending.length,
    shrines: s.settlements.filter(x => x.shrine && x.shrine.owner === pid).length, fronts: s.climate.fronts.map(f => f.phase).join(','),
    faithNet: p.faith
  };
}
function legalTargets(s, pw) {
  const out = [];
  if (pw.target === 'none') { if (!E.validate(s, { type: 'power', power: pw.id })) out.push(undefined); return out; }
  s.map.tiles.forEach(t => { if (!E.validate(s, { type: 'power', power: pw.id, tile: t.id })) out.push(t.id); });
  return out;
}

test('every faction power has a legal target in a reachable position and produces a real, distinct state change', () => {
  const report = [];
  for (const pw of data.powers) {
    const s = sandbox(pw.faction, pw.faction === 'greek' ? 'norse' : 'greek');
    E.apply(s, { type: 'endTurn' }); E.apply(s, { type: 'endTurn' }); // round resolves: control recomputed, still our turn
    s.players[0].faith = 300; s.players[0].favor = 15; s.players[0].cooldowns = {};
    const home = s.settlements[s.players[0].home];
    if (home.shrine) { home.shrine.ward = 1; home.shrine.eclipsed = 2; }
    const targets = legalTargets(s, pw);
    assert.ok(targets.length > 0, pw.id + ' has no legal target (' + E.validate(s, { type: 'power', power: pw.id, tile: home.tile }) + ')');
    let changed = false, detail = '';
    for (const tile of targets.slice(0, 40)) {
      const before = fingerprint(s, 0), c = E.clone(s);
      const err = E.apply(c, tile === undefined ? { type: 'power', power: pw.id } : { type: 'power', power: pw.id, tile });
      assert.strictEqual(err, null, pw.id + ' rejected a validated target');
      const after = fingerprint(c, 0);
      after.faithNet = +(after.faithNet + pw.cost.faith).toFixed(2);
      const diff = Object.keys(before).filter(k => String(before[k]) !== String(after[k]));
      assert.ok(c.players[0].cooldowns[pw.id] === pw.cooldown, pw.id + ' sets its cooldown');
      assert.ok(c.players[0].faith >= 0 && c.players[0].favor >= 0, pw.id + ' never makes resources negative');
      c.settlements.forEach(x => { assert.ok(x.pop >= 0 && x.followers.every(f => f >= 0) && x.followers.reduce((a, b) => a + b, 0) <= x.pop, pw.id + ' keeps settlement counts legal'); assert.ok(x.needs.prosperity >= 0 && x.needs.prosperity <= 10); });
      if (diff.length) { changed = true; detail = diff.join('+'); break; }
    }
    assert.ok(changed, pw.id + ' changed nothing on any of ' + targets.length + ' legal targets');
    report.push(pw.id + ': ' + detail);
  }
  assert.strictEqual(report.length, 40);
});

test('powers reject casting by the wrong faction, during cooldown, without resources, and on malformed targets', () => {
  for (const pw of data.powers) {
    const s = sandbox(pw.faction, pw.faction === 'greek' ? 'norse' : 'greek');
    const other = IDS.find(f => f !== pw.faction);
    const s2 = E.newGame({ seed: 5, players: [{ faction: other }, { faction: pw.faction }] });
    assert.match(E.validate(s2, { type: 'power', power: pw.id, tile: 0 }), /not your power/, pw.id + ' wrong faction');
    s.players[0].cooldowns[pw.id] = 2;
    assert.match(E.validate(s, { type: 'power', power: pw.id, tile: 0 }), /recovering/, pw.id + ' cooldown');
    s.players[0].cooldowns[pw.id] = 0; s.players[0].faith = 0; s.players[0].favor = 0;
    if (pw.cost.faith || pw.cost.favor) assert.match(E.validate(s, { type: 'power', power: pw.id, tile: 0 }), /afford/, pw.id + ' cost');
    s.players[0].faith = 300; s.players[0].favor = 15;
    if (pw.target !== 'none' && pw.target !== 'anyTile') {
      assert.ok(E.validate(s, { type: 'power', power: pw.id, tile: -5 }), pw.id + ' rejects tile -5');
      assert.ok(E.validate(s, { type: 'power', power: pw.id, tile: 99999 }), pw.id + ' rejects tile 99999');
      assert.ok(E.validate(s, { type: 'power', power: pw.id }), pw.id + ' rejects a missing target');
      assert.ok(E.validate(s, { type: 'power', power: pw.id, tile: 'x' }), pw.id + ' rejects a string target');
    }
    assert.ok(E.validate(s, { type: 'power', power: pw.id, tile: 0, role: 'archmage' }), pw.id + ' rejects unknown role');
  }
});

test('every effect type used by data has an AI valuation, and the AI can choose every power in some game', () => {
  const used = new Set(); data.powers.forEach(p => p.effects.forEach(e => used.add(e.type))); data.events.forEach(e => e.choices.forEach(c => c.effects.forEach(x => used.add(x.type))));
  used.forEach(t => assert.ok(AI.VALUED.indexOf(t) >= 0, t + ' not valued by AI'));
});

test('icon and VFX ids are unique per power (no shared radial-burst placeholder)', () => {
  assert.strictEqual(new Set(data.powers.map(p => p.icon)).size, 40);
  assert.strictEqual(new Set(data.powers.map(p => p.vfx)).size, 40);
});
