#!/usr/bin/env node
// Ablation study: how much of a pantheon's strength comes from each domain and power? Removes one piece at a time (a domain is dropped,
// a power is disabled with cooldown 999) and measures that pantheon's duel and FFA win rates on the same fixed seeds.
//   node tools/ablate.js greek [seedsPerDuel=6]
const { loadData, PWEngine, AI } = require('../tests/helpers.js');
const fac = process.argv[2], K = +(process.argv[3] || 6);
const base = loadData(), ids = base.factions.map(f => f.id).filter(x => x !== fac);
function measure(data) {
  const E = PWEngine.create(data); let w2 = 0, n2 = 0, w3 = 0, n3 = 0, seed = 1;
  ids.forEach((o, oi) => { for (let k = 0; k < K; k++) { const seat = k % 2, pl = seat ? [{ faction: o }, { faction: fac }] : [{ faction: fac }, { faction: o }];
    const s = E.newGame({ seed: 4000 + seed++, players: pl }); let g = 0; while (!s.over && g++ < 4000) AI.playTurn(E, s, { noLookahead: true }); n2++; if (s.players[s.winner.pid].faction === fac) w2++;
    const o2 = ids[(oi + 3) % ids.length], pl3 = [{ faction: fac }, { faction: o }, { faction: o2 }]; for (let r = 0; r < k % 3; r++) pl3.push(pl3.shift());
    const t = E.newGame({ seed: 7000 + seed, players: pl3 }); g = 0; while (!t.over && g++ < 4000) AI.playTurn(E, t, { noLookahead: true }); n3++; if (t.players[t.winner.pid].faction === fac) w3++; } });
  return { duel: (100 * w2 / n2).toFixed(0), ffa: (100 * w3 / n3).toFixed(0) };
}
const f0 = base.factions.find(f => f.id === fac);
console.log('baseline', JSON.stringify(measure(base)));
f0.domains.forEach(d => { const data = JSON.parse(JSON.stringify(base)); const f = data.factions.find(x => x.id === fac); f.domains = f.domains.filter(x => x !== d); console.log('without domain', d.padEnd(24), JSON.stringify(measure(data))); });
f0.powers.forEach(p => { const data = JSON.parse(JSON.stringify(base)); data.powers.find(x => x.id === p).cooldown = 999; data.powers.find(x => x.id === p).cost.faith = 9999; console.log('without power ', p.padEnd(24), JSON.stringify(measure(data))); });
