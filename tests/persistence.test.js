// Saves, imports, migrations and replays (P023, P024, P025, A006).
const test = require('node:test'), assert = require('node:assert');
const path = require('path');
const { data, E, H, AI, playOut, loadData } = require('./helpers.js');
const S = require('../ui/storage.js');
function memLS(limit) { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { if (limit && JSON.stringify(m).length + v.length > limit) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
function midGame(seed) {
  const pl = [{ faction: 'hittite', human: true }, { faction: 'yoruba', ai: 'hard' }, { faction: 'japanese', ai: 'easy' }];
  const s = E.newGame({ seed, players: pl });
  let g = 0; while (s.turn < 18 && g++ < 3000) AI.playTurn(E, s);
  return s;
}

test('save -> close -> restore resumes the exact turn, resources, covenants, grudges, weather and hash', () => {
  const s = midGame(1234);
  assert.ok(s.covenants.length || s.climate.fronts.length || s.players.some(p => p.grudge.some(x => x)), 'the position carries living-world state');
  const rec = S.makeRecord(E, s, { label: 'test' });
  const json = JSON.stringify(rec);
  const back = S.restore(E, JSON.parse(json));
  assert.ok(back.state, back.error);
  assert.strictEqual(E.hash(back.state), E.hash(s));
  assert.deepStrictEqual(back.state.covenants, s.covenants); assert.deepStrictEqual(back.state.climate, s.climate);
  assert.deepStrictEqual(back.state.players.map(p => p.grudge), s.players.map(p => p.grudge));
  assert.strictEqual(back.state.turn, s.turn); assert.strictEqual(back.state.players[0].faith, s.players[0].faith);
});
test('a full game persists and replays to the same final hash, including scenario and alternative modes', () => {
  for (const cfg of [{ seed: 77, players: [{ faction: 'vedic' }, { faction: 'irish' }] },
                     { seed: 314, players: data.scenarios[0].players, mode: { kind: 'scenario', scenario: data.scenarios[0].id } },
                     { seed: 15, players: [{ faction: 'mexica' }, { faction: 'greek' }], mode: { kind: 'alt', victory: 'sacredSites' } }]) {
    const s = E.newGame(cfg); let g = 0; while (!s.over && g++ < 4000) AI.playTurn(E, s);
    const rec = S.makeRecord(E, s, {});
    const r = S.restore(E, JSON.parse(JSON.stringify(rec)));
    assert.ok(r.state, r.error); assert.strictEqual(E.hash(r.state), E.hash(s)); assert.ok(r.state.over);
  }
});
test('damaged, foreign, newer and tampered files are refused with a reason and never become a valid match', () => {
  const s = midGame(55), rec = S.makeRecord(E, s, {});
  assert.match(S.parseImport('{not json').error, /not valid JSON/);
  assert.match(S.parseImport('{"hello":1}').error, /not a Pantheon Wars/);
  const newer = JSON.parse(JSON.stringify(rec)); newer.schema = 9; assert.match(S.check(newer), /newer version/);
  const tamper = JSON.parse(JSON.stringify(rec)); tamper.actions[3].a.tile = 0; assert.match(S.check(tamper), /checksum/);
  // a hand-made (re-checksummed) poisoned replay: illegal action, wrong player, unknown faction, version mismatch
  const fix = r => { delete r.checksum; r.checksum = S.fnv(JSON.stringify(r)); return r; };
  const ill = fix(Object.assign(JSON.parse(JSON.stringify(rec)), { actions: [{ p: 0, a: { type: 'eclipse', tile: 0 } }], finalHash: null }));
  assert.match(S.restore(E, ill).error, /illegal/);
  const wrong = fix(Object.assign(JSON.parse(JSON.stringify(rec)), { actions: [{ p: 2, a: { type: 'endTurn' } }], finalHash: null }));
  assert.match(S.restore(E, wrong).error, /wrong god/);
  const fac = JSON.parse(JSON.stringify(rec)); fac.cfg.players[1].faction = 'atlantis'; fix(fac); assert.match(S.restore(E, fac).error, /unknown pantheon/);
  const ver = JSON.parse(JSON.stringify(rec)); ver.engine = '0.9.0'; fix(ver); assert.match(S.restore(E, ver).error, /cannot be replayed/);
  const hm = JSON.parse(JSON.stringify(rec)); hm.finalHash = 'deadbeef'; fix(hm); const r = S.restore(E, hm); assert.match(r.error, /hash mismatch/); assert.ok(r.mismatch);
});
test('slot storage writes atomically, keeps a backup, recovers from corruption, reports quota, and namespaces cross-tab conflicts', () => {
  const ls = memLS(), store = new S.Store(ls, 'tabA');
  const s = midGame(66), rec = S.makeRecord(E, s, { session: 'tabA' });
  assert.ok(store.write('slot1', rec).ok);
  assert.ok(store.read('slot1').record);
  const rec2 = S.makeRecord(E, s, { session: 'tabA', label: 'second' }); store.write('slot1', rec2);
  ls.setItem('pw.save.slot1', '{"broken": tru');
  const rd = store.read('slot1'); assert.ok(rd.recovered && rd.record.label === '', 'backup recovered');
  assert.ok(!ls.getItem('pw.save.slot1.tmp'));
  const small = new S.Store(memLS(2000), 'tabQ'); const q = small.write('slot2', rec); assert.match(q.error, /full|large/);
  // another tab writes later to the same manual slot -> conflict reported, not silently overwritten
  const other = new S.Store(ls, 'tabB'); other.loadedAt = 0; const recB = S.makeRecord(E, s, { session: 'tabB', created: new Date(Date.now() + 5000).toISOString() }); other.write('slot3', recB, { force: true });
  store.loadedAt = Date.now() - 1000; const c = store.write('slot3', rec); assert.ok(c.conflict);
  const ca = store.write('auto', rec); assert.ok(ca.ok); other.write('auto', recB, { force: true }); store.loadedAt = Date.now() - 1000; const cb = store.write('auto', rec); assert.ok(cb.ok && cb.slot === 'auto.tabA', 'autosave namespaced to this tab');
});
test('A006: a v0.1 replay is recognised and replayed by the frozen legacy engine to its recorded hash', () => {
  const fx = require('./fixtures/v0.1-e2e-seed11.json');
  assert.ok(S.isLegacy(fx));
  assert.match(S.restore(E, fx).error, /legacy/);
  const L = require('../engine/legacy/engine-v0.1.js').create(loadData(path.join(__dirname, '..', 'data', 'legacy', 'v0.1')));
  const r = S.restoreLegacy(L, fx); assert.ok(r.state, r.error); assert.strictEqual(L.hash(r.state), '6a3687d9');
  // the same actions do NOT reproduce under v0.2 rules: that is reported, never claimed identical
  let st = E.newGame({ seed: fx.seed, players: fx.players }), bad = -1;
  for (let i = 0; i < fx.actions.length; i++) { if (E.apply(st, fx.actions[i].a)) { bad = i; break; } }
  assert.ok(bad >= 0 || E.hash(st) !== fx.hash, 'v0.2 rules diverge from v0.1 (expected and documented)');
});
test('P024 challenge exchange: a seed+config+actions file reproduces the final hash; the short code round-trips the setup', () => {
  const s = playOut(4040, [{ faction: 'irish', human: true }, { faction: 'mesopotamian', human: true }]);
  const rec = S.makeRecord(E, s, { kind: 'challenge' });
  const r = S.restore(E, JSON.parse(JSON.stringify(rec))); assert.strictEqual(E.hash(r.state), E.hash(s));
  const code = S.challengeCode(rec), cfg = S.readChallengeCode(code);
  assert.deepStrictEqual(cfg.players.map(p => p.faction), ['irish', 'mesopotamian']); assert.strictEqual(cfg.seed, 4040);
  assert.ok(code.length < 200, 'short code');
  assert.strictEqual(S.readChallengeCode('%%%'), null);
  assert.match(S.exportName(rec), /^pantheon-wars-challenge-seed4040-irish-mesopotamian-t\d+\.json$/);
});
test('P025 chronicle reconstruction: turn 1, a middle turn and the last turn match per-turn hashes recorded during play, without touching the live game', () => {
  const pl = [{ faction: 'greek' }, { faction: 'vedic' }, { faction: 'hittite' }];
  const s = E.newGame({ seed: 2025, players: pl }), hashes = { 1: E.hash(s) };
  let g = 0; while (!s.over && g++ < 4000) { const t = s.turn; AI.playTurn(E, s); if (s.turn !== t && !s.over) hashes[s.turn] = E.hash(s); }
  const C = require('../ui/chronicle.js');
  const rec = S.makeRecord(E, s, { turnHashes: hashes, kind: 'chronicle' });
  const live = E.hash(s);
  const book = C.reconstruct(E, rec);
  assert.ok(!book.error, book.error);
  [1, Math.floor(s.turn / 2), s.turn].forEach(t => { assert.ok(book.checkpoints[t], 'checkpoint ' + t); if (hashes[t]) assert.strictEqual(E.hash(book.checkpoints[t]), hashes[t], 'turn ' + t); });
  assert.strictEqual(book.mismatches.length, 0);
  assert.strictEqual(E.hash(s), live, 'live game untouched');
  assert.strictEqual(E.hash(book.final), live);
  const scores = book.scores; assert.strictEqual(scores.length, Object.keys(book.checkpoints).length); assert.strictEqual(scores[0].length, 3);
  const ev = C.decisiveEvents(book, 7); assert.ok(ev.length >= 3 && ev.length <= 7, 'between 3 and 7 consequential events');
  ev.forEach(e => assert.ok(book.final.log.some(l => l.id === e.id), 'every tapestry event exists in the history'));
});
