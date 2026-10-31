// Shared fixtures for the Node test suite.
const loadData = require('../tools/load-data.js');
const PWEngine = require('../engine/engine.js'), AI = require('../engine/ai.js');
const data = loadData(), E = PWEngine.create(data), H = E.helpers;
const IDS = data.factions.map(f => f.id);

function playOut(seed, players, opts) {
  const s = E.newGame(Object.assign({ seed, players }, opts || {}));
  let g = 0; while (!s.over && g++ < 5000) AI.playTurn(E, s);
  return s;
}
/* A rich hand-built position for faction `fac`: everything revealed, plenty of Faith/Favor, a priest of ours standing in the rival's
 * home (contested), our followers in a waterside town, a damaged and eclipsed shrine of ours, an active route and a drought front. */
function sandbox(fac, rivalFac, seed) {
  const s = E.newGame({ seed: seed || 21, players: [{ faction: fac }, { faction: rivalFac || (fac === 'greek' ? 'norse' : 'greek') }] });
  const me = s.players[0]; me.faith = 300; me.favor = 15;
  const home = s.settlements[me.home], rivalHome = s.settlements[s.players[1].home];
  // know the home region and the rival's home, leave the rest in fog so revelation powers have work to do
  s.map.tiles.forEach(t => { if (H.dist(s, t.id, home.tile) <= 5 || H.dist(s, t.id, rivalHome.tile) <= 2) me.revealed[t.id] = 1; });
  const pr = s.priests.find(p => p.owner === 0); pr.tile = rivalHome.tile;
  rivalHome.followers[0] = 1; rivalHome.followers[1] = Math.min(rivalHome.followers[1], rivalHome.pop - 2);
  // our followers in every other settlement within 4 of home, and control of the nearest two
  const near = s.settlements.filter(x => x !== home && x !== rivalHome).sort((a, b) => H.dist(s, a.tile, home.tile) - H.dist(s, b.tile, home.tile));
  near.slice(0, 5).forEach((x, i) => { x.followers[0] = i < 2 ? Math.ceil(x.pop * 0.6) : 1; if (i < 2) x.followers[1] = 0; });
  // a rival foothold in our home so contested/rivalInfluenced targets exist near us too
  home.followers[1] = 1;
  home.shrine.ward = 1; home.shrine.eclipsed = 2; home.pop = Math.max(2, home.pop - 2); home.needs.prosperity = 2;
  for (let i = 0; i < 2; i++) { const pp = H.playerPriests(s, 0)[0]; } // keep priest count
  E.helpers; // no-op, explicit
  // route between home and a near town
  s.routes.forEach(r => { if ((r.a === home.id || r.b === home.id) && r.owner < 0) { const o = s.settlements[r.a === home.id ? r.b : r.a]; o.followers[0] = Math.max(o.followers[0], 1); } });
  const rt = s.routes.find(r => r.a === home.id || r.b === home.id); if (rt) { rt.owner = 0; rt.status = 'active'; rt.since = 1; }
  s.climate.fronts.push({ id: 99, kind: 'drought', tile: home.tile, radius: 2, phase: 'active', t0: 1, t1: 3, hitDone: true });
  s.settlements.forEach(x => { if (x.pop < x.peak) return; });
  home.peak = home.pop + 3;
  // update control silently by running a no-op validation (control is recomputed on the next apply)
  return s;
}
module.exports = { data, E, H, AI, IDS, playOut, sandbox, loadData, PWEngine };
